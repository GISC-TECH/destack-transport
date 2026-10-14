"""Concede ou revoga a administração protegida de usuários e acessos."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from transport.permissions import ACCESS_MANAGE_PERMISSION
from transport.services.permissao_service import (
    obter_configuracao_acesso,
    registrar_auditoria_usuario,
)


class Command(BaseCommand):
    help = 'Concede diretamente a um usuário a administração de usuários e acessos.'

    def add_arguments(self, parser):
        parser.add_argument('username', help='Nome do usuário autorizado')
        parser.add_argument(
            '--revogar', action='store_true',
            help='Revoga a permissão em vez de concedê-la',
        )

    @transaction.atomic
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

        try:
            permission = Permission.objects.get(
                content_type__app_label='transport',
                content_type__model='configuracaoacessousuario',
                codename=ACCESS_MANAGE_PERMISSION,
            )
        except Permission.DoesNotExist as exc:
            raise CommandError(
                'Permissão de administração não encontrada. Execute as migrações primeiro.'
            ) from exc

        had_permission = user.user_permissions.filter(pk=permission.pk).exists()
        if options['revogar']:
            user.user_permissions.remove(permission)
            action = 'revogada de'
        else:
            user.user_permissions.add(permission)
            action = 'concedida a'
        has_permission = not options['revogar']
        if had_permission != has_permission:
            config = obter_configuracao_acesso(user)
            config.versao += 1
            config.save(update_fields=['versao', 'atualizado_em'])
            registrar_auditoria_usuario(
                None,
                user,
                'concessao_admin_acessos' if has_permission else 'revogacao_admin_acessos',
                {'usuarios.manage_access': had_permission, 'version': config.versao - 1},
                {'usuarios.manage_access': has_permission, 'version': config.versao},
                origem='comando',
            )
        self.stdout.write(self.style.SUCCESS(
            f'Permissão de administração de acessos {action} {user.username}.'
        ))
