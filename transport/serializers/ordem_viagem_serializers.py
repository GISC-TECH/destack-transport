# transport/serializers/ordem_viagem_serializers.py
"""Serializers para Ordens de Viagem (OS)."""

from rest_framework import serializers

from ..models import (
    CIOT, Cliente, CTeDocumento, DespesaViagem, Motorista, OrdemViagem,
    OrdemViagemCTe, OrdemViagemParada, Veiculo
)


class OrdemViagemCTeSerializer(serializers.ModelSerializer):
    """Serializer para CT-es vinculados a uma ordem de viagem."""

    cte_id = serializers.UUIDField(source='cte.id', read_only=True)
    cte_chave = serializers.CharField(source='cte.chave', read_only=True)
    cte_numero = serializers.IntegerField(
        source='cte.identificacao.numero', read_only=True, allow_null=True
    )

    class Meta:
        model = OrdemViagemCTe
        fields = ['id', 'cte_id', 'cte_chave', 'cte_numero', 'ordem_entrega']


class OrdemViagemParadaSerializer(serializers.ModelSerializer):
    """Serializer para paradas de uma ordem de viagem."""

    class Meta:
        model = OrdemViagemParada
        fields = [
            'id', 'tipo', 'sequencia', 'cidade', 'uf', 'latitude', 'longitude',
            'data_previsao', 'data_realizada', 'observacao'
        ]


class DespesaViagemSerializer(serializers.ModelSerializer):
    """Serializer para despesas de viagem."""

    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)

    class Meta:
        model = DespesaViagem
        fields = [
            'id', 'categoria', 'categoria_display', 'descricao', 'valor',
            'data', 'comprovante', 'criado_em'
        ]
        read_only_fields = ('criado_em',)


class OrdemViagemListSerializer(serializers.ModelSerializer):
    """Serializer otimizado para listagem de ordens de viagem."""

    cliente_nome = serializers.CharField(source='cliente.razao_social', read_only=True)
    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    ctes_count = serializers.IntegerField(source='ctes.count', read_only=True)

    class Meta:
        model = OrdemViagem
        fields = [
            'id', 'numero', 'tipo', 'status', 'status_display',
            'cliente', 'cliente_nome', 'veiculo', 'veiculo_placa',
            'motorista', 'motorista_nome', 'data_saida', 'data_previsao_chegada',
            'origem_cidade', 'origem_uf', 'origem_latitude', 'origem_longitude',
            'destino_cidade', 'destino_uf', 'destino_latitude', 'destino_longitude',
            'ciot', 'ctes_count', 'distancia_km'
        ]


class OrdemViagemSerializer(serializers.ModelSerializer):
    """Serializer completo para leitura de ordem de viagem."""

    cliente_nome = serializers.CharField(source='cliente.razao_social', read_only=True)
    veiculo_placa = serializers.CharField(source='veiculo.placa', read_only=True)
    motorista_nome = serializers.CharField(source='motorista.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    ctes = OrdemViagemCTeSerializer(many=True, read_only=True)
    paradas = OrdemViagemParadaSerializer(many=True, read_only=True)
    despesas = DespesaViagemSerializer(many=True, read_only=True)

    class Meta:
        model = OrdemViagem
        fields = [
            'id', 'numero', 'tipo', 'tipo_display', 'status', 'status_display',
            'cliente', 'cliente_nome', 'veiculo', 'veiculo_placa',
            'motorista', 'motorista_nome', 'data_saida', 'data_retorno',
            'data_previsao_chegada', 'km_inicial', 'km_final', 'distancia_km',
            'origem_uf', 'origem_cidade', 'origem_latitude', 'origem_longitude',
            'destino_uf', 'destino_cidade', 'destino_latitude', 'destino_longitude',
            'ciot', 'observacoes', 'ctes', 'paradas', 'despesas',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = (
            'criado_em', 'atualizado_em', 'cliente_nome', 'veiculo_placa',
            'motorista_nome', 'status_display', 'tipo_display', 'ctes',
            'paradas', 'despesas'
        )


class OrdemViagemCTeCreateSerializer(serializers.ModelSerializer):
    """Serializer de escrita para vínculo de CT-e."""

    cte = serializers.PrimaryKeyRelatedField(queryset=CTeDocumento.objects.all())

    class Meta:
        model = OrdemViagemCTe
        fields = ['cte', 'ordem_entrega']


class OrdemViagemParadaCreateSerializer(serializers.ModelSerializer):
    """Serializer de escrita para paradas."""

    class Meta:
        model = OrdemViagemParada
        fields = [
            'tipo', 'sequencia', 'cidade', 'uf', 'latitude', 'longitude',
            'data_previsao', 'data_realizada', 'observacao'
        ]


class OrdemViagemCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para criação/edição de ordem de viagem com CT-es e paradas aninhados."""

    ctes = OrdemViagemCTeCreateSerializer(many=True, required=False)
    paradas = OrdemViagemParadaCreateSerializer(many=True, required=False)
    cliente = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(), required=False, allow_null=True
    )
    veiculo = serializers.PrimaryKeyRelatedField(queryset=Veiculo.objects.all())
    motorista = serializers.PrimaryKeyRelatedField(
        queryset=Motorista.objects.all(), required=False, allow_null=True
    )
    ciot = serializers.PrimaryKeyRelatedField(
        queryset=CIOT.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = OrdemViagem
        fields = [
            'id', 'tipo', 'status', 'cliente', 'veiculo', 'motorista',
            'data_saida', 'data_retorno', 'data_previsao_chegada',
            'km_inicial', 'km_final', 'origem_uf', 'origem_cidade',
            'origem_latitude', 'origem_longitude', 'destino_uf', 'destino_cidade',
            'destino_latitude', 'destino_longitude', 'ciot', 'observacoes', 'ctes', 'paradas'
        ]

    def validate(self, data):
        km_inicial = data.get('km_inicial')
        km_final = data.get('km_final')
        if km_inicial and km_final and km_final < km_inicial:
            raise serializers.ValidationError(
                {'km_final': 'KM final não pode ser menor que KM inicial.'}
            )
        return data

    def _atualizar_status_ciot(self, ciot_antigo, ciot_novo):
        """Marca CIOT antigo como ativo e novo como usado."""
        if ciot_antigo and ciot_antigo != ciot_novo:
            ciot_antigo.status = 'ativo'
            ciot_antigo.save(update_fields=['status'])
        if ciot_novo and ciot_novo.status == 'ativo':
            ciot_novo.status = 'usado'
            ciot_novo.save(update_fields=['status'])

    def create(self, validated_data):
        ctes_data = validated_data.pop('ctes', [])
        paradas_data = validated_data.pop('paradas', [])
        ciot = validated_data.get('ciot')
        ordem = OrdemViagem.objects.create(**validated_data)
        if ciot:
            self._atualizar_status_ciot(None, ciot)
        self._salvar_ctes(ordem, ctes_data)
        self._salvar_paradas(ordem, paradas_data)
        return ordem

    def update(self, instance, validated_data):
        ctes_data = validated_data.pop('ctes', None)
        paradas_data = validated_data.pop('paradas', None)
        ciot_antigo = instance.ciot
        ciot_novo = validated_data.get('ciot')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        self._atualizar_status_ciot(ciot_antigo, ciot_novo)

        if ctes_data is not None:
            instance.ctes.all().delete()
            self._salvar_ctes(instance, ctes_data)

        if paradas_data is not None:
            instance.paradas.all().delete()
            self._salvar_paradas(instance, paradas_data)

        return instance

    def _salvar_ctes(self, ordem, ctes_data):
        for item_data in ctes_data:
            OrdemViagemCTe.objects.create(ordem=ordem, **item_data)

    def _salvar_paradas(self, ordem, paradas_data):
        for item_data in paradas_data:
            OrdemViagemParada.objects.create(ordem=ordem, **item_data)
