"""
Testes dos tratamentos de recepção adicionados para fechar os gaps de schema SEFAZ:
- Modais não-rodoviários CT-e (aéreo, aquaviário, ferroviário, dutoviário, multimodal)
- Modais não-rodoviários MDF-e (aéreo, aquaviário, ferroviário)
- CT-e OS (mod 67) — bloco infCTeNormOS
- Eventos: Carta de Correção (estruturada) + fallback genérico universal

Os modais são testados chamando o parser de seção diretamente (rápido e isolado);
os eventos são testados ponta-a-ponta via parse_evento (que busca o doc no banco).
"""
from decimal import Decimal

from django.test import TestCase

from transport.models import (
    CTeDocumento, MDFeDocumento,
    CTeModalAereo, CTeModalAquaviario, CTeModalFerroviario,
    CTeModalDutoviario, CTeModalMultimodal, CTeOSInfo,
    MDFeModalAereo, MDFeModalAquaviario, MDFeModalFerroviario,
    CTeCartaCorrecao, DocumentoEvento,
)
from transport.services import parser_cte as PC
from transport.services import parser_mdfe as PM
from transport.services.parser_eventos import parse_evento


def _cte():
    return CTeDocumento.objects.create(
        chave='29250924633774000118570010000099991012180999',
        xml_original='<x/>', processado=False)


def _mdfe():
    return MDFeDocumento.objects.create(
        chave='29260624633774000118580010000010591003046085',
        xml_original='<x/>', processado=False)


class CTeModaisExtrasTests(TestCase):
    def test_aereo(self):
        cte = _cte()
        infcte = {'infModal': {'@versaoModal': '4.00', 'aereo': {
            'nMinu': '123', 'nOCA': '45678901234', 'dPrevAereo': '2026-06-10',
            'tarifa': {'CL': 'M', 'cTar': '001', 'vTar': '1500.50'},
            'natCarga': {'xDime': '10X20X30'},
        }}}
        PC.parse_cte_modais_extras(cte, infcte)
        m = CTeModalAereo.objects.get(cte=cte)
        self.assertEqual(m.numero_minuta, '123')
        self.assertEqual(m.valor_tarifa, Decimal('1500.50'))
        self.assertEqual(m.dimensao, '10X20X30')
        self.assertIsNotNone(m.dados_completos)

    def test_aquaviario(self):
        cte = _cte()
        infcte = {'infModal': {'@versaoModal': '4.00', 'aquav': {
            'vPrest': '2000.00', 'vAFRMM': '50.00', 'xNavio': 'NAVIO TESTE',
            'nViag': '7', 'direc': 'N', 'irin': 'IRIN123',
            'prtEmb': 'SANTOS', 'prtDest': 'ITAJAI', 'tpNav': '0',
        }}}
        PC.parse_cte_modais_extras(cte, infcte)
        m = CTeModalAquaviario.objects.get(cte=cte)
        self.assertEqual(m.nome_navio, 'NAVIO TESTE')
        self.assertEqual(m.valor_afrmm, Decimal('50.00'))
        self.assertEqual(m.direcao, 'N')

    def test_ferroviario(self):
        cte = _cte()
        infcte = {'infModal': {'@versaoModal': '4.00', 'ferrov': {
            'tpTraf': '0', 'fluxo': 'FX01', 'idTrem': 'TREM-9', 'vFrete': '9999.99',
            'trafMut': {'respFat': '1', 'ferrEmi': '1'},
        }}}
        PC.parse_cte_modais_extras(cte, infcte)
        m = CTeModalFerroviario.objects.get(cte=cte)
        self.assertEqual(m.id_trem, 'TREM-9')
        self.assertEqual(m.valor_frete, Decimal('9999.99'))
        self.assertEqual(m.resp_faturamento, '1')

    def test_dutoviario(self):
        cte = _cte()
        infcte = {'infModal': {'@versaoModal': '4.00', 'duto': {
            'vTar': '300.00', 'dIni': '2026-06-01', 'dFim': '2026-06-30',
        }}}
        PC.parse_cte_modais_extras(cte, infcte)
        m = CTeModalDutoviario.objects.get(cte=cte)
        self.assertEqual(m.valor_tarifa, Decimal('300.00'))
        self.assertIsNotNone(m.data_inicio)
        self.assertIsNotNone(m.data_fim)

    def test_multimodal(self):
        cte = _cte()
        infcte = {'infModal': {'@versaoModal': '4.00', 'multimodal': {
            'COTM': 'COTM-001', 'indNegociavel': '1',
            'seg': {'respSeg': '1', 'nApol': 'AP-1', 'nAver': 'AV-1'},
        }}}
        PC.parse_cte_modais_extras(cte, infcte)
        m = CTeModalMultimodal.objects.get(cte=cte)
        self.assertEqual(m.numero_cotm, 'COTM-001')
        self.assertEqual(m.numero_apolice, 'AP-1')

    def test_exclusividade_modal(self):
        """Trocar o modal num reprocesso não deixa registro órfão de outro modal."""
        cte = _cte()
        PC.parse_cte_modais_extras(cte, {'infModal': {'aereo': {'nMinu': '1'}}})
        self.assertTrue(CTeModalAereo.objects.filter(cte=cte).exists())
        # Reprocessa como aquaviário
        PC.parse_cte_modais_extras(cte, {'infModal': {'aquav': {'xNavio': 'X'}}})
        self.assertFalse(CTeModalAereo.objects.filter(cte=cte).exists())
        self.assertTrue(CTeModalAquaviario.objects.filter(cte=cte).exists())


class CTeOSInfoTests(TestCase):
    def test_os_info(self):
        cte = _cte()
        infcte = {'infCTeNormOS': {
            'infServico': {'xDescServ': 'TRANSPORTE DE VALORES', 'infQ': {'qCarga': '5.0000'}},
            'seg': {'infSeg': {'xSeg': 'SEGURADORA X'}, 'nApol': 'OS-AP', 'nAver': 'OS-AV'},
            'infDocRef': [{'chave': '111'}],
        }}
        PC.parse_cte_os_info(cte, infcte)
        os_info = CTeOSInfo.objects.get(cte=cte)
        self.assertEqual(os_info.descricao_servico, 'TRANSPORTE DE VALORES')
        self.assertEqual(os_info.quantidade_carga, Decimal('5.0000'))
        self.assertEqual(os_info.seguradora, 'SEGURADORA X')
        self.assertIsNotNone(os_info.documentos_referenciados)


class MDFeModaisExtrasTests(TestCase):
    def test_aereo(self):
        mdfe = _mdfe()
        infmdfe = {'infModal': {'aereo': {
            'nac': 'PR', 'matr': 'PTABC', 'nVoo': 'AD1234',
            'cAerEmb': 'CGH', 'cAerDes': 'SDU', 'dVoo': '2026-06-12',
        }}}
        PM.parse_mdfe_modais_extras(mdfe, infmdfe)
        m = MDFeModalAereo.objects.get(mdfe=mdfe)
        self.assertEqual(m.matricula, 'PTABC')
        self.assertEqual(m.aerodromo_destino, 'SDU')

    def test_aquaviario(self):
        mdfe = _mdfe()
        infmdfe = {'infModal': {'aquav': {
            'CNPJAgeNav': '12345678000199', 'cEmbar': 'EMB1', 'xEmbar': 'BARCO',
            'nViag': '3', 'tpEmb': '01', 'tpNav': '0', 'irin': 'IR1',
            'cPrtEmb': 'BREMB', 'cPrtDest': 'BRDST',
        }}}
        PM.parse_mdfe_modais_extras(mdfe, infmdfe)
        m = MDFeModalAquaviario.objects.get(mdfe=mdfe)
        self.assertEqual(m.nome_embarcacao, 'BARCO')
        self.assertEqual(m.cnpj_agente_navegacao, '12345678000199')

    def test_ferroviario(self):
        mdfe = _mdfe()
        infmdfe = {'infModal': {'ferrov': {'trem': {
            'xPref': 'PREF1', 'dhTrem': '2026-06-12T08:00:00-03:00',
            'xOri': 'ORIG', 'xDest': 'DEST', 'qVag': '15',
        }}}}
        PM.parse_mdfe_modais_extras(mdfe, infmdfe)
        m = MDFeModalFerroviario.objects.get(mdfe=mdfe)
        self.assertEqual(m.prefixo_trem, 'PREF1')
        self.assertEqual(m.qtd_vagoes, 15)
        self.assertIsNotNone(m.data_hora_trem)


# --- XML helpers para eventos ---

def _proc_evento_cte(chave, tp_evento, det_inner, n_seq='1', c_stat='135'):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<procEventoCTe versao="4.00">
  <eventoCTe versao="4.00">
    <infEvento Id="ID{tp_evento}{chave}{n_seq}">
      <cOrgao>29</cOrgao><tpAmb>1</tpAmb><CNPJ>24633774000118</CNPJ>
      <chCTe>{chave}</chCTe><dhEvento>2026-06-12T10:00:00-03:00</dhEvento>
      <tpEvento>{tp_evento}</tpEvento><nSeqEvento>{n_seq}</nSeqEvento>
      <detEvento versaoEvento="4.00">{det_inner}</detEvento>
    </infEvento>
  </eventoCTe>
  <retEventoCTe versao="4.00">
    <infEvento>
      <tpAmb>1</tpAmb><verAplic>SE</verAplic><cOrgao>29</cOrgao>
      <cStat>{c_stat}</cStat><xMotivo>Evento registrado e vinculado</xMotivo>
      <chCTe>{chave}</chCTe><tpEvento>{tp_evento}</tpEvento>
      <nSeqEvento>{n_seq}</nSeqEvento><dhRegEvento>2026-06-12T10:01:00-03:00</dhRegEvento>
      <nProt>329260000111111</nProt>
    </infEvento>
  </retEventoCTe>
</procEventoCTe>"""


class EventoCartaCorrecaoTests(TestCase):
    def test_cce_persistida(self):
        cte = _cte()
        det = """<evCCeCTe><descEvento>Carta de Correcao</descEvento>
          <infCorrecao><grupoAlterado>ide</grupoAlterado><campoAlterado>xObs</campoAlterado>
            <valorAlterado>CORRECAO TESTE</valorAlterado><nroItemAlterado>1</nroItemAlterado></infCorrecao>
          <xCondUso>A Carta de Correcao...</xCondUso></evCCeCTe>"""
        result = parse_evento(_proc_evento_cte(cte.chave, '110110', det))
        self.assertIsNotNone(result)
        carta = CTeCartaCorrecao.objects.get(cte=cte)
        self.assertEqual(carta.codigo_status, 135)
        self.assertEqual(carta.protocolo, '329260000111111')
        self.assertEqual(len(carta.correcoes), 1)
        self.assertEqual(carta.correcoes[0]['campo'], 'xObs')
        # Também registrado no fallback genérico (timeline unificada)
        self.assertTrue(DocumentoEvento.objects.filter(
            chave_documento=cte.chave, tipo_evento='110110').exists())


class EventoGenericoFallbackTests(TestCase):
    def test_evento_sem_handler_dedicado_e_persistido(self):
        """Comprovante de Entrega (110180) não tem handler estruturado, mas deve
        ser recebido e persistido no fallback genérico — nunca descartado."""
        cte = _cte()
        det = """<evCECTe><descEvento>Comprovante de Entrega</descEvento>
          <dhEntrega>2026-06-12T15:00:00-03:00</dhEntrega></evCECTe>"""
        result = parse_evento(_proc_evento_cte(cte.chave, '110180', det))
        self.assertIsNotNone(result)
        ev = DocumentoEvento.objects.get(chave_documento=cte.chave, tipo_evento='110180')
        self.assertEqual(ev.tipo_documento, 'CTE')
        self.assertEqual(ev.cte_id, cte.id)
        self.assertTrue(ev.confirmado)
        self.assertEqual(ev.descricao_evento, 'Comprovante de Entrega (CT-e)')
        self.assertIsNotNone(ev.detalhe_json)
