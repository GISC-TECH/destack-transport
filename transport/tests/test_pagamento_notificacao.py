"""Testes para notificação de pagamento ao gestor via WhatsApp."""
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from datetime import date

from transport.models import (
    ConfiguracaoEmpresa,
    CTeDocumento,
    Motorista,
    PagamentoAgregado,
    PagamentoProprio,
    Veiculo,
)
from transport.services.pagamento_service import (
    montar_mensagem_pagamento,
    notificar_gestor_pagamento,
)


def _criar_cte():
    """Cria um CT-e mínimo para testes de pagamento agregado."""
    cte = CTeDocumento.objects.create(
        chave='35260612345678000190570010000001231234567890',
        processado=True,
    )
    from transport.models import CTeIdentificacao
    CTeIdentificacao.objects.create(
        cte=cte,
        numero='123',
        serie='1',
        modelo='57',
        data_emissao='2026-06-15T10:00:00-03:00',
        uf_ini='SP',
        uf_fim='RJ',
        nome_mun_ini='Sao Paulo',
        nome_mun_fim='Rio de Janeiro',
    )
    from transport.models import CTePrestacaoServico
    CTePrestacaoServico.objects.create(
        cte=cte,
        valor_total_prestado=1000.00,
    )
    return cte


class MontarMensagemPagamentoTests(TestCase):
    def setUp(self):
        self.motorista = Motorista.objects.create(
            nome='João Silva',
            cpf='12345678901',
            chave_pix='joao@email.com',
            banco='Banco do Brasil',
            agencia='1234',
            conta='56789-0',
            tipo_conta='corrente',
        )
        self.veiculo = Veiculo.objects.create(
            placa='ABC1D23',
            tipo_proprietario='00',
        )

    def test_mensagem_agregado_com_pix(self):
        cte = _criar_cte()
        pagamento = PagamentoAgregado.objects.create(
            cte=cte,
            condutor_nome='João Silva',
            condutor_cpf='12345678901',
            valor_frete_total=Decimal('1000.00'),
            percentual_repasse=Decimal('25.00'),
            data_prevista=date(2026, 6, 30),
        )

        mensagem = montar_mensagem_pagamento(pagamento, 'agregado')

        self.assertIn('João Silva', mensagem)
        self.assertIn('R$ 250,00', mensagem)
        self.assertIn('joao@email.com', mensagem)
        self.assertIn('Banco do Brasil', mensagem)

    def test_mensagem_proprio_com_pix(self):
        pagamento = PagamentoProprio.objects.create(
            veiculo=self.veiculo,
            periodo='2026-06',
            motorista_nome='João Silva',
            motorista_cpf='12345678901',
            km_total_periodo=1000,
            valor_base_faixa=Decimal('1500.00'),
            data_prevista='2026-06-30',
        )

        mensagem = montar_mensagem_pagamento(pagamento, 'proprio')

        self.assertIn('João Silva', mensagem)
        self.assertIn('ABC1D23', mensagem)
        self.assertIn('2026-06', mensagem)
        self.assertIn('joao@email.com', mensagem)

    def test_mensagem_sem_pix(self):
        motorista_sem_pix = Motorista.objects.create(
            nome='Maria Souza',
            cpf='98765432100',
        )
        cte = _criar_cte()
        pagamento = PagamentoAgregado.objects.create(
            cte=cte,
            condutor_nome='Maria Souza',
            condutor_cpf='98765432100',
            valor_frete_total=Decimal('1000.00'),
            percentual_repasse=Decimal('25.00'),
            data_prevista=date(2026, 6, 30),
        )

        mensagem = montar_mensagem_pagamento(pagamento, 'agregado')

        self.assertIn('Maria Souza', mensagem)
        self.assertIn('sem dados bancários/Pix', mensagem)


class NotificarGestorPagamentoTests(TestCase):
    def setUp(self):
        self.config = ConfiguracaoEmpresa.objects.create(
            razao_social='Transporte Teste',
            cnpj='12345678000195',
            telefone_gestor='11999998888',
        )
        self.motorista = Motorista.objects.create(
            nome='João Silva',
            cpf='12345678901',
            chave_pix='joao@email.com',
        )

    @patch('transport.services.pagamento_service.enviar_whatsapp')
    def test_notifica_gestor_quando_telefone_configurado(self, mock_enviar):
        mock_enviar.return_value = {'status': 'enviado', 'id': 'msg123'}

        cte = _criar_cte()
        pagamento = PagamentoAgregado.objects.create(
            cte=cte,
            condutor_nome='João Silva',
            condutor_cpf='12345678901',
            valor_frete_total=Decimal('1000.00'),
            percentual_repasse=Decimal('25.00'),
            data_prevista=date(2026, 6, 30),
        )

        resultado = notificar_gestor_pagamento(pagamento, 'agregado')

        self.assertEqual(resultado['status'], 'enviado')
        mock_enviar.assert_called_once()
        args = mock_enviar.call_args
        self.assertEqual(args.kwargs['motorista'], self.motorista)

    def test_falha_quando_telefone_gestor_nao_configurado(self):
        self.config.telefone_gestor = None
        self.config.save()

        cte = _criar_cte()
        pagamento = PagamentoAgregado.objects.create(
            cte=cte,
            condutor_nome='João Silva',
            condutor_cpf='12345678901',
            valor_frete_total=Decimal('1000.00'),
            percentual_repasse=Decimal('25.00'),
            data_prevista=date(2026, 6, 30),
        )

        resultado = notificar_gestor_pagamento(pagamento, 'agregado')

        self.assertEqual(resultado['status'], 'falha')
        self.assertIn('Telefone do gestor não configurado', resultado['erro'])
