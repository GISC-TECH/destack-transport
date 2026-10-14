"""
Adapter do `requests` que envia as chamadas ao EGS pelo Worker Cloudflare
(`cloudflare-egs-relay/`), para servidores cujo IP o EGS bloqueia (Contabo).

Reutiliza o protocolo de `cloudflare-egs-relay/bridge_protocol.py`: o request
original vira um POST {worker}/relay com X-Relay-Method/Path/Headers e o Worker
devolve status e headers em X-Relay-Status/X-Relay-Headers.

Uso:
    session = requests.Session()
    install_relay(session, 'https://egs-relay.destacktransporte.com')
"""
import importlib.util
from pathlib import Path
from typing import Optional

import requests
from requests.adapters import BaseAdapter
from requests.structures import CaseInsensitiveDict
from requests.utils import get_encoding_from_headers

_BRIDGE_PATH = Path(__file__).resolve().parent / 'cloudflare-egs-relay' / 'bridge_protocol.py'


def _load_bridge():
    spec = importlib.util.spec_from_file_location('egs_bridge_protocol', _BRIDGE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class WorkerRelayAdapter(BaseAdapter):
    def __init__(self, worker_url: str, timeout: float = 180.0, bridge=None, inner: Optional[requests.Session] = None):
        super().__init__()
        self.worker_url = worker_url.rstrip('/')
        self.timeout = timeout
        self.bridge = bridge or _load_bridge()
        self.inner = inner or requests.Session()
        self.inner.trust_env = False

    def send(self, request, stream=False, timeout=None, verify=True, cert=None, proxies=None):
        pairs = [(k, v) for k, v in request.headers.items()]
        relay_headers = self.bridge.request_headers(request.method, request.url, pairs)
        body = request.body or b''
        if isinstance(body, str):
            body = body.encode('utf-8')
        outer = self.inner.post(
            f'{self.worker_url}/relay',
            headers=relay_headers,
            data=body,
            timeout=timeout if isinstance(timeout, (int, float)) else self.timeout,
        )
        status, content, header_pairs = self.bridge.response_parts(outer.status_code, outer.headers, outer.content)
        response = requests.Response()
        response.status_code = status
        response.headers = CaseInsensitiveDict(
            (name.decode('ascii'), value.decode('latin-1')) for name, value in header_pairs
        )
        response._content = content
        response.encoding = get_encoding_from_headers(response.headers)
        response.url = request.url
        response.request = request
        response.reason = ''
        response.connection = self
        return response

    def close(self):
        self.inner.close()


def install_relay(session: requests.Session, worker_url: str, hosts=('api.egssistemas.com.br', 'app.egssistemas.com.br')) -> WorkerRelayAdapter:
    adapter = WorkerRelayAdapter(worker_url)
    for host in hosts:
        session.mount(f'https://{host}', adapter)
    return adapter
