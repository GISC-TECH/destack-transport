"""Registro dos modelos operacionais no Django Admin."""
from django.contrib import admin

from ..models import (
    Abastecimento,
    AlertaSistema,
    CIOT,
    ContaPagar,
    DespesaViagem,
    DocumentoAnexo,
    Fatura,
    FaturaItem,
    MensagemComunicacao,
    Multa,
    OrdemViagem,
    OrdemViagemParada,
    PagamentoAgregado,
    PagamentoProprio,
    Pedagio,
    PlanoManutencao,
    PosicaoVeiculo,
    RotaOtimizada,
    Sinistro,
    TabelaFrete,
    TransacaoBancaria,
)


@admin.register(OrdemViagem)
class OrdemViagemAdmin(admin.ModelAdmin):
    list_display = ('numero', 'tipo', 'status', 'cliente', 'veiculo', 'motorista', 'data_saida')
    list_filter = ('tipo', 'status', 'data_saida')
    search_fields = ('numero', 'cliente__razao_social', 'veiculo__placa', 'motorista__nome')
    date_hierarchy = 'data_saida'


@admin.register(OrdemViagemParada)
class OrdemViagemParadaAdmin(admin.ModelAdmin):
    list_display = ('ordem', 'sequencia', 'tipo', 'cidade', 'uf')
    list_filter = ('tipo',)
    search_fields = ('cidade', 'uf', 'ordem__numero')


@admin.register(DespesaViagem)
class DespesaViagemAdmin(admin.ModelAdmin):
    list_display = ('ordem', 'categoria', 'valor', 'data')
    list_filter = ('categoria',)


@admin.register(Abastecimento)
class AbastecimentoAdmin(admin.ModelAdmin):
    list_display = ('veiculo', 'motorista', 'data', 'litros', 'valor_total', 'hodometro')
    list_filter = ('data',)
    search_fields = ('veiculo__placa', 'motorista__nome')


@admin.register(PlanoManutencao)
class PlanoManutencaoAdmin(admin.ModelAdmin):
    list_display = ('veiculo', 'tipo', 'descricao', 'proxima_data', 'proxima_km', 'ativo')
    list_filter = ('tipo', 'ativo')


@admin.register(Multa)
class MultaAdmin(admin.ModelAdmin):
    list_display = ('veiculo', 'motorista', 'data_infracao', 'valor', 'pontos', 'status')
    list_filter = ('status', 'data_infracao')


@admin.register(Sinistro)
class SinistroAdmin(admin.ModelAdmin):
    list_display = ('veiculo', 'motorista', 'data', 'tipo', 'status', 'custo_total')
    list_filter = ('tipo', 'status')


@admin.register(Pedagio)
class PedagioAdmin(admin.ModelAdmin):
    list_display = ('ordem', 'data', 'valor', 'praca', 'categoria')
    list_filter = ('data',)


@admin.register(TabelaFrete)
class TabelaFreteAdmin(admin.ModelAdmin):
    list_display = ('origem_cidade', 'destino_cidade', 'tipo_veiculo', 'valor_minimo', 'ativo')
    list_filter = ('ativo', 'tipo_veiculo')


@admin.register(PosicaoVeiculo)
class PosicaoVeiculoAdmin(admin.ModelAdmin):
    list_display = ('veiculo', 'ordem', 'latitude', 'longitude', 'data_hora', 'fonte')
    list_filter = ('fonte', 'data_hora')


@admin.register(RotaOtimizada)
class RotaOtimizadaAdmin(admin.ModelAdmin):
    list_display = ('ordem', 'distancia_km', 'duracao_min', 'provedor', 'status', 'criado_em')
    list_filter = ('provedor', 'status')


@admin.register(MensagemComunicacao)
class MensagemComunicacaoAdmin(admin.ModelAdmin):
    list_display = ('canal', 'destinatario', 'assunto', 'status', 'enviado_em', 'criado_em')
    list_filter = ('canal', 'status')


@admin.register(CIOT)
class CIOTAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'cliente', 'motorista', 'origem_cidade', 'destino_cidade', 'data_validade', 'status')
    list_filter = ('status', 'data_emissao')
    search_fields = ('codigo', 'cliente__razao_social', 'motorista__nome')


@admin.register(AlertaSistema)
class AlertaSistemaAdmin(admin.ModelAdmin):
    list_display = ('tipo', 'prioridade', 'mensagem', 'lido', 'resolvido', 'data_hora')
    list_filter = ('prioridade', 'lido', 'resolvido')


@admin.register(Fatura)
class FaturaAdmin(admin.ModelAdmin):
    list_display = ('numero', 'cliente', 'data_emissao', 'data_vencimento', 'valor_total', 'status')
    list_filter = ('status', 'data_emissao')


@admin.register(FaturaItem)
class FaturaItemAdmin(admin.ModelAdmin):
    list_display = ('fatura', 'cte', 'valor')


@admin.register(ContaPagar)
class ContaPagarAdmin(admin.ModelAdmin):
    list_display = ('descricao', 'fornecedor', 'data_vencimento', 'valor', 'status')
    list_filter = ('status', 'data_vencimento')


@admin.register(TransacaoBancaria)
class TransacaoBancariaAdmin(admin.ModelAdmin):
    list_display = ('data', 'descricao', 'tipo', 'valor', 'conciliado')
    list_filter = ('tipo', 'conciliado')


@admin.register(DocumentoAnexo)
class DocumentoAnexoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'tipo', 'cliente', 'motorista', 'veiculo', 'cte', 'validade')
    list_filter = ('tipo',)
