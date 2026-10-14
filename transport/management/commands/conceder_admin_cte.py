"""Concede ou revoga as operações sensíveis de CT-e para um usuário específico."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand, CommandError

from transport.permissions import (
    CTE_EDITAR_VALOR_PERMISSION,
    CTE_EXCLUIR_PERMISSION,
)


class Command(BaseCommand):
    help = (
        "Concede diretamente a um usuário as permissões de editar o valor "
        "do frete e excluir CT-es importados."
    )

    def add_arguments(self, parser):
        parser.add_argument('username', help='Nome do usuário autorizado')
        parser.add_argument(
            '--revogar',
            action='store_true',
            help='Revoga as permissões em vez de concedê-las',
        )

    def handle(self, *args, **options):
        username = options['username']
        user_model = get_user_model()

        try:
            user = user_model.objects.get(username__iexact=username)
        except user_model.DoesNotExist as exc:
            raise CommandError(f"Usuário '{username}' não encontrado.") from exc
        except user_model.MultipleObjectsReturned as exc:
            raise CommandError(
                f"Mais de um usuário corresponde a '{username}'. Use o nome exato."
            ) from exc

        codenames = [CTE_EDITAR_VALOR_PERMISSION, CTE_EXCLUIR_PERMISSION]
        permissions = list(Permission.objects.filter(
            content_type__app_label='transport',
            content_type__model='ctedocumento',
            codename__in=codenames,
        ))
        found = {permission.codename for permission in permissions}
        missing = sorted(set(codenames) - found)
        if missing:
            raise CommandError(
                'Permissões não encontradas: '
                + ', '.join(missing)
                + '. Execute as migrações antes deste comando.'
            )

        if options['revogar']:
            user.user_permissions.remove(*permissions)
            action = 'revogadas de'
        else:
            user.user_permissions.add(*permissions)
            action = 'concedidas a'

        self.stdout.write(self.style.SUCCESS(
            f"Permissões de administração de CT-e {action} {user.username}."
        ))
