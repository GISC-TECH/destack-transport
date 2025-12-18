#!/bin/bash
# Script para restaurar backup do banco de dados

set -e

echo "================================================"
echo "  DESTACK - Restauração de Backup              "
echo "================================================"
echo ""

# Verificar se há backups disponíveis
if [ ! -d "backups" ] || [ -z "$(ls -A backups/*.dump 2>/dev/null)" ]; then
    echo "❌ ERRO: Nenhum backup encontrado em backups/"
    echo "   Certifique-se de que os arquivos .dump estão na pasta backups/"
    exit 1
fi

# Listar backups disponíveis
echo "📁 Backups disponíveis:"
echo ""
ls -lh backups/*.dump 2>/dev/null | awk '{print "   - " $9 " (" $5 ")"}'
echo ""

# Selecionar backup mais recente
LATEST_BACKUP=$(ls -t backups/*.dump 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ ERRO: Nenhum arquivo .dump encontrado!"
    exit 1
fi

echo "🎯 Backup selecionado: $LATEST_BACKUP"
echo ""

# Confirmação
read -p "⚠️  Isso irá SUBSTITUIR todos os dados atuais. Continuar? [s/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "❌ Operação cancelada."
    exit 0
fi

echo ""
echo "🔄 Iniciando restauração..."
echo ""

# Verificar se container está rodando
if ! docker-compose -f docker-compose.local.yml ps postgres | grep -q "Up"; then
    echo "⚠️  Container PostgreSQL não está rodando. Iniciando..."
    docker-compose -f docker-compose.local.yml up -d postgres
    echo "⏳ Aguardando PostgreSQL ficar pronto..."
    sleep 10
fi

# Copiar backup para dentro do container
echo "📋 Copiando backup para o container..."
docker cp "$LATEST_BACKUP" destack_postgres_local:/tmp/restore.dump

# Dropar conexões existentes
echo "🔌 Fechando conexões ativas..."
docker-compose -f docker-compose.local.yml exec -T postgres psql -U destack_user -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'destack_db' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Dropar e recriar banco
echo "🗑️  Recriando banco de dados..."
docker-compose -f docker-compose.local.yml exec -T postgres psql -U destack_user -d postgres -c "DROP DATABASE IF EXISTS destack_db;" 2>/dev/null || true
docker-compose -f docker-compose.local.yml exec -T postgres psql -U destack_user -d postgres -c "CREATE DATABASE destack_db OWNER destack_user;"

# Restaurar backup
echo "📥 Restaurando backup..."
docker-compose -f docker-compose.local.yml exec -T postgres pg_restore -U destack_user -d destack_db -v --no-owner --no-acl /tmp/restore.dump 2>&1 | grep -v "^pg_restore: " | tail -20

# Limpar arquivo temporário
docker-compose -f docker-compose.local.yml exec -T postgres rm /tmp/restore.dump

echo ""
echo "================================================"
echo "✅ Backup restaurado com sucesso!"
echo ""
echo "📊 Estatísticas do banco:"
docker-compose -f docker-compose.local.yml exec -T postgres psql -U destack_user -d destack_db -c "SELECT schemaname, tablename, n_live_tup as rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"
echo ""
echo "🔄 Reiniciando aplicação..."
docker-compose -f docker-compose.local.yml restart web
echo ""
echo "✅ Aplicação reiniciada!"
echo "================================================"
