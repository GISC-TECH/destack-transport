import hashlib
import os
import shutil
import tempfile

from django.conf import settings
from django.core.management import call_command
from django.test import TestCase

from transport.models import CTeDocumento, MDFeDocumento


class RetencaoXmlsTests(TestCase):
    def setUp(self):
        self._media_root_original = settings.MEDIA_ROOT
        self.media_root = tempfile.mkdtemp()
        settings.MEDIA_ROOT = self.media_root

    def tearDown(self):
        settings.MEDIA_ROOT = self._media_root_original
        if os.path.isdir(self.media_root):
            shutil.rmtree(self.media_root)

    def test_signal_gera_checksum_ao_salvar_cte(self):
        xml = "<cte><teste>123</teste></cte>"
        cte = CTeDocumento.objects.create(
            chave="3" * 44,
            versao="4.00",
            xml_original=xml,
        )

        cte.refresh_from_db()
        self.assertEqual(cte.checksum, hashlib.sha256(xml.encode("utf-8")).hexdigest())

    def test_signal_gera_checksum_ao_salvar_mdfe(self):
        xml = "<mdfe><teste>456</teste></mdfe>"
        mdfe = MDFeDocumento.objects.create(
            chave="5" * 44,
            versao="3.00",
            xml_original=xml,
        )

        mdfe.refresh_from_db()
        self.assertEqual(mdfe.checksum, hashlib.sha256(xml.encode("utf-8")).hexdigest())

    def test_comando_organiza_xml_cte_sem_mover(self):
        xml = "<cte><conteudo>CTE TESTE</conteudo></cte>"
        cte = CTeDocumento.objects.create(
            chave="7" * 44,
            versao="4.00",
            xml_original=xml,
        )

        call_command("organizar_xmls")

        cte.refresh_from_db()
        self.assertIsNotNone(cte.caminho_arquivo)
        self.assertTrue(cte.caminho_arquivo.startswith("xmls/"))
        self.assertTrue(cte.caminho_arquivo.endswith(f"/{cte.chave}.xml"))
        self.assertEqual(cte.xml_original, xml)

        caminho_absoluto = os.path.join(self.media_root, cte.caminho_arquivo)
        self.assertTrue(os.path.isfile(caminho_absoluto))
        with open(caminho_absoluto, "r", encoding="utf-8") as arquivo:
            self.assertEqual(arquivo.read(), xml)

    def test_comando_move_xml_quando_flag_mover(self):
        xml = "<mdfe><conteudo>MDFE TESTE</conteudo></mdfe>"
        mdfe = MDFeDocumento.objects.create(
            chave="9" * 44,
            versao="3.00",
            xml_original=xml,
        )

        call_command("organizar_xmls", "--mover")

        mdfe.refresh_from_db()
        self.assertIsNotNone(mdfe.caminho_arquivo)
        self.assertTrue(mdfe.caminho_arquivo.startswith("xmls/"))
        self.assertTrue(mdfe.caminho_arquivo.endswith(f"/{mdfe.chave}.xml"))
        self.assertEqual(mdfe.xml_original, "")

    def test_comando_ignora_documentos_sem_xml_original(self):
        CTeDocumento.objects.create(
            chave="1" * 44,
            versao="4.00",
            xml_original=None,
        )

        call_command("organizar_xmls")

        cte = CTeDocumento.objects.get(chave="1" * 44)
        self.assertIsNone(cte.caminho_arquivo)
