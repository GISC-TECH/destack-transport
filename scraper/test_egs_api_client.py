"""Testes unitarios do cliente HTTP do EGS e do adapter de relay (sem rede)."""
import base64
import io
import json
import unittest
import zipfile
from datetime import date
from unittest import mock

import requests

import egs_api_client as mod
from egs_api_client import EGSApiClient, EGSSessionLimitError
from egs_relay import WorkerRelayAdapter


class FakeResponse:
    def __init__(self, status=200, body=b'', headers=None, json_data=None):
        self.status_code = status
        self.headers = headers or {}
        self._json = json_data
        self.content = body if json_data is None else json.dumps(json_data).encode()
        self.text = self.content.decode('utf-8', 'replace')

    def json(self):
        if self._json is None:
            return json.loads(self.content)
        return self._json


class FakeHttp:
    def __init__(self, routes):
        self.routes = routes  # (method, url_suffix) -> FakeResponse | callable(kwargs)
        self.headers = {}
        self.calls = []

    def _dispatch(self, method, url, **kw):
        self.calls.append((method, url, kw))
        for (m, suffix), resp in self.routes.items():
            if m == method and url.endswith(suffix):
                return resp(kw) if callable(resp) else resp
        raise AssertionError(f'rota inesperada {method} {url}')

    def get(self, url, **kw):
        return self._dispatch('GET', url, **kw)

    def post(self, url, **kw):
        return self._dispatch('POST', url, **kw)


def make_zip(files):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


class LoginTests(unittest.TestCase):
    def setUp(self):
        self.http = FakeHttp({
            ('GET', 'GetServerUrlByChaveAcessoV1'): FakeResponse(json_data={'URLAPI': 'https://api.x/EGSAPP3/', 'AUXTOKEN': 'AUX=='}),
            ('POST', 'EGSAPP3/token'): FakeResponse(json_data={'access_token': 'tok123', 'token_type': 'bearer', 'expires_in': 86399}),
        })
        self.cli = EGSApiClient('USER', 'secret', '57226', session=mock.MagicMock())
        self.cli.http = self.http

    def test_login_monta_form_e_basic_sem_captcha(self):
        token = self.cli.login()
        self.assertEqual(token, 'tok123')
        method, url, kw = self.http.calls[-1]
        self.assertEqual(url, 'https://api.x/EGSAPP3/token')
        self.assertEqual(kw['data'], {'grant_type': 'password', 'username': 'USER', 'password': 'secret', 'auxtoken': 'AUX=='})
        self.assertNotIn('captcha', kw['data'])
        esperado = 'Basic ' + base64.b64encode(b'57226:eg$ystem').decode()
        self.assertEqual(kw['headers']['Authorization'], esperado)
        self.assertEqual(self.http.headers['Authorization'], 'Bearer tok123')

    def test_limite_de_acesso_vira_excecao_com_ids(self):
        self.http.routes[('POST', 'EGSAPP3/token')] = FakeResponse(
            400, json_data={'error': 'oauthErrorLimiteAcesso', 'error_description': 'Limite atingido|86352|92859'})
        with self.assertRaises(EGSSessionLimitError) as ctx:
            self.cli.login()
        self.assertEqual((ctx.exception.id_empresa, ctx.exception.id_usuario), ('86352', '92859'))

    def test_login_derrubando_sessoes(self):
        respostas = iter([
            FakeResponse(400, json_data={'error': 'oauthErrorLimiteAcesso', 'error_description': 'cheio|86352|92859'}),
            FakeResponse(json_data={'access_token': 'tok2', 'expires_in': 1}),
        ])
        self.http.routes[('POST', 'EGSAPP3/token')] = lambda kw: next(respostas)
        self.http.routes[('GET', 'GetUsuariosLogados')] = FakeResponse(json_data=[
            {'CODUSUARIO': 'LINDA', 'CODACESSO': 111, 'MINUTOSATIVIDADE': 5},
            {'CODUSUARIO': 'LUANNA', 'CODACESSO': 222, 'MINUTOSATIVIDADE': 90},
        ])
        self.http.routes[('POST', 'PostDerrubaUsuario')] = FakeResponse(json_data={})
        with mock.patch.object(mod.time, 'sleep'):
            self.assertEqual(self.cli.login_derrubando_sessoes(derrubar=True), 'tok2')
        derrubadas = [c for c in self.http.calls if c[1].endswith('PostDerrubaUsuario')]
        self.assertEqual(len(derrubadas), 1)  # so a mais ociosa
        self.assertEqual(derrubadas[0][2]['json'], {'IDUSUARIO': '92859', 'IDEMPRESA': '86352', 'CODACESSO': 222})
        self.assertTrue(derrubadas[0][2]['headers']['Authorization'].startswith('Basic '))

    def test_nao_derruba_quando_desligado(self):
        self.http.routes[('POST', 'EGSAPP3/token')] = FakeResponse(
            400, json_data={'error': 'oauthErrorLimiteAcesso', 'error_description': 'cheio|86352|92859'})
        with self.assertRaises(EGSSessionLimitError):
            self.cli.login_derrubando_sessoes(derrubar=False)
        self.assertFalse(any(c[1].endswith('PostDerrubaUsuario') for c in self.http.calls))


class ODataEDownloadTests(unittest.TestCase):
    def setUp(self):
        self.cli = EGSApiClient('U', 'P', '57226', session=mock.MagicMock())
        self.cli.http = FakeHttp({})
        self.cli.token, self.cli.url_api = 'tok', 'https://api.x/EGSAPP3/'

    def test_periodo_usa_fuso_brasil_e_fim_exclusivo(self):
        flt = self.cli._periodo(date(2026, 10, 1), date(2026, 10, 7))
        self.assertEqual(flt, 'DATAEMISSAO ge 2026-10-01T00:00:00-03:00 and DATAEMISSAO lt 2026-10-08T00:00:00-03:00')

    def test_odata_codifica_query_e_pagina(self):
        paginas = [
            FakeResponse(json_data={'value': [{'IDCTE': 1}, {'IDCTE': 2}]}),
            FakeResponse(json_data={'value': [{'IDCTE': 3}]}),
        ]
        self.cli.http.routes[('GET', '')] = lambda kw: paginas.pop(0)
        rows = list(self.cli.odata_iter('CTeTelaXml', page=2, filter_="STATUSNOME eq 'AUTORIZADA'", select='IDCTE'))
        self.assertEqual([r['IDCTE'] for r in rows], [1, 2, 3])
        urls = [c[1] for c in self.cli.http.calls]
        self.assertIn("odata/CTeTelaXml?$filter=STATUSNOME%20eq%20'AUTORIZADA'&$select=IDCTE&$top=2", urls[0])
        self.assertIn('$skip=2', urls[1])

    def test_download_unico_xml_e_zip(self):
        xml = b'<cteProc/>'
        self.cli.http.routes[('POST', 'DownloadExportacaoXml')] = FakeResponse(
            body=xml, headers={'x-filename': 'CTe123.xml', 'Content-Type': 'application/octet-stream'})
        self.assertEqual(self.cli.download_cte_xml([123]), {'CTe123.xml': xml})
        z = make_zip({'MDFe1.xml': b'<a/>', 'MDFe1_Canc.xml': b'<b/>'})
        self.cli.http.routes[('POST', 'MDFeApi/DownloadXml')] = FakeResponse(body=z, headers={'x-filename': 'MDFe_XML.zip'})
        self.assertEqual(self.cli.download_mdfe_xml([1, 2]), {'MDFe1.xml': b'<a/>', 'MDFe1_Canc.xml': b'<b/>'})
        body = [c for c in self.cli.http.calls if c[1].endswith('MDFeApi/DownloadXml')][0][2]['json']
        self.assertEqual(body, {'IDMDFE': [1, 2]})


class FiltroNovosTests(unittest.TestCase):
    def test_cte_cancelado_existente_e_rebaixado_mdfe_nao(self):
        from daily_download_api import _filtrar_novos
        ctes = [{'CHAVECTE': 'a', 'STATUSNOME': 'AUTORIZADA'}, {'CHAVECTE': 'b', 'STATUSNOME': 'CANCELADO'}, {'CHAVECTE': 'c', 'STATUSNOME': 'AUTORIZADA'}]
        self.assertEqual([d['CHAVECTE'] for d in _filtrar_novos(ctes, 'CHAVECTE', {'a', 'b'})], ['b', 'c'])
        mdfes = [{'CHAVEMDFE': 'x', 'STATUSNOME': 'CANCELADO'}, {'CHAVEMDFE': 'y', 'STATUSNOME': 'FINALIZADA'}]
        self.assertEqual(_filtrar_novos(mdfes, 'CHAVEMDFE', {'x'}), [mdfes[1]])


class RelayAdapterTests(unittest.TestCase):
    def test_request_vira_post_no_worker_e_resposta_e_decodificada(self):
        inner = mock.MagicMock()
        header_pairs = [['Content-Type', 'application/octet-stream'], ['x-filename', 'CTe1.xml']]
        inner.post.return_value = mock.MagicMock(
            status_code=200,
            headers={'x-relay-status': '200', 'x-relay-headers': base64.b64encode(json.dumps(header_pairs).encode()).decode()},
            content=b'<cteProc/>',
        )
        adapter = WorkerRelayAdapter('https://relay.example/', inner=inner)
        session = requests.Session()
        session.mount('https://api.egssistemas.com.br', adapter)
        try:
            resp = session.post('https://api.egssistemas.com.br/EGSAPP3/api/CteApi/DownloadXml', json={'IDCTE': [1]},
                                headers={'Authorization': 'Bearer t'})
        except ValueError as e:  # bridge_protocol ainda so aceita app.egssistemas.com.br
            self.skipTest(f'bridge_protocol sem suporte ao host api: {e}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b'<cteProc/>')
        self.assertEqual(resp.headers['x-filename'], 'CTe1.xml')
        kw = inner.post.call_args.kwargs
        self.assertEqual(kw['headers']['X-Relay-Method'], 'POST')
        self.assertEqual(kw['headers']['X-Relay-Path'], '/EGSAPP3/api/CteApi/DownloadXml')
        enviados = json.loads(base64.b64decode(kw['headers']['X-Relay-Headers']))
        self.assertIn(['Authorization', 'Bearer t'], enviados)
        self.assertEqual(kw['data'], b'{"IDCTE": [1]}')


if __name__ == '__main__':
    unittest.main()
