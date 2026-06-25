# transport/serializers/fatura_serializers.py
"""Serializers para contas a receber (Faturas)."""

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from ..models import Cliente, CTeDocumento, Fatura, FaturaItem


class FaturaItemSerializer(serializers.ModelSerializer):
    """Serializer de leitura para itens de fatura."""

    cte_id = serializers.UUIDField(source='cte.id', read_only=True, allow_null=True)
    cte_chave = serializers.CharField(source='cte.chave', read_only=True, allow_null=True)
    cte_numero = serializers.IntegerField(
        source='cte.identificacao.numero', read_only=True, allow_null=True
    )
    cte_data_emissao = serializers.DateTimeField(
        source='cte.identificacao.data_emissao',
        read_only=True,
        allow_null=True,
        format='%d/%m/%Y'
    )

    class Meta:
        model = FaturaItem
        fields = [
            'id', 'cte_id', 'cte_chave', 'cte_numero', 'cte_data_emissao',
            'descricao', 'valor', 'criado_em'
        ]


class FaturaItemCreateSerializer(serializers.ModelSerializer):
    """Serializer de escrita para itens de fatura."""

    cte = serializers.PrimaryKeyRelatedField(
        queryset=CTeDocumento.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = FaturaItem
        fields = ['cte', 'descricao', 'valor']


class FaturaListSerializer(serializers.ModelSerializer):
    """Serializer otimizado para listagem de faturas."""

    cliente_nome = serializers.CharField(source='cliente.razao_social', read_only=True)
    itens_count = serializers.IntegerField(source='itens.count', read_only=True)

    class Meta:
        model = Fatura
        fields = [
            'id', 'numero', 'cliente', 'cliente_nome', 'data_emissao',
            'data_vencimento', 'status', 'valor_total', 'itens_count'
        ]


class FaturaSerializer(serializers.ModelSerializer):
    """Serializer completo para leitura de fatura (com itens)."""

    cliente_nome = serializers.CharField(source='cliente.razao_social', read_only=True)
    itens = FaturaItemSerializer(many=True, read_only=True)

    class Meta:
        model = Fatura
        fields = [
            'id', 'numero', 'cliente', 'cliente_nome', 'data_emissao',
            'data_vencimento', 'status', 'valor_total', 'observacao',
            'itens', 'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('criado_em', 'atualizado_em', 'cliente_nome', 'itens')


class FaturaCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/edição de fatura com itens aninhados."""

    itens = FaturaItemCreateSerializer(many=True)
    cliente = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all())

    class Meta:
        model = Fatura
        fields = [
            'id', 'numero', 'cliente', 'data_emissao', 'data_vencimento',
            'status', 'valor_total', 'observacao', 'itens'
        ]
        read_only_fields = ('valor_total',)

    def validate(self, data):
        itens = data.get('itens')
        # Exige itens apenas na criação; em atualizações parciais o campo pode ser omitido
        if self.instance is None and not itens:
            raise serializers.ValidationError({'itens': 'A fatura deve possuir pelo menos um item.'})
        return data

    @transaction.atomic
    def create(self, validated_data):
        itens_data = validated_data.pop('itens', [])
        validated_data['valor_total'] = Decimal('0.00')
        fatura = Fatura.objects.create(**validated_data)
        total = self._salvar_itens(fatura, itens_data)
        fatura.valor_total = total
        fatura.save(update_fields=['valor_total', 'atualizado_em'])
        return fatura

    @transaction.atomic
    def update(self, instance, validated_data):
        itens_data = validated_data.pop('itens', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if itens_data is not None:
            instance.itens.all().delete()
            total = self._salvar_itens(instance, itens_data)
            instance.valor_total = total

        instance.save()
        return instance

    def _salvar_itens(self, fatura, itens_data):
        total = Decimal('0.00')
        for item_data in itens_data:
            valor = item_data.get('valor') or Decimal('0.00')
            FaturaItem.objects.create(fatura=fatura, **item_data)
            total += valor
        return total
