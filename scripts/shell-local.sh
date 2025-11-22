#!/bin/bash
# Script para abrir shell Django no ambiente local

echo "================================================"
echo "  DESTACK - Django Shell"
echo "================================================"
echo ""

docker-compose -f docker-compose.local.yml exec web python manage.py shell
