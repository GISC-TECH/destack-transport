"""Views para envio e histórico de comunicações."""
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Cliente, MensagemComunicacao, Motorista, OrdemViagem
from ..permissions import TransportModelPermission
from ..serializers.comunicacao_serializers import MensagemComunicacaoSerializer
from ..services.comunicacao_service import enviar_email, enviar_whatsapp


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enviar_comunicacao(request):
    """
    Endpoint para enviar e-mail ou WhatsApp.

    Payload:
    {
        "canal": "email" | "whatsapp",
        "destinatario": "...",
        "assunto": "..." (apenas e-mail),
        "conteudo": "...",
        "cliente_id": "..." (opcional),
        "motorista_id": "..." (opcional),
        "ordem_id": "..." (opcional)
    }
    """
    data = request.data
    canal = data.get('canal')
    destinatario = data.get('destinatario')
    assunto = data.get('assunto', '')
    conteudo = data.get('conteudo')

    if canal not in ('email', 'whatsapp'):
        return Response({'erro': 'Canal inválido. Use email ou whatsapp.'}, status=status.HTTP_400_BAD_REQUEST)
    if not destinatario or not conteudo:
        return Response({'erro': 'destinatario e conteudo são obrigatórios.'}, status=status.HTTP_400_BAD_REQUEST)

    cliente = None
    motorista = None
    ordem = None

    try:
        if data.get('cliente_id'):
            cliente = Cliente.objects.get(pk=data['cliente_id'])
        if data.get('motorista_id'):
            motorista = Motorista.objects.get(pk=data['motorista_id'])
        if data.get('ordem_id'):
            ordem = OrdemViagem.objects.get(pk=data['ordem_id'])
    except Exception as exc:
        return Response({'erro': f'Entidade relacionada não encontrada: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

    if canal == 'email':
        resultado = enviar_email(destinatario, assunto, conteudo, cliente=cliente, motorista=motorista, ordem=ordem)
    else:
        resultado = enviar_whatsapp(destinatario, conteudo, cliente=cliente, motorista=motorista, ordem=ordem)

    http_status = status.HTTP_200_OK if resultado['status'] == 'enviado' else status.HTTP_502_BAD_GATEWAY
    return Response(resultado, status=http_status)


class MensagemComunicacaoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet somente leitura para histórico de comunicações."""
    queryset = MensagemComunicacao.objects.all().select_related('cliente', 'motorista', 'ordem')
    serializer_class = MensagemComunicacaoSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = []
    ordering = ['-criado_em']
