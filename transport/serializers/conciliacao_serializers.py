# transport/serializers/conciliacao_serializers.py
"""Serializers para conciliação bancária."""

from rest_framework import serializers

from ..models import Fatura, ContaPagar, TransacaoBancaria


class FaturaSerializer(serializers.ModelSerializer):
    """Serializer enxuto para Fatura (compatibilidade com conciliação bancária)."""
    cliente_nome = serializers.CharField(source='cliente.razao_social', read_only=True, allow_null=True)

    class Meta:
        model = Fatura
        fields = [
            'id', 'numero', 'cliente', 'cliente_nome', 'valor_total',
            'data_emissao', 'data_vencimento', 'status',
            'observacao', 'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('criado_em', 'atualizado_em', 'cliente_nome')


class ContaPagarSerializer(serializers.ModelSerializer):
    """Serializer para Conta a Pagar."""
    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True, allow_null=True)

    def validate(self, data):
        status_final = data.get('status', getattr(self.instance, 'status', None))
        data_pagamento_final = data.get('data_pagamento', getattr(self.instance, 'data_pagamento', None))
        if status_final == 'paga' and not data_pagamento_final:
            raise serializers.ValidationError({
                'data_pagamento': 'Data de pagamento é obrigatória quando o status é paga.'
            })
        return data

    class Meta:
        model = ContaPagar
        fields = [
            'id', 'descricao', 'categoria', 'fornecedor', 'valor',
            'data_vencimento', 'data_pagamento',
            'status', 'comprovante', 'veiculo', 'veiculo_placa',
            'observacao', 'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('criado_em', 'atualizado_em', 'veiculo_placa')
        extra_kwargs = {
            'veiculo': {'required': False, 'allow_null': True},
        }


class TransacaoBancariaSerializer(serializers.ModelSerializer):
    """Serializer para Transação Bancária."""
    fatura_numero = serializers.CharField(source='fatura.numero', read_only=True, allow_null=True)
    conta_pagar_descricao = serializers.CharField(source='conta_pagar.descricao', read_only=True, allow_null=True)

    class Meta:
        model = TransacaoBancaria
        fields = [
            'id', 'data', 'descricao', 'valor', 'tipo',
            'arquivo_origem', 'conciliado',
            'fatura', 'fatura_numero',
            'conta_pagar', 'conta_pagar_descricao',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = (
            'arquivo_origem', 'criado_em', 'atualizado_em',
            'fatura_numero', 'conta_pagar_descricao'
        )


class TransacaoBancariaListSerializer(serializers.ModelSerializer):
    """Serializer enxuto para listagem de transações."""
    fatura_numero = serializers.CharField(source='fatura.numero', read_only=True, allow_null=True)
    conta_pagar_descricao = serializers.CharField(source='conta_pagar.descricao', read_only=True, allow_null=True)

    class Meta:
        model = TransacaoBancaria
        fields = [
            'id', 'data', 'descricao', 'valor', 'tipo',
            'arquivo_origem', 'conciliado',
            'fatura_id', 'fatura_numero',
            'conta_pagar_id', 'conta_pagar_descricao'
        ]


class VincularTransacaoSerializer(serializers.Serializer):
    """Serializer para vincular transação a fatura ou conta a pagar."""
    fatura_id = serializers.UUIDField(required=False, allow_null=True)
    conta_pagar_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, data):
        fatura_id = data.get('fatura_id')
        conta_pagar_id = data.get('conta_pagar_id')

        if fatura_id is None and conta_pagar_id is None:
            raise serializers.ValidationError(
                "Informe fatura_id ou conta_pagar_id para vincular."
            )

        if fatura_id is not None and not Fatura.objects.filter(pk=fatura_id).exists():
            raise serializers.ValidationError({'fatura_id': 'Fatura não encontrada.'})

        if conta_pagar_id is not None and not ContaPagar.objects.filter(pk=conta_pagar_id).exists():
            raise serializers.ValidationError({'conta_pagar_id': 'Conta a pagar não encontrada.'})

        return data


class UploadConciliacaoSerializer(serializers.Serializer):
    """Serializer para upload de arquivo de conciliação."""
    arquivo = serializers.FileField(required=True)
