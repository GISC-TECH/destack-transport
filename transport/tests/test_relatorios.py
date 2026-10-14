"""
Testes das correções e adições de relatórios (M2/M3/M4):
- Faturamento exclui CT-es cancelados.
- KM rodado não conta em dobro (tração + reboque).
- Relatório de motoristas (viagens, repasses, pendências de validade).
"""
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from transport.models import (
    CTeDocumento, CTeIdentificacao, CTePrestacaoServico, CTeCancelamento,
    CTeModalRodoviario, CTeVeiculoRodoviario, CTeMotorista,
    Motorista, PagamentoAgregado,
)
from transport.views.config_views import RelatorioAPIView


def _cte(chave, numero, valor, dist_km=0):
    cte = CTeDocumento.objects.create(chave=chave, xml_original='<x/>', processado=True)
    CTeIdentificacao.objects.create(
        cte=cte, numero=numero, data_emissao=timezone.now(), dist_km=dist_km)
    CTePrestacaoServico.objects.create(cte=cte, valor_total_prestado=Decimal(valor))
    return cte


class FaturamentoExcluiCanceladosTests(TestCase):
    def test_cancelado_nao_entra_no_faturamento(self):
        _cte('29250924633774000118570010000000011012180001', '1', '1000.00')
        cte2 = _cte('29250924633774000118570010000000021012180002', '2', '500.00')
        CTeCancelamento.objects.create(
            cte=cte2, c_stat=135, tp_amb=1, dh_evento=timezone.now(),
            x_just='teste cancelamento ok')

        view = RelatorioAPIView()
        dados = view._gerar_relatorio_faturamento(None, None, {})
        total = sum(d['valor'] for d in dados)
        self.assertEqual(total, 1000.00)  # 500 cancelado fora


class KmRodadoSemDobraTests(TestCase):
    def test_km_atribuido_so_a_tracao(self):
        cte = _cte('29250924633774000118570010000000031012180003', '3', '100.00', dist_km=250)
        modal = CTeModalRodoviario.objects.create(cte=cte)
        CTeVeiculoRodoviario.objects.create(modal=modal, placa='TRA1234', tipo_veiculo='0')
        CTeVeiculoRodoviario.objects.create(modal=modal, placa='REB5678', tipo_veiculo='1')

        view = RelatorioAPIView()
        dados = view._gerar_relatorio_km_rodado(None, None, {})
        por_placa = {d['placa']: d for d in dados}
        # KM só na tração; reboque não recebe os 250 km
        self.assertEqual(por_placa['TRA1234']['km_ctes'], 250)
        self.assertNotIn('REB5678', por_placa)


class RelatorioMotoristasTests(TestCase):
    def test_relatorio_motoristas(self):
        # Motorista automático (sem CNH) com 1 viagem e 1 pagamento
        cte = _cte('29250924633774000118570010000000041012180004', '4', '800.00')
        modal = CTeModalRodoviario.objects.create(cte=cte)
        mot = Motorista.objects.create(nome='JOSE', cpf='11122233344', cnh=None,
                                       cadastro_automatico=True)
        CTeMotorista.objects.create(modal=modal, nome='JOSE', cpf='11122233344', motorista=mot)
        PagamentoAgregado.objects.create(
            cte=cte,
            condutor_nome='JOSE', condutor_cpf='11122233344', placa='ABC1234',
            valor_frete_total=Decimal('1000'), percentual_repasse=Decimal('80'),
            valor_repassado=Decimal('800'), status='pago',
            data_prevista=date.today())

        view = RelatorioAPIView()
        dados = view._gerar_relatorio_motoristas(None, None, {})
        linha = next(d for d in dados if d['cpf'].replace('.', '').replace('-', '') == '11122233344')
        self.assertEqual(linha['viagens_cte'], 1)
        self.assertEqual(linha['viagens_total'], 1)
        self.assertEqual(linha['total_repassado'], 800.0)
        self.assertEqual(linha['cadastro'], 'Automático')
        self.assertEqual(linha['cadastro_completo'], 'Não')

    def test_filtro_pendentes_so_traz_com_validade_vencendo(self):
        Motorista.objects.create(nome='COM CNH OK', cpf='55566677788', cnh='X1',
                                 validade_cnh=date.today() + timedelta(days=365))
        Motorista.objects.create(nome='CNH VENCENDO', cpf='99988877766', cnh='X2',
                                 validade_cnh=date.today() + timedelta(days=10))
        view = RelatorioAPIView()
        dados = view._gerar_relatorio_motoristas(None, None, {'pendentes': True})
        nomes = {d['nome'] for d in dados}
        self.assertIn('CNH VENCENDO', nomes)
        self.assertNotIn('COM CNH OK', nomes)
