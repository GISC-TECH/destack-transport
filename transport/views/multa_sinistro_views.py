# transport/views/multa_sinistro_views.py
"""Views para Multas e Sinistros."""

from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import Multa, Sinistro
from ..permissions import TransportModelPermission
from ..serializers.multa_sinistro_serializers import (
    MultaCreateUpdateSerializer, MultaListSerializer, MultaSerializer,
    SinistroCreateUpdateSerializer, SinistroListSerializer, SinistroSerializer
)


class MultaViewSet(viewsets.ModelViewSet):
    """CRUD de Multas."""

    queryset = Multa.objects.all().select_related('veiculo', 'motorista')
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['veiculo__placa', 'auto_infracao', 'descricao', 'local']
    ordering_fields = ['data_infracao', 'data_vencimento', 'status']
    ordering = ['-data_infracao', '-criado_em']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MultaCreateUpdateSerializer
        if self.action == 'list':
            return MultaListSerializer
        return MultaSerializer


class SinistroViewSet(viewsets.ModelViewSet):
    """CRUD de Sinistros."""

    queryset = Sinistro.objects.all().select_related('veiculo', 'motorista')
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['veiculo__placa', 'numero_sinistro', 'descricao', 'local']
    ordering_fields = ['data', 'status']
    ordering = ['-data', '-criado_em']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SinistroCreateUpdateSerializer
        if self.action == 'list':
            return SinistroListSerializer
        return SinistroSerializer
