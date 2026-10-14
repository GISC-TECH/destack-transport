# transport/views/cliente_views.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from ..permissions import TransportModelPermission
from django.http import HttpResponse
from django.utils import timezone
import csv

from ..models import Cliente
from ..serializers.cliente_serializers import ClienteSerializer, ClienteListSerializer


class ClienteViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de Clientes.

    Endpoints:
    - GET /api/clientes/ - Listar clientes
    - GET /api/clientes/{id}/ - Detalhes de um cliente
    - POST /api/clientes/ - Criar cliente
    - PUT/PATCH /api/clientes/{id}/ - Atualizar cliente
    - DELETE /api/clientes/{id}/ - Deletar cliente
    - GET /api/clientes/export/ - Exportar para CSV
    """

    queryset = Cliente.objects.all()
    permission_classes = [IsAuthenticated, TransportModelPermission]

    def get_serializer_class(self):
        """Retorna serializer apropriado para a action."""
        if self.action == 'list':
            return ClienteListSerializer
        return ClienteSerializer

    def get_queryset(self):
        """Aplica filtros via query parameters."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Filtro por ativo
        ativo = params.get('ativo')
        if ativo is not None:
            queryset = queryset.filter(ativo=ativo.lower() == 'true')

        # Filtro por tipo de frete
        tipo_frete = params.get('tipo_frete')
        if tipo_frete:
            queryset = queryset.filter(tipo_frete=tipo_frete.upper())

        # Filtro por UF
        estado = params.get('estado')
        if estado:
            queryset = queryset.filter(estado__iexact=estado)

        # Busca geral (razão social, nome fantasia, CNPJ)
        q = params.get('q')
        if q:
            queryset = queryset.filter(
                Q(razao_social__icontains=q) |
                Q(nome_fantasia__icontains=q) |
                Q(cnpj__icontains=q)
            )

        return queryset.distinct().order_by('razao_social')

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Exporta clientes para CSV."""
        queryset = self.get_queryset()

        # Criar resposta CSV
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        filename = f"clientes_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Razão Social', 'Nome Fantasia', 'CNPJ', 'IE',
            'Endereço', 'Cidade', 'UF', 'CEP',
            'Distância (KM)', 'Tipo Frete', 'Ativo'
        ])

        for cliente in queryset:
            endereco_completo = f"{cliente.logradouro or ''}, {cliente.numero or ''}"
            writer.writerow([
                str(cliente.id),
                cliente.razao_social,
                cliente.nome_fantasia or '',
                cliente.cnpj,
                cliente.ie or '',
                endereco_completo,
                cliente.cidade or '',
                cliente.estado or '',
                cliente.cep or '',
                cliente.distancia or '',
                cliente.tipo_frete,
                'Sim' if cliente.ativo else 'Não'
            ])

        return response
