"""
Endpoints read-only para a recepção genérica: GTV-e (DocumentoFiscalGenerico)
e eventos recebidos (DocumentoEvento). Esses documentos são persistidos no
parse mas não pertencem ao fluxo principal de CT-e/MDF-e.
"""
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated

from ..permissions import TransportModelPermission
from ..models import DocumentoFiscalGenerico, DocumentoEvento
from rest_framework import serializers


class DocumentoFiscalGenericoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = DocumentoFiscalGenerico
        fields = ['id', 'tipo', 'tipo_display', 'modelo', 'chave', 'numero', 'serie',
                  'data_emissao', 'emitente_cnpj', 'emitente_nome', 'valor_total',
                  'processado', 'criado_em']


class DocumentoEventoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoEvento
        fields = ['id', 'tipo_documento', 'chave_documento', 'tipo_evento',
                  'descricao_evento', 'sequencia_evento', 'data_evento', 'protocolo',
                  'codigo_status', 'motivo_status', 'confirmado', 'criado_em']


class DocumentoFiscalGenericoViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista/consulta documentos fiscais genéricos recebidos (ex.: GTV-e mod 64)."""
    queryset = DocumentoFiscalGenerico.objects.all().order_by('-criado_em')
    serializer_class = DocumentoFiscalGenericoSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['chave', 'numero', 'emitente_cnpj', 'emitente_nome']
    ordering_fields = ['criado_em', 'data_emissao', 'valor_total']

    def get_queryset(self):
        qs = super().get_queryset()
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo.upper())
        return qs


class DocumentoEventoViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista/consulta os eventos recebidos (cancelamento, CC-e, encerramento, etc.)."""
    queryset = DocumentoEvento.objects.all().order_by('-data_evento')
    serializer_class = DocumentoEventoSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['chave_documento', 'tipo_evento', 'protocolo']
    ordering_fields = ['data_evento', 'criado_em']

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('tipo_documento'):
            qs = qs.filter(tipo_documento=params['tipo_documento'].upper())
        if params.get('tipo_evento'):
            qs = qs.filter(tipo_evento=params['tipo_evento'])
        if params.get('chave'):
            qs = qs.filter(chave_documento=params['chave'])
        return qs
