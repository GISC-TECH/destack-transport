# transport/views/documento_views.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
import mimetypes

from ..models import DocumentoAnexo, Cliente, Motorista, Veiculo
from ..serializers.documento_serializers import (
    DocumentoAnexoSerializer,
    DocumentoAnexoListSerializer,
    DocumentoAnexoUploadSerializer
)


class DocumentoAnexoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de DocumentoAnexo.

    Endpoints:
    - GET /api/documentos/ - Listar documentos
    - GET /api/documentos/{id}/ - Detalhes de um documento
    - POST /api/documentos/ - Criar documento
    - PUT/PATCH /api/documentos/{id}/ - Atualizar documento
    - DELETE /api/documentos/{id}/ - Deletar documento
    - GET /api/documentos/{id}/download/ - Baixar arquivo
    """

    queryset = DocumentoAnexo.objects.all()
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        """Retorna serializer apropriado para a action."""
        if self.action == 'list':
            return DocumentoAnexoListSerializer
        return DocumentoAnexoSerializer

    def get_queryset(self):
        """Aplica filtros via query parameters."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Filtro por cliente
        cliente_id = params.get('cliente')
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)

        # Filtro por motorista
        motorista_id = params.get('motorista')
        if motorista_id:
            queryset = queryset.filter(motorista_id=motorista_id)

        # Filtro por veiculo
        veiculo_id = params.get('veiculo')
        if veiculo_id:
            queryset = queryset.filter(veiculo_id=veiculo_id)

        # Filtro por tipo
        tipo = params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo=tipo)

        return queryset.order_by('-criado_em')

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download do arquivo anexo."""
        documento = self.get_object()

        if not documento.arquivo:
            raise Http404("Arquivo não encontrado")

        try:
            file_handle = documento.arquivo.open('rb')
            content_type = documento.tipo_mime or mimetypes.guess_type(documento.arquivo.name)[0] or 'application/octet-stream'

            response = FileResponse(
                file_handle,
                content_type=content_type
            )
            response['Content-Disposition'] = f'attachment; filename="{documento.nome or documento.arquivo.name}"'
            return response
        except Exception as e:
            raise Http404(f"Erro ao acessar arquivo: {str(e)}")


class ClienteDocumentoViewSet(viewsets.ViewSet):
    """
    ViewSet para documentos de um Cliente específico.

    Endpoints:
    - GET /api/clientes/{cliente_pk}/documentos/ - Listar documentos do cliente
    - POST /api/clientes/{cliente_pk}/documentos/ - Adicionar documento ao cliente
    - DELETE /api/clientes/{cliente_pk}/documentos/{id}/ - Remover documento do cliente
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def list(self, request, cliente_pk=None):
        """Lista documentos do cliente."""
        cliente = get_object_or_404(Cliente, pk=cliente_pk)
        documentos = DocumentoAnexo.objects.filter(cliente=cliente).order_by('-criado_em')
        serializer = DocumentoAnexoListSerializer(documentos, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request, cliente_pk=None):
        """Adiciona documento ao cliente."""
        cliente = get_object_or_404(Cliente, pk=cliente_pk)

        upload_serializer = DocumentoAnexoUploadSerializer(data=request.data)
        if not upload_serializer.is_valid():
            return Response(upload_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = upload_serializer.validated_data
        arquivo = data['arquivo']

        documento = DocumentoAnexo.objects.create(
            cliente=cliente,
            tipo=data.get('tipo', 'outro'),
            nome=data.get('nome') or arquivo.name,
            arquivo=arquivo,
            validade=data.get('validade'),
            observacoes=data.get('observacoes', ''),
            criado_por=request.user if request.user.is_authenticated else None
        )

        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, cliente_pk=None, pk=None):
        """Remove documento do cliente."""
        cliente = get_object_or_404(Cliente, pk=cliente_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, cliente=cliente)

        # Remove o arquivo fisico
        if documento.arquivo:
            documento.arquivo.delete(save=False)

        documento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MotoristaDocumentoViewSet(viewsets.ViewSet):
    """
    ViewSet para documentos de um Motorista específico.

    Endpoints:
    - GET /api/motoristas/{motorista_pk}/documentos/ - Listar documentos do motorista
    - POST /api/motoristas/{motorista_pk}/documentos/ - Adicionar documento ao motorista
    - DELETE /api/motoristas/{motorista_pk}/documentos/{id}/ - Remover documento do motorista
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def list(self, request, motorista_pk=None):
        """Lista documentos do motorista."""
        motorista = get_object_or_404(Motorista, pk=motorista_pk)
        documentos = DocumentoAnexo.objects.filter(motorista=motorista).order_by('-criado_em')
        serializer = DocumentoAnexoListSerializer(documentos, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request, motorista_pk=None):
        """Adiciona documento ao motorista."""
        motorista = get_object_or_404(Motorista, pk=motorista_pk)

        upload_serializer = DocumentoAnexoUploadSerializer(data=request.data)
        if not upload_serializer.is_valid():
            return Response(upload_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = upload_serializer.validated_data
        arquivo = data['arquivo']

        documento = DocumentoAnexo.objects.create(
            motorista=motorista,
            tipo=data.get('tipo', 'outro'),
            nome=data.get('nome') or arquivo.name,
            arquivo=arquivo,
            validade=data.get('validade'),
            observacoes=data.get('observacoes', ''),
            criado_por=request.user if request.user.is_authenticated else None
        )

        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, motorista_pk=None, pk=None):
        """Remove documento do motorista."""
        motorista = get_object_or_404(Motorista, pk=motorista_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, motorista=motorista)

        if documento.arquivo:
            documento.arquivo.delete(save=False)

        documento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VeiculoDocumentoViewSet(viewsets.ViewSet):
    """
    ViewSet para documentos de um Veiculo específico.

    Endpoints:
    - GET /api/veiculos/{veiculo_pk}/documentos/ - Listar documentos do veiculo
    - POST /api/veiculos/{veiculo_pk}/documentos/ - Adicionar documento ao veiculo
    - DELETE /api/veiculos/{veiculo_pk}/documentos/{id}/ - Remover documento do veiculo
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def list(self, request, veiculo_pk=None):
        """Lista documentos do veiculo."""
        veiculo = get_object_or_404(Veiculo, pk=veiculo_pk)
        documentos = DocumentoAnexo.objects.filter(veiculo=veiculo).order_by('-criado_em')
        serializer = DocumentoAnexoListSerializer(documentos, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request, veiculo_pk=None):
        """Adiciona documento ao veiculo."""
        veiculo = get_object_or_404(Veiculo, pk=veiculo_pk)

        upload_serializer = DocumentoAnexoUploadSerializer(data=request.data)
        if not upload_serializer.is_valid():
            return Response(upload_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = upload_serializer.validated_data
        arquivo = data['arquivo']

        documento = DocumentoAnexo.objects.create(
            veiculo=veiculo,
            tipo=data.get('tipo', 'outro'),
            nome=data.get('nome') or arquivo.name,
            arquivo=arquivo,
            validade=data.get('validade'),
            observacoes=data.get('observacoes', ''),
            criado_por=request.user if request.user.is_authenticated else None
        )

        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, veiculo_pk=None, pk=None):
        """Remove documento do veiculo."""
        veiculo = get_object_or_404(Veiculo, pk=veiculo_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, veiculo=veiculo)

        if documento.arquivo:
            documento.arquivo.delete(save=False)

        documento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
