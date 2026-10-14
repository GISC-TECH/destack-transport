#!/bin/bash
# Baixa um dump PostgreSQL custom-format da produção via SSH, sem copiar
# credenciais para a máquina local. Requer acesso SSH ao host de produção.

set -euo pipefail

PROD_SSH="${PROD_SSH:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-destack_postgres}"
POSTGRES_DB="${POSTGRES_DB:-destack_db}"
POSTGRES_USER="${POSTGRES_USER:-destack_user}"
BACKUP_DIR="${BACKUP_DIR:-backups}"

if [ -z "$PROD_SSH" ]; then
    echo "ERRO: defina PROD_SSH, exemplo:"
    echo "  PROD_SSH=root@31.97.247.165 $0"
    exit 1
fi

mkdir -p "$BACKUP_DIR"
timestamp="$(date +%Y%m%d_%H%M%S)"
outfile="$BACKUP_DIR/prod_${POSTGRES_DB}_${timestamp}.dump"

echo "Baixando dump de $PROD_SSH/$POSTGRES_CONTAINER para $outfile..."
ssh -o StrictHostKeyChecking=no "$PROD_SSH" \
    "docker exec $POSTGRES_CONTAINER pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc --no-owner --no-acl" \
    > "$outfile"

if [ ! -s "$outfile" ]; then
    echo "ERRO: dump vazio ou não criado."
    rm -f "$outfile"
    exit 1
fi

echo "Dump salvo em: $outfile"
echo "Tamanho: $(du -h "$outfile" | awk '{print $1}')"
echo ""
echo "Para restaurar localmente:"
echo "  ./scripts/restore-backup.sh"
