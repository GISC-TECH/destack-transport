import test from "node:test";
import assert from "node:assert/strict";
import { handle, upstreamURL, encodeHeaders, decodeHeaders } from "./worker.js";

function relay(path = "/login", headers = [], method = "GET", ip = "207.180.255.150") {
  return new Request("https://relay.example/relay", {
    method: "POST",
    headers: {
      "CF-Connecting-IP": ip,
      "X-Relay-Path": path,
      "X-Relay-Method": method,
      "X-Relay-Headers": encodeHeaders(headers),
    },
  });
}

test("only Contabo may use the relay, regardless of spoofed forwarding headers", async () => {
  const request = relay("/login", [], "GET", "198.51.100.9");
  request.headers.set("X-Forwarded-For", "207.180.255.150");
  let called = false;
  const response = await handle(request, {}, async () => { called = true; });
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("URLs cannot select another upstream or inject a fragment", () => {
  for (const path of ["https://evil.example/", "//evil.example/", "/\\evil.example/", "/login#secret", "", null]) {
    assert.throws(() => upstreamURL(path));
  }
  assert.equal(upstreamURL("/login?return=%2Fdashboard").origin, "https://app.egssistemas.com.br");
  assert.equal(upstreamURL("/EGSAPP3/token", "api.egssistemas.com.br").href, "https://api.egssistemas.com.br/EGSAPP3/token");
  for (const host of ["evil.example", "app.egssistemas.com.br.evil.example", "api.egssistemas.com.br:443", "user@api.egssistemas.com.br", "https://api.egssistemas.com.br", ""]) {
    assert.throws(() => upstreamURL("/login", host));
  }
});

test("missing host header defaults to app and explicit app remains supported", async () => {
  for (const host of [undefined, "app.egssistemas.com.br"]) {
    const request = relay();
    if (host !== undefined) request.headers.set("X-Relay-Host", host);
    const response = await handle(request, {}, async (url) => {
      assert.equal(url, "https://app.egssistemas.com.br/login");
      return new Response("login");
    });
    assert.equal(response.status, 200);
  }
});

test("api token, REST and OData requests reach the selected host", async () => {
  for (const [method, path] of [["POST", "/EGSAPP3/token"], ["GET", "/EGSAPP3/api/Sistema/GetUserSession"], ["GET", "/EGSAPP3/odata/CTe?$skip=10&$top=20"]]) {
    const request = relay(path, [["Authorization", "Bearer synthetic"], ["X-Relay-Host", "evil.example"]], method);
    request.headers.set("X-Relay-Host", "api.egssistemas.com.br");
    const response = await handle(request, {}, async (url, options) => {
      assert.equal(url, "https://api.egssistemas.com.br" + path);
      assert.equal(options.method, method);
      assert.equal(options.headers.get("Authorization"), "Bearer synthetic");
      assert.equal(options.headers.has("X-Relay-Host"), false);
      return new Response("result");
    });
    assert.equal(response.status, 200);
  }
});

test("unlisted host headers are rejected before fetching", async () => {
  for (const host of ["evil.example", "api.egssistemas.com.br.evil.example", "api.egssistemas.com.br:443", ""]) {
    const request = relay();
    request.headers.set("X-Relay-Host", host);
    const response = await handle(request, {}, () => assert.fail("must not fetch"));
    assert.equal(response.status, 400);
  }
});

test("diagnostics probes app login even with an api host header", async () => {
  const request = new Request("https://relay.example/__diagnostics", {
    headers: { "CF-Connecting-IP": "207.180.255.150", "X-Relay-Host": "api.egssistemas.com.br" },
  });
  const urls = [];
  const response = await handle(request, {}, async (url) => {
    urls.push(url);
    if (url === "https://ipinfo.io/json") return Response.json({ country: "BR", ip: "synthetic", org: "test" });
    if (url === "https://www.cloudflare.com/cdn-cgi/trace") return new Response("colo=GRU\n");
    assert.equal(url, "https://app.egssistemas.com.br/login");
    return new Response("login");
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).egsLoginStatus, 200);
  assert.equal(urls.length, 3);
});

test("session headers survive; routing and forwarding headers do not", () => {
  const headers = decodeHeaders(encodeHeaders([
    ["Cookie", "session=synthetic"], ["Origin", "https://app.egssistemas.com.br"],
    ["Host", "evil.example"], ["CF-Connecting-IP", "198.51.100.1"],
    ["X-Forwarded-For", "198.51.100.1"], ["Proxy-Authorization", "synthetic"],
  ]));
  assert.equal(headers.get("Cookie"), "session=synthetic");
  assert.equal(headers.get("Origin"), "https://app.egssistemas.com.br");
  for (const name of ["Host", "CF-Connecting-IP", "X-Forwarded-For", "Proxy-Authorization"]) assert.equal(headers.has(name), false);
  assert.equal(headers.get("Accept-Encoding"), "identity");
});

test("malformed header envelopes fail without making an upstream request", async () => {
  for (const value of ["!not-base64!", btoa('{}'), encodeHeaders([["bad\nheader", "value"]]), "a".repeat(44001)]) {
    const request = relay();
    request.headers.set("X-Relay-Headers", value);
    const response = await handle(request, {}, () => assert.fail("must not fetch"));
    assert.equal(response.status, 400);
  }
});

test("upstream redirects are not followed and multiple cookies remain separate", async () => {
  const cookies = ["session=synthetic; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure", "other=value; HttpOnly"];
  const response = await handle(relay(), {}, async (url, options) => {
    assert.equal(url, "https://app.egssistemas.com.br/login");
    assert.equal(options.redirect, "manual");
    const headers = new Headers({ Location: "https://outside.example/" });
    cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
    return new Response(null, { status: 302, headers });
  });
  assert.equal(response.headers.get("X-Relay-Status"), "302");
  const pairs = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(response.headers.get("X-Relay-Headers")), (s) => s.charCodeAt(0))));
  assert.deepEqual(pairs.filter(([name]) => name === "set-cookie").map(([, value]) => value), cookies);
});

test("download bytes are forwarded without being converted to text", async () => {
  const bytes = Uint8Array.from([80, 75, 3, 4, 255, 0, 128]);
  const response = await handle(relay("/download"), {}, async () => new Response(bytes, { headers: { "Content-Type": "application/zip" } }));
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("upstream failures do not expose request headers or error details", async () => {
  const response = await handle(relay("/login", [["Cookie", "session=synthetic"]]), {}, async () => { throw new Error("private diagnostics"); });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Upstream request failed" });
});

test("POST data reaches the fixed upstream unchanged", async () => {
  const body = "field=synthetic%2Bvalue&utf8=%C3%A7";
  const request = new Request(relay("/login", [["Content-Type", "application/x-www-form-urlencoded"]], "POST"), { body });
  const response = await handle(request, {}, async (url, options) => {
    assert.equal(url, "https://app.egssistemas.com.br/login");
    assert.equal(options.method, "POST");
    assert.equal(await new Response(options.body).text(), body);
    return new Response(null, { status: 204 });
  });
  assert.equal(response.headers.get("X-Relay-Status"), "204");
});
