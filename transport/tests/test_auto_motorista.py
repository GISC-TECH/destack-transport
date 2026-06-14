"""
Testes da automação de cadastro de motorista a partir do XML.

Antes o cadastro de Motorista era 100% manual; agora o condutor do CT-e/MDF-e
é auto-cadastrado e vinculado (casado por CPF), com CNH/validades em branco.
"""
from django.test import TestCase

from transport.models import (
    CTeDocumento, MDFeDocumento, Motorista,
    CTeModalRodoviario, CTeMotorista,
)
from transport.services.cadastro import sincronizar_motorista
from transport.services import parser_cte as PC
from transport.services import parser_mdfe as PM


class SincronizarMotoristaTests(TestCase):
    def test_cria_motorista_novo(self):
        m = sincronizar_motorista('JOAO DA SILVA', '12345678901')
        self.assertIsNotNone(m)
        self.assertEqual(m.cpf, '12345678901')
        self.assertEqual(m.nome, 'JOAO DA SILVA')
        self.assertIsNone(m.cnh)
        self.assertTrue(m.cadastro_automatico)
        self.assertFalse(m.cadastro_completo)

    def test_idempotente_por_cpf(self):
        a = sincronizar_motorista('JOAO', '12345678901')
        b = sincronizar_motorista('JOAO DA SILVA', '123.456.789-01')  # mesmo CPF formatado
        self.assertEqual(a.id, b.id)
        self.assertEqual(Motorista.objects.filter(cpf='12345678901').count(), 1)

    def test_nao_sobrescreve_cadastro_manual(self):
        manual = Motorista.objects.create(
            nome='MARIA SOUZA', cpf='98765432100', cnh='123456789',
            cadastro_automatico=False)
        m = sincronizar_motorista('NOME DO XML', '98765432100')
        self.assertEqual(m.id, manual.id)
        m.refresh_from_db()
        self.assertEqual(m.nome, 'MARIA SOUZA')  # nome manual preservado
        self.assertEqual(m.cnh, '123456789')
        self.assertFalse(m.cadastro_automatico)

    def test_cpf_invalido_retorna_none(self):
        self.assertIsNone(sincronizar_motorista('FULANO', '123'))
        self.assertIsNone(sincronizar_motorista('FULANO', None))

    def test_dois_condutores_sem_cnh_nao_colidem(self):
        a = sincronizar_motorista('A', '11111111111')
        b = sincronizar_motorista('B', '22222222222')
        self.assertIsNotNone(a)
        self.assertIsNotNone(b)
        self.assertEqual(Motorista.objects.filter(cnh__isnull=True).count(), 2)


class ParserVinculoMotoristaTests(TestCase):
    def test_cte_motorista_vincula_cadastro(self):
        cte = CTeDocumento.objects.create(
            chave='29250924633774000118570010000099991012180991',
            xml_original='<x/>', processado=False)
        modal = CTeModalRodoviario.objects.create(cte=cte)
        infcte = {'infModal': {'@versaoModal': '4.00', 'rodo': {
            'RNTRC': '12345678',
            'moto': {'xNome': 'CARLOS MOTORISTA', 'CPF': '45678912300'},
        }}}
        PC.parse_cte_modal_rodoviario(cte, infcte)
        cm = CTeMotorista.objects.get(modal__cte=cte)
        self.assertIsNotNone(cm.motorista)
        self.assertEqual(cm.motorista.cpf, '45678912300')
        self.assertTrue(cm.motorista.cadastro_automatico)

    def test_mdfe_condutor_vincula_cadastro(self):
        mdfe = MDFeDocumento.objects.create(
            chave='29260624633774000118580010000010591003046081',
            xml_original='<x/>', processado=False)
        infmdfe = {'infModal': {'@versaoModal': '3.00', 'rodo': {
            'veicTracao': {'placa': 'ABC1234', 'tara': '5000', 'condutor': {'xNome': 'PEDRO CONDUTOR', 'CPF': '32165498700'}},
        }}}
        PM.parse_mdfe_modal_rodoviario(mdfe, infmdfe)
        cond = mdfe.condutores.first()
        self.assertIsNotNone(cond)
        self.assertIsNotNone(cond.motorista)
        self.assertEqual(cond.motorista.cpf, '32165498700')
        self.assertTrue(Motorista.objects.filter(cpf='32165498700').exists())
