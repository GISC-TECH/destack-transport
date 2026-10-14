"""Wire format for the private Chrome proxy and HTTP clients of the EGS Worker."""
import base64
import json
import os
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

EGS_HOSTS = {"app.egssistemas.com.br", "api.egssistemas.com.br"}
DEFAULT_WORKER_URL = "https://destack-egs-relay.isctecnologia1418.workers.dev"
METHODS = {"GET", "HEAD", "POST", "OPTIONS"}
HOP_HEADERS = {
    "connection", "proxy-connection", "keep-alive", "transfer-encoding",
    "content-length", "te", "trailer", "upgrade", "proxy-authenticate",
    "proxy-authorization", "alt-svc",
}


def request_headers(method, url, pairs):
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https" or parsed.hostname not in EGS_HOSTS
        or parsed.port not in (None, 443) or parsed.username or parsed.password
        or parsed.fragment or method not in METHODS
    ):
        raise ValueError("Unsupported upstream request")
    path = parsed.path or "/"
    if parsed.query:
        path += "?" + parsed.query
    encoded = base64.b64encode(json.dumps(list(pairs), ensure_ascii=True).encode()).decode()
    if len(path) > 16000 or len(encoded) > 44000:
        raise ValueError("Request headers too large")
    return {
        "X-Relay-Host": parsed.hostname,
        "X-Relay-Method": method,
        "X-Relay-Path": path,
        "X-Relay-Headers": encoded,
        "Accept-Encoding": "identity",
    }


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def relay_request(method, url, headers, body):
    """Relay via urllib; return (status, byte header pairs, binary body).

    EGS_WORKER_URL selects the same HTTPS Worker origin used by the proxy.
    Upstream HTTP errors/redirects remain responses; Worker failures raise.
    """
    pairs = headers.items() if hasattr(headers, "items") else headers
    relay_headers = request_headers(method, url, pairs)
    worker = os.environ.get("EGS_WORKER_URL", DEFAULT_WORKER_URL).rstrip("/")
    parsed = urlsplit(worker)
    if (
        parsed.scheme != "https" or not parsed.hostname
        or parsed.username or parsed.password or parsed.path
        or parsed.query or parsed.fragment or parsed.port not in (None, 443)
    ):
        raise ValueError("EGS_WORKER_URL must be an HTTPS origin")
    request = Request(worker + "/relay", data=body or b"", headers=relay_headers, method="POST")
    # Avoid ambient proxy settings and forwarding the envelope on redirects.
    opener = build_opener(ProxyHandler({}), _NoRedirect())
    try:
        response = opener.open(request, timeout=180)
    except HTTPError as error:
        response = error
    with response:
        status, response_body, response_headers = response_parts(
            response.status,
            {name.lower(): value for name, value in response.headers.items()},
            response.read(),
        )
    return status, response_headers, response_body


def response_parts(outer_status, headers, body):
    if outer_status != 200:
        raise ValueError("Worker refused the relay")
    try:
        status = int(headers["x-relay-status"])
        encoded = headers["x-relay-headers"]
        if len(encoded) > 44000:
            raise ValueError("Response headers too large")
        pairs = json.loads(base64.b64decode(encoded, validate=True).decode("utf-8"))
        if not 200 <= status <= 599 or not isinstance(pairs, list) or len(pairs) > 100:
            raise ValueError("Invalid relay response")
        clean = []
        for pair in pairs:
            if not isinstance(pair, list) or len(pair) != 2 or not all(isinstance(x, str) for x in pair):
                raise ValueError("Invalid header pair")
            name, value = pair
            if any(c in name + value for c in "\r\n\0"):
                raise ValueError("Invalid header value")
            if name.lower() not in HOP_HEADERS:
                clean.append((name.encode("ascii"), value.encode("latin-1")))
    except (KeyError, TypeError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError("Invalid relay response") from error
    return status, b"" if status in (204, 304) else body, clean


def health_ready(data):
    return (
        isinstance(data, dict)
        and isinstance(data.get("egress"), dict)
        and data["egress"].get("country") == "BR"
        and data.get("egsLoginStatus") == 200
    )
