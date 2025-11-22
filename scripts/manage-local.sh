#!/bin/bash
# Script para executar comandos manage.py no ambiente local

if [ $# -eq 0 ]; then
    echo "================================================"
    echo "  DESTACK - Django Management Commands"
    echo "================================================"
    echo ""
    echo "Uso: ./scripts/manage-local.sh <comando>"
    echo ""
    echo "Exemplos:"
    echo "  ./scripts/manage-local.sh migrate"
    echo "  ./scripts/manage-local.sh makemigrations"
    echo "  ./scripts/manage-local.sh createsuperuser"
    echo "  ./scripts/manage-local.sh collectstatic"
    echo "  ./scripts/manage-local.sh shell"
    echo ""
    exit 1
fi

echo "🔧 Executando: python manage.py $@"
echo ""

docker-compose -f docker-compose.local.yml exec web python manage.py "$@"
