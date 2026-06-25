"""
Testes dos dashboards financeiros:
- Inadimplência
- Fluxo de Caixa
- DRE Simplificada
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework.test import APIRequestFactory, force_authenticate

from transport.models import (
    CTeDocumento,
    CTeIdentificacao,
    CTePrestacaoServico,
    CTeCobranca,
    CTeDuplicata,
    CTeProtocoloAutorizacao,
    CTEDestinatario,
    PagamentoAgregado,
    PagamentoProprio,
    Veiculo,
    ManutencaoVeiculo,
)
from transport.views.financeiro_views import (
    InadimplenciaAPIView,
    FluxoCaixaAPIView,
    DREAPIView,
)


User = get_user_model()


def _cte(chave, numero, valor, data_emissao=None, pago=False):
    """Cria um CT-e mínimo válido para os dashboards financeiros."""
    cte = CTeDocumento.objects.create(
        chave=chave,
        xml_original='<x/>',
        processado=True,
        pago=pago,
    )
    CTeIdentificacao.objects.create(
        cte=cte,
        numero=numero,
        data_emissao=data_emissao or timezone.now(),
    )
    CTePrestacaoServico.objects.create(
        cte=cte,
        valor_total_prestado=Decimal(valor),
    )
    CTEDestinatario.objects.create(
        cte=cte,
        razao_social='Cliente Teste',
        cnpj='12345678000190',
    )
    CTeProtocoloAutorizacao.objects.create(
        cte=cte,
        ambiente=1,
        versao_aplic='1.0',
        data_recebimento=data_emissao or timezone.now(),
        numero_protocolo=chave[:15],
        codigo_status=100,
        motivo_status='Autorizado',
    )
    return cte


def _autenticar_request(request, user=None):
    if user is None:
        user = User.objects.create_user(username='financeiro', password='teste123')
    user.is_staff = True
    user.save()
    force_authenticate(request, user=user)
    return request


class InadimplenciaAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = InadimplenciaAPIView.as_view()
        self.hoje = date.today()

    def test_lista_faturas_atrasadas_por_cliente(self):
        cte = _cte('29250924633774000118570010000000011012180001', '1', '1500.00')
        cobranca = CTeCobranca.objects.create(cte=cte)
        CTeDuplicata.objects.create(
            cobranca=cobranca,
            data_vencimento=self.hoje - timedelta(days=10),
            valor=Decimal('1500.00'),
        )

        request = self.factory.get('/api/financeiro/inadimplencia/')
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_em_aberto'], 1500.0)
        self.assertEqual(response.data['quantidade_faturas'], 1)
        self.assertEqual(response.data['quantidade_clientes'], 1)
        self.assertEqual(len(response.data['faturas']), 1)
        self.assertEqual(response.data['faturas'][0]['dias_atraso'], 10)

    def test_nao_lista_faturas_pagas(self):
        cte = _cte('29250924633774000118570010000000021012180002', '2', '800.00', pago=True)
        cobranca = CTeCobranca.objects.create(cte=cte)
        CTeDuplicata.objects.create(
            cobranca=cobranca,
            data_vencimento=self.hoje - timedelta(days=5),
            valor=Decimal('800.00'),
        )

        request = self.factory.get('/api/financeiro/inadimplencia/')
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_em_aberto'], 0.0)
        self.assertEqual(response.data['quantidade_faturas'], 0)

    def test_nao_lista_faturas_nao_vencidas(self):
        cte = _cte('29250924633774000118570010000000031012180003', '3', '1200.00')
        cobranca = CTeCobranca.objects.create(cte=cte)
        CTeDuplicata.objects.create(
            cobranca=cobranca,
            data_vencimento=self.hoje + timedelta(days=5),
            valor=Decimal('1200.00'),
        )

        request = self.factory.get('/api/financeiro/inadimplencia/')
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_em_aberto'], 0.0)
        self.assertEqual(response.data['quantidade_faturas'], 0)


class FluxoCaixaAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = FluxoCaixaAPIView.as_view()
        self.hoje = date.today()
        self.inicio = self.hoje - timedelta(days=5)
        self.fim = self.hoje + timedelta(days=5)

    def test_projecao_receitas_e_despesas(self):
        # Receita
        cte = _cte('29250924633774000118570010000000041012180004', '4', '2000.00')
        cobranca = CTeCobranca.objects.create(cte=cte)
        CTeDuplicata.objects.create(
            cobranca=cobranca,
            data_vencimento=self.hoje,
            valor=Decimal('2000.00'),
        )

        # Despesa agregada
        PagamentoAgregado.objects.create(
            cte=cte,
            placa='ABC1234',
            condutor_nome='Motorista',
            valor_frete_total=Decimal('2000.00'),
            percentual_repasse=Decimal('25.00'),
            data_prevista=self.hoje,
            status='pendente',
        )

        request = self.factory.get(
            '/api/financeiro/fluxo-caixa/',
            {
                'data_inicio': self.inicio.isoformat(),
                'data_fim': self.fim.isoformat(),
                'agrupamento': 'dia',
            },
        )
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['totais']['receitas'], 2000.0)
        self.assertEqual(response.data['totais']['despesas'], 500.0)
        self.assertEqual(response.data['totais']['saldo_projetado'], 1500.0)

        # Verifica se o período de hoje existe na série
        hoje_str = self.hoje.isoformat()
        item_hoje = next((s for s in response.data['serie'] if s['periodo'] == hoje_str), None)
        self.assertIsNotNone(item_hoje)
        self.assertEqual(item_hoje['receitas'], 2000.0)
        self.assertEqual(item_hoje['despesas'], 500.0)
        self.assertEqual(item_hoje['saldo_periodo'], 1500.0)

    def test_agrupamento_mensal(self):
        cte = _cte('29250924633774000118570010000000051012180005', '5', '3000.00')
        cobranca = CTeCobranca.objects.create(cte=cte)
        CTeDuplicata.objects.create(
            cobranca=cobranca,
            data_vencimento=self.hoje,
            valor=Decimal('3000.00'),
        )

        request = self.factory.get(
            '/api/financeiro/fluxo-caixa/',
            {
                'data_inicio': date(self.hoje.year, self.hoje.month, 1).isoformat(),
                'data_fim': date(self.hoje.year, self.hoje.month + 1, 1) - timedelta(days=1),
                'agrupamento': 'mes',
            },
        )
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data['serie']) >= 1)
        self.assertEqual(response.data['totais']['receitas'], 3000.0)

    def test_agrupamento_invalido_retorna_400(self):
        request = self.factory.get(
            '/api/financeiro/fluxo-caixa/',
            {
                'data_inicio': self.inicio.isoformat(),
                'data_fim': self.fim.isoformat(),
                'agrupamento': 'invalido',
            },
        )
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 400)


class DREAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = DREAPIView.as_view()
        self.hoje = date.today()
        self.inicio = date(self.hoje.year, self.hoje.month, 1)
        self.fim = date(self.hoje.year, self.hoje.month + 1, 1) - timedelta(days=1)

    def test_dre_calcula_receita_custos_e_margem(self):
        cte = _cte(
            '29250924633774000118570010000000061012180006',
            '6',
            '5000.00',
            data_emissao=timezone.make_aware(timezone.datetime(self.hoje.year, self.hoje.month, 10)),
        )

        # Pagamento agregado como custo
        PagamentoAgregado.objects.create(
            cte=cte,
            placa='ABC1234',
            condutor_nome='Motorista',
            valor_frete_total=Decimal('5000.00'),
            percentual_repasse=Decimal('30.00'),
            data_prevista=self.hoje,
            status='pendente',
        )

        # Manutenção como custo
        veiculo = Veiculo.objects.create(placa='XYZ9876', tipo_proprietario='00', ativo=True)
        ManutencaoVeiculo.objects.create(
            veiculo=veiculo,
            data_agendada=self.hoje,
            custo=Decimal('500.00'),
        )

        request = self.factory.get(
            '/api/financeiro/dre/',
            {
                'data_inicio': self.inicio.isoformat(),
                'data_fim': self.fim.isoformat(),
            },
        )
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['resumo']['receita_total'], 5000.0)
        self.assertEqual(response.data['resumo']['custos']['agregados'], 1500.0)
        self.assertEqual(response.data['resumo']['custos']['manutencoes'], 500.0)
        self.assertEqual(response.data['resumo']['custos']['total'], 2000.0)
        self.assertEqual(response.data['resumo']['lucro'], 3000.0)
        self.assertEqual(response.data['resumo']['margem_percentual'], 60.0)

    def test_dre_exporta_csv(self):
        cte = _cte(
            '29250924633774000118570010000000071012180007',
            '7',
            '1000.00',
            data_emissao=timezone.make_aware(timezone.datetime(self.hoje.year, self.hoje.month, 5)),
        )

        request = self.factory.get(
            '/api/financeiro/dre/',
            {
                'data_inicio': self.inicio.isoformat(),
                'data_fim': self.fim.isoformat(),
                'formato': 'csv',
            },
        )
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('attachment', response['Content-Disposition'])
        content = response.content.decode('utf-8')
        self.assertIn('DRE Simplificada', content)
        self.assertIn('Receita Total', content)

    def test_dre_evolucao_mensal(self):
        cte = _cte(
            '29250924633774000118570010000000081012180008',
            '8',
            '2500.00',
            data_emissao=timezone.make_aware(timezone.datetime(self.hoje.year, self.hoje.month, 15)),
        )

        request = self.factory.get(
            '/api/financeiro/dre/',
            {
                'data_inicio': self.inicio.isoformat(),
                'data_fim': self.fim.isoformat(),
            },
        )
        _autenticar_request(request)
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data['evolucao_mensal']) >= 1)
        mes_atual = self.hoje.strftime('%Y-%m')
        mes_item = next((e for e in response.data['evolucao_mensal'] if e['mes'] == mes_atual), None)
        self.assertIsNotNone(mes_item)
        self.assertEqual(mes_item['receita'], 2500.0)
