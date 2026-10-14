# transport/validators.py
"""
Validadores de documentos brasileiros (CPF, CNPJ, Inscrição Estadual)
e placas de veículos.
"""

import re
from django.core.exceptions import ValidationError


def normalizar_placa(placa):
    """
    Remove caracteres não alfanuméricos e retorna a placa em maiúsculas.

    Aceita formatos antigo (AAA-9999) e Mercosul (AAA-9A99). Retorna None
    se o valor for vazio.
    """
    if not placa:
        return None
    return re.sub(r'[^A-Z0-9]', '', str(placa).upper())


def _digitos_iguais(valor):
    """Verifica se todos os dígitos de uma string numérica são iguais."""
    return len(set(valor)) == 1


def _calcular_digito(cpf_cnpj, pesos):
    """Calcula um dígito verificador genérico a partir dos pesos informados."""
    soma = sum(int(digito) * peso for digito, peso in zip(cpf_cnpj, pesos))
    resto = soma % 11
    return '0' if resto < 2 else str(11 - resto)


def validar_cpf(cpf):
    """
    Valida um CPF utilizando os dígitos verificadores.

    Lança ValidationError caso o CPF seja inválido.
    """
    if not cpf:
        return

    cpf_limpo = re.sub(r'\D', '', str(cpf))

    if len(cpf_limpo) != 11:
        raise ValidationError('CPF deve ter 11 dígitos.')

    if _digitos_iguais(cpf_limpo):
        raise ValidationError('CPF inválido.')

    primeiro_digito = _calcular_digito(cpf_limpo[:9], range(10, 1, -1))
    if primeiro_digito != cpf_limpo[9]:
        raise ValidationError('CPF inválido.')

    segundo_digito = _calcular_digito(cpf_limpo[:10], range(11, 1, -1))
    if segundo_digito != cpf_limpo[10]:
        raise ValidationError('CPF inválido.')


def validar_cnpj(cnpj):
    """
    Valida um CNPJ utilizando os dígitos verificadores.

    Lança ValidationError caso o CNPJ seja inválido.
    """
    if not cnpj:
        return

    cnpj_limpo = re.sub(r'\D', '', str(cnpj))

    if len(cnpj_limpo) != 14:
        raise ValidationError('CNPJ deve ter 14 dígitos.')

    if _digitos_iguais(cnpj_limpo):
        raise ValidationError('CNPJ inválido.')

    pesos_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    primeiro_digito = _calcular_digito(cnpj_limpo[:12], pesos_1)
    if primeiro_digito != cnpj_limpo[12]:
        raise ValidationError('CNPJ inválido.')

    segundo_digito = _calcular_digito(cnpj_limpo[:13], pesos_2)
    if segundo_digito != cnpj_limpo[13]:
        raise ValidationError('CNPJ inválido.')


def validar_ie(ie, uf=None):
    """
    Validação básica de Inscrição Estadual.

    Remove caracteres não numéricos e verifica se contém apenas dígitos.
    Não realiza validação de dígito verificador por UF (cada estado possui
    uma regra própria). Se uma UF for informada, verifica se a IE está
    vazia para estados que isentam a IE (ex.: IE Isenta).

    Lança ValidationError caso a IE seja inválida.
    """
    if not ie:
        return

    ie_limpo = re.sub(r'\D', '', str(ie))

    if not ie_limpo:
        raise ValidationError('Inscrição Estadual inválida.')

    if len(ie_limpo) > 14:
        raise ValidationError('Inscrição Estadual deve ter no máximo 14 dígitos.')


class ValidadorDocumento:
    """Classe utilitária para agrupar as funções de validação."""

    CPF = staticmethod(validar_cpf)
    CNPJ = staticmethod(validar_cnpj)
    IE = staticmethod(validar_ie)
