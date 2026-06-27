# transport/admin/motorista.py

from django.contrib import admin
from django.utils.html import format_html
from datetime import date, timedelta
from ..models import Motorista


@admin.register(Motorista)
class MotoristaAdmin(admin.ModelAdmin):
    """Admin para Motorista."""

    list_display = [
        'nome', 'cpf', 'cnh', 'categoria_cnh',
        'status_documentos', 'ativo', 'criado_em'
    ]
    list_filter = ['ativo', 'categoria_cnh', 'criado_em']
    search_fields = ['nome', 'cpf', 'cnh']
    readonly_fields = ['id', 'criado_em', 'atualizado_em', 'alertas_vencimento']
    date_hierarchy = 'criado_em'

    fieldsets = (
        ('Dados Pessoais', {
            'fields': ('nome', 'cpf', 'telefone', 'email')
        }),
        ('CNH', {
            'fields': ('cnh', 'categoria_cnh', 'validade_cnh')
        }),
        ('Certificações', {
            'fields': ('nr20_validade', 'nr35_validade', 'mopp_validade')
        }),
        ('Endereço', {
            'fields': (
                'logradouro', 'numero', 'complemento',
                'bairro', 'cidade', 'estado', 'cep'
            ),
            'classes': ('collapse',)
        }),
        ('Dados Bancários / Pix', {
            'fields': (
                'tipo_chave_pix', 'chave_pix', 'banco',
                'agencia', 'conta', 'tipo_conta', 'favorecido'
            ),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('ativo', 'observacoes')
        }),
        ('Alertas', {
            'fields': ('alertas_vencimento',),
            'classes': ('collapse',)
        }),
        ('Metadados', {
            'fields': ('id', 'criado_em', 'atualizado_em'),
            'classes': ('collapse',)
        })
    )

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

    status_documentos.short_description = 'Status Docs'

    def alertas_vencimento(self, obj):
        """Mostra alertas de vencimento formatados."""
        docs_vencendo = obj.get_documentos_vencendo(dias=30)

        if not docs_vencendo:
            return "Todos os documentos estão válidos."

        html = "<ul>"
        for doc in docs_vencendo:
            cor = 'red' if doc['vencido'] else 'orange'
            status = 'VENCIDO' if doc['vencido'] else 'Vence em breve'
            html += f"<li style='color: {cor};'><strong>{doc['documento']}</strong>: {doc['validade']} ({status})</li>"
        html += "</ul>"

        return format_html(html)

    alertas_vencimento.short_description = 'Alertas de Vencimento'
