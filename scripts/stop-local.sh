#!/bin/bash
# Script para parar ambiente de desenvolvimento local

echo "================================================"
echo "  DESTACK - Parando Ambiente Local             "
echo "================================================"
echo ""

echo "🛑 Parando containers..."
docker-compose -f docker-compose.local.yml down

echo ""
echo "✅ Containers parados!"
echo ""
echo "💡 Para remover volumes também (APAGA DADOS!):"
echo "   docker-compose -f docker-compose.local.yml down -v"
echo "================================================"
