# transport/views/motorista_views.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from ..permissions import TransportModelPermission
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
    permission_classes = [IsAuthenticated, TransportModelPermission]

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

        # Filtro por origem do cadastro (automático via XML)
        cadastro_automatico = params.get('cadastro_automatico')
        if cadastro_automatico is not None:
            queryset = queryset.filter(cadastro_automatico=cadastro_automatico.lower() == 'true')

        # Filtro por cadastro incompleto (sem CNH ou sem validade de CNH)
        incompletos = params.get('incompletos')
        if incompletos is not None and incompletos.lower() == 'true':
            queryset = queryset.filter(Q(cnh__isnull=True) | Q(cnh='') | Q(validade_cnh__isnull=True))

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
        Query params:
            - dias (default: 30): Número de dias para considerar vencimento
            - mostrar_todos (default: false): Se true, mostra todos os motoristas
        """
        dias = int(request.query_params.get('dias', 30))
        mostrar_todos = request.query_params.get('mostrar_todos', 'false').lower() == 'true'

        motoristas_lista = []

        for motorista in self.get_queryset().filter(ativo=True):
            docs_vencendo = motorista.get_documentos_vencendo(dias=dias)

            # Se mostrar_todos, inclui todos; senão, só os com docs vencendo
            if mostrar_todos or docs_vencendo:
                # Formatar CPF: 123.456.789-01
                cpf = motorista.cpf or ''
                cpf_limpo = ''.join(filter(str.isdigit, cpf))
                cpf_formatado = cpf
                if len(cpf_limpo) == 11:
                    cpf_formatado = f'{cpf_limpo[:3]}.{cpf_limpo[3:6]}.{cpf_limpo[6:9]}-{cpf_limpo[9:]}'

                motoristas_lista.append({
                    'id': str(motorista.id),
                    'nome': motorista.nome,
                    'cpf': motorista.cpf,
                    'cpf_formatado': cpf_formatado,
                    'documentos_vencendo': docs_vencendo
                })

        return Response({
            'dias_alerta': dias,
            'mostrar_todos': mostrar_todos,
            'total': len(motoristas_lista),
            'motoristas': motoristas_lista
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
