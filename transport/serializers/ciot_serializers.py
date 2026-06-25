"""Serializers para CIOT."""
from rest_framework import serializers

from ..models import CIOT


class CIOTSerializer(serializers.ModelSerializer):
    """Serializer completo para CIOT."""

    cliente_nome = serializers.CharField(source='cliente.razao_social', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    cte_chave = serializers.CharField(source='cte.chave', read_only=True)
    mdfe_chave = serializers.CharField(source='mdfe.chave', read_only=True)
    ordem_numero = serializers.CharField(source='ordem.numero', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = CIOT
        fields = [
            'id', 'codigo', 'descricao', 'responsavel_cnpj', 'responsavel_cpf',
            'cliente', 'cliente_nome', 'motorista', 'motorista_nome',
            'origem_cidade', 'origem_uf', 'destino_cidade', 'destino_uf',
            'valor', 'data_emissao', 'data_validade',
            'cte', 'cte_chave', 'mdfe', 'mdfe_chave', 'ordem', 'ordem_numero',
            'status', 'status_display', 'observacao',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('id', 'criado_em', 'atualizado_em')

    def validate_codigo(self, value):
        """Valida formato do CIOT."""
        if not value:
            raise serializers.ValidationError("Código CIOT é obrigatório.")
        if not value.isdigit():
            raise serializers.ValidationError("O código CIOT deve conter apenas números.")
        if len(value) != 12:
            raise serializers.ValidationError("O código CIOT deve conter exatamente 12 dígitos.")
        return value

    def validate(self, data):
        """Valida CNPJ/CPF do responsável."""
        cnpj = data.get('responsavel_cnpj')
        cpf = data.get('responsavel_cpf')
        if cnpj and len(cnpj) != 14:
            raise serializers.ValidationError("CNPJ do responsável deve conter 14 dígitos.")
        if cpf and len(cpf) != 11:
            raise serializers.ValidationError("CPF do responsável deve conter 11 dígitos.")
        return data


class CIOTListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagem de CIOTs."""

    cliente_nome = serializers.CharField(source='cliente.razao_social', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = CIOT
        fields = [
            'id', 'codigo', 'descricao', 'cliente_nome', 'motorista_nome',
            'origem_cidade', 'destino_cidade', 'data_validade', 'status', 'status_display'
        ]
