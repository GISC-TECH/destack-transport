import base64
import json
import io
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from bridge_protocol import DEFAULT_WORKER_URL, request_headers, relay_request, response_parts, health_ready


def encoded(pairs):
    return base64.b64encode(json.dumps(pairs).encode()).decode()


class BridgeTests(unittest.TestCase):
    def test_request_keeps_cookie_and_encoded_query(self):
        result = request_headers("POST", "https://app.egssistemas.com.br/api?text=%C3%A7", [("Cookie", "session=synthetic")])
        self.assertEqual(result["X-Relay-Path"], "/api?text=%C3%A7")
        self.assertEqual(result["X-Relay-Host"], "app.egssistemas.com.br")
        self.assertEqual(json.loads(base64.b64decode(result["X-Relay-Headers"])), [["Cookie", "session=synthetic"]])

    def test_rejects_different_hosts_ports_and_methods(self):
        for url in ["https://evil.example/login", "https://api.egssistemas.com.br.evil.example/", "http://app.egssistemas.com.br/", "https://app.egssistemas.com.br:8443/", "https://user@app.egssistemas.com.br/", "http://api.egssistemas.com.br/", "https://api.egssistemas.com.br:8443/", "https://user:pass@api.egssistemas.com.br/", "https://api.egssistemas.com.br/EGSAPP3/token#fragment"]:
            with self.assertRaises(ValueError):
                request_headers("GET", url, [])
        with self.assertRaises(ValueError):
            request_headers("DELETE", "https://app.egssistemas.com.br/", [])

    def test_api_host_and_paths_are_supported(self):
        for method, path in [("POST", "/EGSAPP3/token"), ("GET", "/EGSAPP3/api/Sistema/GetUserSession"), ("GET", "/EGSAPP3/odata/CTe?$skip=10&$top=20")]:
            result = request_headers(method, "https://api.egssistemas.com.br" + path, [])
            self.assertEqual(result["X-Relay-Host"], "api.egssistemas.com.br")
            self.assertEqual(result["X-Relay-Path"], path)

    @patch.dict("os.environ", {}, clear=True)
    @patch("bridge_protocol.build_opener")
    def test_urllib_relay_preserves_body_headers_and_upstream_error(self, build):
        binary = bytes([80, 75, 3, 4, 255, 0])
        cookies = [["Set-Cookie", "one=x"], ["Set-Cookie", "two=y"], ["Content-Type", "application/zip"]]
        response = MagicMock()
        # HTTP errors from EGS are inside the successful Worker envelope.
        response.status = 200
        response.headers = {"X-Relay-Status": "401", "X-Relay-Headers": encoded(cookies)}
        response.read.return_value = binary
        build.return_value.open.return_value = response
        status, pairs, body = relay_request("POST", "https://api.egssistemas.com.br/EGSAPP3/token", {"Content-Type": "application/x-www-form-urlencoded"}, b"username=synthetic")
        self.assertEqual((status, body), (401, binary))
        self.assertEqual(pairs[:2], [(b"Set-Cookie", b"one=x"), (b"Set-Cookie", b"two=y")])
        args, kwargs = build.return_value.open.call_args
        request = args[0]
        self.assertEqual(request.full_url, DEFAULT_WORKER_URL + "/relay")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.data, b"username=synthetic")
        self.assertEqual(request.get_header("X-relay-host"), "api.egssistemas.com.br")
        self.assertEqual(json.loads(base64.b64decode(request.get_header("X-relay-headers"))), [["Content-Type", "application/x-www-form-urlencoded"]])
        self.assertEqual(kwargs["timeout"], 180)
        proxy_handler, redirect_handler = build.call_args.args
        self.assertEqual(proxy_handler.proxies, {})
        self.assertIsNone(redirect_handler.redirect_request(None, None, 302, "", {}, "https://evil.example/"))

    @patch.dict("os.environ", {"EGS_WORKER_URL": "https://relay.example/"}, clear=True)
    @patch("bridge_protocol.build_opener")
    def test_urllib_worker_override_and_default_app_routing(self, build):
        response = MagicMock()
        response.status = 200
        response.headers = {"x-relay-status": "204", "x-relay-headers": encoded([])}
        response.read.return_value = b"unexpected"
        build.return_value.open.return_value = response
        self.assertEqual(relay_request("GET", "https://app.egssistemas.com.br/login", [], None), (204, [], b""))
        request = build.return_value.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://relay.example/relay")
        self.assertEqual(request.get_header("X-relay-host"), "app.egssistemas.com.br")

    @patch("bridge_protocol.build_opener")
    def test_urllib_rejects_unlisted_upstream_before_network(self, build):
        with self.assertRaises(ValueError):
            relay_request("GET", "https://evil.example/", [], b"")
        build.assert_not_called()

    @patch("bridge_protocol.build_opener")
    def test_urllib_rejects_invalid_worker_origin_before_network(self, build):
        for worker in ["http://relay.example", "https://user@relay.example", "https://relay.example/path", "https://relay.example?query=1", "https://relay.example#fragment"]:
            with patch.dict("os.environ", {"EGS_WORKER_URL": worker}):
                with self.assertRaises(ValueError):
                    relay_request("GET", "https://api.egssistemas.com.br/", [], b"")
        build.assert_not_called()

    @patch.dict("os.environ", {}, clear=True)
    @patch("bridge_protocol.build_opener")
    def test_urllib_worker_error_is_not_an_upstream_response(self, build):
        build.return_value.open.side_effect = HTTPError(DEFAULT_WORKER_URL + "/relay", 403, "Forbidden", {}, io.BytesIO(b"private response"))
        with self.assertRaisesRegex(ValueError, "Worker refused"):
            relay_request("GET", "https://api.egssistemas.com.br/", [], b"")

    def test_cookie_expiry_commas_do_not_split_cookies(self):
        cookies = [["Set-Cookie", "session=x; Expires=Wed, 21 Oct 2026 07:28:00 GMT"], ["Set-Cookie", "other=y"]]
        status, body, pairs = response_parts(200, {"x-relay-status": "302", "x-relay-headers": encoded(cookies)}, b"")
        self.assertEqual(status, 302)
        self.assertEqual(len(pairs), 2)
        self.assertIn(b"Wed, 21 Oct", pairs[0][1])

    def test_zip_bytes_and_content_encoding_survive(self):
        binary = bytes([80, 75, 3, 4, 0, 255, 128])
        _, body, pairs = response_parts(200, {"x-relay-status": "200", "x-relay-headers": encoded([["Content-Type", "application/zip"], ["Content-Encoding", "gzip"], ["Transfer-Encoding", "chunked"]])}, binary)
        self.assertEqual(body, binary)
        self.assertIn((b"Content-Encoding", b"gzip"), pairs)
        self.assertNotIn((b"Transfer-Encoding", b"chunked"), pairs)

    def test_rejects_worker_errors_and_header_injection(self):
        for status, headers in [(403, {}), (200, {}), (200, {"x-relay-status": "200", "x-relay-headers": encoded([["Location", "/login\r\nInjected: yes"]])})]:
            with self.assertRaises(ValueError):
                response_parts(status, headers, b"private upstream body")

    def test_no_content_response_has_no_body(self):
        _, body, _ = response_parts(200, {"x-relay-status": "204", "x-relay-headers": encoded([])}, b"unexpected")
        self.assertEqual(body, b"")

    def test_health_requires_brazil_and_egs_connectivity(self):
        self.assertTrue(health_ready({"egress": {"country": "BR"}, "egsLoginStatus": 200}))
        for data in [{"egress": {"country": "DE"}, "egsLoginStatus": 200}, {"egress": {"country": "BR"}, "egsLoginStatus": 403}, {}, None]:
            self.assertFalse(health_ready(data))


if __name__ == "__main__":
    unittest.main()
