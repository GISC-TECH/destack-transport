"""Views para gerenciamento de CIOT."""
from datetime import date

from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import CIOT
from ..permissions import TransportModelPermission
from ..serializers.ciot_serializers import CIOTListSerializer, CIOTSerializer


class CIOTViewSet(viewsets.ModelViewSet):
    """ViewSet para CRUD de CIOTs."""
    queryset = CIOT.objects.all().select_related(
        'cliente', 'motorista', 'cte', 'mdfe', 'ordem'
    )
    serializer_class = CIOTSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'descricao', 'origem_cidade', 'destino_cidade', 'cliente__razao_social', 'motorista__nome']
    ordering_fields = ['codigo', 'data_emissao', 'data_validade', 'status', 'criado_em']
    ordering = ['-criado_em']

    def get_serializer_class(self):
        if self.action == 'list':
            return CIOTListSerializer
        return CIOTSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        status_filter = params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        cliente_id = params.get('cliente')
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)

        motorista_id = params.get('motorista')
        if motorista_id:
            queryset = queryset.filter(motorista_id=motorista_id)

        vencidos = params.get('vencidos')
        if vencidos == 'true':
            queryset = queryset.filter(data_validade__lt=date.today())
        elif vencidos == 'false':
            queryset = queryset.filter(data_validade__gte=date.today())

        disponiveis = params.get('disponiveis')
        if disponiveis == 'true':
            queryset = queryset.filter(status='ativo')

        return queryset

    @action(detail=True, methods=['post'], url_path='cancelar')
    def cancelar(self, request, pk=None):
        """Cancela um CIOT."""
        ciot = self.get_object()
        if ciot.status == 'cancelado':
            return Response({'erro': 'CIOT já está cancelado.'}, status=status.HTTP_400_BAD_REQUEST)
        ciot.status = 'cancelado'
        ciot.save(update_fields=['status'])
        return Response({'status': 'cancelado', 'id': str(ciot.id)})

    @action(detail=True, methods=['post'], url_path='usar')
    def usar(self, request, pk=None):
        """Marca um CIOT como usado (vinculado a uma operação)."""
        ciot = self.get_object()
        if ciot.status != 'ativo':
            return Response(
                {'erro': f"Não é possível usar um CIOT com status '{ciot.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        ciot.status = 'usado'
        ciot.save(update_fields=['status'])
        return Response({'status': 'usado', 'id': str(ciot.id)})

    @action(detail=False, methods=['get'], url_path='resumo')
    def resumo(self, request):
        """Retorna resumo de CIOTs por status."""
        from django.db.models import Count
        resumo = self.get_queryset().values('status').annotate(total=Count('id'))
        return Response({item['status']: item['total'] for item in resumo})
