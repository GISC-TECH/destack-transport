from django.contrib.auth.models import User
from django.test import TestCase
from datetime import date
from decimal import Decimal

from transport.models import CTeDocumento, PagamentoAgregado, PagamentoProprio, Veiculo
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
        self.assertEqual(auth_response.status_code, 401)
        self.assertFalse(auth_response.json()["authenticated"])


class AlertasPagamentoEndpointTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="test-password-123",
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
