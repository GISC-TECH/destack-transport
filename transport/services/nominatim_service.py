"""
Serviço de geocodificação usando Nominatim (OpenStreetMap).

Gratuito, mas com limites de uso. Documentação recomenda:
- No máximo 1 requisição por segundo.
- User-Agent identificando a aplicação.
- Cache de resultados para reduzir requisições.

Mais informações: https://operations.osmfoundation.org/policies/nominatim/
"""
import logging
import time
from functools import lru_cache

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org"
DEFAULT_USER_AGENT = "DestackTransport/1.0"
DEFAULT_TIMEOUT = 15
DEFAULT_DELAY = 1.1  # segundos entre requisições

# Chave de cache para coordenadas geocodificadas
_CACHE_PREFIX = "nominatim:coords"
_CACHE_TIMEOUT = 60 * 60 * 24 * 30  # 30 dias


def _get_setting(name, default):
    return getattr(settings, name, default)


def _cache_key(query):
    """Gera chave de cache normalizada para a consulta."""
    normalized = query.strip().lower().replace(" ", "_")
    return f"{_CACHE_PREFIX}:{normalized}"


def _fetch_from_cache(query):
    """Busca coordenadas no cache Django (Redis)."""
    return cache.get(_cache_key(query))


def _save_to_cache(query, coordinates):
    """Salva coordenadas no cache Django (Redis)."""
    cache.set(_cache_key(query), coordinates, timeout=_CACHE_TIMEOUT)


_last_request_time = 0


def _throttle():
    """Garante intervalo mínimo entre requisições ao Nominatim."""
    global _last_request_time
    delay = _get_setting("NOMINATIM_DELAY_SECONDS", DEFAULT_DELAY)
    elapsed = time.time() - _last_request_time
    if elapsed < delay:
        time.sleep(delay - elapsed)
    _last_request_time = time.time()


def geocodificar(cidade, uf=None, pais="Brasil"):
    """
    Geocodifica uma cidade/UF em latitude/longitude.

    Args:
        cidade: Nome da cidade.
        uf: Sigla do estado (opcional, mas recomendado).
        pais: Nome do país (default: Brasil).

    Returns:
        dict: {'latitude': float, 'longitude': float} ou None em caso de erro.
    """
    if not cidade:
        return None

    partes = [cidade]
    if uf:
        partes.append(uf)
    partes.append(pais)
    query = ", ".join(partes)

    # Tenta cache
    cached = _fetch_from_cache(query)
    if cached:
        return cached

    base_url = _get_setting("NOMINATIM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    user_agent = _get_setting("NOMINATIM_USER_AGENT", DEFAULT_USER_AGENT)
    timeout = _get_setting("NOMINATIM_TIMEOUT", DEFAULT_TIMEOUT)

    url = f"{base_url}/search"
    params = {
        "q": query,
        "format": "json",
        "limit": 1,
        "countrycodes": "br",
    }
    headers = {"User-Agent": user_agent}

    try:
        _throttle()
        response = requests.get(url, params=params, headers=headers, timeout=timeout)
        response.raise_for_status()
        data = response.json()

        if not data:
            logger.warning(f"Nominatim não encontrou coordenadas para: {query}")
            return None

        resultado = data[0]
        coordinates = {
            "latitude": float(resultado["lat"]),
            "longitude": float(resultado["lon"]),
        }
        _save_to_cache(query, coordinates)
        return coordinates

    except requests.exceptions.Timeout:
        logger.warning(f"Timeout ao geocodificar '{query}' no Nominatim")
    except requests.exceptions.RequestException as exc:
        logger.warning(f"Erro ao geocodificar '{query}' no Nominatim: {exc}")
    except (ValueError, KeyError, TypeError) as exc:
        logger.warning(f"Resposta inválida do Nominatim para '{query}': {exc}")

    return None
