# transport/serializers/payment_serializers.py

import logging

from django.db import transaction
from rest_framework import serializers
from rest_framework.reverse import reverse

# Importar modelos relevantes
from ..models import FaixaKM, PagamentoAgregado, PagamentoProprio, ContaPagar, CTeDocumento # CTeDocumento para o link
from ..validators import validar_cpf


logger = logging.getLogger(__name__)

COMPROVANTE_MAX_BYTES = 10 * 1024 * 1024
COMPROVANTE_ASSINATURAS = {
    '.pdf': (b'%PDF-',),
    '.png': (b'\x89PNG\r\n\x1a\n',),
    '.jpg': (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
}


def validar_comprovante(value):
    """Aceita apenas PDF/JPEG/PNG reais e limita cada comprovante a 10 MB."""
    if value is None:
        return value
    if value.size > COMPROVANTE_MAX_BYTES:
        raise serializers.ValidationError('O comprovante deve ter no máximo 10 MB.')

    nome = value.name.lower()
    extensao = next((ext for ext in COMPROVANTE_ASSINATURAS if nome.endswith(ext)), None)
    if not extensao:
        raise serializers.ValidationError('Envie o comprovante em PDF, JPG ou PNG.')

    posicao = value.tell() if hasattr(value, 'tell') else 0
    cabecalho = value.read(8)
    if hasattr(value, 'seek'):
        value.seek(posicao)
    if not any(cabecalho.startswith(assinatura) for assinatura in COMPROVANTE_ASSINATURAS[extensao]):
        raise serializers.ValidationError('O conteúdo do comprovante não corresponde ao tipo do arquivo.')
    return value


def _so_digitos(value):
    """Remove caracteres não numéricos, preservando vazio."""
    if value is None:
        return ''
    return str(value).replace('.', '').replace('-', '').replace('/', '').strip()


class ComprovanteCleanupMixin:
    """Remove do storage o comprovante substituido/removido apos o commit."""

    def update(self, instance, validated_data):
        comprovante_anterior = instance.comprovante
        nome_anterior = comprovante_anterior.name if comprovante_anterior else ''
        storage_anterior = comprovante_anterior.storage if comprovante_anterior else None

        instance = super().update(instance, validated_data)
        nome_atual = instance.comprovante.name if instance.comprovante else ''

        if nome_anterior and nome_anterior != nome_atual:
            def remover_comprovante_anterior():
                try:
                    storage_anterior.delete(nome_anterior)
                except Exception:
                    logger.exception(
                        'Falha ao remover comprovante substituido do storage: %s',
                        nome_anterior,
                    )

            transaction.on_commit(remover_comprovante_anterior)
        return instance

# ===================================================
# === Serializers Pagamentos e Parametrização ===
# ===================================================

class ContaPagarSerializer(serializers.ModelSerializer):
    """Serializer para o modelo ContaPagar."""
    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True, allow_null=True)

    def validate(self, data):
        """Valida regras de integridade para contas a pagar."""
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
            'data_vencimento', 'data_pagamento', 'status', 'comprovante',
            'veiculo', 'veiculo_placa', 'observacao',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('veiculo_placa', 'criado_em', 'atualizado_em')
        extra_kwargs = {
            'veiculo': {'required': False, 'allow_null': True},
        }


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


class PagamentoAgregadoSerializer(ComprovanteCleanupMixin, serializers.ModelSerializer):
    """ Serializer para o modelo PagamentoAgregado. """
    # Campos somente leitura para exibir informações do CT-e relacionado
    cte_id = serializers.UUIDField(source='cte.id', read_only=True, allow_null=True)
    cte_chave = serializers.CharField(source='cte.chave', read_only=True)
    cte_numero = serializers.IntegerField(source='cte.identificacao.numero', read_only=True, allow_null=True)
    cte_data_emissao = serializers.DateTimeField(source='cte.identificacao.data_emissao', read_only=True, allow_null=True, format='%d/%m/%Y')
    comprovante_url = serializers.SerializerMethodField(read_only=True)
    comprovante = serializers.FileField(write_only=True, required=False, allow_null=True)
    tem_comprovante = serializers.SerializerMethodField(read_only=True)

    def get_comprovante_url(self, obj):
        if obj.comprovante:
            return reverse(
                'pagamento-agregado-comprovante',
                kwargs={'pk': obj.pk},
                request=self.context.get('request'),
            )
        return None

    def get_tem_comprovante(self, obj):
        return bool(obj.comprovante)

    def validate_condutor_cpf(self, value):
        """Normaliza e valida o CPF do condutor."""
        if not value:
            return value
        cpf_limpo = _so_digitos(value)
        if cpf_limpo:
            validar_cpf(cpf_limpo)
        return cpf_limpo

    def validate_comprovante(self, value):
        return validar_comprovante(value)

    def validate(self, data):
        """Valida regras de integridade para pagamentos agregados."""
        # Se é uma criação (não tem instance), cte é obrigatório
        if self.instance is None:
            if 'cte' not in data:
                raise serializers.ValidationError({'cte': 'CT-e é obrigatório para criar um pagamento agregado.'})
            if not data.get('condutor_nome'):
                raise serializers.ValidationError({'condutor_nome': 'Nome do condutor é obrigatório.'})
            if not data.get('placa'):
                raise serializers.ValidationError({'placa': 'Placa do veículo é obrigatória.'})
        status_final = data.get('status', getattr(self.instance, 'status', None))
        data_pagamento_final = data.get('data_pagamento', getattr(self.instance, 'data_pagamento', None))
        if status_final == 'pago' and not data_pagamento_final:
            raise serializers.ValidationError({
                'data_pagamento': 'Data de pagamento é obrigatória quando o status é pago.'
            })
        return data

    class Meta:
        model = PagamentoAgregado
        # Lista os campos a serem incluídos
        fields = [
            'id', 'cte', 'cte_id', 'cte_chave', 'cte_numero', 'cte_data_emissao', # Campos do CT-e
            'placa', 'condutor_cpf', 'condutor_nome',
            'valor_frete_total', 'percentual_repasse', 'desconto', 'valor_repassado', # desconto e valor_repassado (calculado)
            'obs', 'status', 'data_prevista', 'data_pagamento',
            'comprovante', 'comprovante_url', 'tem_comprovante',
            'criado_em', 'atualizado_em'
        ]
        # Campos que não podem ser definidos diretamente na criação/atualização
        # valor_repassado é calculado automaticamente pelo model.save()
        read_only_fields = ('valor_repassado', 'criado_em', 'atualizado_em', 'cte_id', 'cte_chave', 'cte_numero', 'cte_data_emissao')
        # CT-e é write_only mas não required no serializer (model constraint garante na criação)
        # Isso permite PATCH sem enviar cte
        extra_kwargs = {'cte': {'write_only': True, 'required': False}}

class PagamentoProprioSerializer(ComprovanteCleanupMixin, serializers.ModelSerializer):
    """ Serializer para o modelo PagamentoProprio. """
    comprovante_url = serializers.SerializerMethodField(read_only=True)
    comprovante = serializers.FileField(write_only=True, required=False, allow_null=True)
    tem_comprovante = serializers.SerializerMethodField(read_only=True)

    def get_comprovante_url(self, obj):
        if obj.comprovante:
            return reverse(
                'pagamento-proprio-comprovante',
                kwargs={'pk': obj.pk},
                request=self.context.get('request'),
            )
        return None

    def get_tem_comprovante(self, obj):
        return bool(obj.comprovante)

    def validate_motorista_cpf(self, value):
        """Normaliza e valida o CPF do motorista."""
        if not value:
            return value
        cpf_limpo = _so_digitos(value)
        if cpf_limpo:
            validar_cpf(cpf_limpo)
        return cpf_limpo

    def validate_comprovante(self, value):
        return validar_comprovante(value)

    def validate(self, data):
        """Valida regras de integridade para pagamentos próprios."""
        if self.instance is None:
            # Criação - campos obrigatórios
            if not data.get('veiculo'):
                raise serializers.ValidationError({'veiculo': 'Veículo é obrigatório para criar um pagamento próprio.'})
            if not data.get('periodo'):
                raise serializers.ValidationError({'periodo': 'Período é obrigatório para criar um pagamento próprio.'})
        status_final = data.get('status', getattr(self.instance, 'status', None))
        data_pagamento_final = data.get('data_pagamento', getattr(self.instance, 'data_pagamento', None))
        if status_final == 'pago' and not data_pagamento_final:
            raise serializers.ValidationError({
                'data_pagamento': 'Data de pagamento é obrigatória quando o status é pago.'
            })
        return data

    # Campos somente leitura
    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    veiculo_modelo = serializers.CharField(source='veiculo.modelo', read_only=True, allow_null=True)
    veiculo_marca = serializers.CharField(source='veiculo.marca', read_only=True, allow_null=True)
    valor_total_pagar = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    # Alias para valor_repassado (compatibilidade com frontend Agregados)
    valor_repassado = serializers.DecimalField(source='valor_base_faixa', max_digits=12, decimal_places=2, read_only=True)
    # Alias para condutor (compatibilidade com frontend Agregados)
    condutor_nome = serializers.CharField(source='motorista_nome', read_only=True, allow_null=True)
    condutor_cpf = serializers.CharField(source='motorista_cpf', read_only=True, allow_null=True)
    # Alias placa direto
    placa = serializers.CharField(source='veiculo.placa', read_only=True)
    # Campos do CT-e vinculado (se houver)
    cte_chave = serializers.CharField(source='cte.chave', read_only=True, allow_null=True)
    cte_remetente_nome = serializers.CharField(source='cte.remetente.razao_social', read_only=True, allow_null=True)
    cte_destinatario_nome = serializers.CharField(source='cte.destinatario.razao_social', read_only=True, allow_null=True)
    cte_valor_total = serializers.DecimalField(source='cte.prestacao.valor_total_prestado', max_digits=12, decimal_places=2, read_only=True, allow_null=True)
    cte_data_emissao = serializers.DateTimeField(
        source='cte.identificacao.data_emissao', read_only=True,
        allow_null=True, format='%d/%m/%Y'
    )

    class Meta:
        model = PagamentoProprio
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'veiculo_modelo', 'veiculo_marca', 'placa', 'periodo',
            # Campos de CT-e (novos para detalhamento)
            'cte', 'cte_chave', 'cte_numero', 'cte_remetente_nome', 'cte_destinatario_nome', 'cte_valor_total', 'cte_data_emissao',
            # Campos de condutor (novos para detalhamento)
            'motorista_nome', 'motorista_cpf', 'condutor_nome', 'condutor_cpf',
            # Campos de pagamento
            'data_prevista',
            'km_total_periodo', 'valor_base_faixa', 'valor_repassado', 'ajustes', 'valor_total_pagar',
            'status', 'data_pagamento', 'comprovante', 'comprovante_url', 'tem_comprovante', 'obs',
            'criado_em', 'atualizado_em'
        ]
        # Campos calculados ou definidos internamente/pela view
        read_only_fields = (
            'valor_repassado', 'criado_em', 'atualizado_em',
            'veiculo_placa', 'veiculo_modelo', 'veiculo_marca', 'placa', 'condutor_nome', 'condutor_cpf',
            'cte_chave', 'cte_remetente_nome', 'cte_destinatario_nome', 'cte_valor_total', 'cte_data_emissao'
        )
        # CT-e e veículo são write_only mas não required no serializer para permitir PATCH
        # Model constraints garantem na criação
        extra_kwargs = {
            'veiculo': {'write_only': True, 'required': False},
            'periodo': {'required': False},  # Required apenas para criação, não para PATCH
            'cte': {'write_only': True, 'required': False},
        }
