#!/bin/bash
# Deploy automatizado do Destack Transport em produção.
# Requer acesso SSH ao host de produção e um .env preenchido no servidor remoto.
#
# Uso:
#   PROD_SSH=root@207.180.255.150 VERSION=v1.1.0 ./scripts/deploy-producao.sh

set -euo pipefail

PROD_SSH="${PROD_SSH:-}"
VERSION="${VERSION:-}"
REMOTE_DIR="${REMOTE_DIR:-/root/apps/destack}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-destack_postgres}"
POSTGRES_DB="${POSTGRES_DB:-destack_db}"
POSTGRES_USER="${POSTGRES_USER:-destack_user}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.contabo.yml}"

if [ -z "$PROD_SSH" ]; then
    echo "ERRO: defina PROD_SSH, exemplo:"
    echo "  PROD_SSH=root@207.180.255.150 $0"
    exit 1
fi

if [ -z "$VERSION" ]; then
    echo "ERRO: defina a versão/tag a ser deployada, exemplo:"
    echo "  VERSION=v1.1.0 $0"
    exit 1
fi

echo "=============================================="
echo "Deploy Destack Transport $VERSION em $PROD_SSH"
echo "=============================================="

# 1. Backup do banco de produção antes de qualquer alteração
timestamp="$(date +%Y%m%d_%H%M%S)"
backup_remote="/tmp/prod_${POSTGRES_DB}_pre_${VERSION}_${timestamp}.dump"

echo ""
echo "[1/6] Backup do banco de produção..."
ssh -o StrictHostKeyChecking=no "$PROD_SSH" \
    "docker exec $POSTGRES_CONTAINER pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc --no-owner --no-acl > $backup_remote" \
    || { echo "ERRO: falha no backup"; exit 1; }

echo "Backup salvo remotamente em: $backup_remote"

# 2. Atualizar código no servidor remoto
echo ""
echo "[2/6] Atualizando código para $VERSION..."
ssh -o StrictHostKeyChecking=no "$PROD_SSH" \
    "cd $REMOTE_DIR && git fetch --tags && git checkout $VERSION && git pull origin $VERSION" \
    || { echo "ERRO: falha ao atualizar código"; exit 1; }

# 3. Buildar e subir containers
echo ""
echo "[3/6] Buildando e subindo containers..."
ssh -o StrictHostKeyChecking=no "$PROD_SSH" \
    "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE up -d --build" \
    || { echo "ERRO: falha ao subir containers"; exit 1; }

# 4. Aplicar migrations
echo ""
echo "[4/6] Aplicando migrations..."
ssh -o StrictHostKeyChecking=no "$PROD_SSH" \
    "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE exec -T web python manage.py migrate --noinput" \
    || { echo "ERRO: falha ao aplicar migrations"; exit 1; }

# 5. Coletar arquivos estáticos
echo ""
echo "[5/6] Coletando arquivos estáticos..."
ssh -o StrictHostKeyChecking=no "$PROD_SSH" \
    "cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE exec -T web python manage.py collectstatic --noinput" \
    || { echo "ERRO: falha ao coletar static files"; exit 1; }

# 6. Reiniciar nginx multi-dominio se existir
if ssh -o StrictHostKeyChecking=no "$PROD_SSH" "docker ps -q -f name=nginx_multi_django" >/dev/null 2>&1; then
    echo ""
    echo "[6/6] Reiniciando nginx multi-dominio..."
    ssh -o StrictHostKeyChecking=no "$PROD_SSH" \
        "docker restart nginx_multi_django" \
        || { echo "AVISO: falha ao reiniciar nginx_multi_django"; }
fi

# 7. Health check externo
echo ""
echo "[7/7] Verificando saúde da aplicação..."
sleep 10
ssh -o StrictHostKeyChecking=no "$PROD_SSH" \
    "curl -sf https://destacktransporte.com/api/health/ >/dev/null && echo 'Health OK' || echo 'Health check falhou'" \
    || { echo "AVISO: health check não retornou 200"; }

echo ""
echo "=============================================="
echo "Deploy $VERSION concluído em $PROD_SSH"
echo "Backup pré-deploy: $backup_remote"
echo "=============================================="
