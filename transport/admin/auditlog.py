"""Configuração do Django Admin para visualização dos logs de auditoria (django-auditlog)."""
from django.contrib import admin
from auditlog.models import LogEntry


# Sobrescreve o admin padrão do django-auditlog com uma visualização customizada.
if LogEntry in admin.site._registry:
    admin.site.unregister(LogEntry)


@admin.register(LogEntry)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin read-only para consulta dos logs de auditoria."""

    list_display = (
        'timestamp',
        'content_type',
        'object_repr',
        'action',
        'actor',
        'changes_summary',
    )
    list_filter = ('action', 'content_type', 'timestamp')
    search_fields = ('object_repr', 'object_pk', 'actor__username', 'changes')
    readonly_fields = (
        'timestamp',
        'content_type',
        'object_pk',
        'object_id',
        'object_repr',
        'action',
        'actor',
        'remote_addr',
        'additional_data',
        'changes',
    )
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)
    list_select_related = ('content_type', 'actor')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Alterações')
    def changes_summary(self, obj):
        """Retorna um resumo curto das alterações registradas."""
        if not obj.changes:
            return '-'
        return ', '.join(obj.changes.keys())[:80]
