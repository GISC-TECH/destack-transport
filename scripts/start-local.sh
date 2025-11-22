#!/bin/bash
# Script para iniciar ambiente de desenvolvimento local

set -e

echo "================================================"
echo "  DESTACK - Ambiente de Desenvolvimento Local  "
echo "================================================"
echo ""

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ ERRO: Docker não está rodando!"
    echo "   Inicie o Docker Desktop e tente novamente."
    exit 1
fi

echo "✅ Docker está rodando"
echo ""

# Verificar se arquivo .env.local existe
if [ ! -f .env.local ]; then
    echo "⚠️  Arquivo .env.local não encontrado!"
    echo "   Copiando de .env.example..."
    cp .env.example .env.local
    echo "✅ Arquivo .env.local criado"
    echo "   IMPORTANTE: Revise as configurações em .env.local"
    echo ""
fi

# Parar containers existentes
echo "🛑 Parando containers existentes (se houver)..."
docker-compose -f docker-compose.local.yml down 2>/dev/null || true
echo ""

# Build das imagens
echo "🔨 Construindo imagens Docker..."
docker-compose -f docker-compose.local.yml build
echo ""

# Iniciar containers
echo "🚀 Iniciando containers..."
docker-compose -f docker-compose.local.yml up -d
echo ""

# Aguardar containers ficarem prontos
echo "⏳ Aguardando containers ficarem prontos..."
sleep 10

# Verificar status
echo ""
echo "📊 Status dos containers:"
docker-compose -f docker-compose.local.yml ps
echo ""

# Verificar logs
echo "📝 Últimas linhas do log:"
docker-compose -f docker-compose.local.yml logs --tail=20 web
echo ""

echo "================================================"
echo "✅ Ambiente iniciado com sucesso!"
echo ""
echo "📍 Acessos:"
echo "   - Aplicação: http://localhost:8001"
echo "   - Admin: http://localhost:8001/admin"
echo "   - API Swagger: http://localhost:8001/api/swagger/"
echo "   - PostgreSQL: localhost:5433"
echo "   - Redis: localhost:6380"
echo ""
echo "👤 Superusuário:"
echo "   Usuário: admin"
echo "   Senha: admin123"
echo ""
echo "📋 Comandos úteis:"
echo "   - Ver logs: docker-compose -f docker-compose.local.yml logs -f"
echo "   - Parar: docker-compose -f docker-compose.local.yml down"
echo "   - Reiniciar: docker-compose -f docker-compose.local.yml restart"
echo "   - Shell Django: docker-compose -f docker-compose.local.yml exec web python manage.py shell"
echo ""
echo "📚 Restaurar backup:"
echo "   ./scripts/restore-backup.sh"
echo "================================================"
