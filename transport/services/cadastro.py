"""
Sincronização de cadastros mestres a partir dos dados extraídos dos XMLs.

Hoje: auto-cadastro/vínculo de Motorista a partir do condutor de CT-e/MDF-e.
Antes esse cadastro era 100% manual; agora todo condutor que aparece num
documento entra automaticamente no cadastro (casado por CPF), com CNH e
validades em branco para o usuário completar depois.
"""
import logging

from django.db import IntegrityError
from transport.models import Motorista

logger = logging.getLogger(__name__)


def _so_digitos(valor):
    return ''.join(filter(str.isdigit, str(valor or '')))


def sincronizar_motorista(nome, cpf):
    """get_or_create do Motorista mestre a partir de um condutor do XML.

    Casa por CPF (11 dígitos, mesmo formato canônico do cadastro manual).
    Cria o motorista com o nome do XML e CNH/validades em branco, marcando
    cadastro_automatico=True. Não fabrica dados ausentes.

    Retorna a instância de Motorista ou None (CPF inválido/ausente).
    """
    cpf_digits = _so_digitos(cpf)
    if len(cpf_digits) != 11:
        return None

    nome_limpo = (nome or '').strip()[:255]

    mot = Motorista.objects.filter(cpf=cpf_digits).first()
    if mot:
        # Completa o nome se o cadastro estava sem nome (não sobrescreve manual).
        if nome_limpo and not (mot.nome or '').strip():
            mot.nome = nome_limpo
            mot.save(update_fields=['nome'])
        return mot

    if not nome_limpo:
        # Sem nome não criamos cadastro novo (evita registro vazio).
        return None

    try:
        return Motorista.objects.create(
            cpf=cpf_digits,
            nome=nome_limpo,
            cnh=None,
            cadastro_automatico=True,
        )
    except IntegrityError:
        # Corrida/condição rara: busca novamente antes de desistir.
        logger.warning("Corrida ao auto-cadastrar motorista CPF %s", cpf_digits)
        return Motorista.objects.filter(cpf=cpf_digits).first()
