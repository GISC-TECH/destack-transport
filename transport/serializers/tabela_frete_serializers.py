# transport/serializers/tabela_frete_serializers.py
"""Serializers para Tabela de Frete."""

from rest_framework import serializers

from ..models import TabelaFrete


class TabelaFreteListSerializer(serializers.ModelSerializer):
    """Serializer otimizado para listagem de tabelas de frete."""

    class Meta:
        model = TabelaFrete
        fields = [
            'id', 'origem_uf', 'origem_cidade', 'destino_uf', 'destino_cidade',
            'tipo_veiculo', 'valor_por_km', 'valor_minimo', 'valor_tonelada',
            'valor_m3', 'vigencia_inicio', 'vigencia_fim', 'ativo'
        ]


class TabelaFreteSerializer(serializers.ModelSerializer):
    """Serializer completo para tabela de frete."""

    class Meta:
        model = TabelaFrete
        fields = [
            'id', 'origem_uf', 'origem_cidade', 'destino_uf', 'destino_cidade',
            'tipo_veiculo', 'valor_por_km', 'valor_minimo', 'valor_tonelada',
            'valor_m3', 'vigencia_inicio', 'vigencia_fim', 'ativo', 'observacao',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('criado_em', 'atualizado_em')


class SimulacaoFreteSerializer(serializers.Serializer):
    """Serializer para entrada de simulação de frete."""

    origem_uf = serializers.CharField(max_length=2, required=False, allow_blank=True)
    origem_cidade = serializers.CharField(max_length=120, required=False, allow_blank=True)
    destino_uf = serializers.CharField(max_length=2, required=False, allow_blank=True)
    destino_cidade = serializers.CharField(max_length=120, required=False, allow_blank=True)
    tipo_veiculo = serializers.CharField(max_length=50, required=False, allow_blank=True)
    distancia_km = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    peso_kg = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    volume_m3 = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)


class SimulacaoFreteResultadoSerializer(serializers.Serializer):
    """Serializer para resultado de simulação de frete."""

    tabela_id = serializers.UUIDField()
    origem = serializers.CharField()
    destino = serializers.CharField()
    valor_frete = serializers.DecimalField(max_digits=12, decimal_places=2)
    valor_por_km = serializers.DecimalField(max_digits=10, decimal_places=2)
    valor_minimo = serializers.DecimalField(max_digits=12, decimal_places=2)
