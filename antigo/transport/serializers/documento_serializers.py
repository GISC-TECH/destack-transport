# transport/serializers/documento_serializers.py

from rest_framework import serializers
from ..models import DocumentoAnexo


class DocumentoAnexoSerializer(serializers.ModelSerializer):
    """Serializer completo para DocumentoAnexo."""

    arquivo_url = serializers.SerializerMethodField(read_only=True)
    tamanho_formatado = serializers.SerializerMethodField(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    entidade_tipo = serializers.SerializerMethodField(read_only=True)
    entidade_nome = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DocumentoAnexo
        fields = [
            'id', 'cliente', 'motorista', 'veiculo',
            'tipo', 'tipo_display', 'nome', 'arquivo', 'arquivo_url',
            'tamanho', 'tamanho_formatado', 'tipo_mime',
            'validade', 'observacoes',
            'criado_em', 'criado_por',
            'entidade_tipo', 'entidade_nome'
        ]
        read_only_fields = ('id', 'tamanho', 'tipo_mime', 'criado_em', 'criado_por')

    def get_arquivo_url(self, obj):
        """Retorna URL completa do arquivo."""
        if obj.arquivo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.arquivo.url)
            return obj.arquivo.url
        return None

    def get_tamanho_formatado(self, obj):
        """Retorna tamanho do arquivo formatado."""
        if not obj.tamanho:
            return None
        if obj.tamanho < 1024:
            return f"{obj.tamanho} B"
        elif obj.tamanho < 1024 * 1024:
            return f"{obj.tamanho / 1024:.1f} KB"
        else:
            return f"{obj.tamanho / (1024 * 1024):.1f} MB"

    def get_entidade_tipo(self, obj):
        """Retorna o tipo de entidade associada."""
        if obj.cliente:
            return 'cliente'
        elif obj.motorista:
            return 'motorista'
        elif obj.veiculo:
            return 'veiculo'
        return None

    def get_entidade_nome(self, obj):
        """Retorna o nome/identificador da entidade associada."""
        if obj.cliente:
            return obj.cliente.razao_social or obj.cliente.nome_fantasia
        elif obj.motorista:
            return obj.motorista.nome
        elif obj.veiculo:
            return obj.veiculo.placa
        return None

    def validate(self, data):
        """Valida que apenas uma entidade seja preenchida."""
        cliente = data.get('cliente')
        motorista = data.get('motorista')
        veiculo = data.get('veiculo')

        entidades = [e for e in [cliente, motorista, veiculo] if e is not None]

        if len(entidades) == 0:
            raise serializers.ValidationError(
                "Pelo menos uma entidade (cliente, motorista ou veiculo) deve ser informada."
            )
        if len(entidades) > 1:
            raise serializers.ValidationError(
                "Apenas uma entidade (cliente, motorista ou veiculo) deve ser informada por vez."
            )

        return data

    def validate_arquivo(self, value):
        """Valida o arquivo enviado."""
        if value:
            # Limite de 10MB
            max_size = 10 * 1024 * 1024
            if value.size > max_size:
                raise serializers.ValidationError(
                    "O arquivo excede o tamanho máximo permitido de 10MB."
                )

            # Tipos de arquivo permitidos
            allowed_types = [
                'application/pdf',
                'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/plain',
            ]
            if value.content_type and value.content_type not in allowed_types:
                raise serializers.ValidationError(
                    f"Tipo de arquivo não permitido: {value.content_type}. "
                    "Tipos permitidos: PDF, imagens (JPG, PNG, GIF), Word, Excel, TXT."
                )
        return value

    def create(self, validated_data):
        """Cria o documento e preenche os campos automaticos."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['criado_por'] = request.user
        return super().create(validated_data)


class DocumentoAnexoListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de documentos."""

    arquivo_url = serializers.SerializerMethodField(read_only=True)
    tamanho_formatado = serializers.SerializerMethodField(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = DocumentoAnexo
        fields = [
            'id', 'tipo', 'tipo_display', 'nome', 'arquivo_url',
            'tamanho_formatado', 'tipo_mime', 'validade', 'criado_em'
        ]

    def get_arquivo_url(self, obj):
        if obj.arquivo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.arquivo.url)
            return obj.arquivo.url
        return None

    def get_tamanho_formatado(self, obj):
        if not obj.tamanho:
            return None
        if obj.tamanho < 1024:
            return f"{obj.tamanho} B"
        elif obj.tamanho < 1024 * 1024:
            return f"{obj.tamanho / 1024:.1f} KB"
        else:
            return f"{obj.tamanho / (1024 * 1024):.1f} MB"


class DocumentoAnexoUploadSerializer(serializers.Serializer):
    """Serializer para upload de documentos via endpoint especifico."""

    arquivo = serializers.FileField(required=True)
    tipo = serializers.ChoiceField(choices=DocumentoAnexo.TIPO_DOCUMENTO_CHOICES, default='outro')
    nome = serializers.CharField(max_length=255, required=False)
    validade = serializers.DateField(required=False, allow_null=True)
    observacoes = serializers.CharField(required=False, allow_blank=True)

    def validate_arquivo(self, value):
        """Valida o arquivo enviado."""
        if value:
            # Limite de 10MB
            max_size = 10 * 1024 * 1024
            if value.size > max_size:
                raise serializers.ValidationError(
                    "O arquivo excede o tamanho máximo permitido de 10MB."
                )
        return value
