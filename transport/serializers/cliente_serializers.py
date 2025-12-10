# transport/serializers/cliente_serializers.py

from rest_framework import serializers
from ..models import Cliente


class ClienteSerializer(serializers.ModelSerializer):
    """Serializer completo para Cliente."""

    cnpj_formatado = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Cliente
        fields = '__all__'
        read_only_fields = ('id', 'criado_em', 'atualizado_em')

    def get_cnpj_formatado(self, obj):
        """Retorna CNPJ formatado."""
        if obj.cnpj and len(obj.cnpj) == 14:
            cnpj = obj.cnpj
            return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"
        return obj.cnpj

    def validate_cnpj(self, value):
        """Valida formato de CNPJ."""
        cnpj_limpo = ''.join(filter(str.isdigit, value))
        if len(cnpj_limpo) != 14:
            raise serializers.ValidationError("CNPJ deve ter 14 dígitos.")
        return cnpj_limpo

    def validate_estado(self, value):
        """Valida UF."""
        if value:
            ufs_validas = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                          'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                          'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
            if value.upper() not in ufs_validas:
                raise serializers.ValidationError("UF inválida.")
            return value.upper()
        return value


class ClienteListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de Clientes."""

    cnpj_formatado = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Cliente
        fields = ['id', 'razao_social', 'nome_fantasia', 'cnpj', 'cnpj_formatado',
                  'cidade', 'estado', 'tipo_frete', 'ativo']
        read_only_fields = fields

    def get_cnpj_formatado(self, obj):
        if obj.cnpj and len(obj.cnpj) == 14:
            cnpj = obj.cnpj
            return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"
        return obj.cnpj
