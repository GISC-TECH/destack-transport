# transport/views/documento_views.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse, Http404

from ..permissions import TransportModelPermission, ReadOnlyPermission
from django.shortcuts import get_object_or_404
import mimetypes

from ..models import DocumentoAnexo, Cliente, Motorista, Veiculo, CTeDocumento
from ..serializers.documento_serializers import (
    DocumentoAnexoSerializer,
    DocumentoAnexoListSerializer,
    DocumentoAnexoUploadSerializer
)


# Mapeamento de tipos de documentos anexos para campos de validade do Veiculo.
# As chaves devem corresponder a TIPO_DOCUMENTO_CHOICES do modelo DocumentoAnexo.
VEICULO_TIPO_TO_CAMPO = {
    'crlv': 'crlv_validade',
    'certificado_tacografo': 'cronotacografo_validade',
    'civ': 'civ_validade',
    'cipp': 'cipp_validade',
    'seguro': 'seguro_validade',  # campo nao existente ainda; ignorado silenciosamente
    'laudo_vistoria': 'laudo_vistoria_validade',  # campo nao existente ainda
}

MOTORISTA_TIPO_TO_CAMPO = {
    'cnh': 'validade_cnh',
    'certificado_nr20': 'nr20_validade',
    'certificado_mopp': 'mopp_validade',
    'certificado_nr35': 'nr35_validade',
    'aso': 'aso_validade',
}


def atualizar_validade_veiculo(veiculo, tipo_documento, validade):
    """Atualiza o campo de validade do veículo baseado no tipo de documento."""
    campo = VEICULO_TIPO_TO_CAMPO.get(tipo_documento)
    if campo and validade:
        setattr(veiculo, campo, validade)
        veiculo.save(update_fields=[campo])
        return True
    return False


def atualizar_validade_motorista(motorista, tipo_documento, validade):
    """Atualiza o campo de validade do motorista baseado no tipo de documento."""
    campo = MOTORISTA_TIPO_TO_CAMPO.get(tipo_documento)
    if campo and validade:
        setattr(motorista, campo, validade)
        motorista.save(update_fields=[campo])
        return True
    return False


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
    permission_classes = [IsAuthenticated, TransportModelPermission]
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

    queryset = DocumentoAnexo.objects.all()
    permission_classes = [IsAuthenticated, TransportModelPermission]
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

    def partial_update(self, request, cliente_pk=None, pk=None):
        """Atualiza documento do cliente (validade, nome, tipo, observacoes)."""
        cliente = get_object_or_404(Cliente, pk=cliente_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, cliente=cliente)

        # Campos permitidos para atualização
        if 'validade' in request.data:
            documento.validade = request.data['validade'] or None
        if 'nome' in request.data:
            documento.nome = request.data['nome']
        if 'tipo' in request.data:
            documento.tipo = request.data['tipo']
        if 'observacoes' in request.data:
            documento.observacoes = request.data['observacoes']

        documento.save()
        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data)

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

    queryset = DocumentoAnexo.objects.all()
    permission_classes = [IsAuthenticated, TransportModelPermission]
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
        tipo = data.get('tipo', 'outro')
        validade = data.get('validade')

        documento = DocumentoAnexo.objects.create(
            motorista=motorista,
            tipo=tipo,
            nome=data.get('nome') or arquivo.name,
            arquivo=arquivo,
            validade=validade,
            observacoes=data.get('observacoes', ''),
            criado_por=request.user if request.user.is_authenticated else None
        )

        # Atualiza automaticamente o campo de validade do motorista
        atualizar_validade_motorista(motorista, tipo, validade)

        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, motorista_pk=None, pk=None):
        """Atualiza documento do motorista (validade, nome, tipo, observacoes)."""
        motorista = get_object_or_404(Motorista, pk=motorista_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, motorista=motorista)

        # Campos permitidos para atualização
        if 'validade' in request.data:
            documento.validade = request.data['validade'] or None
        if 'nome' in request.data:
            documento.nome = request.data['nome']
        if 'tipo' in request.data:
            documento.tipo = request.data['tipo']
        if 'observacoes' in request.data:
            documento.observacoes = request.data['observacoes']

        documento.save()

        # Atualiza automaticamente o campo de validade do motorista
        if documento.validade:
            atualizar_validade_motorista(motorista, documento.tipo, documento.validade)

        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data)

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

    queryset = DocumentoAnexo.objects.all()
    permission_classes = [IsAuthenticated, TransportModelPermission]
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
        tipo = data.get('tipo', 'outro')
        validade = data.get('validade')

        documento = DocumentoAnexo.objects.create(
            veiculo=veiculo,
            tipo=tipo,
            nome=data.get('nome') or arquivo.name,
            arquivo=arquivo,
            validade=validade,
            observacoes=data.get('observacoes', ''),
            criado_por=request.user if request.user.is_authenticated else None
        )

        # Atualiza automaticamente o campo de validade do veículo
        atualizar_validade_veiculo(veiculo, tipo, validade)

        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, veiculo_pk=None, pk=None):
        """Atualiza documento do veiculo (validade, nome, tipo, observacoes)."""
        veiculo = get_object_or_404(Veiculo, pk=veiculo_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, veiculo=veiculo)

        # Campos permitidos para atualização
        if 'validade' in request.data:
            documento.validade = request.data['validade'] or None
        if 'nome' in request.data:
            documento.nome = request.data['nome']
        if 'tipo' in request.data:
            documento.tipo = request.data['tipo']
        if 'observacoes' in request.data:
            documento.observacoes = request.data['observacoes']

        documento.save()

        # Atualiza automaticamente o campo de validade do veículo
        if documento.validade:
            atualizar_validade_veiculo(veiculo, documento.tipo, documento.validade)

        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data)

    def destroy(self, request, veiculo_pk=None, pk=None):
        """Remove documento do veiculo."""
        veiculo = get_object_or_404(Veiculo, pk=veiculo_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, veiculo=veiculo)

        if documento.arquivo:
            documento.arquivo.delete(save=False)

        documento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CTeDocumentoAnexoViewSet(viewsets.ViewSet):
    """
    ViewSet para documentos anexos de um CT-e específico.

    Endpoints:
    - GET /api/ctes/{cte_pk}/documentos/ - Listar documentos do CT-e
    - POST /api/ctes/{cte_pk}/documentos/ - Adicionar documento ao CT-e
    - DELETE /api/ctes/{cte_pk}/documentos/{id}/ - Remover documento do CT-e
    """

    queryset = DocumentoAnexo.objects.all()
    permission_classes = [IsAuthenticated, TransportModelPermission]
    parser_classes = [MultiPartParser, FormParser]

    def list(self, request, cte_pk=None):
        """Lista documentos do CT-e."""
        cte = get_object_or_404(CTeDocumento, pk=cte_pk)
        documentos = DocumentoAnexo.objects.filter(cte=cte).order_by('-criado_em')
        serializer = DocumentoAnexoListSerializer(documentos, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request, cte_pk=None):
        """Adiciona documento ao CT-e."""
        cte = get_object_or_404(CTeDocumento, pk=cte_pk)

        upload_serializer = DocumentoAnexoUploadSerializer(data=request.data)
        if not upload_serializer.is_valid():
            return Response(upload_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = upload_serializer.validated_data
        arquivo = data['arquivo']

        documento = DocumentoAnexo.objects.create(
            cte=cte,
            tipo=data.get('tipo', 'outro'),
            nome=data.get('nome') or arquivo.name,
            arquivo=arquivo,
            validade=data.get('validade'),
            observacoes=data.get('observacoes', ''),
            criado_por=request.user if request.user.is_authenticated else None
        )

        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, cte_pk=None, pk=None):
        """Atualiza documento do CT-e (validade, nome, tipo, observacoes)."""
        cte = get_object_or_404(CTeDocumento, pk=cte_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, cte=cte)

        if 'validade' in request.data:
            documento.validade = request.data['validade'] or None
        if 'nome' in request.data:
            documento.nome = request.data['nome']
        if 'tipo' in request.data:
            documento.tipo = request.data['tipo']
        if 'observacoes' in request.data:
            documento.observacoes = request.data['observacoes']

        documento.save()
        serializer = DocumentoAnexoSerializer(documento, context={'request': request})
        return Response(serializer.data)

    def destroy(self, request, cte_pk=None, pk=None):
        """Remove documento do CT-e."""
        cte = get_object_or_404(CTeDocumento, pk=cte_pk)
        documento = get_object_or_404(DocumentoAnexo, pk=pk, cte=cte)

        if documento.arquivo:
            documento.arquivo.delete(save=False)

        documento.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
