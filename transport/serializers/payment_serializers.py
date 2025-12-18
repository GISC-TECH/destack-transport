# transport/serializers/payment_serializers.py

from rest_framework import serializers

# Importar modelos relevantes
from ..models import FaixaKM, PagamentoAgregado, PagamentoProprio, CTeDocumento # CTeDocumento para o link

# ===================================================
# === Serializers Pagamentos e Parametrização ===
# ===================================================

class FaixaKMSerializer(serializers.ModelSerializer):
    """ Serializer para o modelo FaixaKM. """
    class Meta:
        model = FaixaKM
        fields = '__all__' # Inclui todos os campos: id, min_km, max_km, valor_pago

    # Validações podem ser adicionadas aqui também, além da view
    def validate(self, data):
        min_km = data.get('min_km')
        max_km = data.get('max_km')

        if max_km is not None and min_km is not None and max_km <= min_km:
            raise serializers.ValidationError("O KM máximo deve ser maior que o KM mínimo.")

        # Validação de sobreposição (pode ser complexa aqui, melhor na view com acesso ao DB)
        # ...

        return data


class PagamentoAgregadoSerializer(serializers.ModelSerializer):
    """ Serializer para o modelo PagamentoAgregado. """
    # Campos somente leitura para exibir informações do CT-e relacionado
    cte_chave = serializers.CharField(source='cte.chave', read_only=True)
    cte_numero = serializers.IntegerField(source='cte.identificacao.numero', read_only=True, allow_null=True)
    cte_data_emissao = serializers.DateTimeField(source='cte.identificacao.data_emissao', read_only=True, allow_null=True, format='%d/%m/%Y')

    class Meta:
        model = PagamentoAgregado
        # Lista os campos a serem incluídos
        fields = [
            'id', 'cte', 'cte_chave', 'cte_numero', 'cte_data_emissao', # Campos do CT-e
            'placa', 'condutor_cpf', 'condutor_nome',
            'valor_frete_total', 'percentual_repasse', 'valor_repassado', # Valor repassado é calculado
            'obs', 'status', 'data_prevista', 'data_pagamento',
            'criado_em', 'atualizado_em'
        ]
        # Campos que não podem ser definidos diretamente na criação/atualização
        read_only_fields = ('criado_em', 'atualizado_em', 'cte_chave', 'cte_numero', 'cte_data_emissao')
        # CT-e é obrigatório (relação 1:1)
        extra_kwargs = {'cte': {'write_only': True, 'required': True}}

class PagamentoProprioSerializer(serializers.ModelSerializer):
    """ Serializer para o modelo PagamentoProprio. """
    # Campos somente leitura
    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    valor_total_pagar = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    # Alias para valor_repassado (compatibilidade com frontend Agregados)
    valor_repassado = serializers.DecimalField(source='valor_base_faixa', max_digits=12, decimal_places=2, read_only=True)
    # Alias para condutor (compatibilidade com frontend Agregados)
    condutor_nome = serializers.CharField(source='motorista_nome', read_only=True, allow_null=True)
    condutor_cpf = serializers.CharField(source='motorista_cpf', read_only=True, allow_null=True)
    # Alias placa direto
    placa = serializers.CharField(source='veiculo.placa', read_only=True)
    # Campos do CT-e vinculado (se houver)
    cte_chave = serializers.CharField(source='cte.chave', read_only=True, allow_null=True)
    cte_data_emissao = serializers.DateTimeField(
        source='cte.identificacao.data_emissao', read_only=True,
        allow_null=True, format='%d/%m/%Y'
    )

    class Meta:
        model = PagamentoProprio
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'placa', 'periodo',
            # Campos de CT-e (novos para detalhamento)
            'cte', 'cte_chave', 'cte_numero', 'cte_data_emissao',
            # Campos de condutor (novos para detalhamento)
            'motorista_nome', 'motorista_cpf', 'condutor_nome', 'condutor_cpf',
            # Campos de pagamento
            'data_prevista',
            'km_total_periodo', 'valor_base_faixa', 'valor_repassado', 'ajustes', 'valor_total_pagar',
            'status', 'data_pagamento', 'obs',
            'criado_em', 'atualizado_em'
        ]
        # Campos calculados ou definidos internamente/pela view
        read_only_fields = (
            'valor_repassado', 'criado_em', 'atualizado_em',
            'veiculo_placa', 'placa', 'condutor_nome', 'condutor_cpf',
            'cte_chave', 'cte_data_emissao'
        )
        # CT-e e veículo são obrigatórios (relação 1:1)
        extra_kwargs = {
            'veiculo': {'write_only': True, 'required': True},
            'periodo': {'required': True},
            'cte': {'write_only': True, 'required': True},
        }