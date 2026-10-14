"""
Cliente HTTP para a API interna do EGS Sistemas (sem Selenium).

Mapeamento e evidencias em docs/egs-api-mapping.md. Fluxo:
  1. GET  EGSWEB/api/Sistema/GetServerUrlByChaveAcessoV1  -> URLAPI do tenant + AUXTOKEN
  2. POST {URLAPI}token (grant_type=password + auxtoken, Basic chave:eg$ystem) -> access_token (24h)
  3. GET  {URLAPI}odata/CTeTelaXml | odata/MDFe  (OData v4: $filter/$select/$top/$skip/$count)
  4. POST {URLAPI}api/CteApi/DownloadExportacaoXml {IDENTArray:[...]}  -> .xml ou .zip
     POST {URLAPI}api/MDFeApi/DownloadXml          {IDMDFE:[...]}      -> .xml ou .zip

Todas as chamadas foram validadas contra producao em 2026-10-14.
"""
import base64
import io
import json
import logging
import os
import time
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, Iterator, List, Optional
from urllib.parse import quote

import requests

logger = logging.getLogger('egs_api_client')

DEFAULT_BASE = 'https://api.egssistemas.com.br/EGSWEB/'
CLIENT_SECRET = 'eg$ystem'  # constante "clientSecret" do bundle appCore.min.js
NOAUTH_BASIC = base64.b64encode(b'590196:eg$ystem').decode()  # usado por GetUsuariosLogados/PostDerrubaUsuario
USER_AGENT = (
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/130.0 Safari/537.36'
)
TOKEN_TTL_SECONDS = 20 * 3600  # token vale 86399s; renova com folga


class EGSApiError(RuntimeError):
    def __init__(self, message: str, status: int = 0, payload=None):
        super().__init__(message)
        self.status = status
        self.payload = payload


class EGSSessionLimitError(EGSApiError):
    """Backend devolveu oauthErrorLimiteAcesso: outro usuario ocupa a vaga."""

    def __init__(self, message: str, id_empresa: str, id_usuario: str):
        super().__init__(message, 400)
        self.id_empresa = id_empresa
        self.id_usuario = id_usuario


class EGSApiClient:
    def __init__(
        self,
        username: str,
        password: str,
        chave_acesso: str,
        base_url: str = DEFAULT_BASE,
        token_cache: Optional[Path] = None,
        timeout: int = 180,
        session: Optional[requests.Session] = None,
    ):
        self.username = username
        self.password = password
        self.chave_acesso = str(chave_acesso)
        self.base_url = base_url.rstrip('/') + '/'
        self.token_cache = Path(token_cache) if token_cache else None
        self.timeout = timeout
        self.http = session or requests.Session()
        self.http.headers.update({
            'User-Agent': USER_AGENT,
            'X-User-Agent': USER_AGENT,  # o interceptor $http do front envia sempre
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://app.egssistemas.com.br',
            'Referer': 'https://app.egssistemas.com.br/',
        })
        self.url_api: Optional[str] = None
        self.token: Optional[str] = None
        self.cod_empresa: Optional[int] = None

    # ------------------------------------------------------------------ auth
    def discover(self) -> Dict[str, str]:
        """Resolve a URL do tenant e o auxtoken (valido por pouco tempo)."""
        r = self.http.get(
            f'{self.base_url}api/Sistema/GetServerUrlByChaveAcessoV1',
            params={'CHAVEACESSO': self.chave_acesso, 'EGSERP': 'true'},
            timeout=self.timeout,
        )
        self._raise_for(r, 'GetServerUrlByChaveAcessoV1')
        data = r.json()
        self.url_api = data['URLAPI'].rstrip('/') + '/'
        return data

    def login(self, force: bool = False) -> str:
        if not force and self._load_cached_token():
            return self.token
        data = self.discover()
        basic = base64.b64encode(f'{self.chave_acesso}:{CLIENT_SECRET}'.encode()).decode()
        # captcha/codigo2fa sao omitidos; o backend pede via erro quando necessario
        form = {
            'grant_type': 'password',
            'username': self.username,
            'password': self.password,
            'auxtoken': data['AUXTOKEN'],
        }
        r = self.http.post(
            f'{self.url_api}token',
            data=form,
            headers={'Authorization': f'Basic {basic}'},
            timeout=self.timeout,
        )
        if r.status_code != 200:
            self._raise_login_error(r)
        payload = r.json()
        self.token = payload['access_token']
        self.http.headers['Authorization'] = f'Bearer {self.token}'
        self._save_cached_token()
        logger.info('Login EGS ok (expires_in=%s)', payload.get('expires_in'))
        return self.token

    def _raise_login_error(self, r: requests.Response) -> None:
        try:
            err = r.json()
        except ValueError:
            raise EGSApiError(f'Login HTTP {r.status_code}: {r.text[:200]}', r.status_code)
        code = err.get('error')
        desc = err.get('error_description', '')
        if code == 'oauthErrorLimiteAcesso':
            # formato: "mensagem|IDEMPRESA|IDUSUARIO"
            parts = desc.split('|')
            raise EGSSessionLimitError(parts[0], parts[1] if len(parts) > 1 else '', parts[2] if len(parts) > 2 else '')
        if code in ('oauthGerouCaptcha', 'oauthCaptchaIncorreto'):
            raise EGSApiError(f'EGS exigiu reCAPTCHA no login: {desc}', r.status_code, err)
        if code == 'oauth2faRequest':
            raise EGSApiError(f'EGS exigiu codigo 2FA no login: {desc}', r.status_code, err)
        raise EGSApiError(f'Login recusado ({code}): {desc}', r.status_code, err)

    def get_user_session(self) -> dict:
        """Equivale ao buildSession do front: empresas, permissoes, usaNovoOdata."""
        r = self._get('api/Sistema/GetUserSession')
        data = r.json()
        self.cod_empresa = data.get('codEmpresa')
        return data

    # ------------------------------------------------------- sessao concorrente
    def usuarios_logados(self, id_empresa: str) -> list:
        r = self.http.get(
            f'{self.url_api}api/Sistema/GetUsuariosLogados',
            params={'IDEMPRESA': id_empresa},
            headers={'Authorization': f'Basic {NOAUTH_BASIC}'},
            timeout=self.timeout,
        )
        self._raise_for(r, 'GetUsuariosLogados')
        return r.json()

    def derrubar_usuario(self, id_usuario: str, id_empresa: str, cod_acesso: str) -> None:
        r = self.http.post(
            f'{self.url_api}api/Sistema/PostDerrubaUsuario',
            json={'IDUSUARIO': id_usuario, 'IDEMPRESA': id_empresa, 'CODACESSO': cod_acesso},
            headers={'Authorization': f'Basic {NOAUTH_BASIC}'},
            timeout=self.timeout,
        )
        self._raise_for(r, 'PostDerrubaUsuario')

    def login_derrubando_sessoes(self, derrubar: Optional[bool] = None) -> str:
        """Login; se o limite de acessos estourar, derruba UMA sessao (a mais ociosa) e tenta de novo.

        Mesmo comportamento do coletor Selenium, que tambem libera uma vaga.
        As sessoes listadas sao de pessoas reais da empresa; EGS_DERRUBAR_SESSAO=false desliga.
        """
        if derrubar is None:
            derrubar = os.getenv('EGS_DERRUBAR_SESSAO', 'true').strip().lower() != 'false'
        try:
            return self.login()
        except EGSSessionLimitError as e:
            logger.warning('Limite de acessos no EGS: %s', e)
            if not derrubar:
                raise
            sessoes = self.usuarios_logados(e.id_empresa)
            if not sessoes:
                raise
            alvo = max(sessoes, key=lambda s: (s.get('MINUTOSATIVIDADE') or 0, -(s.get('CODACESSO') or 0)))
            cod_acesso = alvo.get('CODACESSO') or alvo.get('IDACESSO')
            logger.warning(
                'Derrubando sessao %s de %s (ociosa ha %s min) para liberar vaga',
                cod_acesso, alvo.get('CODUSUARIO'), alvo.get('MINUTOSATIVIDADE'),
            )
            self.derrubar_usuario(e.id_usuario, e.id_empresa, cod_acesso)
            time.sleep(2)
            return self.login(force=True)

    # ------------------------------------------------------------------ odata
    def odata(self, entity: str, filter_: str = '', select: str = '', orderby: str = '',
              top: int = 200, skip: int = 0, count: bool = False) -> dict:
        parts = []
        if filter_:
            parts.append('$filter=' + filter_)
        if select:
            parts.append('$select=' + select)
        if orderby:
            parts.append('$orderby=' + orderby)
        parts.append(f'$top={top}')
        if skip:
            parts.append(f'$skip={skip}')
        if count:
            parts.append('$count=true')
        query = quote('&'.join(parts), safe="=$&,()'")
        r = self._get(f'odata/{entity}?{query}')
        return r.json()

    def odata_iter(self, entity: str, page: int = 200, **kw) -> Iterator[dict]:
        skip = 0
        while True:
            data = self.odata(entity, top=page, skip=skip, **kw)
            rows = data.get('value', [])
            yield from rows
            if len(rows) < page:
                return
            skip += page

    @staticmethod
    def _periodo(inicio: date, fim: Optional[date]) -> str:
        fim = fim or date.today()
        fim_excl = fim + timedelta(days=1)
        return (f"DATAEMISSAO ge {inicio.isoformat()}T00:00:00-03:00 and "
                f"DATAEMISSAO lt {fim_excl.isoformat()}T00:00:00-03:00")

    def listar_ctes(self, inicio: date, fim: Optional[date] = None, status: Optional[str] = None) -> List[dict]:
        """Linhas de VW_CTETELAXML (tela /cte-tela-xml)."""
        flt = self._periodo(inicio, fim)
        if status:
            flt += f" and STATUSNOME eq '{status}'"
        return list(self.odata_iter(
            'CTeTelaXml', filter_=flt, orderby='DATAEMISSAO asc,NUMCTE asc',
            select='IDCTE,NUMCTE,DATAEMISSAO,STATUSNOME,CHAVECTE,DEST_NOME,CODEMPRESA,MODELO',
        ))

    def listar_mdfes(self, inicio: date, fim: Optional[date] = None, status: Optional[str] = None) -> List[dict]:
        """Linhas da grid /mdfe (entidade OData MDFe)."""
        flt = self._periodo(inicio, fim)
        if status:
            flt += f" and STATUSNOME eq '{status}'"
        return list(self.odata_iter(
            'MDFe', filter_=flt, orderby='DATAEMISSAO asc,NUMMDFE asc',
            select='IDMDFE,NUMMDFE,SERIE,DATAEMISSAO,STATUSNOME,CHAVEMDFE,PLACATRACAO,UFINI,UFFIM,CODEMPRESA',
        ))

    # -------------------------------------------------------------- downloads
    def download_cte_xml(self, ids: List[int]) -> Dict[str, bytes]:
        """Retorna {nome_arquivo: xml_bytes}. Um id -> .xml; varios -> .zip (descompactado aqui)."""
        return self._download('api/CteApi/DownloadExportacaoXml', {'IDENTArray': list(ids)})

    def download_mdfe_xml(self, ids: List[int]) -> Dict[str, bytes]:
        return self._download('api/MDFeApi/DownloadXml', {'IDMDFE': list(ids)})

    def _download(self, path: str, body: dict) -> Dict[str, bytes]:
        r = self.http.post(f'{self.url_api}{path}', json=body, timeout=self.timeout)
        self._raise_for(r, path)
        name = r.headers.get('x-filename') or 'download.bin'
        content = r.content
        if content[:4] == b'PK\x03\x04':
            out = {}
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                for info in zf.infolist():
                    if not info.is_dir():
                        out[os.path.basename(info.filename)] = zf.read(info)
            return out
        return {name: content}

    # ---------------------------------------------------------------- helpers
    def _get(self, path: str) -> requests.Response:
        if not self.token:
            self.login()
        r = self.http.get(f'{self.url_api}{path}', timeout=self.timeout)
        if r.status_code == 401:
            logger.info('Token EGS expirado/invalido, relogando')
            self.login(force=True)
            r = self.http.get(f'{self.url_api}{path}', timeout=self.timeout)
        self._raise_for(r, path)
        return r

    @staticmethod
    def _raise_for(r: requests.Response, what: str) -> None:
        if r.status_code >= 400:
            raise EGSApiError(f'{what} -> HTTP {r.status_code}: {r.text[:300]}', r.status_code)

    def _load_cached_token(self) -> bool:
        if not self.token_cache or not self.token_cache.exists():
            return False
        try:
            data = json.loads(self.token_cache.read_text())
            if time.time() - data['created'] > TOKEN_TTL_SECONDS or data.get('chave') != self.chave_acesso:
                return False
            self.token, self.url_api = data['access_token'], data['url_api']
            self.http.headers['Authorization'] = f'Bearer {self.token}'
            return True
        except (ValueError, KeyError):
            return False

    def _save_cached_token(self) -> None:
        if not self.token_cache:
            return
        self.token_cache.parent.mkdir(parents=True, exist_ok=True)
        self.token_cache.write_text(json.dumps({
            'access_token': self.token, 'url_api': self.url_api,
            'chave': self.chave_acesso, 'created': time.time(),
        }))
        os.chmod(self.token_cache, 0o600)


def from_env(token_cache: Optional[str] = None) -> EGSApiClient:
    """Constroi o cliente a partir das mesmas variaveis que o scraper Selenium usa.

    EGS_RELAY_URL (opcional): URL do Worker Cloudflare; todas as chamadas ao EGS
    passam por ele (necessario onde o IP e bloqueado, ex. Contabo).
    EGS_HTTP_PROXY (opcional): proxy HTTP so para o EGS (ex. o Privoxy/Tor que o
    Chrome ja usa em CHROME_PROXY_URL). Ignorado quando EGS_RELAY_URL esta definido.
    """
    from config import EGS_USERNAME, EGS_PASSWORD, EGS_ACCESS_KEY, EGS_BASE_URL  # noqa: F401

    session = requests.Session()
    session.trust_env = False  # nao herdar HTTP(S)_PROXY: o Destack interno nao pode passar pelo proxy
    relay_url = os.getenv('EGS_RELAY_URL', '').strip()
    proxy_url = os.getenv('EGS_HTTP_PROXY', '').strip()
    if proxy_url and not relay_url:
        session.proxies = {'http': proxy_url, 'https': proxy_url}
        logger.info('Chamadas ao EGS via proxy %s', proxy_url)
    if relay_url:
        from egs_relay import install_relay

        install_relay(session, relay_url)
        logger.info('Chamadas ao EGS via relay %s', relay_url)
    return EGSApiClient(
        username=EGS_USERNAME,
        password=EGS_PASSWORD,
        chave_acesso=EGS_ACCESS_KEY,
        token_cache=Path(token_cache) if token_cache else None,
        session=session,
    )


if __name__ == '__main__':  # uso: python egs_api_client.py [dias]
    import sys

    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    dias = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    cli = from_env(token_cache=os.path.join(os.getenv('DATA_DIR', 'data'), 'egs_token.json'))
    cli.login_derrubando_sessoes()
    inicio = date.today() - timedelta(days=dias)
    ctes = cli.listar_ctes(inicio)
    mdfes = cli.listar_mdfes(inicio)
    print(f'CT-e desde {inicio}: {len(ctes)} | MDF-e: {len(mdfes)}')
    if ctes:
        arquivos = cli.download_cte_xml([c['IDCTE'] for c in ctes[:2]])
        print('CT-e XML:', {k: len(v) for k, v in arquivos.items()})
    if mdfes:
        arquivos = cli.download_mdfe_xml([m['IDMDFE'] for m in mdfes[:2]])
        print('MDF-e XML:', {k: len(v) for k, v in arquivos.items()})
