"""
Serviço de comunicação para envio de e-mail e WhatsApp.

E-mail utiliza o backend configurado no Django (send_mail).
WhatsApp é um placeholder: quando houver gateway contratado (Twilio, Z-API,
Evolution API, etc.), implementar a chamada real na função _enviar_whatsapp.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

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
        mensagem.enviado_em = timezone.now()
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
    Envia mensagem de WhatsApp via Evolution API e registra no histórico.
    """
    from .whatsapp_service import enviar_mensagem_texto

    mensagem = MensagemComunicacao.objects.create(
        canal='whatsapp',
        destinatario=numero,
        conteudo=conteudo,
        cliente=cliente,
        motorista=motorista,
        ordem=ordem,
        status='pendente',
    )

    resultado = enviar_mensagem_texto(numero, conteudo)

    if resultado['status'] == 'enviado':
        mensagem.status = 'enviado'
        mensagem.enviado_em = timezone.now()
        mensagem.save(update_fields=['status', 'enviado_em'])
        return {'status': 'enviado', 'id': str(mensagem.id)}

    erro = resultado.get('erro', 'Erro desconhecido ao enviar WhatsApp')
    logger.warning("Falha ao enviar WhatsApp para %s: %s", numero, erro)
    mensagem.status = 'falha'
    mensagem.erro = erro
    mensagem.save(update_fields=['status', 'erro'])
    return {'status': 'falha', 'erro': erro, 'id': str(mensagem.id)}
