# transport/serializers/posicao_veiculo_serializers.py
"""Serializers para Posição do Veículo e ETA."""

from rest_framework import serializers

from ..models import OrdemViagem, PosicaoVeiculo, Veiculo


class PosicaoVeiculoSerializer(serializers.ModelSerializer):
    """Serializer para posição do veículo."""

    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    ordem_numero = serializers.CharField(source='ordem.numero', read_only=True)

    class Meta:
        model = PosicaoVeiculo
        fields = [
            'id', 'ordem', 'ordem_numero', 'veiculo', 'veiculo_placa',
            'latitude', 'longitude', 'velocidade', 'data_hora', 'fonte'
        ]
        read_only_fields = ('data_hora',)


class PosicaoVeiculoCreateSerializer(serializers.ModelSerializer):
    """Serializer para criação de posição."""

    ordem = serializers.PrimaryKeyRelatedField(queryset=OrdemViagem.objects.all())
    veiculo = serializers.PrimaryKeyRelatedField(queryset=Veiculo.objects.all())

    class Meta:
        model = PosicaoVeiculo
        fields = ['ordem', 'veiculo', 'latitude', 'longitude', 'velocidade', 'fonte']


class ETASerializer(serializers.Serializer):
    """Serializer para resposta de ETA."""

    ordem_id = serializers.UUIDField()
    ultima_posicao = PosicaoVeiculoSerializer()
    distancia_restante_km = serializers.IntegerField()
    velocidade_media_kmh = serializers.IntegerField()
    eta_horas = serializers.FloatField()
    eta_texto = serializers.CharField()
    status = serializers.CharField()
