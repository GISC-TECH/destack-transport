"""
Management command para criar/atualizar os grupos de permissões padrão do Destack Transport.

Uso:
    python manage.py criar_perfis_padrao
"""

from django.core.management.base import BaseCommand
from transport.services.permissao_service import criar_todos_os_grupos_padrao, PERFIS


class Command(BaseCommand):
    help = "Cria ou atualiza os grupos de permissões padrão (Leitura, Operacional, Financeiro, Administrativo)"

    def handle(self, *args, **options):
        self.stdout.write("Criando/atualizando grupos de permissões padrão...")

        grupos = criar_todos_os_grupos_padrao()

        for nome, grupo in grupos.items():
            descricao = PERFIS[nome]["description"]
            total_perms = grupo.permissions.count()
            self.stdout.write(
                self.style.SUCCESS(f"✓ {nome}: {descricao} ({total_perms} permissões)")
            )

        self.stdout.write(self.style.SUCCESS("Grupos padrão criados com sucesso."))
