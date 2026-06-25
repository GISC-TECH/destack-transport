# transport/services/numeracao_service.py
"""
Serviço de controle de numeração/série para CT-e e MDF-e.

Responsabilidades:
- Gerar/retornar o próximo número disponível para uma combinação
  CNPJ emitente + modelo + série.
- Verificar se um número já foi utilizado por outro documento (duplicidade).
- Registrar o número de um documento processado com sucesso.
"""

import logging

from django.db import transaction

from ..models import ControleNumeracao, CTeDocumento, MDFeDocumento

logger = logging.getLogger(__name__)


MODELO_CTE = ControleNumeracao.MODELO_CTE
MODELO_MDFE = ControleNumeracao.MODELO_MDFE


def _normalizar_serie(serie):
    """Remove zeros à esquerda da série, mantendo-a como string."""
    if serie is None:
        return ''
    serie_str = str(serie).strip().lstrip('0')
    return serie_str or '0'


def _normalizar_cnpj(cnpj):
    """Retorna apenas os dígitos do CNPJ."""
    if cnpj is None:
        return ''
    return ''.join(filter(str.isdigit, str(cnpj)))


def extrair_dados_numeracao_da_chave(chave):
    """
    Extrai CNPJ emitente, modelo, série e número a partir da chave de acesso
    de 44 dígitos (layout padrão de documentos fiscais eletrônicos brasileiros).

    Layout da chave:
      0-1   : Código da UF
      2-5   : Ano/Mês de emissão
      6-19  : CNPJ do emitente (14 dígitos)
      20-21 : Modelo
      22-24 : Série
      25-33 : Número do documento
      34-41 : Código numérico
      42    : Dígito verificador

    Retorna dict ou None caso a chave seja inválida.
    """
    chave_limpa = ''.join(filter(str.isdigit, str(chave)))
    if len(chave_limpa) != 44:
        return None

    cnpj = chave_limpa[6:20]
    modelo = chave_limpa[20:22]
    serie = _normalizar_serie(chave_limpa[22:25])
    try:
        numero = int(chave_limpa[25:34])
    except ValueError:
        return None

    return {
        'cnpj_emitente': cnpj,
        'modelo': modelo,
        'serie': serie,
        'numero': numero,
    }


def mapear_modelo_para_choice(modelo):
    """
    Converte o código numérico do modelo para a constante do ControleNumeracao.

    CTe => modelo 57
    MDFe => modelo 58
    """
    if str(modelo) in ('57', 'CTe'):
        return MODELO_CTE
    if str(modelo) in ('58', 'MDFe'):
        return MODELO_MDFE
    return None


def proximo_numero(cnpj, modelo, serie):
    """
    Retorna o próximo número disponível para a combinação informada.

    Args:
        cnpj (str): CNPJ do emitente (somente dígitos).
        modelo (str): 'CTe' ou 'MDFe' (ou código numérico '57'/'58').
        serie (str): Série do documento.

    Returns:
        int: Próximo número sugerido.
    """
    cnpj = _normalizar_cnpj(cnpj)
    modelo_choice = mapear_modelo_para_choice(modelo)
    serie = _normalizar_serie(serie)

    if not cnpj or not modelo_choice:
        return 1

    controle, _ = ControleNumeracao.objects.get_or_create(
        cnpj_emitente=cnpj,
        modelo=modelo_choice,
        serie=serie,
        defaults={'ultimo_numero': 0},
    )
    return controle.ultimo_numero + 1


def verificar_duplicidade(cnpj, modelo, serie, numero, chave_atual=None):
    """
    Verifica se já existe outro CT-e ou MDF-e com o mesmo
    CNPJ emitente + modelo + série + número.

    Args:
        cnpj (str): CNPJ do emitente.
        modelo (str): 'CTe' ou 'MDFe' (ou código numérico '57'/'58').
        serie (str/int): Série do documento.
        numero (int): Número do documento.
        chave_atual (str, optional): Chave do documento sendo processado.
            Ignorada na verificação para permitir reprocessamento do mesmo XML.

    Returns:
        dict: {'duplicado': bool, 'chave_existente': str|None, 'modelo_doc': str|None}
    """
    cnpj = _normalizar_cnpj(cnpj)
    modelo_choice = mapear_modelo_para_choice(modelo)
    serie = _normalizar_serie(serie)
    chave_atual_limpa = ''.join(filter(str.isdigit, str(chave_atual))) if chave_atual else None

    if not cnpj or not modelo_choice or numero is None:
        return {'duplicado': False, 'chave_existente': None, 'modelo_doc': None}

    if modelo_choice == MODELO_CTE:
        queryset = CTeDocumento.objects.filter(
            identificacao__serie=serie,
            identificacao__numero=numero,
        ).select_related('identificacao')
    else:
        queryset = MDFeDocumento.objects.filter(
            identificacao__serie=serie,
            identificacao__n_mdf=numero,
        ).select_related('identificacao')

    if chave_atual_limpa:
        queryset = queryset.exclude(chave=chave_atual_limpa)

    for doc in queryset.iterator():
        dados_chave = extrair_dados_numeracao_da_chave(doc.chave)
        if dados_chave and dados_chave.get('cnpj_emitente') == cnpj:
            return {
                'duplicado': True,
                'chave_existente': doc.chave,
                'modelo_doc': 'CT-e' if modelo_choice == MODELO_CTE else 'MDF-e',
            }

    return {'duplicado': False, 'chave_existente': None, 'modelo_doc': None}


@transaction.atomic
def registrar_numero(cnpj, modelo, serie, numero):
    """
    Registra o número como utilizado, atualizando o controle se necessário.

    Args:
        cnpj (str): CNPJ do emitente.
        modelo (str): 'CTe' ou 'MDFe' (ou código numérico '57'/'58').
        serie (str/int): Série do documento.
        numero (int): Número utilizado.

    Returns:
        ControleNumeracao: Registro de controle atualizado.
    """
    cnpj = _normalizar_cnpj(cnpj)
    modelo_choice = mapear_modelo_para_choice(modelo)
    serie = _normalizar_serie(serie)

    if not cnpj or not modelo_choice or numero is None:
        return None

    controle, _ = ControleNumeracao.objects.get_or_create(
        cnpj_emitente=cnpj,
        modelo=modelo_choice,
        serie=serie,
        defaults={'ultimo_numero': 0},
    )

    if numero > controle.ultimo_numero:
        controle.ultimo_numero = numero
        controle.save(update_fields=['ultimo_numero'])

    return controle
