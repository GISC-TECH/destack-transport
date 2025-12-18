# ✅ Checklist de Download - DESTACK

Antes de baixar a pasta `destack` para seu PC local, verifique se todos os arquivos necessários estão presentes:

## 📦 Arquivos Essenciais

### Backups do Banco de Dados
- [ ] `backups/destack_backup_*.dump` (arquivo binário ~11MB)
- [ ] `backups/destack_backup_*.sql` (arquivo SQL texto)

### Configuração Docker
- [ ] `docker-compose.local.yml` (Docker Compose para dev local)
- [ ] `Dockerfile.local` (Dockerfile para dev local)
- [ ] `.env.local` (Variáveis de ambiente local)

### Scripts de Automação
- [ ] `scripts/start-local.sh` (Iniciar ambiente)
- [ ] `scripts/stop-local.sh` (Parar ambiente)
- [ ] `scripts/restore-backup.sh` (Restaurar backup)
- [ ] `scripts/logs-local.sh` (Ver logs)
- [ ] `scripts/shell-local.sh` (Django shell)
- [ ] `scripts/manage-local.sh` (Comandos manage.py)

### Documentação
- [ ] `README_LOCAL.md` (Guia completo de setup local)
- [ ] `QUICK_START.md` (Guia rápido)
- [ ] `README.md` (Documentação principal)

### Código Fonte
- [ ] `core/` (Configurações Django)
- [ ] `transport/` (App principal)
- [ ] `requirements.txt` (Dependências Python)
- [ ] `manage.py` (Django management)

## 🚫 Arquivos que NÃO devem estar presentes

- [ ] `.env` (produção - NÃO baixar!)
- [ ] `db.sqlite3` (banco local - será criado no Docker)
- [ ] `__pycache__/` (cache Python - ignorado pelo .gitignore)
- [ ] `staticfiles_collected/` (gerado automaticamente)
- [ ] `mediafiles/xml_*` (XMLs de produção - opcionalmente excluir por segurança)

## 📊 Verificação Final

Execute este comando na pasta `destack` para verificar:

```bash
cd /root/apps/destack
ls -lh backups/
ls -lh scripts/
ls -lh *.yml *.md
```

## 📝 Próximos Passos no seu PC Local

1. ✅ Baixar toda a pasta `destack`
2. ✅ Instalar Docker Desktop
3. ✅ Abrir terminal na pasta `destack`
4. ✅ Executar `./scripts/start-local.sh`
5. ✅ Aguardar containers iniciarem
6. ✅ (Opcional) Restaurar backup: `./scripts/restore-backup.sh`
7. ✅ Acessar http://localhost:8001

## 🔐 Segurança

⚠️ **IMPORTANTE:**
- Os backups contêm dados reais de produção
- Mantenha os arquivos de backup seguros
- Não compartilhe backups publicamente
- Use apenas para desenvolvimento local

## 💾 Tamanho Esperado

- Pasta completa: ~50-100MB (com backups)
- Sem backups: ~20-30MB
- Com node_modules (se houver): pode chegar a 200MB+

## ✅ Checklist Completo

- [ ] Todos os arquivos listados acima presentes
- [ ] Nenhum arquivo de produção (.env, logs sensíveis)
- [ ] Backups do banco de dados
- [ ] Scripts executáveis (chmod +x já aplicado)
- [ ] Documentação completa
- [ ] .gitignore configurado

**Data da preparação:** 2025-11-22
**Versão do sistema:** Django 5.0.6 + PostgreSQL 15 + Redis 7
