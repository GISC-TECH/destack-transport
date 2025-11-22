#!/bin/bash
# Script para visualizar logs do ambiente local

SERVICE=${1:-web}

echo "================================================"
echo "  DESTACK - Logs do serviço: $SERVICE"
echo "================================================"
echo ""
echo "💡 Pressione Ctrl+C para sair"
echo ""

docker-compose -f docker-compose.local.yml logs -f --tail=100 $SERVICE
