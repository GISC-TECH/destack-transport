from django.contrib import admin
from django.contrib.auth.models import Group, Permission, User
from django.core.management import call_command
from django.test import RequestFactory, TestCase
from rest_framework import status
from rest_framework.test import APIClient

from transport.models import AuditoriaAcessoUsuario
from transport.permissions import (
    ACCESS_MANAGE_PERMISSION,
    CTE_EDITAR_VALOR_PERMISSION,
    CTE_EXCLUIR_PERMISSION,
)
from transport.services.permissao_service import (
    ConflitoVersaoAcesso,
    OperacaoAcessoProtegida,
    atualizar_acesso_usuario,
    atualizar_status_usuario,
    criar_todos_os_grupos_padrao,
    get_acesso_usuario,
    get_catalogo_acessos,
)


class UserAccessControlSecurityTests(TestCase):
    """Contrato de segurança do painel administrativo de acessos."""

    @classmethod
    def setUpTestData(cls):
        criar_todos_os_grupos_padrao()

        cls.manager = User.objects.create_user(
            username='Jacival',
            password='test-only-password',
            is_staff=True,
            is_superuser=True,
        )
        cls.other_superuser = User.objects.create_user(
            username='outro-superuser',
            password='test-only-password',
            is_staff=True,
            is_superuser=True,
        )
        cls.administrative = User.objects.create_user(
            username='administrativo',
            password='test-only-password',
            is_staff=True,
        )
        cls.administrative.groups.add(Group.objects.get(name='Administrativo'))
        cls.staff = User.objects.create_user(
            username='staff-sem-permissao',
            password='test-only-password',
            is_staff=True,
        )
        cls.common = User.objects.create_user(
            username='usuario-comum',
            password='test-only-password',
        )
        cls.target = User.objects.create_user(
            username='usuario-alvo',
            password='test-only-password',
        )
        cls.external_group = Group.objects.create(name='Grupo Externo Não Gerenciado')
        cls.target.groups.add(Group.objects.get(name='Operacional'))
        cls.target.groups.add(cls.external_group)

        cls.manage_permission = Permission.objects.get(
            content_type__app_label='transport',
            content_type__model='configuracaoacessousuario',
            codename=ACCESS_MANAGE_PERMISSION,
        )
        cls.cte_permission = Permission.objects.get(
            content_type__app_label='transport',
            content_type__model='ctedocumento',
            codename=CTE_EDITAR_VALOR_PERMISSION,
        )
        cls.cte_delete_permission = Permission.objects.get(
            content_type__app_label='transport',
            content_type__model='ctedocumento',
            codename=CTE_EXCLUIR_PERMISSION,
        )
        cls.manager.user_permissions.add(
            cls.manage_permission,
            cls.cte_permission,
            cls.cte_delete_permission,
        )

    def setUp(self):
        self.client = APIClient()
        self.request = RequestFactory().put(
            '/api/usuarios/acessos/',
            REMOTE_ADDR='127.0.0.1',
            HTTP_USER_AGENT='security-test',
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def _access_url(self, user=None):
        return f'/api/usuarios/{(user or self.target).pk}/acessos/'

    def _status_url(self, user=None):
        return f'/api/usuarios/{(user or self.target).pk}/status/'

    def _audit_url(self, user=None):
        return f'/api/usuarios/{(user or self.target).pk}/auditoria/'

    def _password_reset_url(self, user=None):
        return f'/api/usuarios/{(user or self.target).pk}/redefinir-senha/'

    def test_only_directly_authorized_actor_can_use_access_control(self):
        self._authenticate(self.manager)
        self.assertEqual(
            self.client.get('/api/usuarios/catalogo-acessos/').status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(self._access_url()).status_code,
            status.HTTP_200_OK,
        )

        denied_actors = [
            self.other_superuser,
            self.administrative,
            self.staff,
            self.common,
        ]
        for actor in denied_actors:
            with self.subTest(actor=actor.username):
                self._authenticate(actor)
                response = self.client.get('/api/usuarios/catalogo-acessos/')
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=None)
        response = self.client.get('/api/usuarios/catalogo-acessos/')
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_manage_access_permission_in_group_does_not_authorize_actor(self):
        indirect_manager_group = Group.objects.create(name='Gestor Indireto Inválido')
        indirect_manager_group.permissions.add(self.manage_permission)
        self.common.groups.add(indirect_manager_group)
        self._authenticate(self.common)

        response = self.client.get('/api/usuarios/catalogo-acessos/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            self.common.user_permissions.filter(pk=self.manage_permission.pk).exists(),
        )

    def test_user_and_group_are_not_exposed_in_django_admin(self):
        self.assertFalse(admin.site.is_registered(User))
        self.assertFalse(admin.site.is_registered(Group))

    def test_inactive_direct_manager_is_denied(self):
        self.manager.is_active = False
        self.manager.save(update_fields=['is_active'])
        self._authenticate(self.manager)

        response = self.client.get('/api/usuarios/catalogo-acessos/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_crud_is_not_unlocked_by_superuser_or_standard_auth_permission(self):
        change_user = Permission.objects.get(
            content_type__app_label='auth',
            codename='change_user',
        )
        self.common.user_permissions.add(change_user)

        for actor in (self.other_superuser, self.common):
            with self.subTest(actor=actor.username):
                self._authenticate(actor)
                self.assertEqual(
                    self.client.get('/api/usuarios/').status_code,
                    status.HTTP_403_FORBIDDEN,
                )

        self._authenticate(self.manager)
        self.assertEqual(
            self.client.get('/api/usuarios/').status_code,
            status.HTTP_200_OK,
        )

    def test_manager_cannot_disable_or_delete_self(self):
        self._authenticate(self.manager)
        current_access = get_acesso_usuario(self.manager)

        disable_response = self.client.patch(
            self._status_url(self.manager),
            {
                'is_active': False,
                'expected_version': current_access['version'],
            },
            format='json',
        )
        delete_response = self.client.delete(
            f'/api/usuarios/{self.manager.pk}/',
            {'expected_version': current_access['version']},
            format='json',
        )

        self.assertEqual(disable_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(delete_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.manager.refresh_from_db()
        self.assertTrue(self.manager.is_active)
        self.assertTrue(self.manager.is_superuser)

    def test_destroy_is_soft_delete_and_preserves_user_row(self):
        self._authenticate(self.manager)
        current_access = get_acesso_usuario(self.target)

        missing_version = self.client.delete(f'/api/usuarios/{self.target.pk}/')
        response = self.client.delete(
            f'/api/usuarios/{self.target.pk}/',
            {'expected_version': current_access['version']},
            format='json',
        )

        self.assertEqual(missing_version.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT))
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)

    def test_superuser_status_and_delete_are_always_blocked(self):
        self._authenticate(self.manager)
        current_access = get_acesso_usuario(self.other_superuser)

        status_response = self.client.patch(
            self._status_url(self.other_superuser),
            {
                'is_active': False,
                'expected_version': current_access['version'],
            },
            format='json',
        )
        delete_response = self.client.delete(
            f'/api/usuarios/{self.other_superuser.pk}/',
            {'expected_version': current_access['version']},
            format='json',
        )

        self.assertEqual(status_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(delete_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.other_superuser.refresh_from_db()
        self.assertTrue(self.other_superuser.is_active)
        self.assertTrue(self.other_superuser.is_superuser)

    def test_stale_destroy_version_returns_conflict_without_deactivation(self):
        self._authenticate(self.manager)
        initial = self.client.get(self._access_url()).json()
        update_response = self.client.put(
            self._access_url(),
            {
                'modo': 'personalizado',
                'modulos': {'cte': ['view']},
                'versao': initial['versao'],
            },
            format='json',
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)

        response = self.client.delete(
            f'/api/usuarios/{self.target.pk}/',
            {'expected_version': initial['versao']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.json()['code'], 'access_version_conflict')
        self.target.refresh_from_db()
        self.assertTrue(self.target.is_active)
        self.assertFalse(
            AuditoriaAcessoUsuario.objects.filter(
                usuario_afetado=self.target,
                acao='desativacao',
            ).exists(),
        )

    def test_deactivation_blocks_an_existing_authenticated_session(self):
        target_client = APIClient()
        target_client.force_login(self.target)
        self.assertEqual(
            target_client.get('/api/users/me/permissions/').status_code,
            status.HTTP_200_OK,
        )

        self._authenticate(self.manager)
        current_access = get_acesso_usuario(self.target)
        response = self.client.patch(
            self._status_url(),
            {
                'is_active': False,
                'expected_version': current_access['version'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        denied_response = target_client.get('/api/users/me/permissions/')
        self.assertIn(
            denied_response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_profile_to_custom_and_back_updates_effective_permissions(self):
        self._authenticate(self.manager)
        initial = self.client.get(self._access_url()).json()

        custom_response = self.client.put(
            self._access_url(),
            {
                'modo': 'personalizado',
                'modulos': {'cte': ['view']},
                'versao': initial['versao'],
            },
            format='json',
        )

        self.assertEqual(custom_response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_staff)
        self.assertFalse(self.target.is_superuser)
        self.assertEqual(
            set(self.target.groups.values_list('name', flat=True)),
            {'Grupo Externo Não Gerenciado'},
        )
        self.assertTrue(self.target.has_perm('transport.view_ctedocumento'))
        self.assertFalse(self.target.has_perm('transport.change_ctedocumento'))

        custom_data = custom_response.json()
        profile_response = self.client.put(
            self._access_url(),
            {
                'modo': 'perfil',
                'perfil': 'Leitura',
                'versao': custom_data['versao'],
            },
            format='json',
        )

        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertEqual(
            set(self.target.groups.values_list('name', flat=True)),
            {'Grupo Externo Não Gerenciado', 'Leitura'},
        )
        self.assertFalse(self.target.user_permissions.filter(codename='view_ctedocumento').exists())

    def test_custom_mode_ignores_cataloged_permission_from_external_group(self):
        change_cte = Permission.objects.get(
            content_type__app_label='transport',
            content_type__model='ctedocumento',
            codename='change_ctedocumento',
        )
        self.external_group.permissions.add(change_cte)
        self._authenticate(self.manager)
        initial = self.client.get(self._access_url()).json()

        response = self.client.put(
            self._access_url(),
            {
                'modo': 'personalizado',
                'modulos': {},
                'versao': initial['versao'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('cte.change', response.json()['enabled_capabilities'])
        self.target.refresh_from_db()
        self.assertTrue(self.target.groups.filter(pk=self.external_group.pk).exists())
        self.assertIn(
            'transport.change_ctedocumento',
            self.target.get_group_permissions(),
        )

        target_client = APIClient()
        target_client.force_authenticate(user=self.target)
        effective = target_client.get('/api/users/me/permissions/')
        self.assertEqual(effective.status_code, status.HTTP_200_OK)
        self.assertFalse(effective.json()['modulos']['cte']['change'])

    def test_profile_edit_and_sync_increment_version_and_create_audit(self):
        self._authenticate(self.manager)
        initial_version = self.client.get(self._access_url()).json()['versao']

        edit_response = self.client.put(
            '/api/perfis/Operacional/',
            {
                'modulos': {'cte': ['view']},
                'motivo': 'Ajuste controlado do perfil.',
            },
            format='json',
        )

        self.assertEqual(edit_response.status_code, status.HTTP_200_OK)
        after_edit = self.client.get(self._access_url()).json()
        self.assertEqual(after_edit['versao'], initial_version + 1)
        edit_audit = AuditoriaAcessoUsuario.objects.get(
            usuario_afetado=self.target,
            acao='alteracao_perfil',
        )
        self.assertEqual(edit_audit.ator, self.manager)
        self.assertEqual(edit_audit.motivo, 'Ajuste controlado do perfil.')
        self.assertEqual(edit_audit.antes['version'], initial_version)
        self.assertEqual(edit_audit.depois['version'], initial_version + 1)

        sync_response = self.client.post(
            '/api/perfis/sincronizar/',
            {'motivo': 'Sincronização controlada dos perfis.'},
            format='json',
        )

        self.assertEqual(sync_response.status_code, status.HTTP_200_OK)
        after_sync = self.client.get(self._access_url()).json()
        self.assertEqual(after_sync['versao'], initial_version + 2)
        sync_audit = AuditoriaAcessoUsuario.objects.get(
            usuario_afetado=self.target,
            acao='sincronizacao_perfil',
        )
        self.assertEqual(sync_audit.ator, self.manager)
        self.assertEqual(sync_audit.motivo, 'Sincronização controlada dos perfis.')
        self.assertEqual(sync_audit.antes['version'], initial_version + 1)
        self.assertEqual(sync_audit.depois['version'], initial_version + 2)

    def test_superuser_target_requires_explicit_demotion_confirmation(self):
        self._authenticate(self.manager)
        initial = self.client.get(self._access_url(self.other_superuser)).json()

        response = self.client.put(
            self._access_url(self.other_superuser),
            {
                'modo': 'personalizado',
                'modulos': {'cte': ['view']},
                'versao': initial['versao'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.other_superuser.refresh_from_db()
        self.assertTrue(self.other_superuser.is_superuser)

        confirmed_response = self.client.put(
            self._access_url(self.other_superuser),
            {
                'modo': 'personalizado',
                'modulos': {'cte': ['view']},
                'versao': initial['versao'],
                'confirm_demote_superuser': True,
            },
            format='json',
        )
        self.assertEqual(confirmed_response.status_code, status.HTTP_200_OK)
        self.other_superuser.refresh_from_db()
        self.assertFalse(self.other_superuser.is_superuser)
        self.assertFalse(self.other_superuser.is_staff)

    def test_protected_and_unknown_capabilities_are_rejected(self):
        self._authenticate(self.manager)
        initial = self.client.get(self._access_url()).json()

        for capability in (
            'usuarios.manage_access',
            'cte.editar_valor_frete',
            'cte.excluir_importado',
            'modulo.inexistente',
        ):
            with self.subTest(capability=capability):
                response = self.client.put(
                    self._access_url(),
                    {
                        'modo': 'personalizado',
                        'enabled_capabilities': [capability],
                        'versao': initial['versao'],
                    },
                    format='json',
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stale_version_returns_conflict_without_second_audit_entry(self):
        self._authenticate(self.manager)
        initial = self.client.get(self._access_url()).json()
        payload = {
            'modo': 'personalizado',
            'modulos': {'cte': ['view']},
            'versao': initial['versao'],
        }

        first = self.client.put(self._access_url(), payload, format='json')
        second = self.client.put(self._access_url(), payload, format='json')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second.json()['code'], 'access_version_conflict')
        self.assertEqual(
            AuditoriaAcessoUsuario.objects.filter(
                usuario_afetado=self.target,
                acao='alteracao_acessos',
            ).count(),
            1,
        )

    def test_stale_status_version_returns_conflict_without_second_change(self):
        self._authenticate(self.manager)
        initial = self.client.get(self._access_url()).json()
        payload = {
            'is_active': False,
            'expected_version': initial['versao'],
            'motivo': 'Suspensão de teste.',
        }

        first = self.client.patch(self._status_url(), payload, format='json')
        second = self.client.patch(
            self._status_url(),
            {
                'is_active': True,
                'expected_version': initial['versao'],
            },
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second.json()['code'], 'access_version_conflict')
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)
        self.assertEqual(
            AuditoriaAcessoUsuario.objects.filter(
                usuario_afetado=self.target,
                acao__in=('ativacao', 'desativacao'),
            ).count(),
            1,
        )

    def test_password_reset_validates_audits_without_secret_and_invalidates_session(self):
        target_client = APIClient()
        target_client.force_login(self.target)
        self.assertEqual(
            target_client.get('/api/users/me/permissions/').status_code,
            status.HTTP_200_OK,
        )
        self._authenticate(self.manager)

        weak_response = self.client.post(
            self._password_reset_url(),
            {'password': 'short', 'password_confirm': 'short'},
            format='json',
        )
        mismatch_response = self.client.post(
            self._password_reset_url(),
            {
                'password': 'Qa9!reset-only-2026',
                'password_confirm': 'Qa9!different-only-2026',
            },
            format='json',
        )

        self.assertEqual(weak_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mismatch_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            AuditoriaAcessoUsuario.objects.filter(
                usuario_afetado=self.target,
                acao='redefinicao_senha',
            ).exists(),
        )

        new_password = 'Qa9!reset-only-2026'
        reset_response = self.client.post(
            self._password_reset_url(),
            {
                'password': new_password,
                'password_confirm': new_password,
                'motivo': 'Solicitação administrativa validada.',
            },
            format='json',
        )

        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertTrue(self.target.check_password(new_password))
        expired_session = target_client.get('/api/users/me/permissions/')
        self.assertIn(
            expired_session.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

        audit = AuditoriaAcessoUsuario.objects.get(
            usuario_afetado=self.target,
            acao='redefinicao_senha',
        )
        self.assertEqual(audit.ator, self.manager)
        self.assertEqual(audit.antes['password_reset'], False)
        self.assertEqual(audit.depois['password_reset'], True)
        self.assertEqual(audit.motivo, 'Solicitação administrativa validada.')
        self.assertNotIn(new_password, str(audit.antes))
        self.assertNotIn(new_password, str(audit.depois))

        history = self.client.get(self._audit_url()).json()['results']
        reset_history = next(item for item in history if item['acao'] == 'redefinicao_senha')
        self.assertNotIn(new_password, str(reset_history))

    def test_password_reset_rejects_password_similar_to_target_username(self):
        self._authenticate(self.manager)
        original_hash = self.target.password

        response = self.client.post(
            self._password_reset_url(),
            {
                'password': self.target.username,
                'password_confirm': self.target.username,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.target.refresh_from_db()
        self.assertEqual(self.target.password, original_hash)

    def test_manager_cannot_reset_another_superuser_password(self):
        self._authenticate(self.manager)
        original_password_hash = self.other_superuser.password
        attempted_password = 'Qa9!blocked-superuser-reset-2026'

        response = self.client.post(
            self._password_reset_url(self.other_superuser),
            {
                'password': attempted_password,
                'password_confirm': attempted_password,
                'motivo': 'Tentativa que deve ser bloqueada.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.other_superuser.refresh_from_db()
        self.assertEqual(self.other_superuser.password, original_password_hash)
        self.assertFalse(self.other_superuser.check_password(attempted_password))
        self.assertFalse(
            AuditoriaAcessoUsuario.objects.filter(
                usuario_afetado=self.other_superuser,
                acao='redefinicao_senha',
            ).exists(),
        )

    def test_password_reset_of_superuser_is_always_blocked(self):
        self._authenticate(self.manager)
        original_password = 'test-only-password'
        self.assertTrue(self.other_superuser.check_password(original_password))

        response = self.client.post(
            self._password_reset_url(self.other_superuser),
            {
                'password': 'Qa9!blocked-superuser-reset-2026',
                'password_confirm': 'Qa9!blocked-superuser-reset-2026',
                'motivo': 'Tentativa administrativa de teste.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.other_superuser.refresh_from_db()
        self.assertTrue(self.other_superuser.check_password(original_password))
        self.assertFalse(
            AuditoriaAcessoUsuario.objects.filter(
                usuario_afetado=self.other_superuser,
                acao='redefinicao_senha',
            ).exists()
        )

    def test_audit_records_actor_before_after_ip_and_user_agent(self):
        self._authenticate(self.manager)
        initial = self.client.get(self._access_url()).json()

        response = self.client.put(
            self._access_url(),
            {
                'modo': 'personalizado',
                'modulos': {'cte': ['view']},
                'versao': initial['versao'],
            },
            format='json',
            REMOTE_ADDR='192.0.2.10',
            HTTP_USER_AGENT='access-control-test-agent',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit = AuditoriaAcessoUsuario.objects.get(
            usuario_afetado=self.target,
            acao='alteracao_acessos',
        )
        self.assertEqual(audit.ator, self.manager)
        self.assertEqual(audit.usuario_afetado_nome, self.target.username)
        self.assertEqual(audit.endereco_ip, '192.0.2.10')
        self.assertEqual(audit.user_agent, 'access-control-test-agent')
        self.assertEqual(audit.antes['access_mode'], 'perfil')
        self.assertEqual(audit.depois['access_mode'], 'personalizado')
        self.assertLess(audit.antes['version'], audit.depois['version'])

        history = self.client.get(self._audit_url())
        self.assertEqual(history.status_code, status.HTTP_200_OK)

    def test_custom_access_update_preserves_protected_cte_permission(self):
        self.target.user_permissions.add(
            self.cte_permission,
            self.cte_delete_permission,
        )
        initial = get_acesso_usuario(self.target)

        atualizar_acesso_usuario(
            self.manager,
            self.target,
            {
                'modo': 'personalizado',
                'modulos': {},
                'versao': initial['versao'],
            },
            request=self.request,
        )

        self.assertTrue(
            self.target.user_permissions.filter(pk=self.cte_permission.pk).exists(),
        )
        self.assertTrue(
            self.target.user_permissions.filter(pk=self.cte_delete_permission.pk).exists(),
        )

    def test_management_command_grants_and_revokes_direct_access(self):
        self.manager.user_permissions.remove(self.manage_permission)
        self.assertFalse(
            self.manager.user_permissions.filter(pk=self.manage_permission.pk).exists(),
        )

        call_command('conceder_admin_acessos', 'jacival', verbosity=0)

        self.assertTrue(
            self.manager.user_permissions.filter(pk=self.manage_permission.pk).exists(),
        )
        call_command('conceder_admin_acessos', 'JACIVAL', '--revogar', verbosity=0)
        self.assertFalse(
            self.manager.user_permissions.filter(pk=self.manage_permission.pk).exists(),
        )

    def test_service_guards_self_access_status_and_version(self):
        manager_access = get_acesso_usuario(self.manager)
        with self.assertRaises(OperacaoAcessoProtegida):
            atualizar_acesso_usuario(
                self.manager,
                self.manager,
                {
                    'modo': 'personalizado',
                    'modulos': {},
                    'versao': manager_access['versao'],
                },
                request=self.request,
            )
        with self.assertRaises(OperacaoAcessoProtegida):
            atualizar_status_usuario(
                self.manager,
                self.manager,
                False,
                request=self.request,
            )

        target_access = get_acesso_usuario(self.target)
        atualizar_acesso_usuario(
            self.manager,
            self.target,
            {
                'modo': 'personalizado',
                'modulos': {},
                'versao': target_access['versao'],
            },
            request=self.request,
        )
        with self.assertRaises(ConflitoVersaoAcesso):
            atualizar_acesso_usuario(
                self.manager,
                self.target,
                {
                    'modo': 'personalizado',
                    'modulos': {},
                    'versao': target_access['versao'],
                },
                request=self.request,
            )

    def test_catalog_marks_operational_permissions_as_protected(self):
        capabilities = {
            item['key']: item
            for item in get_catalogo_acessos()['capabilities']
        }

        for key in (
            'usuarios.manage_access',
            'cte.editar_valor_frete',
            'cte.excluir_importado',
        ):
            with self.subTest(capability=key):
                self.assertIn(key, capabilities)
                self.assertTrue(capabilities[key]['locked'])
