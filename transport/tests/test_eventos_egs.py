"""Recepcao de eventos reais do EGS: encerramento MDF-e com <cUF> e checagem fina no check_exists."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from transport.models import DocumentoEvento, MDFeDocumento
from transport.services.parser_eventos import _uf_sigla, parse_evento

CHAVE = '29260624633774000118580010000010591003046085'
# procEventoMDFe exatamente como o EGS entrega (namespace .../MDFe e <cUF> em vez de <UF>)
XML_ENCERRAMENTO = '<?xml version="1.0" encoding="UTF-8"?><procEventoMDFe xmlns="http://www.portalfiscal.inf.br/MDFe" versao="3.00"><eventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><infEvento Id="ID1101122926062463377400011858001000001059100304608501"><cOrgao>29</cOrgao><tpAmb>1</tpAmb><CNPJ>24633774000118</CNPJ><chMDFe>29260624633774000118580010000010591003046085</chMDFe><dhEvento>2026-10-14T09:07:13-03:00</dhEvento><tpEvento>110112</tpEvento><nSeqEvento>1</nSeqEvento><detEvento versaoEvento="3.00"><evEncMDFe><descEvento>Encerramento</descEvento><nProt>929260014004796</nProt><dtEnc>2026-10-14</dtEnc><cUF>29</cUF><cMun>2922300</cMun></evEncMDFe></detEvento></infEvento></eventoMDFe><retEventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><infEvento Id="ID929260014052334"><tpAmb>1</tpAmb><verAplic>RS20260326112507</verAplic><cOrgao>29</cOrgao><cStat>135</cStat><xMotivo>Evento registrado e vinculado ao MDF-e</xMotivo><chMDFe>29260624633774000118580010000010591003046085</chMDFe><tpEvento>110112</tpEvento><xEvento>Encerramento</xEvento><nSeqEvento>001</nSeqEvento><dhRegEvento>2026-10-14T09:07:13-03:00</dhRegEvento><nProt>929260014052334</nProt></infEvento></retEventoMDFe></procEventoMDFe>'


class EncerramentoMDFeTests(TestCase):
    def test_uf_sigla(self):
        self.assertEqual(_uf_sigla('29'), 'BA')
        self.assertEqual(_uf_sigla('sp'), 'SP')
        self.assertIsNone(_uf_sigla('99'))
        self.assertIsNone(_uf_sigla(None))

    def test_encerramento_com_cuf_marca_mdfe_encerrado(self):
        mdfe = MDFeDocumento.objects.create(chave=CHAVE, xml_original='<x/>', processado=True)
        parse_evento(XML_ENCERRAMENTO, None)
        mdfe.refresh_from_db()
        self.assertTrue(mdfe.encerrado)
        self.assertEqual(mdfe.uf_encerramento, 'BA')
        self.assertTrue(mdfe.municipio_encerramento_cod)
        self.assertTrue(DocumentoEvento.objects.filter(chave_documento=CHAVE, tipo_evento='110112').exists())


class CheckExistsEventosTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_superuser('adm', 'a@a.com', 'x')
        self.api = APIClient()
        self.api.force_authenticate(user)

    def test_retorna_so_eventos_exatos_existentes(self):
        mdfe = MDFeDocumento.objects.create(chave=CHAVE, xml_original='<x/>', processado=True)
        DocumentoEvento.objects.create(tipo_documento='MDFE', chave_documento=CHAVE, mdfe=mdfe,
                                       tipo_evento='110112', sequencia_evento=1)
        r = self.api.post('/api/upload/check_exists/', {
            'chaves': [CHAVE],
            'eventos': [f'{CHAVE}:110112:1', f'{CHAVE}:110111:1', 'invalido', f'{CHAVE}:110112:x'],
        }, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['existing_eventos'], [f'{CHAVE}:110112:1'])
        self.assertEqual(r.json()['existing'], [CHAVE])
