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

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Cria grupos fixos de permissões e atribui permissões do app transport."

    GRUPOS = {
        "Financeiro": {
            "description": "Gestão financeira: pagamentos, faturas e contas a pagar.",
            "models": [
                "pagamentoagregado",
                "pagamentoproprio",
                "faixakm",
                "fatura",
                "faturaitem",
                "contapagar",
            ],
            "actions": ["view", "add", "change", "delete"],
        },
        "Operacional": {
            "description": "Gestão operacional: viagens, motoristas, veículos e manutenções.",
            "models": [
                "ctedocumento",
                "mdfedocumento",
                "motorista",
                "veiculo",
                "manutencaoveiculo",
                "compartimentacaoveiculo",
                "cliente",
                "documentoanexo",
                "documentofiscalgenerico",
                "documentoevento",
                "ordemviagem",
                "ordemviagemcte",
                "ordemviagemparada",
                "despesaviagem",
                "abastecimento",
                "planomanutencao",
                "multa",
                "sinistro",
                "pedagio",
                "tabelafrete",
                "posicaoveiculo",
            ],
            "actions": ["view", "add", "change", "delete"],
        },
        "Administrativo": {
            "description": "Gestão administrativa: usuários e configurações do sistema.",
            "models": [
                "user",  # auth.User
                "configuracaoempresa",
                "parametrosistema",
                "registrobackup",
                "alertasistema",
            ],
            "actions": ["view", "add", "change", "delete"],
        },
        "Leitura": {
            "description": "Apenas visualização de todos os dados do sistema.",
            "models": [
                "ctedocumento",
                "mdfedocumento",
                "motorista",
                "veiculo",
                "manutencaoveiculo",
                "compartimentacaoveiculo",
                "cliente",
                "pagamentoagregado",
                "pagamentoproprio",
                "faixakm",
                "fatura",
                "faturaitem",
                "contapagar",
                "transacaobancaria",
                "documentoanexo",
                "documentofiscalgenerico",
                "documentoevento",
                "ordemviagem",
                "ordemviagemcte",
                "ordemviagemparada",
                "despesaviagem",
                "abastecimento",
                "planomanutencao",
                "multa",
                "sinistro",
                "pedagio",
                "tabelafrete",
                "posicaoveiculo",
                "configuracaoempresa",
                "parametrosistema",
                "registrobackup",
                "alertasistema",
                "user",
            ],
            "actions": ["view"],
        },
    }

    def handle(self, *args, **options):
        total_permissoes = 0

        for nome_grupo, config in self.GRUPOS.items():
            grupo, created = Group.objects.get_or_create(name=nome_grupo)
            acao = "Criado" if created else "Atualizado"
            self.stdout.write(self.style.NOTICE(f"{acao} grupo: {nome_grupo}"))

            permissoes_a_adicionar = []
            for model_name in config["models"]:
                for action in config["actions"]:
                    perm = self._buscar_permissao(model_name, action)
                    if perm:
                        permissoes_a_adicionar.append(perm)
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                f"  Permissão não encontrada: {action}_{model_name}"
                            )
                        )

            if permissoes_a_adicionar:
                grupo.permissions.set(permissoes_a_adicionar)
                total_permissoes += len(permissoes_a_adicionar)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  {len(permissoes_a_adicionar)} permissões atribuídas."
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Grupos configurados com sucesso. Total de permissões atribuídas: {total_permissoes}"
            )
        )

    def _buscar_permissao(self, model_name, action):
        """Busca uma Permission pelo nome do modelo e ação."""
        app_label = "transport"
        if model_name == "user":
            app_label = "auth"

        try:
            content_type = ContentType.objects.get(
                app_label=app_label, model=model_name
            )
            return Permission.objects.get(
                codename=f"{action}_{model_name}", content_type=content_type
            )
        except (ContentType.DoesNotExist, Permission.DoesNotExist):
            return None
