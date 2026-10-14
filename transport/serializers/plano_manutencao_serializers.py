# transport/serializers/plano_manutencao_serializers.py
"""Serializers para Planos de Manutenção."""

from rest_framework import serializers

from ..models import PlanoManutencao, Veiculo


class PlanoManutencaoListSerializer(serializers.ModelSerializer):
    """Serializer otimizado para listagem de planos."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = PlanoManutencao
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'tipo', 'tipo_display', 'descricao',
            'intervalo_km', 'intervalo_dias', 'ultima_km', 'ultima_data',
            'proxima_km', 'proxima_data', 'ativo'
        ]


class PlanoManutencaoSerializer(serializers.ModelSerializer):
    """Serializer completo para plano de manutenção."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = PlanoManutencao
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'tipo', 'tipo_display', 'descricao',
            'intervalo_km', 'intervalo_dias', 'ultima_km', 'ultima_data',
            'proxima_km', 'proxima_data', 'ativo', 'observacao',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('criado_em', 'atualizado_em')


class PlanoManutencaoCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/edição de plano de manutenção."""

    veiculo = serializers.PrimaryKeyRelatedField(queryset=Veiculo.objects.all())

    class Meta:
        model = PlanoManutencao
        fields = [
            'id', 'veiculo', 'tipo', 'descricao', 'intervalo_km', 'intervalo_dias',
            'ultima_km', 'ultima_data', 'proxima_km', 'proxima_data', 'ativo', 'observacao'
        ]

    def validate(self, data):
        intervalo_km = data.get('intervalo_km')
        intervalo_dias = data.get('intervalo_dias')
        if not intervalo_km and not intervalo_dias:
            raise serializers.ValidationError(
                'Informe pelo menos um intervalo (KM ou Dias).'
            )
        return data
