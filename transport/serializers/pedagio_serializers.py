# transport/serializers/pedagio_serializers.py
"""Serializers para Pedágio."""

from rest_framework import serializers

from ..models import OrdemViagem, Pedagio, Veiculo


class PedagioListSerializer(serializers.ModelSerializer):
    """Serializer otimizado para listagem de pedágios."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    ordem_numero = serializers.CharField(source='ordem.numero', read_only=True)

    class Meta:
        model = Pedagio
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'ordem', 'ordem_numero',
            'data', 'praca', 'rodovia', 'km', 'categoria', 'tag', 'valor'
        ]


class PedagioSerializer(serializers.ModelSerializer):
    """Serializer completo para pedágio."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    ordem_numero = serializers.CharField(source='ordem.numero', read_only=True)

    class Meta:
        model = Pedagio
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'ordem', 'ordem_numero',
            'data', 'praca', 'rodovia', 'km', 'categoria', 'tag', 'valor',
            'comprovante', 'observacao', 'criado_em'
        ]
        read_only_fields = ('criado_em',)


class PedagioCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/edição de pedágio."""

    veiculo = serializers.PrimaryKeyRelatedField(queryset=Veiculo.objects.all())
    ordem = serializers.PrimaryKeyRelatedField(
        queryset=OrdemViagem.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Pedagio
        fields = [
            'id', 'veiculo', 'ordem', 'data', 'praca', 'rodovia', 'km',
            'categoria', 'tag', 'valor', 'comprovante', 'observacao'
        ]

    def validate(self, data):
        valor = data.get('valor')
        if valor is not None and valor < 0:
            raise serializers.ValidationError({'valor': 'Valor não pode ser negativo.'})
        return data
