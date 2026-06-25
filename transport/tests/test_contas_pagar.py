from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from transport.models import ContaPagar, Veiculo


User = get_user_model()


class ContaPagarModelTests(TestCase):
    """Testes unitários para o modelo ContaPagar."""

    def setUp(self):
        self.veiculo = Veiculo.objects.create(
            placa="ABC1234",
            tipo_proprietario="00",
            ativo=True,
        )

    def test_criar_conta_a_pagar_basica(self):
        conta = ContaPagar.objects.create(
            descricao="Combustível posto X",
            categoria="combustivel",
            fornecedor="Posto X",
            valor=Decimal("500.00"),
            data_vencimento=date(2026, 7, 10),
        )
        self.assertEqual(conta.status, "pendente")
        self.assertEqual(str(conta), "Combustível posto X - R$ 500.00 (Pendente)")

    def test_conta_paga_exige_data_pagamento(self):
        conta = ContaPagar.objects.create(
            descricao="Pedágio",
            categoria="pedagio",
            valor=Decimal("50.00"),
            data_vencimento=date(2026, 7, 10),
            status="paga",
            data_pagamento=date(2026, 7, 9),
        )
        self.assertEqual(conta.status, "paga")

    def test_vinculo_com_veiculo(self):
        conta = ContaPagar.objects.create(
            descricao="Manutenção",
            categoria="oficina",
            fornecedor="Oficina Y",
            valor=Decimal("1200.00"),
            data_vencimento=date(2026, 7, 15),
            veiculo=self.veiculo,
        )
        self.assertEqual(conta.veiculo.placa, "ABC1234")
        self.assertTrue(self.veiculo.contas_a_pagar.exists())


class ContaPagarAPITests(APITestCase):
    """Testes de integração para a API de Contas a Pagar."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            is_staff=True,
            is_superuser=True,
        )

        self.client = APIClient()
        self.client.login(username="testuser", password="testpass123")

        self.veiculo = Veiculo.objects.create(
            placa="XYZ9876",
            tipo_proprietario="00",
            ativo=True,
        )
        self.conta = ContaPagar.objects.create(
            descricao="Seguro anual",
            categoria="seguro",
            fornecedor="Seguradora Z",
            valor=Decimal("2500.00"),
            data_vencimento=date.today() + timedelta(days=10),
        )

    def test_listar_contas_a_pagar(self):
        response = self.client.get("/api/contas-a-pagar/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_filtrar_por_status(self):
        response = self.client.get("/api/contas-a-pagar/?status=pendente")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

        response = self.client.get("/api/contas-a-pagar/?status=paga")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 0)

    def test_criar_conta_a_pagar(self):
        payload = {
            "descricao": "Pedágio BR-101",
            "categoria": "pedagio",
            "fornecedor": "Pedágio S.A.",
            "valor": "120.50",
            "data_vencimento": str(date.today() + timedelta(days=5)),
            "status": "pendente",
        }
        response = self.client.post("/api/contas-a-pagar/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ContaPagar.objects.count(), 2)

    def test_criar_conta_paga_sem_data_pagamento_retorna_erro(self):
        payload = {
            "descricao": "Combustível",
            "categoria": "combustivel",
            "valor": "300.00",
            "data_vencimento": str(date.today()),
            "status": "paga",
        }
        response = self.client.post("/api/contas-a-pagar/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_atualizar_status_para_pago(self):
        payload = {
            "status": "paga",
            "data_pagamento": str(date.today()),
        }
        response = self.client.patch(f"/api/contas-a-pagar/{self.conta.id}/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.conta.refresh_from_db()
        self.assertEqual(self.conta.status, "paga")

    def test_deletar_conta_a_pagar(self):
        response = self.client.delete(f"/api/contas-a-pagar/{self.conta.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(ContaPagar.objects.count(), 0)

    def test_conta_vencida_marcada_como_atrasada(self):
        payload = {
            "descricao": "Conta atrasada",
            "categoria": "outras",
            "valor": "100.00",
            "data_vencimento": str(date.today() - timedelta(days=5)),
            "status": "pendente",
        }
        response = self.client.post("/api/contas-a-pagar/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        conta = ContaPagar.objects.get(id=response.data["id"])
        self.assertEqual(conta.status, "atrasada")
