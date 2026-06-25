# transport/views/abastecimento_views.py
"""Views para Abastecimento."""

from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Abastecimento
from ..permissions import TransportModelPermission
from ..serializers.abastecimento_serializers import (
    AbastecimentoCreateUpdateSerializer, AbastecimentoListSerializer,
    AbastecimentoSerializer
)


class AbastecimentoViewSet(viewsets.ModelViewSet):
    """CRUD de Abastecimentos."""

    queryset = Abastecimento.objects.all().select_related('veiculo', 'motorista', 'ordem_viagem')
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['veiculo__placa', 'posto', 'observacao']
    ordering_fields = ['data', 'hodometro', 'criado_em']
    ordering = ['-data', '-criado_em']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return AbastecimentoCreateUpdateSerializer
        if self.action == 'list':
            return AbastecimentoListSerializer
        return AbastecimentoSerializer

    @action(detail=False, methods=['get'], url_path='resumo')
    def resumo(self, request):
        """Retorna resumo de consumo médio e gastos por veículo."""
        from django.db.models import Avg, Count, Sum

        veiculo_id = request.query_params.get('veiculo')
        queryset = self.get_queryset()
        if veiculo_id:
            queryset = queryset.filter(veiculo_id=veiculo_id)

        resumo = queryset.values('veiculo__placa').annotate(
            total_abastecimentos=Count('id'),
            total_litros=Sum('litros'),
            total_gasto=Sum('valor_total'),
            media_litros=Avg('litros')
        ).order_by('veiculo__placa')

        return Response(list(resumo))
