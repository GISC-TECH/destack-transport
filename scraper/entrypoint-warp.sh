#!/bin/bash
set -e

# Adiciona o host do Tor no /etc/hosts (o DNS do Docker pode nao estar disponivel)
if [ -n "$TOR_HOST" ]; then
    TOR_IP=$(getent hosts "$TOR_HOST" | awk '{print $1}' || true)
    if [ -n "$TOR_IP" ]; then
        echo "$TOR_IP $TOR_HOST" >> /etc/hosts
        echo "[TOR] Adicionado $TOR_HOST -> $TOR_IP em /etc/hosts"
    fi
fi

# Inicia o daemon do Cloudflare WARP em background (opcional)
if [ "$USE_WARP" = "true" ] && command -v warp-svc >/dev/null 2>&1; then
    echo "[WARP] Iniciando daemon..."
    warp-svc &
    WARP_SVC_PID=$!

    # Aguarda o daemon estar pronto
    for i in $(seq 1 30); do
        if warp-cli status >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    # Registra (se ainda nao registrado)
    if ! warp-cli registration show >/dev/null 2>&1; then
        echo "[WARP] Registrando..."
        printf "y\n" | script -q -c "warp-cli registration new" /dev/null
    fi

    # Conecta
    echo "[WARP] Conectando..."
    warp-cli connect

    # Aguarda conexao
    for i in $(seq 1 30); do
        STATUS=$(warp-cli status 2>/dev/null | head -1)
        echo "[WARP] Status: $STATUS"
        if echo "$STATUS" | grep -q "Connected"; then
            echo "[WARP] Conectado!"
            break
        fi
        sleep 1
    done

    echo "[WARP] IP externo: $(curl -s ifconfig.me)"
fi

# Proxy do Chrome: SEMPRE HTTP.
# Preferencia:
#   1) CHROME_PROXY_URL se ja for http(s)
#   2) TOR_HTTP_PROXY / Privoxy do container tor (http://destack_tor:8118)
#   3) pproxy local a partir de TOR_SOCKS_URL / CHROME_PROXY_URL socks
PPROXY_PORT=${PPROXY_PORT:-8118}
TOR_HTTP_PROXY=${TOR_HTTP_PROXY:-http://destack_tor:8118}
TOR_SOCKS_URL=${TOR_SOCKS_URL:-socks5://destack_tor:9050}

resolve_proxy_host_ip() {
    local url="$1"
    local host
    host=$(echo "$url" | sed -E 's#^(https?|socks5|socks4|socks5h)://##; s#:.*##')
    local ip
    ip=$(getent hosts "$host" 2>/dev/null | awk '{print $1}' | head -1 || true)
    if [ -n "$ip" ]; then
        echo "$url" | sed "s/$host/$ip/"
    else
        echo "$url"
    fi
}

wait_http_proxy() {
    local url="$1"
    local label="$2"
    echo "[PROXY] Aguardando $label ($url)..."
    for i in $(seq 1 60); do
        if curl -s --max-time 5 --proxy "$url" https://api.ipify.org >/dev/null 2>&1; then
            IP=$(curl -s --max-time 8 --proxy "$url" https://api.ipify.org || true)
            echo "[PROXY] $label OK — IP externo: ${IP:-desconhecido}"
            return 0
        fi
        sleep 2
    done
    echo "[PROXY] AVISO: $label nao respondeu a tempo"
    return 1
}

if [ -n "$CHROME_PROXY_URL" ] || [ -n "$TOR_HTTP_PROXY" ]; then
    # Se CHROME_PROXY_URL for SOCKS, tenta Privoxy do tor primeiro
    if echo "${CHROME_PROXY_URL:-}" | grep -qE '^socks5?h?://'; then
        echo "[PROXY] CHROME_PROXY_URL e SOCKS — preferindo Privoxy HTTP do Tor"
        if wait_http_proxy "$TOR_HTTP_PROXY" "tor-privoxy"; then
            CHROME_PROXY_URL="$TOR_HTTP_PROXY"
        else
            # Fallback: pproxy local
            SOCKS_URL=$(resolve_proxy_host_ip "${TOR_SOCKS_URL:-$CHROME_PROXY_URL}")
            SOCKS_HOST=$(echo "$SOCKS_URL" | sed -E 's#^socks5?h?://##; s#:.*##')
            SOCKS_PORT=$(echo "$SOCKS_URL" | sed -E 's#^socks5?h?://[^:]*:##; s#/.*##')
            echo "[PPROXY] Fallback local HTTP -> socks5://${SOCKS_HOST}:${SOCKS_PORT}"
            python3 -m pproxy -l "http://127.0.0.1:${PPROXY_PORT}" -r "socks5://${SOCKS_HOST}:${SOCKS_PORT}" >/tmp/pproxy.log 2>&1 &
            wait_http_proxy "http://127.0.0.1:${PPROXY_PORT}" "pproxy-local" || true
            CHROME_PROXY_URL="http://127.0.0.1:${PPROXY_PORT}"
        fi
    else
        # HTTP configurado (caminho recomendado)
        CHROME_PROXY_URL=${CHROME_PROXY_URL:-$TOR_HTTP_PROXY}
        CHROME_PROXY_URL=$(resolve_proxy_host_ip "$CHROME_PROXY_URL")
        if ! wait_http_proxy "$CHROME_PROXY_URL" "chrome-http-proxy"; then
            # Tenta Privoxy padrao e pproxy local como rede de seguranca
            if wait_http_proxy "$TOR_HTTP_PROXY" "tor-privoxy"; then
                CHROME_PROXY_URL="$TOR_HTTP_PROXY"
            else
                SOCKS_URL=$(resolve_proxy_host_ip "$TOR_SOCKS_URL")
                SOCKS_HOST=$(echo "$SOCKS_URL" | sed -E 's#^socks5?h?://##; s#:.*##')
                SOCKS_PORT=$(echo "$SOCKS_URL" | sed -E 's#^socks5?h?://[^:]*:##; s#/.*##')
                echo "[PPROXY] Subindo fallback local..."
                python3 -m pproxy -l "http://127.0.0.1:${PPROXY_PORT}" -r "socks5://${SOCKS_HOST}:${SOCKS_PORT}" >/tmp/pproxy.log 2>&1 &
                wait_http_proxy "http://127.0.0.1:${PPROXY_PORT}" "pproxy-local" || true
                CHROME_PROXY_URL="http://127.0.0.1:${PPROXY_PORT}"
            fi
        fi
    fi

    export CHROME_PROXY_URL
    export TOR_HTTP_PROXY
    export TOR_SOCKS_URL
    echo "[PROXY] CHROME_PROXY_URL final=${CHROME_PROXY_URL}"
fi

# Executa o comando principal (scheduler ou outro)
echo "[ENTRYPOINT] Iniciando: $@"
exec "$@"
