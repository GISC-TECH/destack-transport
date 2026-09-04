import io
import tempfile
import zipfile
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import Permission, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from transport.models import CTeDocumento, PagamentoAgregado, PagamentoProprio, Veiculo
from transport.serializers.payment_serializers import PagamentoAgregadoSerializer


class ComprovantesDownloadTests(APITestCase):
    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.settings_override = override_settings(
            MEDIA_ROOT=self.media_dir.name,
            COMPROVANTES_ZIP_MAX_FILES=10,
        )
        self.settings_override.enable()

        self.user = User.objects.create_user('financeiro', password='senha-segura-123')
        self.user.user_permissions.add(
            Permission.objects.get(codename='view_pagamentoagregado'),
            Permission.objects.get(codename='view_pagamentoproprio'),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.cte_a = CTeDocumento.objects.create(chave='1' * 44, versao='4.00', processado=True)
        self.cte_b = CTeDocumento.objects.create(chave='2' * 44, versao='4.00', processado=True)
        self.agregado_pago = PagamentoAgregado.objects.create(
            cte=self.cte_a,
            placa='ABC1234',
            condutor_nome='Motorista A',
            valor_frete_total=Decimal('1000.00'),
            percentual_repasse=Decimal('25.00'),
            data_prevista=date(2026, 9, 1),
            data_pagamento=date(2026, 9, 2),
            status='pago',
            comprovante=SimpleUploadedFile('recibo-a.pdf', b'conteudo-a', content_type='application/pdf'),
        )
        self.agregado_pendente = PagamentoAgregado.objects.create(
            cte=self.cte_b,
            placa='XYZ9876',
            condutor_nome='Motorista B',
            valor_frete_total=Decimal('800.00'),
            percentual_repasse=Decimal('20.00'),
            data_prevista=date(2026, 9, 3),
            status='pendente',
            comprovante=SimpleUploadedFile('recibo-b.txt', b'conteudo-b', content_type='text/plain'),
        )
        self.veiculo = Veiculo.objects.create(placa='DEF5678', tipo_proprietario='00', ativo=True)
        self.proprio = PagamentoProprio.objects.create(
            veiculo=self.veiculo,
            periodo='2026-09',
            valor_base_faixa=Decimal('500.00'),
            ajustes=Decimal('0.00'),
            status='pago',
            data_pagamento=date(2026, 9, 2),
            comprovante=SimpleUploadedFile('proprio.pdf', b'conteudo-proprio', content_type='application/pdf'),
        )

    def tearDown(self):
        self.settings_override.disable()
        self.media_dir.cleanup()

    @staticmethod
    def _zip_response(response):
        payload = b''.join(response.streaming_content)
        return zipfile.ZipFile(io.BytesIO(payload))

    def test_serializer_expoe_apenas_url_autenticada(self):
        response = self.client.get(f'/api/pagamentos/agregados/{self.agregado_pago.pk}/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['tem_comprovante'])
        self.assertNotIn('comprovante', response.data)
        self.assertEqual(
            response.data['comprovante_url'],
            f'http://testserver/api/pagamentos/agregados/{self.agregado_pago.pk}/comprovante/',
        )

    def test_download_individual_exige_autenticacao_e_entrega_arquivo(self):
        url = f'/api/pagamentos/agregados/{self.agregado_pago.pk}/comprovante/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertEqual(b''.join(response.streaming_content), b'conteudo-a')
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(url).status_code, (401, 403))

    def test_download_selecionados_inclui_somente_ids_enviados(self):
        response = self.client.post(
            '/api/pagamentos/agregados/comprovantes/download/',
            {'ids': [str(self.agregado_pendente.pk)]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        with self._zip_response(response) as arquivo_zip:
            nomes = arquivo_zip.namelist()
            self.assertIn('manifesto.csv', nomes)
            comprovantes = [nome for nome in nomes if nome != 'manifesto.csv']
            self.assertEqual(len(comprovantes), 1)
            self.assertEqual(arquivo_zip.read(comprovantes[0]), b'conteudo-b')

    def test_download_todos_respeita_filtros_ativos(self):
        response = self.client.post(
            '/api/pagamentos/agregados/comprovantes/download/?status=pago',
            {'todos': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        with self._zip_response(response) as arquivo_zip:
            comprovantes = [nome for nome in arquivo_zip.namelist() if nome != 'manifesto.csv']
            self.assertEqual(len(comprovantes), 1)
            self.assertEqual(arquivo_zip.read(comprovantes[0]), b'conteudo-a')

    def test_download_funciona_para_pagamentos_proprios(self):
        response = self.client.post(
            '/api/pagamentos/proprios/comprovantes/download/',
            {'ids': [str(self.proprio.pk)]},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        with self._zip_response(response) as arquivo_zip:
            comprovantes = [nome for nome in arquivo_zip.namelist() if nome != 'manifesto.csv']
            self.assertEqual(arquivo_zip.read(comprovantes[0]), b'conteudo-proprio')

    def test_download_rejeita_usuario_sem_permissao_de_visualizacao(self):
        sem_permissao = User.objects.create_user('sem-permissao', password='senha-segura-123')
        self.client.force_authenticate(sem_permissao)

        response = self.client.post(
            '/api/pagamentos/agregados/comprovantes/download/',
            {'todos': True},
            format='json',
        )

        self.assertEqual(response.status_code, 403)

    def test_download_rejeita_payload_invalido(self):
        response = self.client.post(
            '/api/pagamentos/agregados/comprovantes/download/',
            {'ids': ['nao-e-uuid']},
            format='json',
        )

        self.assertEqual(response.status_code, 400)

    @override_settings(COMPROVANTES_ZIP_MAX_TOTAL_BYTES=5)
    def test_download_rejeita_soma_de_arquivos_acima_do_limite(self):
        response = self.client.post(
            '/api/pagamentos/agregados/comprovantes/download/',
            {'ids': [str(self.agregado_pago.pk)]},
            format='json',
        )

        self.assertEqual(response.status_code, 413)

    def test_upload_rejeita_extensao_valida_com_conteudo_falso(self):
        serializer = PagamentoAgregadoSerializer(
            self.agregado_pago,
            data={'comprovante': SimpleUploadedFile('falso.pdf', b'nao-e-pdf')},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('comprovante', serializer.errors)

    def test_upload_aceita_pdf_com_assinatura_valida(self):
        serializer = PagamentoAgregadoSerializer(
            self.agregado_pago,
            data={'comprovante': SimpleUploadedFile('valido.pdf', b'%PDF-1.7 conteudo')},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_patch_aceita_remover_comprovante_com_null(self):
        serializer = PagamentoAgregadoSerializer(
            self.agregado_pago,
            data={'comprovante': None},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    @override_settings(COMPROVANTES_ZIP_MAX_FILES=1)
    def test_registros_sem_comprovante_nao_contam_no_limite(self):
        for indice in range(3):
            cte = CTeDocumento.objects.create(
                chave=f'{indice + 3}' * 44,
                versao='4.00',
                processado=True,
            )
            PagamentoAgregado.objects.create(
                cte=cte,
                placa='SEM1234',
                condutor_nome='Sem comprovante',
                valor_frete_total=Decimal('100.00'),
                percentual_repasse=Decimal('10.00'),
                data_prevista=date(2026, 9, 1),
                status='pago',
            )

        response = self.client.post(
            '/api/pagamentos/agregados/comprovantes/download/?status=pago',
            {'todos': True},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
