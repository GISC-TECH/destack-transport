# transport/serializers/vehicle_serializers.py

from rest_framework import serializers

# Importar modelos relevantes
from ..models import Veiculo, ManutencaoVeiculo, CompartimentacaoVeiculo

# ==============================================
# === Serializers Veículos e Manutenções ===
# ==============================================

class ManutencaoVeiculoSerializer(serializers.ModelSerializer):
    """ Serializer para o modelo ManutencaoVeiculo. """
    # Campo para exibir dados do veículo relacionado (apenas leitura)
    veiculo_placa = serializers.SerializerMethodField(read_only=True)
    # Campos para exibir no frontend (objeto veiculo com placa e modelo)
    veiculo_info = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ManutencaoVeiculo
        fields = [
            'id', 'veiculo', 'veiculo_placa', 'veiculo_info',
            'tipo', 'descricao', 'data_agendada', 'data_realizada',
            'quilometragem', 'custo', 'fornecedor', 'status',
            'observacoes', 'nota_fiscal', 'arquivo_nota',
            # Campos legados para compatibilidade
            'data_servico', 'servico_realizado', 'oficina',
            'peca_utilizada', 'valor_peca', 'valor_mao_obra', 'valor_total',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ('valor_total', 'criado_em', 'atualizado_em', 'veiculo_placa', 'veiculo_info')
        extra_kwargs = {
            'veiculo': {'required': False},
            # Campos legados são opcionais
            'data_servico': {'required': False},
            'servico_realizado': {'required': False},
            'oficina': {'required': False},
            'peca_utilizada': {'required': False},
            'valor_peca': {'required': False},
            'valor_mao_obra': {'required': False},
        }

    def get_veiculo_placa(self, obj):
        """Retorna a placa do veículo com tratamento de erro."""
        try:
            if obj.veiculo:
                return obj.veiculo.placa
        except Exception:
            pass
        return None

    def get_veiculo_info(self, obj):
        """Retorna info do veículo no formato esperado pelo frontend."""
        try:
            if obj.veiculo:
                return {
                    'id': obj.veiculo.id,
                    'placa': obj.veiculo.placa,
                    'modelo': getattr(obj.veiculo, 'modelo', '') or ''
                }
        except Exception:
            pass
        return None


class CompartimentacaoVeiculoSerializer(serializers.ModelSerializer):
    """Serializer para Compartimentação de Veículo."""

    class Meta:
        model = CompartimentacaoVeiculo
        fields = ['id', 'numero_boca', 'capacidade_m3', 'veiculo']
        read_only_fields = ('id', 'veiculo')  # veiculo é setado automaticamente
        extra_kwargs = {
            'veiculo': {'required': False}  # Será setado automaticamente em nested routes
        }

    def validate_numero_boca(self, value):
        """Valida número da boca."""
        if value < 1 or value > 9:
            raise serializers.ValidationError("Número da boca deve estar entre 1 e 9.")
        return value


class VeiculoSerializer(serializers.ModelSerializer):
    """ Serializer completo para o modelo Veiculo (ATUALIZADO). """

    # Compartimentos agora são writable (não mais read_only)
    compartimentos = CompartimentacaoVeiculoSerializer(many=True, required=False)
    documentos_vencendo = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Veiculo
        # Lista os campos a serem incluídos (ATUALIZADO com novos campos)
        fields = [
            'id', 'placa', 'renavam', 'tara', 'capacidade_kg', 'capacidade_m3',
            'tipo_rodado', 'tipo_carroceria',
            'tipo_proprietario', 'proprietario_cnpj', 'proprietario_cpf',
            'proprietario_nome', 'rntrc_proprietario', 'uf_proprietario',
            'civ_validade', 'cipp_validade', 'afericao_validade',
            'crlv_validade', 'cronotacografo_validade', 'seguro_validade', 'laudo_vistoria_validade',
            'ativo', 'observacoes', 'compartimentos', 'documentos_vencendo',
            'gps_identificador', 'gps_provedor', 'gps_ultima_sincronizacao',
            'criado_em', 'atualizado_em'
        ]
        # Campos de data/hora são apenas leitura
        read_only_fields = ('id', 'criado_em', 'atualizado_em')

    def get_documentos_vencendo(self, obj):
        """Retorna documentos que vencem em 30 dias."""
        return obj.get_documentos_vencendo(dias=30)

    def validate_compartimentos(self, compartimentos):
        """Valida que não há numero_boca duplicados."""
        if not compartimentos:
            return compartimentos

        numeros_boca = [c.get('numero_boca') for c in compartimentos]
        if len(numeros_boca) != len(set(numeros_boca)):
            raise serializers.ValidationError(
                "Não é permitido ter compartimentos com o mesmo número de boca."
            )
        return compartimentos

    def create(self, validated_data):
        """Cria veículo com compartimentos aninhados."""
        compartimentos_data = validated_data.pop('compartimentos', [])
        veiculo = Veiculo.objects.create(**validated_data)

        for comp_data in compartimentos_data:
            CompartimentacaoVeiculo.objects.create(veiculo=veiculo, **comp_data)

        return veiculo

    def update(self, instance, validated_data):
        """Atualiza veículo e sincroniza compartimentos."""
        compartimentos_data = validated_data.pop('compartimentos', None)

        # Atualiza campos do veículo
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Se compartimentos foram enviados, sincroniza (substitui todos)
        if compartimentos_data is not None:
            # Remove compartimentos existentes
            instance.compartimentos.all().delete()

            # Cria novos compartimentos
            for comp_data in compartimentos_data:
                CompartimentacaoVeiculo.objects.create(veiculo=instance, **comp_data)

        return instance

# --- Serializers para Painel de Manutenção ---
# Estes não são ModelSerializers, pois formatam dados agregados da view

class ManutencaoIndicadoresSerializer(serializers.Serializer):
    """ Serializer para os indicadores gerais do painel de manutenção. """
    total_manutencoes = serializers.IntegerField(required=False)
    total_pecas = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    total_mao_obra = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    valor_total = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    filtros = serializers.DictField(required=False) # Para mostrar os filtros aplicados

class ManutencaoGraficosSerializer(serializers.Serializer):
    """ Serializer para os dados dos gráficos do painel de manutenção. """
    por_status = serializers.ListField(child=serializers.DictField(), required=False)
    por_veiculo = serializers.ListField(child=serializers.DictField(), required=False)
    por_periodo = serializers.ListField(child=serializers.DictField(), required=False)
    filtros = serializers.DictField(required=False) # Para mostrar os filtros aplicados