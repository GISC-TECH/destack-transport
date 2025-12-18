# CTE/MDF-e API - Docker Deployment Guide

Este guia explica como configurar e executar a API CTE/MDF-e usando Docker com PostgreSQL, Redis, Celery e Nginx com HTTPS.

## 📋 Pré-requisitos

- Docker (versão 20.10+)
- Docker Compose (versão 2.0+)
- 4GB+ de RAM disponível
- 10GB+ de espaço em disco

## 🚀 Instalação Rápida

### 1. Clone e Configure

```bash
# Se ainda não estiver no diretório do projeto
cd cte_mdfe_api

# Tornar scripts executáveis
chmod +x docker_setup.sh generate_ssl_certs.sh

# Executar setup automático
./docker_setup.sh setup
```

### 2. Criar Usuário Admin

```bash
./docker_setup.sh createsuperuser
```

### 3. Acessar a Aplicação

- **HTTPS**: https://localhost
- **Admin**: https://localhost/admin/
- **API**: https://localhost/api/
- **Health Check**: https://localhost/api/health/

## 🔧 Configuração Manual

### 1. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar variáveis
nano .env
```

**Variáveis importantes:**
```env
DJANGO_SECRET_KEY=sua-chave-secreta-aqui
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,seu-dominio.com
DATABASE_PASSWORD=senha-segura
```

### 2. Gerar Certificados SSL

```bash
# Para desenvolvimento (auto-assinado)
./generate_ssl_certs.sh

# Para produção, substitua os arquivos em nginx/ssl/
# nginx/ssl/cert.pem
# nginx/ssl/key.pem
```

### 3. Construir e Iniciar

```bash
# Construir imagens
docker-compose build

# Iniciar serviços
docker-compose up -d

# Executar migrações
docker-compose exec web python manage.py migrate

# Criar superusuário
docker-compose exec web python manage.py createsuperuser
```

## 🛠️ Comandos Úteis

### Script de Gerenciamento

```bash
# Ver ajuda
./docker_setup.sh help

# Iniciar serviços
./docker_setup.sh start

# Parar serviços
./docker_setup.sh stop

# Reiniciar serviços
./docker_setup.sh restart

# Ver logs
./docker_setup.sh logs

# Ver status
./docker_setup.sh status

# Executar migrações
./docker_setup.sh migrate

# Reset completo (apaga dados!)
./docker_setup.sh reset
```

### Docker Compose Direto

```bash
# Ver logs de todos os serviços
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f web

# Executar comando no container
docker-compose exec web python manage.py shell

# Backup do banco
docker-compose exec db pg_dump -U postgres cte_mdfe_db > backup.sql

# Restaurar banco
docker-compose exec -T db psql -U postgres cte_mdfe_db < backup.sql
```

## 🏗️ Arquitetura dos Serviços

### Serviços Incluídos

1. **web** - Aplicação Django (Gunicorn)
   - Porta: 8000 (interna)
   - Health check: `/api/health/`

2. **db** - PostgreSQL 15
   - Porta: 5432
   - Volume: `postgres_data`

3. **redis** - Redis 7
   - Porta: 6379
   - Volume: `redis_data`

4. **celery** - Worker Celery
   - Processa tarefas assíncronas

5. **nginx** - Servidor Web/Proxy
   - Portas: 80, 443
   - SSL/TLS terminação
   - Serve arquivos estáticos

### Volumes Persistentes

- `postgres_data` - Dados do PostgreSQL
- `redis_data` - Dados do Redis
- `static_volume` - Arquivos estáticos
- `media_volume` - Arquivos de upload

## 🔒 Configuração HTTPS

### Desenvolvimento (Certificados Auto-assinados)

Os certificados são gerados automaticamente pelo script:

```bash
./generate_ssl_certs.sh
```

**⚠️ Aviso**: Navegadores mostrarão aviso de segurança. Clique em "Avançado" → "Prosseguir".

### Produção (Let's Encrypt)

1. **Configurar domínio** - Aponte seu domínio para o servidor

2. **Instalar Certbot**:
```bash
# No host (não no container)
sudo apt install certbot python3-certbot-nginx
```

3. **Gerar certificados**:
```bash
# Parar nginx temporariamente
docker-compose stop nginx

# Gerar certificados
sudo certbot certonly --standalone -d seu-dominio.com

# Copiar certificados
sudo cp /etc/letsencrypt/live/seu-dominio.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/seu-dominio.com/privkey.pem nginx/ssl/key.pem

# Ajustar permissões
sudo chown $USER:$USER nginx/ssl/*.pem

# Reiniciar nginx
docker-compose start nginx
```

4. **Renovação automática**:
```bash
# Adicionar ao crontab
0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx
```

## 🔧 Modo Desenvolvimento

Para desenvolvimento com hot reload:

```bash
# Usar arquivo de desenvolvimento
docker-compose -f docker-compose.dev.yml up -d

# O código é montado como volume para edição em tempo real
# Debug está habilitado
# Servidor de desenvolvimento Django em vez do Gunicorn
```

## 📊 Monitoramento e Logs

### Health Checks

- **Aplicação**: https://localhost/api/health/
- **Nginx**: Configurado para verificar upstreams
- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`

### Logs

```bash
# Todos os logs
docker-compose logs -f

# Por serviço
docker-compose logs -f web
docker-compose logs -f nginx
docker-compose logs -f db

# Logs do Django (arquivo)
tail -f logs/django.log
```

## 🛡️ Segurança

### Configurações de Produção

1. **Variáveis de ambiente obrigatórias**:
   - `DJANGO_SECRET_KEY` - Chave única de 50+ caracteres
   - `DATABASE_PASSWORD` - Senha forte para PostgreSQL
   - `DJANGO_ALLOWED_HOSTS` - Domínios permitidos

2. **Headers de segurança** (já configurados):
   - HSTS (comentado por padrão)
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection

3. **Rate limiting** (já configurado):
   - API: 10 requests/segundo
   - Login: 5 requests/minuto

### Backup

```bash
# Script de backup automático
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T db pg_dump -U postgres cte_mdfe_db > "backup_${DATE}.sql"
tar -czf "media_backup_${DATE}.tar.gz" mediafiles/
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**:
```bash
# Verificar se o PostgreSQL está rodando
docker-compose ps db
docker-compose logs db
```

2. **Certificados SSL inválidos**:
```bash
# Regenerar certificados
rm -rf nginx/ssl/*
./generate_ssl_certs.sh
docker-compose restart nginx
```

3. **Erro de migração**:
```bash
# Executar migrações manualmente
docker-compose exec web python manage.py migrate --fake-initial
```

4. **Problema de permissões**:
```bash
# Ajustar permissões dos volumes
docker-compose exec web chown -R app:app /app/mediafiles
```

### Comandos de Diagnóstico

```bash
# Status de todos os serviços
docker-compose ps

# Usar dentro do container Django
docker-compose exec web python manage.py shell

# Verificar configurações
docker-compose exec web python manage.py check --deploy

# Ver variáveis de ambiente
docker-compose exec web env | grep DJANGO
```

## 📝 Próximos Passos

1. **Configurar domínio real** e certificados SSL de produção
2. **Configurar backup automático** do banco e arquivos
3. **Monitoramento** com Prometheus/Grafana (opcional)
4. **Load balancer** para múltiplas instâncias (opcional)
5. **CI/CD pipeline** para deploy automatizado

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Verificar logs: `./docker_setup.sh logs`
2. Consultar este README
3. Verificar issues no repositório do projeto