# transport/views/plano_manutencao_views.py
"""Views para Planos de Manutenção."""

from datetime import date, timedelta

from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import PlanoManutencao
from ..permissions import TransportModelPermission
from ..serializers.plano_manutencao_serializers import (
    PlanoManutencaoCreateUpdateSerializer, PlanoManutencaoListSerializer,
    PlanoManutencaoSerializer
)


class PlanoManutencaoViewSet(viewsets.ModelViewSet):
    """CRUD de Planos de Manutenção."""

    queryset = PlanoManutencao.objects.all().select_related('veiculo')
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['veiculo__placa', 'descricao', 'observacao']
    ordering_fields = ['veiculo__placa', 'tipo', 'proxima_data', 'proxima_km']
    ordering = ['veiculo__placa', 'tipo', 'descricao']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PlanoManutencaoCreateUpdateSerializer
        if self.action == 'list':
            return PlanoManutencaoListSerializer
        return PlanoManutencaoSerializer

    def perform_create(self, serializer):
        instance = serializer.save()
        instance.calcular_proximas()
        instance.save()

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.calcular_proximas()
        instance.save()

    @action(detail=False, methods=['get'], url_path='alertas')
    def alertas(self, request):
        """Retorna planos de manutenção próximos do vencimento."""
        dias_alerta = int(request.query_params.get('dias', 30))
        planos = self.get_queryset().filter(ativo=True)
        vencendo = [p for p in planos if p.esta_vencendo(dias_alerta=dias_alerta)]
        serializer = PlanoManutencaoListSerializer(vencendo, many=True)
        return Response(serializer.data)
