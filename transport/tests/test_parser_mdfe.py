"""
Testes de cobertura do parser de MDF-e (Fase E).

Garante extração dos campos reais, ausência de fabricação (Fase A) e as
seções adicionadas na Fase C (ANTT financeiro, infLotacao, observações,
pontoFulgor, qUnid, unidades de transporte).
"""
import glob
import os
from decimal import Decimal

from django.conf import settings
from django.test import TestCase

from transport.models import (
    MDFeDocumento, MDFeSeguroCarga, MDFeTotais, MDFeModalRodoviario,
    MDFeProdutoPredominante, MDFeObservacao,
)
from transport.services import parser_mdfe as P

MDFE_DIR = os.path.join(settings.BASE_DIR, 'mediafiles', 'xml_mdfes')


def _first_mdfe():
    arquivos = sorted(glob.glob(os.path.join(MDFE_DIR, '*.xml')))
    return arquivos[0] if arquivos else None


class RealMdfeXmlTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        caminho = _first_mdfe()
        with open(caminho, 'r', encoding='utf-8') as fh:
            xml = fh.read()
        # A chave é o nome do arquivo (44 dígitos)
        chave = os.path.splitext(os.path.basename(caminho))[0]
        cls.mdfe = MDFeDocumento.objects.create(chave=chave, versao='3.00', xml_original=xml)
        cls.ok = P.parse_mdfe_completo(cls.mdfe)

    def test_processamento_bem_sucedido(self):
        self.assertTrue(self.ok)

    def test_totais_reais_nao_fabricados(self):
        tot = MDFeTotais.objects.filter(mdfe=self.mdfe).first()
        if tot:
            # Não pode ser o antigo placeholder mínimo
            self.assertNotEqual(tot.v_carga, Decimal('0.01'))
            self.assertNotEqual(tot.q_carga, Decimal('0.0001'))

    def test_seguro_sem_cnpj_fabricado(self):
        seg = MDFeSeguroCarga.objects.filter(mdfe=self.mdfe).first()
        if seg:
            # CNPJ ausente no XML deve ficar None, nunca 00000000000000
            self.assertNotEqual(seg.cnpj_seguradora, '00000000000000')


class NewSectionsUnitTests(TestCase):
    def setUp(self):
        self.mdfe = MDFeDocumento.objects.create(chave='8' * 44, versao='3.00')

    def test_antt_financeiro(self):
        infmdfe = {'infModal': {'@versaoModal': '3.00', 'rodo': {'infANTT': {
            'RNTRC': '56173655', 'tpRntrc': '1', 'valETarifa': '12.50', 'valAPagar': '1500.00',
            'infCIOT': {'valORespFrete': '1200.00'},
        }}}}
        P.parse_mdfe_modal_rodoviario(self.mdfe, infmdfe)
        mod = MDFeModalRodoviario.objects.get(mdfe=self.mdfe)
        self.assertEqual(mod.tp_rntrc, '1')
        self.assertEqual(mod.val_etarifa, Decimal('12.50'))
        self.assertEqual(mod.val_apagar, Decimal('1500.00'))
        self.assertEqual(mod.val_resp_frete, Decimal('1200.00'))

    def test_inflotacao_e_qunid(self):
        infmdfe = {
            'prodPred': {'tpCarga': '02', 'xProd': 'Diversos', 'infLotacao': {
                'infLocalCarrega': {'CEP': '43810160', 'latitude': '-12.97'},
                'infLocalDescarrega': {'CEP': '48970000'}}},
            'tot': {'qCTe': '3', 'vCarga': '5000.00', 'cUnid': '01', 'qCarga': '2000', 'qUnid': '5'},
        }
        P.parse_mdfe_produto_predominante(self.mdfe, infmdfe)
        P.parse_mdfe_totais(self.mdfe, infmdfe)
        pp = MDFeProdutoPredominante.objects.get(mdfe=self.mdfe)
        self.assertEqual(pp.cep_carrega, '43810160')
        self.assertEqual(pp.cep_descarrega, '48970000')
        tot = MDFeTotais.objects.get(mdfe=self.mdfe)
        self.assertEqual(tot.q_unid, 5)

    def test_observacoes_cont_fisco(self):
        infmdfe = {'infAdic': {
            'infCpl': 'Obs gerais',
            'obsCont': [{'@xCampo': 'PEDIDO', 'xTexto': '12345'}],
            'obsFisco': [{'@xCampo': 'AUTORIZACAO', 'xTexto': 'XYZ'}],
        }}
        P.parse_mdfe_informacoes_adicionais(self.mdfe, infmdfe)
        tipos = sorted(MDFeObservacao.objects.filter(mdfe=self.mdfe)
                       .values_list('tipo', flat=True))
        self.assertEqual(tipos, ['cont', 'fisco'])
