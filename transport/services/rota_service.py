"""
Serviço de roteirização e otimização de rotas.

Utiliza o OSRM (Open Source Routing Machine) público para cálculo de rotas.
O endpoint público é gratuito, sem chave de API, mas possui rate limits modestos.
Para produção com alto volume, recomenda-se instância própria do OSRM.
"""
import logging
from decimal import Decimal
from urllib.parse import urlencode

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org"
OSRM_TIMEOUT = int(getattr(settings, "OSRM_TIMEOUT", 15))


def _get_osrm_base_url():
    return getattr(settings, "OSRM_BASE_URL", DEFAULT_OSRM_BASE_URL).rstrip("/")


def _coordenada_para_osrm(lat, lon):
    """Formata coordenada no padrão lon,lat exigido pelo OSRM."""
    return f"{float(lon):.6f},{float(lat):.6f}"


def calcular_rota_osrm(pontos):
    """
    Calcula rota entre pontos usando OSRM /route/v1/driving/.

    pontos: lista de dicts {'latitude': float, 'longitude': float, 'descricao': str}
    Retorna: dict com distancia_km, duracao_min, geometria, waypoints ou {'erro': str}.
    """
    if len(pontos) < 2:
        return {"erro": "São necessários pelo menos dois pontos para calcular uma rota."}

    coords = ";".join(_coordenada_para_osrm(p["latitude"], p["longitude"]) for p in pontos)
    base_url = _get_osrm_base_url()
    url = f"{base_url}/route/v1/driving/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
    }

    try:
        response = requests.get(url, params=params, timeout=OSRM_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.Timeout:
        logger.warning("Timeout ao consultar OSRM")
        return {"erro": "Serviço de roteirização indisponível (timeout). Tente novamente."}
    except requests.exceptions.RequestException as exc:
        logger.warning("Erro na requisição ao OSRM: %s", exc)
        return {"erro": f"Erro ao consultar serviço de roteirização: {exc}"}

    if data.get("code") != "Ok" or not data.get("routes"):
        msg = data.get("message", "Resposta inválida do serviço de roteirização")
        logger.warning("OSRM retornou erro: %s", msg)
        return {"erro": msg}

    route = data["routes"][0]
    distancia_metros = route.get("distance", 0)
    duracao_segundos = route.get("duration", 0)
    geometry = route.get("geometry", {})
    legs = route.get("legs", [])

    # Monta waypoints ordenados com distância e duração entre eles
    waypoints = []
    for idx, ponto in enumerate(pontos):
        wp = {
            "ordem": idx,
            "latitude": float(ponto["latitude"]),
            "longitude": float(ponto["longitude"]),
            "descricao": ponto.get("descricao", f"Ponto {idx + 1}"),
        }
        if idx < len(legs):
            leg = legs[idx]
            wp["distancia_proximo_km"] = round(leg.get("distance", 0) / 1000, 2)
            wp["duracao_proximo_min"] = round(leg.get("duration", 0) / 60, 2)
        waypoints.append(wp)

    return {
        "distancia_km": Decimal(str(round(distancia_metros / 1000, 2))),
        "duracao_min": int(round(duracao_segundos / 60, 0)),
        "geometria": geometry,
        "waypoints": waypoints,
        "provedor": "osrm",
    }


def ordenar_pontos_otimizado(pontos):
    """
    Aplica heurística do vizinho mais próximo para otimizar a ordem de entregas.
    O primeiro ponto é fixo como origem; o restante é reordenado para minimizar
    distância em linha reta entre paradas consecutivas.

    Retorna nova lista de pontos ordenados.
    """
    if len(pontos) <= 2:
        return list(pontos)

    nao_visitados = pontos[1:]
    rota = [pontos[0]]
    atual = pontos[0]

    while nao_visitados:
        def distancia(p):
            return (
                (float(atual["latitude"]) - float(p["latitude"])) ** 2 +
                (float(atual["longitude"]) - float(p["longitude"])) ** 2
            )

        mais_proximo = min(nao_visitados, key=distancia)
        rota.append(mais_proximo)
        nao_visitados.remove(mais_proximo)
        atual = mais_proximo

    return rota
