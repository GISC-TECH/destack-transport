from datetime import date
from unittest.mock import patch

from django.test import TestCase

from transport.models import AlertaSistema, Motorista
from transport.tasks import gerar_alertas_inteligentes


class AlertTaskTests(TestCase):
    def test_long_document_name_creates_bounded_idempotent_reference(self):
        motorista = Motorista.objects.create(
            nome="Motorista Teste",
            cpf="00000000000",
        )
        documento = {
            "documento": "Certificado de capacitacao complementar " + "X" * 120,
            "validade": date.today(),
            "vencido": False,
            "dias_restantes": 0,
        }

        with patch.object(
            Motorista,
            "get_documentos_vencendo",
            return_value=[documento],
        ):
            primeiro_resultado = gerar_alertas_inteligentes()
            segundo_resultado = gerar_alertas_inteligentes()

        alerta = AlertaSistema.objects.get(tipo="documento_motorista_vencendo")
        self.assertLessEqual(len(alerta.referencia), 60)
        self.assertTrue(alerta.referencia.startswith(str(motorista.id)[:20]))
        self.assertEqual(primeiro_resultado["alertas_criados"], 1)
        self.assertEqual(segundo_resultado["alertas_criados"], 0)

    def test_short_reference_keeps_legacy_format(self):
        motorista = Motorista.objects.create(
            nome="Motorista Teste",
            cpf="11111111111",
            validade_cnh=date.today(),
        )

        gerar_alertas_inteligentes()

        alerta = AlertaSistema.objects.get(tipo="documento_motorista_vencendo")
        self.assertEqual(alerta.referencia, f"{motorista.id}_CNH")
