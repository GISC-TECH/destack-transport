# transport/views/pedagio_views.py
"""Views para Pedágio."""

from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import Pedagio
from ..permissions import TransportModelPermission
from ..serializers.pedagio_serializers import (
    PedagioCreateUpdateSerializer, PedagioListSerializer, PedagioSerializer
)


class PedagioViewSet(viewsets.ModelViewSet):
    """CRUD de Pedágios."""

    queryset = Pedagio.objects.all().select_related('veiculo', 'ordem')
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['veiculo__placa', 'praca', 'rodovia', 'tag']
    ordering_fields = ['data', 'valor', 'criado_em']
    ordering = ['-data', '-criado_em']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PedagioCreateUpdateSerializer
        if self.action == 'list':
            return PedagioListSerializer
        return PedagioSerializer
