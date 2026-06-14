"""
Testes de cobertura do parser de CT-e (Fase E).

Garante que o parser:
1. Extrai os campos presentes no XML real (regressão: falha se "deixar passar").
2. NÃO fabrica valores quando o campo está ausente (integridade — Fase A).
3. Extrai as seções adicionadas nas Fases B (ICMS detalhado, cobrança,
   vale-pedágio, CIOT, fluxo).
"""
import os
from decimal import Decimal

from django.conf import settings
from django.test import TestCase

from transport.models import (
    CTeDocumento, CTeTributos, CTeCarga, CTeEmitente,
    CTeModalRodoviario, CTeCobranca, CTeValePedagio, CTeFluxoPassagem,
    CTeIdentificacao,
)
from transport.services import parser_cte as P

SAMPLE_CTE = os.path.join(
    settings.BASE_DIR, 'mediafiles', 'xml_ctes', '229240000051072-procCTe.xml'
)


class RealCteXmlTests(TestCase):
    """Processa o XML real de exemplo e valida a extração."""

    @classmethod
    def setUpTestData(cls):
        with open(SAMPLE_CTE, 'r', encoding='utf-8') as fh:
            xml = fh.read()
        cls.cte = CTeDocumento.objects.create(
            chave='29240524633774000118570010000012351076258412',
            versao='4.00', xml_original=xml,
        )
        cls.ok = P.parse_cte_completo(cls.cte)

    def test_processamento_bem_sucedido(self):
        self.assertTrue(self.ok)

    def test_identificacao_extraida_real(self):
        ident = CTeIdentificacao.objects.get(cte=self.cte)
        # Campos reais do XML — não podem ser None nem valores fabricados
        self.assertIsNotNone(ident.numero)
        self.assertIsNotNone(ident.data_emissao)
        self.assertIsNotNone(ident.cfop)
        # Não fabricado: município não pode ser o antigo placeholder
        self.assertNotEqual(ident.nome_mun_ini, "MUNICÍPIO NÃO INFORMADO")

    def test_icms_detalhado_extraido(self):
        trib = CTeTributos.objects.get(cte=self.cte)
        self.assertEqual(trib.icms_tipo, 'ICMS45')
        self.assertEqual(trib.icms_cst, '51')
        self.assertEqual(trib.valor_total_tributos, Decimal('11.68'))
        # ICMS45 só tem CST -> os demais devem ser None (não fabricados)
        self.assertIsNone(trib.icms_vbc)
        self.assertIsNone(trib.icms_picms)

    def test_emitente_sem_fabricacao(self):
        emit = CTeEmitente.objects.get(cte=self.cte)
        self.assertTrue(emit.razao_social)
        self.assertNotIn('NÃO INFORMADO', (emit.razao_social or ''))
        # CNPJ real (não o placeholder 00000000000000)
        self.assertNotEqual(emit.cnpj, '00000000000000')


class NewSectionsUnitTests(TestCase):
    """Valida o parsing das seções adicionadas na Fase B com dados sintéticos."""

    def setUp(self):
        self.cte = CTeDocumento.objects.create(chave='9' * 44, versao='4.00')

    def test_cobranca_e_duplicatas(self):
        infcte = {'cobr': {
            'fat': {'nFat': 'FAT-1', 'vOrig': '1000.00', 'vDesc': '50.00', 'vLiq': '950.00'},
            'dup': [{'nDup': '1', 'dVenc': '2026-07-01', 'vDup': '475.00'},
                    {'nDup': '2', 'dVenc': '2026-08-01', 'vDup': '475.00'}],
        }}
        P.parse_cte_cobranca(self.cte, infcte)
        cob = CTeCobranca.objects.get(cte=self.cte)
        self.assertEqual(cob.numero_fatura, 'FAT-1')
        self.assertEqual(cob.valor_liquido, Decimal('950.00'))
        self.assertEqual(cob.duplicatas.count(), 2)

    def test_modal_ciot_e_vale_pedagio(self):
        infcte = {'infCteNorm': {'infModal': {'@versaoModal': '4.00', 'rodo': {
            'RNTRC': '12345678',
            'infCIOT': {'CIOT': '123456789012'},
            'valePed': {'disp': [{'CNPJForn': '1' * 14, 'vValePed': '80.00'}]},
        }}}}
        P.parse_cte_modal_rodoviario(self.cte, infcte)
        modal = CTeModalRodoviario.objects.get(cte=self.cte)
        self.assertEqual(modal.ciot, '123456789012')
        self.assertEqual(CTeValePedagio.objects.filter(cte=self.cte).count(), 1)
        self.assertEqual(CTeValePedagio.objects.get(cte=self.cte).valor, Decimal('80.00'))

    def test_fluxo_passagens(self):
        infcte = {'compl': {'fluxo': {'pass': [{'xPass': 'BR-101'}, {'xPass': 'BR-262'}]}}}
        P.parse_cte_fluxo(self.cte, infcte)
        nomes = list(CTeFluxoPassagem.objects.filter(cte=self.cte)
                     .order_by('ordem').values_list('nome_passagem', flat=True))
        self.assertEqual(nomes, ['BR-101', 'BR-262'])

    def test_sem_fabricacao_de_valores(self):
        """Modal sem RNTRC não deve gravar o antigo placeholder '00000000'."""
        infcte = {'infCteNorm': {'infModal': {'@versaoModal': '4.00', 'rodo': {'lota': '1'}}}}
        P.parse_cte_modal_rodoviario(self.cte, infcte)
        modal = CTeModalRodoviario.objects.get(cte=self.cte)
        self.assertIsNone(modal.rntrc)
        self.assertTrue(modal.lotacao)
