# transport/views/motorista_views.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from datetime import date, timedelta
import csv

from ..models import Motorista
from ..serializers.motorista_serializers import MotoristaSerializer, MotoristaListSerializer


class MotoristaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de Motoristas.

    Endpoints:
    - GET /api/motoristas/ - Listar motoristas
    - GET /api/motoristas/{id}/ - Detalhes de um motorista
    - POST /api/motoristas/ - Criar motorista
    - PUT/PATCH /api/motoristas/{id}/ - Atualizar motorista
    - DELETE /api/motoristas/{id}/ - Deletar motorista
    - GET /api/motoristas/vencimentos/ - Motoristas com documentos vencendo
    - GET /api/motoristas/export/ - Exportar para CSV
    """

    queryset = Motorista.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Retorna serializer apropriado para a action."""
        if self.action == 'list':
            return MotoristaListSerializer
        return MotoristaSerializer

    def get_queryset(self):
        """Aplica filtros via query parameters."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Filtro por ativo
        ativo = params.get('ativo')
        if ativo is not None:
            queryset = queryset.filter(ativo=ativo.lower() == 'true')

        # Filtro por categoria CNH
        categoria = params.get('categoria_cnh')
        if categoria:
            queryset = queryset.filter(categoria_cnh=categoria.upper())

        # Busca geral (nome, CPF, CNH)
        q = params.get('q')
        if q:
            queryset = queryset.filter(
                Q(nome__icontains=q) |
                Q(cpf__icontains=q) |
                Q(cnh__icontains=q)
            )

        return queryset.distinct().order_by('nome')

    @action(detail=False, methods=['get'])
    def vencimentos(self, request):
        """
        Retorna motoristas com documentos vencendo.
        Query param: dias (default: 30)
        """
        dias = int(request.query_params.get('dias', 30))

        # Motoristas com pelo menos um documento vencendo
        motoristas_vencendo = []

        for motorista in self.get_queryset().filter(ativo=True):
            docs_vencendo = motorista.get_documentos_vencendo(dias=dias)
            if docs_vencendo:
                motoristas_vencendo.append({
                    'id': str(motorista.id),
                    'nome': motorista.nome,
                    'cpf': motorista.cpf,
                    'documentos_vencendo': docs_vencendo
                })

        return Response({
            'dias_alerta': dias,
            'total': len(motoristas_vencendo),
            'motoristas': motoristas_vencendo
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Exporta motoristas para CSV."""
        queryset = self.get_queryset()

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        filename = f"motoristas_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Nome', 'CPF', 'CNH', 'Categoria', 'Validade CNH',
            'NR20', 'NR35', 'MOPP', 'Telefone', 'Email', 'Ativo'
        ])

        for motorista in queryset:
            writer.writerow([
                str(motorista.id),
                motorista.nome,
                motorista.cpf,
                motorista.cnh,
                motorista.categoria_cnh or '',
                motorista.validade_cnh or '',
                motorista.nr20_validade or '',
                motorista.nr35_validade or '',
                motorista.mopp_validade or '',
                motorista.telefone or '',
                motorista.email or '',
                'Sim' if motorista.ativo else 'Não'
            ])

        return response
