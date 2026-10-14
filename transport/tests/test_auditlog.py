"""Testes básicos do django-auditlog para os modelos críticos do transport."""
from django.test import TestCase

from auditlog.models import LogEntry

from transport.models import Cliente, Veiculo, Motorista


class AuditlogBasicoTests(TestCase):
    """Garante que alterações em modelos críticos geram entradas de auditoria."""

    def test_criar_cliente_gera_log(self):
        logs_antes = LogEntry.objects.count()
        cliente = Cliente.objects.create(
            razao_social='Cliente Teste',
            cnpj='11.222.333/0001-44',
        )
        logs_depois = LogEntry.objects.count()
        self.assertEqual(logs_depois, logs_antes + 1)

        log = LogEntry.objects.first()
        self.assertEqual(log.action, LogEntry.Action.CREATE)
        self.assertEqual(log.object_repr, str(cliente))
        self.assertEqual(log.content_type.model, 'cliente')

    def test_atualizar_veiculo_gera_log(self):
        veiculo = Veiculo.objects.create(placa='ABC1234')
        logs_antes = LogEntry.objects.count()
        veiculo.placa = 'ABC1235'
        veiculo.save()
        logs_depois = LogEntry.objects.count()
        self.assertEqual(logs_depois, logs_antes + 1)

        log = LogEntry.objects.first()
        self.assertEqual(log.action, LogEntry.Action.UPDATE)
        self.assertIn('placa', log.changes)

    def test_excluir_motorista_gera_log(self):
        motorista = Motorista.objects.create(nome='Motorista Teste', cpf='12345678901')
        logs_antes = LogEntry.objects.count()
        motorista.delete()
        logs_depois = LogEntry.objects.count()
        self.assertEqual(logs_depois, logs_antes + 1)

        log = LogEntry.objects.first()
        self.assertEqual(log.action, LogEntry.Action.DELETE)
        self.assertEqual(log.content_type.model, 'motorista')
