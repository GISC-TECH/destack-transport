"""
Serviço para calcular distância em KM entre origem e destino.

Combina:
- Nominatim: geocodificação gratuita de cidade/UF.
- OSRM: cálculo de rota entre coordenadas.

Fallback: se não conseguir calcular pela rota, retorna None para não
prejudicar métricas com valores incorretos.
"""
import logging

from .nominatim_service import geocodificar
from .rota_service import calcular_rota_osrm

logger = logging.getLogger(__name__)


def calcular_distancia_cidade_uf(cidade_origem, uf_origem, cidade_destino, uf_destino):
    """
    Calcula distância em KM entre duas cidades/UF usando Nominatim + OSRM.

    Args:
        cidade_origem: Nome da cidade de origem.
        uf_origem: Sigla do estado de origem.
        cidade_destino: Nome da cidade de destino.
        uf_destino: Sigla do estado de destino.

    Returns:
        int/None: distância em KM arredondada, ou None se não for possível calcular.
    """
    if not cidade_origem or not cidade_destino:
        logger.debug("Cidade de origem ou destino não informada.")
        return None

    coords_origem = geocodificar(cidade_origem, uf_origem)
    if not coords_origem:
        logger.warning(f"Não foi possível geocodificar origem: {cidade_origem}/{uf_origem}")
        return None

    coords_destino = geocodificar(cidade_destino, uf_destino)
    if not coords_destino:
        logger.warning(f"Não foi possível geocodificar destino: {cidade_destino}/{uf_destino}")
        return None

    pontos = [
        {
            "latitude": coords_origem["latitude"],
            "longitude": coords_origem["longitude"],
            "descricao": f"{cidade_origem}/{uf_origem}",
        },
        {
            "latitude": coords_destino["latitude"],
            "longitude": coords_destino["longitude"],
            "descricao": f"{cidade_destino}/{uf_destino}",
        },
    ]

    resultado = calcular_rota_osrm(pontos)
    if resultado.get("erro"):
        logger.warning(f"OSRM não retornou rota: {resultado['erro']}")
        return None

    distancia_km = resultado.get("distancia_km")
    if distancia_km is None:
        return None

    return int(round(float(distancia_km)))
