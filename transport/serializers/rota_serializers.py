"""Serializers para Rota Otimizada."""
from rest_framework import serializers

from ..models import RotaOtimizada


class RotaOtimizadaSerializer(serializers.ModelSerializer):
    """Serializer completo para RotaOtimizada."""

    class Meta:
        model = RotaOtimizada
        fields = [
            'id', 'ordem', 'distancia_km', 'duracao_min', 'geometria',
            'waypoints', 'provedor', 'status', 'criado_em', 'atualizado_em'
        ]
        read_only_fields = ['id', 'criado_em', 'atualizado_em']


class RotaOtimizadaListSerializer(serializers.ModelSerializer):
    """Serializer resumido para listagem de rotas."""

    class Meta:
        model = RotaOtimizada
        fields = ['id', 'distancia_km', 'duracao_min', 'status', 'criado_em']
