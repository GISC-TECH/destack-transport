# transport/admin/cliente.py

from django.contrib import admin
from ..models import Cliente


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    """Admin para Cliente."""

    list_display = [
        'razao_social', 'nome_fantasia', 'cnpj', 'cidade',
        'estado', 'tipo_frete', 'ativo', 'criado_em'
    ]
    list_filter = ['ativo', 'tipo_frete', 'estado', 'criado_em']
    search_fields = ['razao_social', 'nome_fantasia', 'cnpj', 'ie']
    readonly_fields = ['id', 'criado_em', 'atualizado_em']
    date_hierarchy = 'criado_em'

    fieldsets = (
        ('Dados Fiscais', {
            'fields': ('razao_social', 'nome_fantasia', 'cnpj', 'ie')
        }),
        ('Endereço', {
            'fields': (
                'logradouro', 'numero', 'complemento',
                'bairro', 'cidade', 'estado', 'cep'
            )
        }),
        ('Operacional', {
            'fields': ('distancia', 'tipo_frete', 'ativo')
        }),
        ('Observações', {
            'fields': ('observacoes',),
            'classes': ('collapse',)
        }),
        ('Metadados', {
            'fields': ('id', 'criado_em', 'atualizado_em'),
            'classes': ('collapse',)
        })
    )
