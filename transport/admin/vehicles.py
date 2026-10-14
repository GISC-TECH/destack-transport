from .common import *

# === Inline para Compartimentação ===
class CompartimentacaoVeiculoInline(admin.TabularInline):
    """Inline para edição de compartimentos do veículo."""
    model = CompartimentacaoVeiculo
    extra = 1
    fields = ['numero_boca', 'capacidade_m3']
    ordering = ['numero_boca']

# === ModelAdmin para Veículos (ATUALIZADO) ===
# ==============================================

@admin.register(Veiculo)
class VeiculoAdmin(admin.ModelAdmin):
    """ Configuração do Admin para Veículos (ATUALIZADO). """
    list_display = ('placa', 'proprietario_nome', 'tipo_proprietario_display', 'rntrc_proprietario', 'total_manutencoes', 'total_gastos', 'status_documentos', 'ativo', 'atualizado_em')
    list_filter = ('ativo', 'uf_proprietario', 'tipo_proprietario', ManutencoesVeiculoFilter)
    search_fields = ('placa', 'renavam', 'proprietario_nome', 'proprietario_cnpj', 'proprietario_cpf')
    readonly_fields = ('criado_em', 'atualizado_em', 'total_manutencoes', 'total_gastos', 'cadastros_vinculados')
    fieldsets = (
        ('Identificação', {'fields': ('placa', 'renavam', 'tipo_rodado', 'tipo_carroceria', 'ativo')}),
        ('Capacidades', {'fields': ('tara', 'capacidade_kg', 'capacidade_m3')}),
        ('Proprietário', {'fields': ('tipo_proprietario', 'proprietario_nome', 'proprietario_cnpj', 'proprietario_cpf', 'rntrc_proprietario', 'uf_proprietario')}),
        ('Documentação', {'fields': ('civ_validade', 'cipp_validade', 'afericao_validade', 'crlv_validade', 'cronotacografo_validade')}),
        ('Observações', {'fields': ('observacoes',), 'classes': ('collapse',)}),
        ('Estatísticas', {'fields': ('total_manutencoes', 'total_gastos', 'cadastros_vinculados')}),
        ('Datas', {'fields': ('criado_em', 'atualizado_em'), 'classes': ('collapse',)}),
    )
    inlines = [CompartimentacaoVeiculoInline, ManutencaoVeiculoInline]
    actions = ['marcar_como_ativo', 'marcar_como_inativo']

    @admin.display(description='Tipo Proprietário')
    def tipo_proprietario_display(self, obj):
        tipos = {'00': 'Próprio', '01': 'Arrendado', '02': 'Agregado'}
        return tipos.get(obj.tipo_proprietario, obj.tipo_proprietario)

    @admin.display(description='Total Manutenções')
    def total_manutencoes(self, obj):
        count = obj.manutencoes.count()
        if count > 0:
            url = reverse('admin:transport_manutencaoveiculo_changelist') + f'?veiculo__id__exact={obj.id}'
            return format_html('<a href="{}">{} manutenções</a>', url, count)
        return "Nenhuma manutenção"

    @admin.display(description='Total Gastos (R$)')
    def total_gastos(self, obj):
        total = obj.manutencoes.aggregate(t=Sum('valor_total'))['t'] or Decimal('0.00')
        return f"R$ {total:.2f}"

    @admin.display(description='Status Docs')
    def status_documentos(self, obj):
        """Mostra status visual dos documentos."""
        docs_vencendo = obj.get_documentos_vencendo(dias=30)

        if not docs_vencendo:
            return format_html('<span style="color: green;">✓ OK</span>')

        vencidos = [d for d in docs_vencendo if d['vencido']]
        if vencidos:
            return format_html(
                '<span style="color: red;">✗ {} vencido(s)</span>',
                len(vencidos)
            )

        return format_html(
            '<span style="color: orange;">⚠ {} vencendo</span>',
            len(docs_vencendo)
        )

    @admin.display(description='Cadastros Vinculados')
    def cadastros_vinculados(self, obj):
        # Contar vinculos com CT-e e MDF-e
        ctes_count = CTeVeiculoRodoviario.objects.filter(placa=obj.placa).count()
        mdfes_count = MDFeVeiculoTracao.objects.filter(placa=obj.placa).count() + MDFeVeiculoReboque.objects.filter(placa=obj.placa).count()
        
        links = []
        if ctes_count > 0:
            url = reverse('admin:transport_ctedocumento_changelist') + f'?modal_rodoviario__veiculos__placa__exact={obj.placa}'
            links.append(format_html('<a href="{}">{} CT-e(s)</a>', url, ctes_count))
        
        if mdfes_count > 0:
            url = reverse('admin:transport_mdfedocumento_changelist') + f'?modal_rodoviario__veiculo_tracao__placa__exact={obj.placa}'
            links.append(format_html('<a href="{}">{} MDF-e(s)</a>', url, mdfes_count))
        
        if not links:
            return "Nenhum documento vinculado"
        
        return format_html(' | '.join(links))

    @admin.action(description="Marcar selecionados como ativos")
    def marcar_como_ativo(self, request, queryset):
        updated = queryset.update(ativo=True)
        self.message_user(request, f"{updated} veículos foram marcados como ativos.")

    @admin.action(description="Marcar selecionados como inativos")
    def marcar_como_inativo(self, request, queryset):
        updated = queryset.update(ativo=False)
        self.message_user(request, f"{updated} veículos foram marcados como inativos.")


@admin.register(ManutencaoVeiculo)
class ManutencaoVeiculoAdmin(admin.ModelAdmin):
    """ Configuração do Admin para Manutenções de Veículos. """
    list_display = ('veiculo_link', 'data_servico', 'servico_realizado', 'quilometragem', 'valor_total', 'status', 'oficina')
    list_filter = ('status', 'data_servico', 'veiculo')
    search_fields = ('servico_realizado', 'oficina', 'observacoes', 'nota_fiscal', 'veiculo__placa')
    readonly_fields = ('valor_total', 'criado_em', 'atualizado_em')
    autocomplete_fields = ['veiculo']
    date_hierarchy = 'data_servico'
    list_select_related = ('veiculo',)
    actions = ['marcar_como_concluida', 'marcar_como_agendada', 'marcar_como_em_andamento']

    @admin.display(description='Veículo', ordering='veiculo__placa')
    def veiculo_link(self, obj):
        link = reverse("admin:transport_veiculo_change", args=[obj.veiculo.pk])
        return format_html('<a href="{}">{}</a>', link, obj.veiculo.placa)

    fieldsets = (
        (None, {'fields': ('veiculo', 'data_servico', 'status')}),
        ('Serviço', {'fields': ('servico_realizado', 'quilometragem', 'oficina', 'observacoes', 'nota_fiscal')}),
        ('Custos', {'fields': ('valor_peca', 'valor_mao_obra', 'valor_total')}),
        ('Datas', {'fields': ('criado_em', 'atualizado_em'), 'classes': ('collapse',)}),
    )

    @admin.action(description="Marcar selecionados como concluídos")
    def marcar_como_concluida(self, request, queryset):
        updated = queryset.update(status='concluida')
        self.message_user(request, f"{updated} manutenções foram marcadas como concluídas.")

    @admin.action(description="Marcar selecionados como agendados")
    def marcar_como_agendada(self, request, queryset):
        updated = queryset.update(status='agendada')
        self.message_user(request, f"{updated} manutenções foram marcadas como agendadas.")

    @admin.action(description="Marcar selecionados como em andamento")
    def marcar_como_em_andamento(self, request, queryset):
        updated = queryset.update(status='em_andamento')
        self.message_user(request, f"{updated} manutenções foram marcadas como em andamento.")

# =============================
