# transport/views/posicao_veiculo_views.py
"""Views para Posição do Veículo."""

from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import PosicaoVeiculo
from ..permissions import TransportModelPermission
from ..serializers.posicao_veiculo_serializers import (
    PosicaoVeiculoCreateSerializer, PosicaoVeiculoSerializer
)


class PosicaoVeiculoViewSet(viewsets.ModelViewSet):
    """CRUD de Posições de Veículos."""

    queryset = PosicaoVeiculo.objects.all().select_related('veiculo', 'ordem')
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['data_hora']
    ordering = ['-data_hora']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PosicaoVeiculoCreateSerializer
        return PosicaoVeiculoSerializer
