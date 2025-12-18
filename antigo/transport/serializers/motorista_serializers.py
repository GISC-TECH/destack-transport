# transport/serializers/motorista_serializers.py

from rest_framework import serializers
from ..models import Motorista


class MotoristaSerializer(serializers.ModelSerializer):
    """Serializer completo para Motorista."""

    cpf_formatado = serializers.SerializerMethodField(read_only=True)
    documentos_vencendo = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Motorista
        fields = '__all__'
        read_only_fields = ('id', 'criado_em', 'atualizado_em')

    def get_cpf_formatado(self, obj):
        """Retorna CPF formatado."""
        if obj.cpf and len(obj.cpf) == 11:
            cpf = obj.cpf
            return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"
        return obj.cpf

    def get_documentos_vencendo(self, obj):
        """Retorna documentos que vencem em 30 dias."""
        return obj.get_documentos_vencendo(dias=30)

    def validate_cpf(self, value):
        """Valida formato de CPF."""
        cpf_limpo = ''.join(filter(str.isdigit, value))
        if len(cpf_limpo) != 11:
            raise serializers.ValidationError("CPF deve ter 11 dígitos.")
        return cpf_limpo


class MotoristaListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de Motoristas."""

    cpf_formatado = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Motorista
        fields = ['id', 'nome', 'cpf', 'cpf_formatado', 'cnh', 'categoria_cnh',
                  'validade_cnh', 'ativo']
        read_only_fields = fields

    def get_cpf_formatado(self, obj):
        if obj.cpf and len(obj.cpf) == 11:
            cpf = obj.cpf
            return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"
        return obj.cpf
