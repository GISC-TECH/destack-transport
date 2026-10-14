# transport/serializers/abastecimento_serializers.py
"""Serializers para Abastecimento."""

from rest_framework import serializers

from ..models import Abastecimento, Motorista, OrdemViagem, Veiculo


class AbastecimentoListSerializer(serializers.ModelSerializer):
    """Serializer otimizado para listagem de abastecimentos."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    combustivel_display = serializers.CharField(source='get_tipo_combustivel_display', read_only=True)

    class Meta:
        model = Abastecimento
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'motorista', 'motorista_nome',
            'data', 'hodometro', 'litros', 'valor_total', 'tipo_combustivel',
            'combustivel_display', 'posto', 'preco_litro', 'consumo_medio'
        ]


class AbastecimentoSerializer(serializers.ModelSerializer):
    """Serializer completo para abastecimento."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    combustivel_display = serializers.CharField(source='get_tipo_combustivel_display', read_only=True)

    class Meta:
        model = Abastecimento
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'motorista', 'motorista_nome',
            'ordem_viagem', 'data', 'hodometro', 'litros', 'valor_total',
            'tipo_combustivel', 'combustivel_display', 'posto', 'cnpj_posto',
            'preco_litro', 'consumo_medio', 'comprovante', 'observacao',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('preco_litro', 'consumo_medio', 'criado_em', 'atualizado_em')


class AbastecimentoCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/edição de abastecimento."""

    veiculo = serializers.PrimaryKeyRelatedField(queryset=Veiculo.objects.all())
    motorista = serializers.PrimaryKeyRelatedField(
        queryset=Motorista.objects.all(), required=False, allow_null=True
    )
    ordem_viagem = serializers.PrimaryKeyRelatedField(
        queryset=OrdemViagem.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Abastecimento
        fields = [
            'id', 'veiculo', 'motorista', 'ordem_viagem', 'data', 'hodometro',
            'litros', 'valor_total', 'tipo_combustivel', 'posto', 'cnpj_posto',
            'comprovante', 'observacao'
        ]

    def validate(self, data):
        litros = data.get('litros')
        valor_total = data.get('valor_total')
        if litros is not None and litros <= 0:
            raise serializers.ValidationError({'litros': 'Litros deve ser maior que zero.'})
        if valor_total is not None and valor_total < 0:
            raise serializers.ValidationError({'valor_total': 'Valor total não pode ser negativo.'})
        return data
