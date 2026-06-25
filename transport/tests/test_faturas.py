"""Testes do módulo de Contas a Receber (Faturas)."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from transport.models import (
    Cliente,
    CTeDocumento,
    CTeIdentificacao,
    CTePrestacaoServico,
    Fatura,
    FaturaItem,
)


User = get_user_model()


class FaturasAPITests(APITestCase):
    """Testes da API de Faturas (Contas a Receber)."""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username='admin', email='admin@teste.com', password='admin123'
        )
        self.client.login(username='admin', password='admin123')

        self.cliente = Cliente.objects.create(
            razao_social='Cliente Teste LTDA',
            cnpj='12345678000190',
            ativo=True,
        )

        self.cte1 = self._criar_cte('1' * 44, '100', Decimal('1500.00'))
        self.cte2 = self._criar_cte('2' * 44, '101', Decimal('2500.00'))
        self.cte3 = self._criar_cte('3' * 44, '102', Decimal('800.00'))

    def _criar_cte(self, chave, numero, valor):
        cte = CTeDocumento.objects.create(
            chave=chave,
            versao='4.00',
            processado=True,
        )
        CTeIdentificacao.objects.create(
            cte=cte,
            numero=int(numero),
            data_emissao=f'{date.today().year}-01-01 10:00:00',
        )
        CTePrestacaoServico.objects.create(
            cte=cte,
            valor_total_prestado=valor,
        )
        return cte

    def test_listar_faturas_vazia(self):
        url = reverse('fatura-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)

    def test_criar_fatura_manual(self):
        url = reverse('fatura-list')
        data = {
            'cliente': str(self.cliente.id),
            'numero': 'FAT-MANUAL-001',
            'data_emissao': date.today().isoformat(),
            'data_vencimento': (date.today() + timedelta(days=10)).isoformat(),
            'status': 'rascunho',
            'observacao': 'Fatura manual de teste',
            'itens': [
                {'cte': str(self.cte1.id), 'descricao': 'Serviço 1', 'valor': '1500.00'},
                {'descricao': 'Serviço avulso', 'valor': '200.00'},
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        fatura = Fatura.objects.get(numero='FAT-MANUAL-001')
        self.assertEqual(fatura.valor_total, Decimal('1700.00'))
        self.assertEqual(fatura.itens.count(), 2)
        self.assertEqual(fatura.cliente, self.cliente)

    def test_gerar_fatura_em_lote(self):
        url = reverse('fatura-gerar_lote')
        data = {
            'cliente': str(self.cliente.id),
            'cte_ids': [str(self.cte1.id), str(self.cte2.id)],
            'data_vencimento': (date.today() + timedelta(days=15)).isoformat(),
            'observacao': 'Lote de teste',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        fatura = Fatura.objects.get(pk=response.data['fatura']['id'])
        self.assertEqual(fatura.itens.count(), 2)
        self.assertEqual(fatura.valor_total, Decimal('4000.00'))
        self.assertTrue(fatura.numero.startswith('FAT-'))
        self.assertEqual(response.data['itens_criados'], 2)

    def test_bloqueia_cte_ja_faturado_em_lote(self):
        url = reverse('fatura-gerar_lote')
        data = {
            'cliente': str(self.cliente.id),
            'cte_ids': [str(self.cte1.id)],
            'data_vencimento': (date.today() + timedelta(days=15)).isoformat(),
        }
        response1 = self.client.post(url, data, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        response2 = self.client.post(url, data, format='json')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('já possuem fatura', response2.data['detail'])

    def test_bloqueia_gerar_lote_sem_cliente(self):
        url = reverse('fatura-gerar_lote')
        data = {
            'cte_ids': [str(self.cte1.id)],
            'data_vencimento': (date.today() + timedelta(days=15)).isoformat(),
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bloqueia_fatura_sem_itens(self):
        url = reverse('fatura-list')
        data = {
            'cliente': str(self.cliente.id),
            'numero': 'FAT-SEM-ITENS',
            'data_emissao': date.today().isoformat(),
            'data_vencimento': (date.today() + timedelta(days=10)).isoformat(),
            'status': 'rascunho',
            'itens': []
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_atualizar_status_fatura(self):
        fatura = Fatura.objects.create(
            cliente=self.cliente,
            numero='FAT-UPDATE-001',
            data_emissao=date.today(),
            data_vencimento=date.today() + timedelta(days=10),
            status='rascunho',
            valor_total=Decimal('100.00'),
        )
        url = reverse('fatura-detail', kwargs={'pk': str(fatura.id)})
        response = self.client.patch(url, {'status': 'enviada'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        fatura.refresh_from_db()
        self.assertEqual(fatura.status, 'enviada')

    def test_excluir_fatura_remove_itens(self):
        fatura = Fatura.objects.create(
            cliente=self.cliente,
            numero='FAT-DELETE-001',
            data_emissao=date.today(),
            data_vencimento=date.today() + timedelta(days=10),
            status='rascunho',
            valor_total=Decimal('500.00'),
        )
        FaturaItem.objects.create(
            fatura=fatura,
            descricao='Item teste',
            valor=Decimal('500.00'),
        )
        url = reverse('fatura-detail', kwargs={'pk': str(fatura.id)})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Fatura.objects.filter(pk=fatura.id).exists())
        self.assertFalse(FaturaItem.objects.filter(fatura=fatura).exists())

    def test_filtro_por_status(self):
        Fatura.objects.create(
            cliente=self.cliente,
            numero='FAT-PAGA-001',
            data_emissao=date.today(),
            data_vencimento=date.today() + timedelta(days=10),
            status='paga',
            valor_total=Decimal('100.00'),
        )
        Fatura.objects.create(
            cliente=self.cliente,
            numero='FAT-RASC-001',
            data_emissao=date.today(),
            data_vencimento=date.today() + timedelta(days=10),
            status='rascunho',
            valor_total=Decimal('200.00'),
        )

        url = reverse('fatura-list')
        response = self.client.get(url, {'status': 'paga'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['numero'], 'FAT-PAGA-001')
