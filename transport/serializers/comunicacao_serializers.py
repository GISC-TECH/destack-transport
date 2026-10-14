"""Serializers para Mensagem de Comunicação."""
from rest_framework import serializers

from ..models import MensagemComunicacao


class MensagemComunicacaoSerializer(serializers.ModelSerializer):
    """Serializer para histórico de comunicações."""

    cliente_nome = serializers.CharField(source='cliente.razao_social', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    ordem_numero = serializers.CharField(source='ordem.numero', read_only=True)

    class Meta:
        model = MensagemComunicacao
        fields = [
            'id', 'canal', 'destinatario', 'assunto', 'conteudo',
            'status', 'erro', 'cliente', 'cliente_nome',
            'motorista', 'motorista_nome', 'ordem', 'ordem_numero',
            'enviado_em', 'criado_em'
        ]
