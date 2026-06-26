"""Views para integração com rastreamento GPS."""
from datetime import datetime

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..models import OrdemViagem, PosicaoVeiculo, Veiculo


def _encontrar_ordem_ativa(veiculo):
    """Retorna a ordem de viagem em andamento para o veículo, se houver."""
    return OrdemViagem.objects.filter(
        veiculo=veiculo,
        status__in=['em_andamento', 'agendada']
    ).order_by('-data_saida').first()


@api_view(['POST'])
@permission_classes([AllowAny])
def webhook_posicao_gps(request):
    """
    Webhook genérico para receber posições de GPS.

    Espera payload JSON com:
    - identificador (obrigatório): placa, ID do GPS ou código do veículo
    - latitude, longitude (obrigatórios)
    - velocidade (opcional)
    - data_hora (opcional, ISO 8601)
    - provedor (opcional)

    O identificador é buscado primeiro em gps_identificador, depois em placa.
    """
    data = request.data
    identificador = data.get('identificador')
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    if not identificador or latitude is None or longitude is None:
        return Response(
            {'erro': 'identificador, latitude e longitude são obrigatórios.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    veiculo = (
        Veiculo.objects.filter(gps_identificador=identificador).first()
        or Veiculo.objects.filter(placa__iexact=identificador).first()
    )

    if not veiculo:
        return Response(
            {'erro': f'Veículo não encontrado para o identificador {identificador}.'},
            status=status.HTTP_404_NOT_FOUND
        )

    data_hora_str = data.get('data_hora')
    data_hora = None
    if data_hora_str:
        try:
            data_hora = datetime.fromisoformat(data_hora_str.replace('Z', '+00:00'))
            if timezone.is_naive(data_hora):
                data_hora = timezone.make_aware(data_hora)
        except ValueError:
            pass

    ordem = _encontrar_ordem_ativa(veiculo)

    posicao = PosicaoVeiculo.objects.create(
        ordem=ordem,
        veiculo=veiculo,
        latitude=latitude,
        longitude=longitude,
        velocidade=data.get('velocidade'),
        data_hora=data_hora,
        fonte='gps',
    )

    veiculo.gps_ultima_sincronizacao = posicao.data_hora
    veiculo.save(update_fields=['gps_ultima_sincronizacao', 'atualizado_em'])

    return Response({
        'status': 'ok',
        'posicao_id': str(posicao.id),
        'veiculo': veiculo.placa,
        'ordem_id': str(ordem.id) if ordem else None,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ultima_posicao_veiculo(request, veiculo_id):
    """Retorna a última posição conhecida de um veículo."""
    try:
        veiculo = Veiculo.objects.get(pk=veiculo_id)
    except Veiculo.DoesNotExist:
        return Response({'erro': 'Veículo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

    posicao = veiculo.posicoes.order_by('-data_hora').first()
    if not posicao:
        return Response({'erro': 'Sem posição registrada.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'veiculo_id': str(veiculo.id),
        'placa': veiculo.placa,
        'latitude': float(posicao.latitude),
        'longitude': float(posicao.longitude),
        'velocidade': float(posicao.velocidade) if posicao.velocidade else None,
        'data_hora': posicao.data_hora.isoformat(),
        'fonte': posicao.fonte,
    })
