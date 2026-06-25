from django.test import TestCase
from django.core.exceptions import ValidationError
from datetime import date
from decimal import Decimal

from transport.models import CTeDocumento, PagamentoAgregado, PagamentoProprio, Veiculo


class PagamentoExclusividadeMutuaTests(TestCase):
    """Garante que um CT-e não possua pagamento agregado e próprio simultaneamente."""

    def setUp(self):
        self.cte = CTeDocumento.objects.create(
            chave="3" * 44,
            versao="4.00",
            processado=True,
        )
        self.veiculo = Veiculo.objects.create(
            placa="XYZ1234",
            tipo_proprietario="00",
            ativo=True,
        )

    def test_criar_pagamento_proprio_quando_existe_agregado_bloqueia(self):
        PagamentoAgregado.objects.create(
            cte=self.cte,
            placa="ABC1234",
            condutor_nome="Motorista Agregado",
            valor_frete_total=Decimal("1000.00"),
            percentual_repasse=Decimal("25.00"),
            data_prevista=date(2026, 1, 10),
        )

        with self.assertRaises(ValidationError):
            PagamentoProprio.objects.create(
                veiculo=self.veiculo,
                periodo="2026-01",
                cte=self.cte,
                valor_base_faixa=Decimal("500.00"),
                ajustes=Decimal("0.00"),
            )

    def test_criar_pagamento_agregado_quando_existe_proprio_bloqueia(self):
        PagamentoProprio.objects.create(
            veiculo=self.veiculo,
            periodo="2026-01",
            cte=self.cte,
            valor_base_faixa=Decimal("500.00"),
            ajustes=Decimal("0.00"),
        )

        with self.assertRaises(ValidationError):
            PagamentoAgregado.objects.create(
                cte=self.cte,
                placa="ABC1234",
                condutor_nome="Motorista Agregado",
                valor_frete_total=Decimal("1000.00"),
                percentual_repasse=Decimal("25.00"),
                data_prevista=date(2026, 1, 10),
            )

    def test_permite_apenas_um_tipo_de_pagamento_por_cte(self):
        # Criação do primeiro tipo deve funcionar
        PagamentoAgregado.objects.create(
            cte=self.cte,
            placa="ABC1234",
            condutor_nome="Motorista Agregado",
            valor_frete_total=Decimal("1000.00"),
            percentual_repasse=Decimal("25.00"),
            data_prevista=date(2026, 1, 10),
        )

        self.assertTrue(
            PagamentoAgregado.objects.filter(cte=self.cte).exists()
        )
        self.assertFalse(
            PagamentoProprio.objects.filter(cte=self.cte).exists()
        )

    def test_conversao_preserva_exclusividade_apos_remocao(self):
        # Cria pagamento agregado e converte para próprio
        agregado = PagamentoAgregado.objects.create(
            cte=self.cte,
            placa=self.veiculo.placa,
            condutor_nome="Motorista Agregado",
            valor_frete_total=Decimal("1000.00"),
            percentual_repasse=Decimal("25.00"),
            data_prevista=date(2026, 1, 10),
        )

        agregado.delete()

        # Após remover o agregado, criar o próprio deve ser permitido
        proprio = PagamentoProprio.objects.create(
            veiculo=self.veiculo,
            periodo="2026-01",
            cte=self.cte,
            valor_base_faixa=Decimal("250.00"),
            ajustes=Decimal("0.00"),
        )

        self.assertFalse(
            PagamentoAgregado.objects.filter(cte=self.cte).exists()
        )
        self.assertTrue(
            PagamentoProprio.objects.filter(cte=self.cte).exists()
        )
