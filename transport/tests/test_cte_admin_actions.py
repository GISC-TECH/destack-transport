from decimal import Decimal

from django.contrib.auth.models import Permission, User
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from transport.models import CTeDocumento, CTePrestacaoServico, PagamentoAgregado
from transport.permissions import (
    CTE_EDITAR_VALOR_PERMISSION,
    CTE_EXCLUIR_PERMISSION,
)
from transport.services.dacte_generator import DACTEGenerator
from transport.services.parser_cte import parse_cte_valores


class CTeAdminActionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='Jacival',
            password='test-only-password',
            is_staff=True,
            is_superuser=True,
        )
        self.other_superuser = User.objects.create_user(
            username='outro_admin',
            password='test-only-password',
            is_staff=True,
            is_superuser=True,
        )
        self.standard_user = User.objects.create_user(
            username='operacional',
            password='test-only-password',
        )

        self.edit_permission = Permission.objects.get(
            codename=CTE_EDITAR_VALOR_PERMISSION,
            content_type__app_label='transport',
        )
        self.delete_permission = Permission.objects.get(
            codename=CTE_EXCLUIR_PERMISSION,
            content_type__app_label='transport',
        )
        self.admin.user_permissions.add(
            self.edit_permission,
            self.delete_permission,
        )

        standard_permissions = Permission.objects.filter(
            codename__in=['view_ctedocumento', 'change_ctedocumento', 'delete_ctedocumento'],
            content_type__app_label='transport',
        )
        self.standard_user.user_permissions.add(*standard_permissions)

        self.cte = CTeDocumento.objects.create(
            chave='1' * 44,
            versao='4.00',
            processado=True,
            valor_frete_importado=Decimal('1000.00'),
        )
        CTePrestacaoServico.objects.create(
            cte=self.cte,
            valor_total_prestado=Decimal('1000.00'),
            valor_recebido=Decimal('1000.00'),
        )

    def _url(self, suffix):
        return f'/api/ctes/{self.cte.pk}/{suffix}/'

    def test_only_directly_authorized_user_can_edit_value(self):
        payload = {'valor_total_prestado': '1250.75'}

        self.client.force_authenticate(self.other_superuser)
        response = self.client.patch(self._url('valor-frete'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.standard_user)
        response = self.client.patch(self._url('valor-frete'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.admin)
        response = self.client.patch(self._url('valor-frete'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.cte.refresh_from_db()
        self.cte.prestacao.refresh_from_db()
        self.assertEqual(self.cte.prestacao.valor_total_prestado, Decimal('1250.75'))
        self.assertEqual(self.cte.valor_frete_importado, Decimal('1000.00'))
        self.assertTrue(self.cte.valor_frete_editado_manualmente)
        self.assertEqual(self.cte.valor_frete_editado_por, self.admin)
        self.assertIsNotNone(self.cte.valor_frete_editado_em)

    def test_manual_value_survives_xml_reprocessing(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            self._url('valor-frete'),
            {'valor_total_prestado': '1250.75'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.cte.refresh_from_db()
        parse_cte_valores(self.cte, {
            'vPrest': {
                'vTPrest': '900.00',
                'vRec': '900.00',
                'Comp': [],
            },
        })

        self.cte.refresh_from_db()
        self.cte.prestacao.refresh_from_db()
        self.assertEqual(self.cte.prestacao.valor_total_prestado, Decimal('1250.75'))
        self.assertEqual(self.cte.valor_frete_importado, Decimal('900.00'))

    def test_manual_value_must_be_positive(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(
            self._url('valor-frete'),
            {'valor_total_prestado': '0.00'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.cte.prestacao.refresh_from_db()
        self.assertEqual(self.cte.prestacao.valor_total_prestado, Decimal('1000.00'))

    def test_dacte_keeps_original_fiscal_value_after_manual_edit(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            self._url('valor-frete'),
            {'valor_total_prestado': '1250.75'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.cte.refresh_from_db()
        self.cte.prestacao.refresh_from_db()
        generator = DACTEGenerator(self.cte)

        self.assertEqual(
            generator._valor_total_fiscal(self.cte.prestacao),
            Decimal('1000.00'),
        )

    def test_detail_exposes_special_capabilities_only_to_designated_user(self):
        self.client.force_authenticate(self.other_superuser)
        response = self.client.get(f'/api/ctes/{self.cte.pk}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['permissoes_especiais'], {
            'editar_valor_frete': False,
            'excluir_cte': False,
        })

        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/ctes/{self.cte.pk}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['permissoes_especiais'], {
            'editar_valor_frete': True,
            'excluir_cte': True,
        })

    def test_directly_authorized_user_can_delete_unlinked_cte(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(self._url('excluir'))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CTeDocumento.objects.filter(pk=self.cte.pk).exists())

    def test_delete_is_blocked_when_cte_has_payment(self):
        PagamentoAgregado.objects.create(
            cte=self.cte,
            placa='ABC1234',
            condutor_nome='Motorista Teste',
            valor_frete_total=Decimal('1000.00'),
            percentual_repasse=Decimal('25.00'),
            valor_repassado=Decimal('250.00'),
            data_prevista='2026-08-31',
        )
        self.client.force_authenticate(self.admin)

        response = self.client.delete(self._url('excluir'))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('pagamento de agregado', response.json()['bloqueios'])
        self.assertTrue(CTeDocumento.objects.filter(pk=self.cte.pk).exists())
        self.assertTrue(PagamentoAgregado.objects.filter(cte=self.cte).exists())

    def test_other_superuser_cannot_delete_cte(self):
        self.client.force_authenticate(self.other_superuser)
        response = self.client.delete(self._url('excluir'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(CTeDocumento.objects.filter(pk=self.cte.pk).exists())

    def test_management_command_grants_permissions_case_insensitively(self):
        self.admin.user_permissions.clear()

        call_command('conceder_admin_cte', 'jacival', verbosity=0)

        direct_codenames = set(self.admin.user_permissions.values_list('codename', flat=True))
        self.assertIn(CTE_EDITAR_VALOR_PERMISSION, direct_codenames)
        self.assertIn(CTE_EXCLUIR_PERMISSION, direct_codenames)
