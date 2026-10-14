"""
Servico centralizado para sincronizacao do status de pagamento.

Este modulo garante que CTeDocumento.pago, PagamentoAgregado.status
e PagamentoProprio.status sejam mantidos consistentes, independentemente
de onde a alteracao se origine (API de CT-e, API de pagamentos, Django Admin).
"""
from datetime import date, datetime
from typing import Optional

from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone

from transport.models import (
    CTeDocumento,
    ConfiguracaoEmpresa,
    Motorista,
    PagamentoAgregado,
    PagamentoProprio,
)
from .comunicacao_service import enviar_whatsapp


class ExclusividadePagamentoError(Exception):
    """Levantado quando um CT-e possui pagamento agregado e próprio simultaneamente."""
    pass


def _verificar_exclusividade_mutua(cte: CTeDocumento):
    """Garante que o CT-e não tenha pagamento agregado e próprio ao mesmo tempo."""
    tem_agregado = PagamentoAgregado.objects.filter(cte=cte).exists()
    tem_proprio = PagamentoProprio.objects.filter(cte=cte).exists()
    if tem_agregado and tem_proprio:
        raise ExclusividadePagamentoError(
            "CT-e não pode possuir pagamento agregado e próprio simultaneamente."
        )


def atualizar_status_pagamento_cte(
    cte: CTeDocumento,
    pago: bool,
    data_pagamento: Optional[date] = None,
    comprovante=None,
    observacao: Optional[str] = None,
    atualizar_pagamentos: bool = True,
    save_cte: bool = True,
):
    """
    Atualiza o status de pagamento de um CT-e e sincroniza os pagamentos
    agregado e proprio vinculados.

    Args:
        cte: Instancia de CTeDocumento.
        pago: Novo status de pagamento.
        data_pagamento: Data do pagamento. Se None e pago=True, usa a data atual.
        comprovante: Arquivo de comprovante (opcional).
        observacao: Observacao do pagamento (opcional).
        atualizar_pagamentos: Se True, sincroniza PagamentoAgregado/PagamentoProprio.
        save_cte: Se True, salva o CT-e no final.
    """
    if pago and data_pagamento is None:
        data_pagamento = timezone.now().date()

    cte.pago = pago
    # CTeDocumento.data_pagamento e DateTimeField; converte date para datetime aware
    if pago and data_pagamento:
        cte.data_pagamento = timezone.make_aware(
            datetime.combine(data_pagamento, datetime.min.time())
        )
    else:
        cte.data_pagamento = None

    if observacao is not None:
        cte.observacao_pagamento = observacao

    if comprovante is not None:
        cte.comprovante_pagamento = comprovante

    update_fields = ['pago', 'data_pagamento', 'observacao_pagamento']
    if comprovante is not None:
        update_fields.append('comprovante_pagamento')

    if save_cte:
        cte.save(update_fields=update_fields)

    if not atualizar_pagamentos:
        return

    status = 'pago' if pago else 'pendente'

    # Sincroniza PagamentoAgregado (OneToOne)
    try:
        pagamento = cte.pagamento_agregado
    except ObjectDoesNotExist:
        pagamento = None

    if pagamento:
        pagamento.status = status
        pagamento.data_pagamento = data_pagamento if pago else None
        pagamento.save(update_fields=['status', 'data_pagamento'])

    # Sincroniza PagamentoProprio (OneToOne)
    try:
        pagamento = cte.pagamento_proprio
    except ObjectDoesNotExist:
        pagamento = None

    if pagamento:
        pagamento.status = status
        pagamento.data_pagamento = data_pagamento if pago else None
        pagamento.save(update_fields=['status', 'data_pagamento'])


def sincronizar_status_pagamento_agregado(pagamento):
    """
    Sincroniza CTeDocumento.pago com base no status de PagamentoAgregado.
    Deve ser chamado apos alteracao do status do pagamento agregado.
    """
    if not pagamento.cte:
        return

    cte = pagamento.cte
    _verificar_exclusividade_mutua(cte)

    novo_pago = pagamento.status == 'pago'

    if cte.pago != novo_pago:
        cte.pago = novo_pago
        cte.data_pagamento = pagamento.data_pagamento if novo_pago else None
        cte.save(update_fields=['pago', 'data_pagamento'])


def sincronizar_status_pagamento_proprio(pagamento):
    """
    Sincroniza CTeDocumento.pago com base no status de PagamentoProprio.
    Deve ser chamado apos alteracao do status do pagamento proprio.
    """
    if not pagamento.cte:
        return

    cte = pagamento.cte
    _verificar_exclusividade_mutua(cte)

    novo_pago = pagamento.status == 'pago'

    if cte.pago != novo_pago:
        cte.pago = novo_pago
        cte.data_pagamento = pagamento.data_pagamento if novo_pago else None
        cte.save(update_fields=['pago', 'data_pagamento'])


def _formatar_moeda(valor):
    """Formata Decimal/float para string de moeda brasileira."""
    if valor is None:
        return 'R$ 0,00'
    return f"R$ {float(valor):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')


def _formatar_data(data):
    """Formata date/datetime para string dd/mm/aaaa."""
    if not data:
        return '-'
    if hasattr(data, 'strftime'):
        return data.strftime('%d/%m/%Y')
    return str(data)


def _buscar_motorista_do_pagamento(pagamento, tipo='agregado'):
    """Busca motorista vinculado ao pagamento, se houver."""
    if tipo == 'agregado':
        cpf = pagamento.condutor_cpf
        if cpf:
            return Motorista.objects.filter(cpf=cpf).first()
        return None

    # Próprio: tenta pelo CPF salvo, depois pelo veículo
    cpf = getattr(pagamento, 'motorista_cpf', None)
    if cpf:
        motorista = Motorista.objects.filter(cpf=cpf).first()
        if motorista:
            return motorista

    veiculo = pagamento.veiculo
    if veiculo:
        # Veiculo não tem FK para motorista; fallback para nome/cpf se houver
        pass

    return None


def montar_mensagem_pagamento(pagamento, tipo='agregado'):
    """Monta mensagem de notificação de pagamento para o gestor."""
    motorista = _buscar_motorista_do_pagamento(pagamento, tipo)

    if tipo == 'agregado':
        nome_motorista = pagamento.condutor_nome or (motorista.nome if motorista else 'Não identificado')
        cpf_motorista = pagamento.condutor_cpf or (motorista.cpf if motorista else '-')
        valor = pagamento.valor_repassado
        referencia = f"CT-e #{pagamento.cte.identificacao.numero}" if pagamento.cte else '-'
    else:
        nome_motorista = pagamento.motorista_nome or (motorista.nome if motorista else 'Não identificado')
        cpf_motorista = pagamento.motorista_cpf or (motorista.cpf if motorista else '-')
        valor = pagamento.valor_total_pagar
        referencia = f"Veículo {pagamento.veiculo.placa} - Período {pagamento.periodo}" if pagamento.veiculo else '-'

    chave_pix = motorista.chave_pix if motorista else None
    banco = motorista.banco if motorista else None
    conta = motorista.conta if motorista else None
    agencia = motorista.agencia if motorista else None
    favorecido = motorista.favorecido if motorista else None

    mensagem = (
        f"📢 *Novo pagamento a realizar*\n\n"
        f"*Tipo:* {'Agregado' if tipo == 'agregado' else 'Próprio'}\n"
        f"*Motorista:* {nome_motorista}\n"
        f"*CPF:* {cpf_motorista}\n"
        f"*Referência:* {referencia}\n"
        f"*Valor:* {_formatar_moeda(valor)}\n"
        f"*Data prevista:* {_formatar_data(pagamento.data_prevista)}\n\n"
    )

    if chave_pix:
        mensagem += f"💠 *Chave Pix:* `{chave_pix}`\n"
    if favorecido:
        mensagem += f"👤 *Favorecido:* {favorecido}\n"
    if banco:
        mensagem += f"🏦 *Banco:* {banco}\n"
    if agencia:
        mensagem += f"🔢 *Agência:* {agencia}\n"
    if conta:
        mensagem += f"💳 *Conta:* {conta}\n"

    if not chave_pix and not banco:
        mensagem += "\n⚠️ *Atenção:* motorista sem dados bancários/Pix cadastrados."

    mensagem += "\n_Favor realizar o repasse._"
    return mensagem


def notificar_gestor_pagamento(pagamento, tipo='agregado'):
    """
    Envia notificação WhatsApp para o gestor sobre um pagamento pendente.

    Args:
        pagamento: instância de PagamentoAgregado ou PagamentoProprio
        tipo: 'agregado' ou 'proprio'

    Returns:
        dict com 'status' e 'erro'
    """
    config = ConfiguracaoEmpresa.objects.first()
    if not config or not config.telefone_gestor:
        return {
            'status': 'falha',
            'erro': 'Telefone do gestor não configurado em Configurações > Dados da Empresa.',
        }

    mensagem = montar_mensagem_pagamento(pagamento, tipo)
    motorista = _buscar_motorista_do_pagamento(pagamento, tipo)
    return enviar_whatsapp(config.telefone_gestor, mensagem, motorista=motorista)
