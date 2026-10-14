# transport/tests/test_numeracao.py
"""
Testes para o controle de numeração/série de CT-e e MDF-e.
"""

from django.test import TestCase
from django.db.utils import IntegrityError

from transport.models import (
    ControleNumeracao,
    CTeDocumento,
    CTeIdentificacao,
    CTeEmitente,
    MDFeDocumento,
    MDFeIdentificacao,
    MDFeEmitente,
)
from transport.services.numeracao_service import (
    extrair_dados_numeracao_da_chave,
    mapear_modelo_para_choice,
    proximo_numero,
    verificar_duplicidade,
    registrar_numero,
)


class ExtracaoChaveTests(TestCase):
    """Testa a extração de dados de numeração a partir da chave de acesso."""

    def setUp(self):
        # Chave CT-e fictícia de 44 dígitos:
        # UF=35, AAMM=2606, CNPJ=12345678000195, modelo=57, série=001,
        # número=000000123, tpEmis=1, código=12345678, DV=9
        self.chave_cte = (
            "35260612345678000195570010000001231123456789"
        )

    def test_extrai_dados_cte_corretamente(self):
        dados = extrair_dados_numeracao_da_chave(self.chave_cte)
        self.assertIsNotNone(dados)
        self.assertEqual(dados['cnpj_emitente'], '12345678000195')
        self.assertEqual(dados['modelo'], '57')
        self.assertEqual(dados['serie'], '1')
        self.assertEqual(dados['numero'], 123)

    def test_retorna_none_para_chave_invalida(self):
        self.assertIsNone(extrair_dados_numeracao_da_chave('123'))
        self.assertIsNone(extrair_dados_numeracao_da_chave('a' * 44))
        self.assertIsNone(extrair_dados_numeracao_da_chave(None))

    def test_mapear_modelo(self):
        self.assertEqual(mapear_modelo_para_choice('57'), ControleNumeracao.MODELO_CTE)
        self.assertEqual(mapear_modelo_para_choice('58'), ControleNumeracao.MODELO_MDFE)
        self.assertEqual(mapear_modelo_para_choice('CTe'), ControleNumeracao.MODELO_CTE)
        self.assertEqual(mapear_modelo_para_choice('MDFe'), ControleNumeracao.MODELO_MDFE)
        self.assertIsNone(mapear_modelo_para_choice('99'))


class ControleNumeracaoModelTests(TestCase):
    """Testa o modelo ControleNumeracao."""

    def test_cria_controle_com_sucesso(self):
        controle = ControleNumeracao.objects.create(
            cnpj_emitente='12345678000195',
            modelo=ControleNumeracao.MODELO_CTE,
            serie='1',
            ultimo_numero=10,
        )
        self.assertEqual(str(controle.cnpj_emitente), '12345678000195')
        self.assertEqual(controle.ultimo_numero, 10)

    def test_unique_constraint_cnpj_modelo_serie(self):
        ControleNumeracao.objects.create(
            cnpj_emitente='12345678000195',
            modelo=ControleNumeracao.MODELO_CTE,
            serie='1',
        )
        with self.assertRaises(IntegrityError):
            ControleNumeracao.objects.create(
                cnpj_emitente='12345678000195',
                modelo=ControleNumeracao.MODELO_CTE,
                serie='1',
            )

    def test_series_diferentes_permitem_registros_distintos(self):
        ControleNumeracao.objects.create(
            cnpj_emitente='12345678000195',
            modelo=ControleNumeracao.MODELO_CTE,
            serie='1',
            ultimo_numero=5,
        )
        ControleNumeracao.objects.create(
            cnpj_emitente='12345678000195',
            modelo=ControleNumeracao.MODELO_CTE,
            serie='2',
            ultimo_numero=10,
        )
        self.assertEqual(ControleNumeracao.objects.count(), 2)


class ProximoNumeroTests(TestCase):
    """Testa a geração do próximo número."""

    def test_retorna_1_quando_nao_existe_controle(self):
        self.assertEqual(
            proximo_numero('12345678000195', '57', '1'),
            1,
        )

    def test_retorna_proximo_numero_baseado_no_ultimo(self):
        ControleNumeracao.objects.create(
            cnpj_emitente='12345678000195',
            modelo=ControleNumeracao.MODELO_CTE,
            serie='1',
            ultimo_numero=42,
        )
        self.assertEqual(
            proximo_numero('12345678000195', 'CTe', '001'),
            43,
        )

    def test_cria_controle_automaticamente(self):
        self.assertFalse(ControleNumeracao.objects.exists())
        proximo_numero('12345678000195', '58', '0')
        self.assertTrue(ControleNumeracao.objects.filter(
            cnpj_emitente='12345678000195',
            modelo=ControleNumeracao.MODELO_MDFE,
            serie='0',
        ).exists())


class VerificarDuplicidadeTests(TestCase):
    """Testa a detecção de numeração duplicada."""

    def setUp(self):
        self.cnpj = '12345678000195'
        self.serie = '1'
        self.numero = 123

        # CT-e original (44 dígitos)
        self.chave_cte = (
            "35260612345678000195570010000001231123456789"
        )
        self.cte = CTeDocumento.objects.create(
            chave=self.chave_cte,
            versao='4.00',
            processado=True,
        )
        CTeIdentificacao.objects.create(
            cte=self.cte,
            serie=1,
            numero=123,
        )
        CTeEmitente.objects.create(
            cte=self.cte,
            cnpj=self.cnpj,
        )

    def test_detecta_duplicidade_para_outro_cte_mesmo_numero(self):
        # Outra chave, mesmo emitente/série/número
        chave_duplicada = (
            "35260612345678000195570010000001241123456790"
        )
        resultado = verificar_duplicidade(
            cnpj=self.cnpj,
            modelo='57',
            serie='001',
            numero=123,
            chave_atual=chave_duplicada,
        )
        self.assertTrue(resultado['duplicado'])
        self.assertEqual(resultado['chave_existente'], self.chave_cte)

    def test_ignora_reprocessamento_da_mesma_chave(self):
        resultado = verificar_duplicidade(
            cnpj=self.cnpj,
            modelo='57',
            serie='1',
            numero=123,
            chave_atual=self.chave_cte,
        )
        self.assertFalse(resultado['duplicado'])

    def test_nao_detecta_quando_numero_diferente(self):
        resultado = verificar_duplicidade(
            cnpj=self.cnpj,
            modelo='57',
            serie='1',
            numero=124,
            chave_atual='35260612345678000195570010000001241123456790',
        )
        self.assertFalse(resultado['duplicado'])

    def test_nao_detecta_quando_serie_diferente(self):
        resultado = verificar_duplicidade(
            cnpj=self.cnpj,
            modelo='57',
            serie='2',
            numero=123,
            chave_atual='35260612345678000195570020000001231123456790',
        )
        self.assertFalse(resultado['duplicado'])

    def test_detecta_duplicidade_mdfe(self):
        chave_mdfe = (
            "35260612345678000195580010000001231123456789"
        )
        mdfe = MDFeDocumento.objects.create(
            chave=chave_mdfe,
            versao='3.00',
            processado=True,
        )
        from django.utils import timezone
        MDFeIdentificacao.objects.create(
            mdfe=mdfe,
            c_uf=35,
            tp_amb=1,
            tp_emit=1,
            tp_emis=1,
            proc_emi=0,
            serie=1,
            n_mdf=123,
            dh_emi=timezone.now(),
        )
        MDFeEmitente.objects.create(
            mdfe=mdfe,
            cnpj=self.cnpj,
        )

        chave_duplicada = (
            "35260612345678000195580010000001241123456790"
        )
        resultado = verificar_duplicidade(
            cnpj=self.cnpj,
            modelo='58',
            serie='001',
            numero=123,
            chave_atual=chave_duplicada,
        )
        self.assertTrue(resultado['duplicado'])
        self.assertEqual(resultado['chave_existente'], chave_mdfe)


class RegistrarNumeroTests(TestCase):
    """Testa o registro do número utilizado."""

    def test_registra_numero_e_atualiza_ultimo(self):
        controle = registrar_numero('12345678000195', '57', '1', 100)
        self.assertEqual(controle.ultimo_numero, 100)

    def test_nao_regride_ultimo_numero(self):
        ControleNumeracao.objects.create(
            cnpj_emitente='12345678000195',
            modelo=ControleNumeracao.MODELO_CTE,
            serie='1',
            ultimo_numero=200,
        )
        controle = registrar_numero('12345678000195', '57', '1', 100)
        self.assertEqual(controle.ultimo_numero, 200)

    def test_cria_controle_quando_nao_existe(self):
        self.assertFalse(ControleNumeracao.objects.exists())
        registrar_numero('12345678000195', '58', '0', 1)
        controle = ControleNumeracao.objects.get(
            cnpj_emitente='12345678000195',
            modelo=ControleNumeracao.MODELO_MDFE,
            serie='0',
        )
        self.assertEqual(controle.ultimo_numero, 1)
