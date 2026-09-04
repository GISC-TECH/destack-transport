from django.contrib.auth.models import Permission, User
from django.test import TestCase
from datetime import date, timedelta
from decimal import Decimal

from transport.models import CTeDocumento, PagamentoAgregado, PagamentoProprio, Veiculo


def _grant_transport_permission(user, model, codename):
    permission = Permission.objects.get(
        content_type__app_label="transport",
        content_type__model=model,
        codename=codename,
    )
    user.user_permissions.add(permission)


class DashboardGeralEndpointTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="test-password-123",
        )
        _grant_transport_permission(
            self.user,
            "configuracaoacessousuario",
            "visualizar_dashboard_geral",
        )
        self.client.force_login(self.user)

    def test_dashboard_rejects_invalid_date_format(self):
        response = self.client.get("/api/dashboard/?data_inicio=01-06-2026&data_fim=30-06-2026")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Formato de data", response.json()["detail"])

    def test_dashboard_accepts_large_date_range_without_overflow(self):
        """Períodos muito grandes não devem causar OverflowError no cálculo do período anterior."""
        response = self.client.get("/api/dashboard/?data_inicio=0001-01-01&data_fim=9999-12-31")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("cards", data)
        self.assertIn("grafico_metas", data)

    def test_dashboard_rejects_final_date_before_start_date(self):
        response = self.client.get("/api/dashboard/?data_inicio=2026-06-30&data_fim=2026-06-01")

        self.assertEqual(response.status_code, 400)
        self.assertIn("data final", response.json()["detail"].lower())
from transport.serializers.payment_serializers import (
    PagamentoAgregadoSerializer,
    PagamentoProprioSerializer,
)


class AuthEndpointTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="test-password-123",
        )

    def test_logout_rejects_get_without_ending_session(self):
        self.client.force_login(self.user)

        response = self.client.get("/api/auth/logout/")

        self.assertEqual(response.status_code, 405)
        auth_response = self.client.get("/api/auth/user/")
        self.assertEqual(auth_response.status_code, 200)
        self.assertTrue(auth_response.json()["authenticated"])

    def test_logout_post_ends_session(self):
        self.client.force_login(self.user)

        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        auth_response = self.client.get("/api/auth/user/")
        self.assertEqual(auth_response.status_code, 200)
        self.assertFalse(auth_response.json()["authenticated"])


class AlertasPagamentoEndpointTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="test-password-123",
        )
        _grant_transport_permission(
            self.user,
            "pagamentoagregado",
            "view_pagamentoagregado",
        )
        self.client.force_login(self.user)

    def test_alertas_pagamentos_rejects_invalid_dias_param(self):
        response = self.client.get("/api/alertas/pagamentos/?dias=abc")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Parâmetro 'dias' deve ser um número inteiro.",
        )

    def test_alertas_pagamentos_includes_total_metadata_and_optional_limit(self):
        response = self.client.get("/api/alertas/pagamentos/?dias=30&limite=5")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["dias_alerta"], 30)
        self.assertEqual(data["limite"], 5)
        self.assertEqual(data["total_agregados_pendentes"], 0)
        self.assertEqual(data["total_proprios_pendentes"], 0)
        self.assertEqual(data["total_pendentes"], 0)
        self.assertFalse(data["resultado_limitado"])

    def test_alertas_pagamentos_respects_date_filter(self):
        cte = CTeDocumento.objects.create(
            chave="A" * 44,
            versao="4.00",
            processado=True,
        )
        PagamentoAgregado.objects.create(
            cte=cte,
            placa="ABC1234",
            condutor_nome="Motorista",
            valor_frete_total=Decimal("1000.00"),
            percentual_repasse=Decimal("25.00"),
            data_prevista=date(2026, 6, 15),
            status="pendente",
        )

        response = self.client.get("/api/alertas/pagamentos/?data_inicio=2026-06-01&data_fim=2026-06-30")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_agregados_pendentes"], 1)

    def test_alertas_pagamentos_date_filter_excludes_outside_range(self):
        cte = CTeDocumento.objects.create(
            chave="B" * 44,
            versao="4.00",
            processado=True,
        )
        PagamentoAgregado.objects.create(
            cte=cte,
            placa="ABC1234",
            condutor_nome="Motorista",
            valor_frete_total=Decimal("1000.00"),
            percentual_repasse=Decimal("25.00"),
            data_prevista=date(2026, 5, 15),
            status="pendente",
        )

        response = self.client.get("/api/alertas/pagamentos/?data_inicio=2026-06-01&data_fim=2026-06-30")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_agregados_pendentes"], 0)


class PagamentoSerializerIntegrityTests(TestCase):
    def test_pagamento_agregado_requires_data_pagamento_when_paid(self):
        cte = CTeDocumento.objects.create(
            chave="1" * 44,
            versao="4.00",
            processado=True,
        )
        pagamento = PagamentoAgregado.objects.create(
            cte=cte,
            placa="ABC1234",
            condutor_nome="Motorista Agregado",
            valor_frete_total=Decimal("1000.00"),
            percentual_repasse=Decimal("25.00"),
            data_prevista=date(2026, 1, 10),
        )

        serializer = PagamentoAgregadoSerializer(
            pagamento,
            data={"status": "pago"},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("data_pagamento", serializer.errors)

    def test_pagamento_agregado_exposes_uuid_cte_id(self):
        cte = CTeDocumento.objects.create(
            chave="2" * 44,
            versao="4.00",
            processado=True,
        )
        pagamento = PagamentoAgregado.objects.create(
            cte=cte,
            placa="ABC1234",
            condutor_nome="Motorista Agregado",
            valor_frete_total=Decimal("1000.00"),
            percentual_repasse=Decimal("25.00"),
            data_prevista=date(2026, 1, 10),
        )

        data = PagamentoAgregadoSerializer(pagamento).data

        self.assertEqual(data["cte_id"], str(cte.id))

    def test_pagamento_proprio_requires_data_pagamento_when_paid(self):
        cte = CTeDocumento.objects.create(
            chave="3" * 44,
            versao="4.00",
            processado=True,
        )
        veiculo = Veiculo.objects.create(
            placa="XYZ1234",
            tipo_proprietario="00",
            ativo=True,
        )
        pagamento = PagamentoProprio.objects.create(
            veiculo=veiculo,
            periodo="2026-01",
            cte=cte,
            valor_base_faixa=Decimal("500.00"),
            ajustes=Decimal("0.00"),
        )

        serializer = PagamentoProprioSerializer(
            pagamento,
            data={"status": "pago"},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("data_pagamento", serializer.errors)
