const DEFAULT_HOST = "app.egssistemas.com.br";
const ALLOWED_ORIGINS = new Set([
  "https://app.egssistemas.com.br",
  "https://api.egssistemas.com.br",
]);
const METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS"]);
const OMIT_HEADERS = new Set([
  "host", "connection", "proxy-connection", "keep-alive", "transfer-encoding",
  "content-length", "te", "trailer", "upgrade", "proxy-authorization",
  "proxy-authenticate", "forwarded", "x-real-ip", "x-forwarded-for",
  "x-forwarded-host", "x-forwarded-proto", "accept-encoding",
]);

export function encodeHeaders(pairs) {
  const bytes = new TextEncoder().encode(JSON.stringify(pairs));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}

export function decodeHeaders(value) {
  if (!value || value.length > 44000) throw new Error("invalid headers");
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  const pairs = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
  if (!Array.isArray(pairs) || pairs.length > 100) throw new Error("invalid headers");
  const headers = new Headers();
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some((item) => typeof item !== "string")) {
      throw new Error("invalid header pair");
    }
    const [name, value] = pair;
    const lower = name.toLowerCase();
    if (OMIT_HEADERS.has(lower) || lower.startsWith("cf-") || lower.startsWith("x-relay-")) continue;
    headers.append(name, value);
  }
  headers.set("Accept-Encoding", "identity");
  return headers;
}

export function upstreamURL(path, host = DEFAULT_HOST) {
  const origin = `https://${host}`;
  if (!ALLOWED_ORIGINS.has(origin)) throw new Error("invalid host");
  if (!path || path.length > 16000 || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("invalid path");
  }
  const target = new URL(path, origin);
  if (target.origin !== origin || target.username || target.password || target.hash) {
    throw new Error("invalid target");
  }
  return target;
}

export function responseHeaders(headers) {
  const pairs = Array.from(headers).filter(([name]) => name.toLowerCase() !== "set-cookie");
  for (const cookie of headers.getSetCookie()) pairs.push(["set-cookie", cookie]);
  return pairs;
}

const reply = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export async function handle(request, env = {}, fetcher = fetch) {
  // Restrict the relay to the existing Contabo server. Do not trust forwarded headers.
  const allowed = new Set((env.ALLOWED_IPS || "207.180.255.150").split(",").map((ip) => ip.trim()));
  if (!allowed.has(request.headers.get("CF-Connecting-IP"))) return reply({ error: "Forbidden" }, 403);
  const url = new URL(request.url);

  if (url.pathname === "/__diagnostics" && request.method === "GET") {
    try {
      const headers = { "User-Agent": "Destack-EGS-Relay/1.0", "Accept-Encoding": "identity" };
      const [geo, trace, egs] = await Promise.all([
        fetcher("https://ipinfo.io/json", { headers, signal: AbortSignal.timeout(20000) }),
        fetcher("https://www.cloudflare.com/cdn-cgi/trace", { headers, signal: AbortSignal.timeout(20000) }),
        fetcher(upstreamURL("/login").href, { headers, redirect: "manual", signal: AbortSignal.timeout(20000) }),
      ]);
      if (!geo.ok || !trace.ok) return reply({ error: "Egress probe failed" }, 502);
      const data = await geo.json();
      const traceData = Object.fromEntries((await trace.text()).trim().split("\n").map((line) => line.split(/=(.*)/s).slice(0, 2)));
      return reply({
        placement: request.headers.get("cf-placement"),
        ingressColo: request.cf?.colo || null,
        egress: { ip: data.ip, country: data.country, organization: data.org, traceColo: traceData.colo },
        egsLoginStatus: egs.status,
      });
    } catch {
      return reply({ error: "Egress probe failed" }, 502);
    }
  }

  if (url.pathname !== "/relay" || request.method !== "POST") return reply({ error: "Not found" }, 404);
  const method = request.headers.get("X-Relay-Method") || "";
  if (!METHODS.has(method)) return reply({ error: "Unsupported upstream method" }, 405);
  let target;
  let headers;
  try {
    target = upstreamURL(request.headers.get("X-Relay-Path"), request.headers.get("X-Relay-Host") ?? undefined);
    headers = decodeHeaders(request.headers.get("X-Relay-Headers"));
  } catch {
    return reply({ error: "Invalid relay request" }, 400);
  }
  try {
    const upstream = await fetcher(target.href, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : request.body,
      redirect: "manual",
      signal: AbortSignal.timeout(180000),
    });
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Relay-Status": String(upstream.status),
        "X-Relay-Headers": encodeHeaders(responseHeaders(upstream.headers)),
        "X-Relay-Placement": request.headers.get("cf-placement") || "unknown",
      },
    });
  } catch {
    return reply({ error: "Upstream request failed" }, 502);
  }
}

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
