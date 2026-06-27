"""Testes para o serviço de integração com Evolution API."""
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings

from transport.services.whatsapp_service import (
    formatar_numero,
    enviar_mensagem_texto,
    testar_conexao,
)


class FormatarNumeroTests(TestCase):
    def test_remove_caracteres_nao_numericos(self):
        self.assertEqual(formatar_numero('(11) 98765-4321'), '5511987654321')

    def test_adiciona_ddi_brasil(self):
        self.assertEqual(formatar_numero('11987654321'), '5511987654321')

    def test_remove_zero_inicial(self):
        self.assertEqual(formatar_numero('011 98765-4321'), '5511987654321')

    def test_mantem_ddi_existente(self):
        self.assertEqual(formatar_numero('5511987654321'), '5511987654321')

    def test_retorna_none_para_vazio(self):
        self.assertIsNone(formatar_numero(''))
        self.assertIsNone(formatar_numero(None))


@override_settings(
    EVOLUTION_API_URL='http://evolution-test:8080',
    EVOLUTION_API_KEY='test-api-key',
    EVOLUTION_INSTANCE_NAME='test-instance',
)
class EnviarMensagemTextoTests(TestCase):
    @patch('transport.services.whatsapp_service.requests.post')
    def test_envia_mensagem_com_sucesso(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.text = '{"key": {"id": "msg123"}}'
        mock_response.json.return_value = {'key': {'id': 'msg123'}}
        mock_post.return_value = mock_response

        resultado = enviar_mensagem_texto('11987654321', 'Olá, mundo!')

        self.assertEqual(resultado['status'], 'enviado')
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], 'http://evolution-test:8080/message/sendText/test-instance')
        self.assertEqual(kwargs['json']['number'], '5511987654321')
        self.assertEqual(kwargs['json']['text'], 'Olá, mundo!')
        self.assertEqual(kwargs['headers']['apikey'], 'test-api-key')

    @patch('transport.services.whatsapp_service.requests.post')
    def test_retorna_falha_quando_api_retorna_erro(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = 'Bad Request'
        mock_post.return_value = mock_response

        resultado = enviar_mensagem_texto('11987654321', 'Teste')

        self.assertEqual(resultado['status'], 'falha')
        self.assertIn('400', resultado['erro'])

    @patch('transport.services.whatsapp_service.requests.post')
    def test_retorna_falha_em_timeout(self, mock_post):
        mock_post.side_effect = Exception('Timeout')

        resultado = enviar_mensagem_texto('11987654321', 'Teste')

        self.assertEqual(resultado['status'], 'falha')

    def test_retorna_falha_quando_nao_configurado(self):
        with override_settings(EVOLUTION_API_URL='', EVOLUTION_API_KEY=''):
            resultado = enviar_mensagem_texto('11987654321', 'Teste')

        self.assertEqual(resultado['status'], 'falha')
        self.assertIn('não configurada', resultado['erro'])


@override_settings(
    EVOLUTION_API_URL='http://evolution-test:8080',
    EVOLUTION_API_KEY='test-api-key',
    EVOLUTION_INSTANCE_NAME='test-instance',
)
class TestarConexaoTests(TestCase):
    @patch('transport.services.whatsapp_service.requests.get')
    def test_conexao_ok(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'state': 'CONNECTED'}
        mock_get.return_value = mock_response

        resultado = testar_conexao()

        self.assertEqual(resultado['status'], 'ok')
        self.assertEqual(resultado['estado'], 'CONNECTED')

    @patch('transport.services.whatsapp_service.requests.get')
    def test_conexao_falha(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = 'Unauthorized'
        mock_get.return_value = mock_response

        resultado = testar_conexao()

        self.assertEqual(resultado['status'], 'falha')

    def test_conexao_falha_quando_nao_configurado(self):
        with override_settings(EVOLUTION_API_URL='', EVOLUTION_API_KEY=''):
            resultado = testar_conexao()

        self.assertEqual(resultado['status'], 'falha')
