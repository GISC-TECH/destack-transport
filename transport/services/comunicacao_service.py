"""
Serviço de comunicação para envio de e-mail e WhatsApp.

E-mail utiliza o backend configurado no Django (send_mail).
WhatsApp é um placeholder: quando houver gateway contratado (Twilio, Z-API,
Evolution API, etc.), implementar a chamada real na função _enviar_whatsapp.
"""
import logging
from datetime import datetime

from django.conf import settings
from django.core.mail import send_mail

from ..models import MensagemComunicacao

logger = logging.getLogger(__name__)


def enviar_email(destinatario, assunto, conteudo, cliente=None, motorista=None, ordem=None):
    """Envia e-mail e registra a comunicação no banco."""
    mensagem = MensagemComunicacao.objects.create(
        canal='email',
        destinatario=destinatario,
        assunto=assunto,
        conteudo=conteudo,
        cliente=cliente,
        motorista=motorista,
        ordem=ordem,
        status='pendente',
    )

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'webmaster@localhost')
    try:
        send_mail(
            subject=assunto,
            message=conteudo,
            from_email=from_email,
            recipient_list=[destinatario],
            fail_silently=False,
        )
        mensagem.status = 'enviado'
        mensagem.enviado_em = datetime.now()
        mensagem.save(update_fields=['status', 'enviado_em'])
        return {'status': 'enviado', 'id': str(mensagem.id)}
    except Exception as exc:
        logger.exception("Erro ao enviar e-mail para %s", destinatario)
        mensagem.status = 'falha'
        mensagem.erro = str(exc)
        mensagem.save(update_fields=['status', 'erro'])
        return {'status': 'falha', 'erro': str(exc), 'id': str(mensagem.id)}


def enviar_whatsapp(numero, conteudo, cliente=None, motorista=None, ordem=None):
    """
    Registra mensagem de WhatsApp e retorna status.
    A implementação real depende de gateway externo.
    """
    mensagem = MensagemComunicacao.objects.create(
        canal='whatsapp',
        destinatario=numero,
        conteudo=conteudo,
        cliente=cliente,
        motorista=motorista,
        ordem=ordem,
        status='pendente',
    )

    # Placeholder: gateway de WhatsApp não configurado.
    erro = (
        "Gateway de WhatsApp não configurado. "
        "Configure TWILIO/WhatsApp Business API para envio real."
    )
    logger.warning(erro)
    mensagem.status = 'falha'
    mensagem.erro = erro
    mensagem.save(update_fields=['status', 'erro'])
    return {'status': 'falha', 'erro': erro, 'id': str(mensagem.id)}
