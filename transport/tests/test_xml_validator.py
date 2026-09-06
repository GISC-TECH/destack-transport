from django.test import SimpleTestCase

from transport.services.xml_validator import validar_xml


class XMLValidatorTests(SimpleTestCase):
    def test_cte_valido_eh_reconhecido(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <CTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
          <infCte Id="CTe29260624633774000118570010000068051019705174" versao="4.00">
            <ide>
              <cUF>29</cUF>
              <cCT>12345678</cCT>
              <CFOP>5352</CFOP>
              <natOp>TRANSPORTE</natOp>
              <mod>57</mod>
              <serie>1</serie>
              <nCT>6805</nCT>
              <dhEmi>2026-06-01T10:00:00-03:00</dhEmi>
            </ide>
          </infCte>
        </CTe>
        """
        resultado = validar_xml(xml)
        self.assertTrue(resultado['valido'], resultado['erros'])
        self.assertEqual(resultado['tipo'], 'cte')

    def test_xml_invalido_eh_rejeitado(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <CTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
          <infCte Id="CTe29260624633774000118570010000068051019705174" versao="4.00">
            <ide>
              <cUF>29</cUF>
              <!-- nCT faltando -->
            </ide>
          </infCte>
        </CTe>
        """
        resultado = validar_xml(xml)
        self.assertFalse(resultado['valido'])
        self.assertEqual(resultado['tipo'], 'cte')

    def test_xml_mal_formado_eh_rejeitado(self):
        resultado = validar_xml("<naoexml")
        self.assertFalse(resultado['valido'])

    def test_mdfe_valido_eh_reconhecido(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <MDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
          <infMDFe Id="MDFe29260624633774000118580010000022461567857588" versao="3.00">
            <ide>
              <cUF>29</cUF>
              <tpAmb>1</tpAmb>
              <tpEmit>1</tpEmit>
              <mod>58</mod>
              <serie>1</serie>
              <nMDF>2246</nMDF>
              <dhEmi>2026-06-01T10:00:00-03:00</dhEmi>
            </ide>
          </infMDFe>
        </MDFe>
        """
        resultado = validar_xml(xml)
        self.assertTrue(resultado['valido'], resultado['erros'])
        self.assertEqual(resultado['tipo'], 'mdfe')

    def test_mdfe_egs_com_campos_opcionais_do_ide_eh_aceito(self):
        """Aceita a ordem de campos emitida pelo EGS no leiaute MDF-e 3.00."""
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <MDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
          <infMDFe Id="MDFe29000000000000000000580010000015251003376395" versao="3.00">
            <ide>
              <cUF>29</cUF>
              <tpAmb>1</tpAmb>
              <tpEmit>1</tpEmit>
              <tpTransp>1</tpTransp>
              <mod>58</mod>
              <serie>1</serie>
              <nMDF>1525</nMDF>
              <cMDF>10033763</cMDF>
              <cDV>5</cDV>
              <modal>1</modal>
              <dhEmi>2026-09-04T10:00:00-03:00</dhEmi>
            </ide>
          </infMDFe>
        </MDFe>
        """

        resultado = validar_xml(xml)

        self.assertTrue(resultado['valido'], resultado['erros'])
        self.assertEqual(resultado['tipo'], 'mdfe')
