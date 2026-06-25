# transport/services/xml_utils.py
"""Utilitários seguros para parsing de XML.

Protege contra ataques XXE (XML External Entity) e XML bombs
(Billion Laughs / Quadratic Blowup) usando defusedxml e limites
de tamanho/profundidade.
"""

import io
import logging

from xml.etree.ElementTree import tostring

logger = logging.getLogger(__name__)

DEFAULT_MAX_XML_SIZE = 10 * 1024 * 1024  # 10 MB
DEFAULT_MAX_XML_DEPTH = 100


class XMLSecurityError(ValueError):
    """Erro levantado quando um XML é rejeitado por questões de segurança."""
    pass


try:
    from defusedxml import ElementTree as DefusedET
    from defusedxml import DefusedXmlException
except ImportError:  # pragma: no cover
    DefusedET = None
    DefusedXmlException = Exception


def _to_bytes(xml_input):
    """Normaliza entrada para bytes."""
    if isinstance(xml_input, str):
        return xml_input.encode("utf-8")
    return xml_input


def _get_text_size(xml_input):
    """Retorna o tamanho em bytes de uma string/bytes XML."""
    if isinstance(xml_input, str):
        return len(xml_input.encode("utf-8"))
    if isinstance(xml_input, (bytes, bytearray)):
        return len(xml_input)
    return None


def _count_depth(element):
    """Calcula a profundidade máxima da árvore XML."""
    max_depth = 0
    stack = [(element, 1)]
    while stack:
        elem, depth = stack.pop()
        if depth > max_depth:
            max_depth = depth
        for child in elem:
            stack.append((child, depth + 1))
    return max_depth


def validate_xml_size(xml_input, max_size=DEFAULT_MAX_XML_SIZE):
    """Rejeita XMLs maiores que o limite configurado."""
    size = _get_text_size(xml_input)
    if size is not None and size > max_size:
        raise XMLSecurityError(
            f"XML excede o tamanho maximo permitido de {max_size} bytes "
            f"({size} bytes recebidos)."
        )


def safe_xmltodict_parse(xml_input, max_size=DEFAULT_MAX_XML_SIZE,
                         max_depth=DEFAULT_MAX_XML_DEPTH, **kwargs):
    """
    Faz parsing seguro de XML via xmltodict.

    - Limita tamanho do XML (padrão 10MB).
    - Usa defusedxml para bloquear XXE e XML bombs.
    - Limita profundidade máxima da árvore (padrão 100).
    - Retorna o dicionário gerado pelo xmltodict.
    """
    if DefusedET is None:
        raise XMLSecurityError(
            "defusedxml nao esta instalado. Instale-o para parsing seguro de XML."
        )

    validate_xml_size(xml_input, max_size)

    try:
        tree = DefusedET.parse(io.BytesIO(_to_bytes(xml_input)))
    except DefusedXmlException as exc:
        raise XMLSecurityError(f"XML bloqueado por seguranca: {exc}") from exc
    except Exception as exc:
        raise XMLSecurityError(f"Falha ao validar XML: {exc}") from exc

    root = tree.getroot()

    depth = _count_depth(root)
    if depth > max_depth:
        raise XMLSecurityError(
            f"XML excede a profundidade maxima permitida de {max_depth} niveis "
            f"({depth} niveis encontrados)."
        )

    # A validacao com defusedxml ja bloqueou XXE, DTDs e XML bombs.
    # Usamos o XML original para preservar namespaces e garantir compatibilidade
    # com o xmltodict.
    import xmltodict
    return xmltodict.parse(xml_input, **kwargs)
