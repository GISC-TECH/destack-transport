"""Private HTTP CONNECT adapter for Chrome; EGS HTTP is relayed by the Worker."""
import asyncio
import json
import os
import time
from urllib.parse import urlsplit

import httpx
from mitmproxy import http

from bridge_protocol import EGS_HOSTS, request_headers, response_parts, health_ready


class WorkerRelay:
    def __init__(self):
        self.worker = os.environ.get("EGS_WORKER_URL", "https://destack-egs-relay.isctecnologia1418.workers.dev").rstrip("/")
        parsed = urlsplit(self.worker)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
            raise ValueError("EGS_WORKER_URL must be an HTTPS origin")
        self.client = None
        self.health_lock = asyncio.Lock()
        self.health_cache = (0, None)
        self.stats = {"relay_requests": 0, "relay_responses": 0, "relay_failures": 0}

    def running(self):
        # The Worker is restricted to Contabo's IPv4. TLS validation stays enabled.
        self.client = httpx.AsyncClient(
            transport=httpx.AsyncHTTPTransport(
                local_address="0.0.0.0",
                limits=httpx.Limits(max_connections=16, max_keepalive_connections=8),
            ),
            timeout=httpx.Timeout(180.0, connect=10.0),
            trust_env=False,
        )

    async def worker_health(self):
        async with self.health_lock:
            expires, cached = self.health_cache
            if time.monotonic() < expires:
                return cached
            try:
                response = await self.client.get(self.worker + "/__diagnostics", timeout=25)
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise ValueError("Invalid diagnostics")
            except (httpx.HTTPError, ValueError):
                data = {"error": "Worker connectivity check failed"}
            self.health_cache = (time.monotonic() + (30 if health_ready(data) else 5), data)
            return data

    async def request(self, flow: http.HTTPFlow):
        request = flow.request
        if request.scheme == "http" and request.path == "/__relay_health" and request.host in {
            "127.0.0.1", "localhost", "destack_egs_worker_proxy", "destack-worker-proxy-check-20261014",
        }:
            data = dict(await self.worker_health())
            data["proxy"] = dict(self.stats)
            flow.response = http.Response.make(
                200 if health_ready(data) else 502,
                json.dumps(data).encode(),
                {"Content-Type": "application/json", "Cache-Control": "no-store"},
            )
            return
        if request.host not in EGS_HOSTS:
            return
        self.stats["relay_requests"] += 1
        try:
            headers = request_headers(request.method, request.pretty_url, request.headers.items(multi=True))
            response = await self.client.post(
                self.worker + "/relay", headers=headers, content=request.raw_content or b"",
            )
            status, body, pairs = response_parts(response.status_code, response.headers, response.content)
            flow.response = http.Response.make(status, body, pairs)
            self.stats["relay_responses"] += 1
        except (httpx.HTTPError, ValueError):
            self.stats["relay_failures"] += 1
            # Never log cookies, authentication data, URLs with query strings, or response bodies.
            flow.response = http.Response.make(502, b"EGS relay unavailable", {"Content-Type": "text/plain", "Cache-Control": "no-store"})


addons = [WorkerRelay()]
