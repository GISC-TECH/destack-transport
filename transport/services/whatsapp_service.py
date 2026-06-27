"""
Serviço de integração com Evolution API para envio de WhatsApp.

A Evolution API é uma solução self-hosted que permite enviar mensagens
via WhatsApp Web. Documentação: https://doc.evolution-api.com/

Endpoints utilizados (v2):
- POST /message/sendText/{instance}
- GET /instance/connect/{instance} (status/QR Code)
"""
import logging
import re

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def get_evolution_config():
    """
    Retorna configurações da Evolution API.

    Prioridade:
    1. Variáveis de ambiente / settings Django
    2. Fallback para valores vazios (serviço fica desabilitado)
    """
    return {
        'base_url': getattr(settings, 'EVOLUTION_API_URL', '').rstrip('/'),
        'api_key': getattr(settings, 'EVOLUTION_API_KEY', ''),
        'instance_name': getattr(settings, 'EVOLUTION_INSTANCE_NAME', 'destack'),
        'enabled': bool(
            getattr(settings, 'EVOLUTION_API_URL', '') and
            getattr(settings, 'EVOLUTION_API_KEY', '')
        ),
    }


def formatar_numero(numero):
    """
    Normaliza número de telefone para formato internacional.

    Remove tudo que não for dígito e garante prefixo 55 (Brasil) se não houver.
    """
    if not numero:
        return None

    digits = re.sub(r'\D', '', str(numero))

    # Se começar com 0, remove
    if digits.startswith('0') and len(digits) > 2:
        digits = digits[1:]

    # Se não tiver DDI, assume Brasil (55)
    if len(digits) <= 11 and not digits.startswith('55'):
        digits = f'55{digits}'

    return digits


def _headers(config):
    """Retorna headers padrão para requisições à Evolution API."""
    return {
        'Content-Type': 'application/json',
        'apikey': config['api_key'],
    }


def testar_conexao():
    """
    Testa se a Evolution API está acessível e a instância existe.

    Retorna dict com status e mensagem.
    """
    config = get_evolution_config()

    if not config['enabled']:
        return {
            'status': 'falha',
            'erro': 'Evolution API não configurada. Verifique EVOLUTION_API_URL e EVOLUTION_API_KEY.',
        }

    url = f"{config['base_url']}/instance/connect/{config['instance_name']}"

    try:
        response = requests.get(url, headers=_headers(config), timeout=10)
        if response.status_code == 200:
            data = response.json()
            state = data.get('state', 'UNKNOWN')
            return {
                'status': 'ok',
                'instancia': config['instance_name'],
                'estado': state,
                'mensagem': f"Instância '{config['instance_name']}' está {state}.",
            }
        return {
            'status': 'falha',
            'erro': f"Evolution API retornou {response.status_code}: {response.text[:200]}",
        }
    except requests.exceptions.Timeout:
        return {'status': 'falha', 'erro': 'Timeout ao conectar na Evolution API.'}
    except requests.exceptions.ConnectionError:
        return {'status': 'falha', 'erro': 'Não foi possível conectar à Evolution API.'}
    except Exception as exc:
        logger.exception("Erro inesperado ao testar conexão com Evolution API")
        return {'status': 'falha', 'erro': str(exc)}


def enviar_mensagem_texto(numero, texto, delay_ms=1200):
    """
    Envia uma mensagem de texto via Evolution API.

    Args:
        numero: número do destinatário (será normalizado)
        texto: conteúdo da mensagem
        delay_ms: delay simulado de digitação (padrão 1200ms)

    Returns:
        dict com 'status' ('enviado'|'falha'), 'erro' e 'response'
    """
    config = get_evolution_config()

    if not config['enabled']:
        erro = 'Evolution API não configurada. Verifique EVOLUTION_API_URL e EVOLUTION_API_KEY.'
        logger.warning(erro)
        return {'status': 'falha', 'erro': erro}

    numero_formatado = formatar_numero(numero)
    if not numero_formatado:
        return {'status': 'falha', 'erro': 'Número de destinatário inválido.'}

    url = f"{config['base_url']}/message/sendText/{config['instance_name']}"
    payload = {
        'number': numero_formatado,
        'text': texto,
        'options': {
            'delay': delay_ms,
            'presence': 'composing',
        },
    }

    try:
        response = requests.post(url, headers=_headers(config), json=payload, timeout=30)

        if response.status_code in (200, 201):
            logger.info("Mensagem WhatsApp enviada para %s", numero_formatado)
            return {
                'status': 'enviado',
                'response': response.json() if response.text else {},
            }

        erro = f"Evolution API retornou {response.status_code}: {response.text[:500]}"
        logger.warning(erro)
        return {'status': 'falha', 'erro': erro}

    except requests.exceptions.Timeout:
        erro = 'Timeout ao enviar mensagem WhatsApp.'
        logger.warning(erro)
        return {'status': 'falha', 'erro': erro}
    except requests.exceptions.ConnectionError:
        erro = 'Não foi possível conectar à Evolution API.'
        logger.warning(erro)
        return {'status': 'falha', 'erro': erro}
    except Exception as exc:
        logger.exception("Erro inesperado ao enviar mensagem WhatsApp")
        return {'status': 'falha', 'erro': str(exc)}


def enviar_imagem(numero, imagem_base64, legenda='', delay_ms=1200):
    """
    Envia uma imagem via Evolution API (base64).

    Args:
        numero: número do destinatário
        imagem_base64: string base64 da imagem (sem prefixo data URI)
        legenda: legenda opcional
        delay_ms: delay simulado

    Returns:
        dict com 'status' e 'erro'
    """
    config = get_evolution_config()

    if not config['enabled']:
        erro = 'Evolution API não configurada.'
        logger.warning(erro)
        return {'status': 'falha', 'erro': erro}

    numero_formatado = formatar_numero(numero)
    if not numero_formatado:
        return {'status': 'falha', 'erro': 'Número de destinatário inválido.'}

    url = f"{config['base_url']}/message/sendMedia/{config['instance_name']}"
    payload = {
        'number': numero_formatado,
        'media': imagem_base64,
        'caption': legenda,
        'mediatype': 'image',
        'fileName': 'imagem.jpg',
        'options': {
            'delay': delay_ms,
            'presence': 'composing',
        },
    }

    try:
        response = requests.post(url, headers=_headers(config), json=payload, timeout=30)

        if response.status_code in (200, 201):
            logger.info("Imagem WhatsApp enviada para %s", numero_formatado)
            return {'status': 'enviado', 'response': response.json() if response.text else {}}

        erro = f"Evolution API retornou {response.status_code}: {response.text[:500]}"
        logger.warning(erro)
        return {'status': 'falha', 'erro': erro}

    except requests.exceptions.Timeout:
        return {'status': 'falha', 'erro': 'Timeout ao enviar imagem WhatsApp.'}
    except requests.exceptions.ConnectionError:
        return {'status': 'falha', 'erro': 'Não foi possível conectar à Evolution API.'}
    except Exception as exc:
        logger.exception("Erro inesperado ao enviar imagem WhatsApp")
        return {'status': 'falha', 'erro': str(exc)}
