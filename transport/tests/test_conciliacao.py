# transport/tests/test_conciliacao.py
"""Testes para conciliação bancária."""

import io
from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, APIClient, force_authenticate
from django.core.files.uploadedfile import SimpleUploadedFile

from ..models import Fatura, ContaPagar, TransacaoBancaria, Cliente, Veiculo
from ..services.conciliacao_service import (
    parse_csv,
    parse_ofx,
    parse_arquivo,
    salvar_transacoes,
)
from ..views.conciliacao_views import TransacaoBancariaViewSet


class ConciliacaoServiceTest(TestCase):
    """Testes para os parsers de conciliação."""

    def test_parse_csv_basico(self):
        csv_content = "data,descricao,valor,tipo\n2026-06-01,Pagamento Cliente A,1500.00,credito\n2026-06-02,Pagamento Fornecedor B,-500.00,debito\n"
        transacoes = parse_csv(io.StringIO(csv_content))
        self.assertEqual(len(transacoes), 2)
        self.assertEqual(transacoes[0]['descricao'], 'Pagamento Cliente A')
        self.assertEqual(transacoes[0]['valor'], Decimal('1500.00'))
        self.assertEqual(transacoes[0]['tipo'], 'credito')
        self.assertEqual(transacoes[1]['tipo'], 'debito')

    def test_parse_csv_valor_negativo(self):
        csv_content = "Data;Histórico;Valor\n01/06/2026;TED Recebida;200,00\n02/06/2026;Pix Enviado;-100,00\n"
        transacoes = parse_csv(io.StringIO(csv_content))
        self.assertEqual(len(transacoes), 2)
        self.assertEqual(transacoes[0]['tipo'], 'credito')
        self.assertEqual(transacoes[1]['tipo'], 'debito')

    def test_parse_csv_data_invalida_ignora(self):
        csv_content = "data,descricao,valor\ninvalid,Teste,10\n2026-06-01,Teste,10\n"
        transacoes = parse_csv(io.StringIO(csv_content))
        self.assertEqual(len(transacoes), 1)

    def test_parse_ofx_fallback(self):
        ofx_content = b"""OFXHEADER:100
DATA:OFXSGML
VERSION:102
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260601
<TRNAMT>1500.00
<MEMO>Pagamento Cliente
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260602
<TRNAMT>-250.50
<NAME>Compra Material
</STMTTRN>
"""
        transacoes = parse_ofx(io.BytesIO(ofx_content))
        self.assertEqual(len(transacoes), 2)
        self.assertEqual(transacoes[0]['descricao'], 'Pagamento Cliente')
        self.assertEqual(transacoes[0]['valor'], Decimal('1500.00'))
        self.assertEqual(transacoes[0]['tipo'], 'credito')
        self.assertEqual(transacoes[1]['descricao'], 'Compra Material')
        self.assertEqual(transacoes[1]['valor'], Decimal('250.50'))
        self.assertEqual(transacoes[1]['tipo'], 'debito')

    def test_parse_arquivo_csv(self):
        file = io.StringIO("data,descricao,valor\n2026-06-01,Teste,100.00\n")
        transacoes = parse_arquivo(file, 'extrato.csv')
        self.assertEqual(len(transacoes), 1)

    def test_parse_arquivo_formato_invalido(self):
        file = io.BytesIO(b'conteudo')
        with self.assertRaises(ValueError):
            parse_arquivo(file, 'extrato.txt')

    def test_salvar_transacoes(self):
        transacoes = [
            {'data': date(2026, 6, 1), 'descricao': 'Tx 1', 'valor': Decimal('100.00'), 'tipo': 'credito'},
            {'data': date(2026, 6, 2), 'descricao': 'Tx 2', 'valor': Decimal('50.00'), 'tipo': 'debito'},
        ]
        registros = salvar_transacoes(transacoes, 'teste.csv')
        self.assertEqual(len(registros), 2)
        self.assertEqual(TransacaoBancaria.objects.count(), 2)


class TransacaoBancariaViewSetTest(TestCase):
    """Testes para o ViewSet de conciliação."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_superuser(username='testuser', password='testpass', email='test@test.com')

        self.cliente = Cliente.objects.create(
            razao_social='Cliente Teste',
            cnpj='12345678000195'
        )
        self.fatura = Fatura.objects.create(
            numero='FAT-001',
            valor_total=Decimal('1000.00'),
            data_vencimento=date(2026, 6, 30),
            status='enviada',
            cliente=self.cliente
        )
        self.fatura_paga = Fatura.objects.create(
            numero='FAT-002',
            valor_total=Decimal('2000.00'),
            data_vencimento=date(2026, 6, 30),
            status='paga',
            cliente=self.cliente
        )
        self.veiculo = Veiculo.objects.create(placa='ABC1234')
        self.conta = ContaPagar.objects.create(
            descricao='Conta Teste',
            valor=Decimal('500.00'),
            data_vencimento=date(2026, 6, 30),
            status='pendente',
            veiculo=self.veiculo
        )
        self.transacao = TransacaoBancaria.objects.create(
            data=date(2026, 6, 1),
            descricao='Transação Teste',
            valor=Decimal('1000.00'),
            tipo='credito',
            arquivo_origem='teste.csv',
            conciliado=False
        )

    def _auth_request(self, method, url, data=None, user=None):
        request = getattr(self.factory, method)(url, data=data, format='json')
        force_authenticate(request, user=user or self.user)
        return request

    def test_list_transacoes(self):
        view = TransacaoBancariaViewSet.as_view({'get': 'list'})
        request = self._auth_request('get', '/transacoes/')
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)

    def test_upload_csv_detecta_transacoes(self):
        client = APIClient()
        client.force_login(user=self.user)
        csv_file = SimpleUploadedFile(
            'extrato.csv',
            b"data,descricao,valor\n2026-06-01,Teste Upload,150.00\n",
            content_type='text/csv'
        )
        response = client.post(
            '/api/transacoes/upload/',
            {'arquivo': csv_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['quantidade'], 1)
        self.assertEqual(TransacaoBancaria.objects.count(), 1)  # Não persiste

    def test_importar_csv_persiste_transacoes(self):
        client = APIClient()
        client.force_login(user=self.user)
        csv_file = SimpleUploadedFile(
            'extrato.csv',
            b"data,descricao,valor\n2026-06-01,Teste Import,200.00\n",
            content_type='text/csv'
        )
        response = client.post(
            '/api/transacoes/importar/',
            {'arquivo': csv_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(TransacaoBancaria.objects.count(), 2)

    def test_vincular_fatura(self):
        view = TransacaoBancariaViewSet.as_view({'post': 'vincular'})
        request = self.factory.post(
            f'/transacoes/{self.transacao.id}/vincular/',
            {'fatura_id': str(self.fatura.id)},
            format='json'
        )
        force_authenticate(request, user=self.user)
        response = view(request, pk=self.transacao.id)
        self.assertEqual(response.status_code, 200)
        self.transacao.refresh_from_db()
        self.assertTrue(self.transacao.conciliado)
        self.assertEqual(self.transacao.fatura_id, self.fatura.id)
        self.fatura.refresh_from_db()
        self.assertEqual(self.fatura.status, 'paga')

    def test_vincular_conta_pagar(self):
        transacao = TransacaoBancaria.objects.create(
            data=date(2026, 6, 2),
            descricao='Débito Teste',
            valor=Decimal('500.00'),
            tipo='debito',
            arquivo_origem='teste.csv',
            conciliado=False
        )
        view = TransacaoBancariaViewSet.as_view({'post': 'vincular'})
        request = self.factory.post(
            f'/transacoes/{transacao.id}/vincular/',
            {'conta_pagar_id': self.conta.id},
            format='json'
        )
        force_authenticate(request, user=self.user)
        response = view(request, pk=transacao.id)
        self.assertEqual(response.status_code, 200)
        transacao.refresh_from_db()
        self.assertTrue(transacao.conciliado)
        self.assertEqual(transacao.conta_pagar_id, self.conta.id)
        self.conta.refresh_from_db()
        self.assertEqual(self.conta.status, 'paga')

    def test_desvincular(self):
        self.transacao.conciliado = True
        self.transacao.fatura = self.fatura
        self.transacao.save()
        view = TransacaoBancariaViewSet.as_view({'post': 'desvincular'})
        request = self.factory.post(f'/transacoes/{self.transacao.id}/desvincular/', {}, format='json')
        force_authenticate(request, user=self.user)
        response = view(request, pk=self.transacao.id)
        self.assertEqual(response.status_code, 200)
        self.transacao.refresh_from_db()
        self.assertFalse(self.transacao.conciliado)
        self.assertIsNone(self.transacao.fatura)
