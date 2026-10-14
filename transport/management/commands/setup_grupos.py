# transport/management/commands/setup_grupos.py
"""
Cria os grupos fixos de permissões do Destack Transport e atribui as permissões
necessárias aos modelos do app transport.

Grupos:
- Financeiro: view/add/change/delete em pagamentos/faturas/contas a pagar
- Operacional: view/add/change/delete em viagens, motoristas, veículos e manutenções
- Administrativo: view/add/change/delete em usuários e configurações
- Leitura: apenas view em todos os modelos principais

Uso:
    python manage.py setup_grupos
"""

from django.core.management.base import BaseCommand

from transport.services.permissao_service import PERFIS, criar_ou_atualizar_grupo


class Command(BaseCommand):
    help = "Cria grupos fixos de permissões e atribui permissões do app transport."

    # Alias mantido para compatibilidade com código/testes antigos. A definição
    # canônica vive em permissao_service.PERFIS.
    GRUPOS = PERFIS

    def handle(self, *args, **options):
        total_permissoes = 0

        for nome_grupo in self.GRUPOS:
            grupo = criar_ou_atualizar_grupo(nome_grupo)
            total = grupo.permissions.count()
            total_permissoes += total
            self.stdout.write(self.style.SUCCESS(
                f"Atualizado grupo: {nome_grupo} ({total} permissões)."
            ))

        self.stdout.write(
            self.style.SUCCESS(
                f"Grupos configurados com sucesso. Total de permissões atribuídas: {total_permissoes}"
            )
        )
