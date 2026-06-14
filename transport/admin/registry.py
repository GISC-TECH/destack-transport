from .common import *

# === Registro de Outros Modelos Relacionados ===
# ==========================================================

# Registra modelos relacionados adicionais que não precisam de customização completa
admin.site.register(CTeEmitente)
admin.site.register(CTeRemetente)
admin.site.register(CTeExpedidor)
admin.site.register(CTeRecebedor)
admin.site.register(CTeVeiculoRodoviario)
admin.site.register(CTeMotorista)
admin.site.register(CTeSeguro)
admin.site.register(CTeProtocoloAutorizacao)
admin.site.register(CTeSuplementar)
admin.site.register(MDFeEmitente)
admin.site.register(MDFeVeiculoTracao)
admin.site.register(MDFeVeiculoReboque)
admin.site.register(MDFeProdutoPerigoso)
admin.site.register(MDFeSeguroCarga)
admin.site.register(MDFeProdutoPredominante)
admin.site.register(MDFeInformacoesAdicionais)
admin.site.register(MDFeProtocoloAutorizacao)
admin.site.register(MDFeSuplementar)

# === Recepção genérica (GTV-e e eventos) ===
from ..models import DocumentoFiscalGenerico, DocumentoEvento


@admin.register(DocumentoFiscalGenerico)
class DocumentoFiscalGenericoAdmin(admin.ModelAdmin):
    list_display = ('tipo', 'modelo', 'chave', 'numero', 'emitente_nome', 'valor_total', 'data_emissao', 'processado')
    list_filter = ('tipo', 'processado')
    search_fields = ('chave', 'numero', 'emitente_cnpj', 'emitente_nome')
    readonly_fields = ('criado_em',)
    ordering = ('-criado_em',)


@admin.register(DocumentoEvento)
class DocumentoEventoAdmin(admin.ModelAdmin):
    list_display = ('tipo_documento', 'tipo_evento', 'descricao_evento', 'chave_documento',
                    'sequencia_evento', 'data_evento', 'confirmado')
    list_filter = ('tipo_documento', 'tipo_evento', 'confirmado')
    search_fields = ('chave_documento', 'tipo_evento', 'protocolo')
    readonly_fields = ('criado_em',)
    ordering = ('-data_evento',)

# Opcional: Criar e registrar o Admin site personalizado
# transport_admin = TransporteDashboardAdmin(name='transport_admin')
# transport_admin.register(CTeDocumento, CTeDocumentoAdmin)
# transport_admin.register(MDFeDocumento, MDFeDocumentoAdmin)
# transport_admin.register(Veiculo, VeiculoAdmin)
# ...E assim por diante
