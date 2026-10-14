#!/bin/bash
set -eu

DOCKER_BIN=/usr/local/bin/docker
SSH_BIN=/usr/bin/ssh
PROXY_CONTAINER=destack_br_egress_proxy
PROXY_IMAGE=destack-transport-scraper_prod_bridge
SSH_KEY=/Users/italocosta/.ssh/destack_deploy_ed25519

if "$DOCKER_BIN" inspect "$PROXY_CONTAINER" >/dev/null 2>&1; then
    "$DOCKER_BIN" start "$PROXY_CONTAINER" >/dev/null
else
    "$DOCKER_BIN" run -d \
        --platform linux/amd64 \
        --name "$PROXY_CONTAINER" \
        --restart unless-stopped \
        -p 127.0.0.1:18118:8080 \
        "$PROXY_IMAGE" \
        python -m pproxy -l http://0.0.0.0:8080 >/dev/null
fi

exec "$SSH_BIN" -NT \
    -i "$SSH_KEY" \
    -o BatchMode=yes \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -R 172.23.0.1:18118:127.0.0.1:18118 \
    root@207.180.255.150
