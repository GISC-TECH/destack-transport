"""
Validacao de XMLs fiscais contra XSDs.

Por padrao usa XSDs minimos que verificam a estrutura raiz, namespace e
alguns campos obrigatorios do <ide>. XSDs oficiais podem ser colocados em
transport/xsd/ para validacao completa, mas os minimos garantem que XMLs
reais do EGS (inclusive processados como cteProc/mdfeProc) sejam aceitos.
"""
import logging
from pathlib import Path

from lxml import etree

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
XSD_DIR = BASE_DIR / 'xsd'

# Mapeamento por tag raiz para os XSDs a serem tentados (ordem importa).
XSD_MAP = {
    'CTe': [XSD_DIR / 'cte_v4.00_minimal.xsd'],
    'cteProc': [XSD_DIR / 'cte_proc_v4.00_minimal.xsd'],
    'MDFe': [
        XSD_DIR / 'mdfe_v3.00_minimal_MDFe.xsd',
        XSD_DIR / 'mdfe_v3.00_minimal.xsd',
    ],
    'mdfeProc': [
        XSD_DIR / 'mdfe_proc_v3.00_minimal_MDFe.xsd',
        XSD_DIR / 'mdfe_proc_v3.00_minimal.xsd',
    ],
    'eventoCTe': [XSD_DIR / 'evento_cte_minimal.xsd'],
    'procEventoCTe': [XSD_DIR / 'evento_cte_minimal.xsd'],
    'eventoMDFe': [XSD_DIR / 'evento_mdfe_minimal.xsd'],
    'procEventoMDFe': [XSD_DIR / 'evento_mdfe_minimal.xsd'],
}


def _get_xsd_paths(root_tag):
    paths = XSD_MAP.get(root_tag, [])
    found = [p for p in paths if p.exists()]
    if not found:
        logger.warning(f'XSD para tag {root_tag} nao encontrado. Validacao ignorada.')
        return None
    return found


def _detect_tipo_xml(root_tag):
    root_tag_lower = root_tag.lower()
    if 'cte' in root_tag_lower:
        return 'cte'
    if 'mdfe' in root_tag_lower:
        return 'mdfe'
    if 'evento' in root_tag_lower:
        return 'evento'
    return None


def validar_xml(xml_content, tipo=None):
    """
    Valida um XML contra o XSD correspondente.

    Args:
        xml_content: string ou bytes com o conteudo XML
        tipo: 'cte', 'mdfe' ou 'evento'. Se None, detecta automaticamente.

    Returns:
        dict: {'valido': bool, 'erros': list[str], 'tipo': str|None}
    """
    try:
        if isinstance(xml_content, str):
            xml_content = xml_content.encode('utf-8')

        root = etree.fromstring(xml_content)
        root_tag = etree.QName(root).localname

        if tipo is None:
            tipo = _detect_tipo_xml(root_tag)

        if tipo is None:
            return {
                'valido': False,
                'erros': [f'Tipo de XML nao reconhecido pela tag raiz: {root_tag}'],
                'tipo': None,
            }

        xsd_paths = _get_xsd_paths(root_tag)
        if xsd_paths is None:
            return {
                'valido': True,
                'erros': [],
                'tipo': tipo,
            }

        ultimos_erros = []
        for xsd_path in xsd_paths:
            with open(xsd_path, 'rb') as xsd_file:
                xsd_doc = etree.parse(xsd_file)
            schema = etree.XMLSchema(xsd_doc)
            try:
                schema.assertValid(root)
                return {
                    'valido': True,
                    'erros': [],
                    'tipo': tipo,
                }
            except etree.DocumentInvalid as e:
                ultimos_erros = [str(err) for err in e.error_log]
                continue

        return {
            'valido': False,
            'erros': ultimos_erros,
            'tipo': tipo,
        }

    except etree.XMLSyntaxError as e:
        return {
            'valido': False,
            'erros': [f'XML mal formado: {e}'],
            'tipo': tipo,
        }
    except Exception as e:
        logger.exception('Erro inesperado na validacao XSD')
        return {
            'valido': False,
            'erros': [f'Erro interno na validacao: {e}'],
            'tipo': tipo,
        }
