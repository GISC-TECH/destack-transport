# transport/serializers/multa_sinistro_serializers.py
"""Serializers para Multas e Sinistros."""

from rest_framework import serializers

from ..models import Motorista, Multa, Sinistro, Veiculo


class MultaListSerializer(serializers.ModelSerializer):
    """Serializer otimizado para listagem de multas."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    gravidade_display = serializers.CharField(source='get_gravidade_display', read_only=True)

    class Meta:
        model = Multa
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'motorista', 'motorista_nome',
            'data_infracao', 'auto_infracao', 'descricao', 'gravidade',
            'gravidade_display', 'pontos', 'valor', 'data_vencimento', 'status', 'status_display'
        ]


class MultaSerializer(serializers.ModelSerializer):
    """Serializer completo para multa."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    gravidade_display = serializers.CharField(source='get_gravidade_display', read_only=True)

    class Meta:
        model = Multa
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'motorista', 'motorista_nome',
            'data_infracao', 'local', 'descricao', 'auto_infracao', 'gravidade',
            'gravidade_display', 'pontos', 'valor', 'data_vencimento',
            'data_pagamento', 'status', 'status_display', 'comprovante',
            'observacao', 'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('criado_em', 'atualizado_em')


class MultaCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/edição de multa."""

    veiculo = serializers.PrimaryKeyRelatedField(queryset=Veiculo.objects.all())
    motorista = serializers.PrimaryKeyRelatedField(
        queryset=Motorista.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Multa
        fields = [
            'id', 'veiculo', 'motorista', 'data_infracao', 'local', 'descricao',
            'auto_infracao', 'gravidade', 'pontos', 'valor', 'data_vencimento',
            'data_pagamento', 'status', 'comprovante', 'observacao'
        ]


class SinistroListSerializer(serializers.ModelSerializer):
    """Serializer otimizado para listagem de sinistros."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Sinistro
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'motorista', 'motorista_nome',
            'data', 'tipo', 'tipo_display', 'descricao', 'custo_total',
            'status', 'status_display', 'numero_sinistro'
        ]


class SinistroSerializer(serializers.ModelSerializer):
    """Serializer completo para sinistro."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Sinistro
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'motorista', 'motorista_nome',
            'data', 'local', 'tipo', 'tipo_display', 'descricao',
            'envolvidos_terceiros', 'custo_total', 'status', 'status_display',
            'numero_sinistro', 'seguradora', 'comprovante', 'observacao',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('criado_em', 'atualizado_em')


class SinistroCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/edição de sinistro."""

    veiculo = serializers.PrimaryKeyRelatedField(queryset=Veiculo.objects.all())
    motorista = serializers.PrimaryKeyRelatedField(
        queryset=Motorista.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Sinistro
        fields = [
            'id', 'veiculo', 'motorista', 'data', 'local', 'tipo', 'descricao',
            'envolvidos_terceiros', 'custo_total', 'status', 'numero_sinistro',
            'seguradora', 'comprovante', 'observacao'
        ]
