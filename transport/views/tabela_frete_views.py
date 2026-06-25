# transport/views/tabela_frete_views.py
"""Views para Tabela de Frete."""

from django.db.models import Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import TabelaFrete
from ..permissions import TransportModelPermission
from ..serializers.tabela_frete_serializers import (
    SimulacaoFreteResultadoSerializer, SimulacaoFreteSerializer,
    TabelaFreteListSerializer, TabelaFreteSerializer
)


class TabelaFreteViewSet(viewsets.ModelViewSet):
    """CRUD de Tabelas de Frete."""

    queryset = TabelaFrete.objects.all()
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['origem_cidade', 'destino_cidade', 'origem_uf', 'destino_uf', 'tipo_veiculo']
    ordering_fields = ['origem_uf', 'destino_uf', 'valor_por_km', 'vigencia_inicio']
    ordering = ['origem_uf', 'origem_cidade', 'destino_uf', 'destino_cidade']

    def get_serializer_class(self):
        if self.action == 'list':
            return TabelaFreteListSerializer
        return TabelaFreteSerializer

    @action(detail=False, methods=['post'], url_path='simular')
    def simular(self, request):
        """Simula o valor de frete com base na tabela mais adequada."""
        serializer = SimulacaoFreteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        hoje = __import__('datetime').date.today()
        filtros = Q(ativo=True) & (
            Q(vigencia_fim__isnull=True) | Q(vigencia_fim__gte=hoje)
        )

        if dados.get('origem_uf'):
            filtros &= Q(origem_uf__iexact=dados['origem_uf'])
        if dados.get('origem_cidade'):
            filtros &= Q(origem_cidade__icontains=dados['origem_cidade'])
        if dados.get('destino_uf'):
            filtros &= Q(destino_uf__iexact=dados['destino_uf'])
        if dados.get('destino_cidade'):
            filtros &= Q(destino_cidade__icontains=dados['destino_cidade'])
        if dados.get('tipo_veiculo'):
            filtros &= Q(tipo_veiculo__icontains=dados['tipo_veiculo'])

        tabelas = TabelaFrete.objects.filter(filtros).order_by('-vigencia_inicio')
        if not tabelas.exists():
            return Response(
                {"detail": "Nenhuma tabela de frete encontrada para os critérios informados."},
                status=status.HTTP_404_NOT_FOUND
            )

        tabela = tabelas.first()
        valor_frete = tabela.calcular_frete(
            distancia_km=dados.get('distancia_km') or 0,
            peso_kg=dados.get('peso_kg') or 0,
            volume_m3=dados.get('volume_m3') or 0
        )

        resultado = {
            'tabela_id': tabela.id,
            'origem': f"{tabela.origem_cidade}/{tabela.origem_uf}",
            'destino': f"{tabela.destino_cidade}/{tabela.destino_uf}",
            'valor_frete': valor_frete,
            'valor_por_km': tabela.valor_por_km,
            'valor_minimo': tabela.valor_minimo,
        }
        return Response(SimulacaoFreteResultadoSerializer(resultado).data)
