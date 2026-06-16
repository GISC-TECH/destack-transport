from django.test import SimpleTestCase

from transport.views.upload_views import UnifiedUploadViewSet


class UploadEventIdentificationTests(SimpleTestCase):
    def test_proc_evento_cte_is_classified_when_primary_detection_falls_back(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <procEventoCTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
          <eventoCTe>
            <infEvento Id="ID1101112926062463377400011857001000006805101970517401">
              <chCTe>29260624633774000118570010000068051019705174</chCTe>
              <tpEvento>110111</tpEvento>
            </infEvento>
          </eventoCTe>
          <retEventoCTe>
            <infEvento>
              <cStat>135</cStat>
            </infEvento>
          </retEventoCTe>
        </procEventoCTe>
        """

        view = UnifiedUploadViewSet()
        tipo_xml, chave, is_retorno, _xml_dict, root_tag = view._identificar_xml_e_chave(
            "CTe29260624633774000118570010000068051019705174_Canc.xml",
            xml,
        )

        self.assertEqual(tipo_xml, "PROC_EVENTO_CT_110111")
        self.assertEqual(chave, "29260624633774000118570010000068051019705174")
        self.assertTrue(is_retorno)
        self.assertEqual(root_tag, "procEventoCTe")
