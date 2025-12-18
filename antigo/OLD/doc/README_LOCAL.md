# DESTACK - Guia de Desenvolvimento Local

Este guia mostra como configurar e rodar o projeto DESTACK localmente usando Docker.

## 📋 Pré-requisitos

- **Docker Desktop** instalado e rodando
  - Windows/Mac: [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
  - Linux: Docker Engine + Docker Compose
- **Git** instalado
- **Mínimo 4GB de RAM livre**
- **Mínimo 10GB de espaço em disco**

## 🚀 Início Rápido

### 1. Clone o Repositório (ou baixe a pasta completa)

```bash
# Se clonar do GitHub:
git clone git@github.com:GISC-TECH/destack-transport.git
cd destack-transport

# Se baixou a pasta:
cd destack
```

### 2. Inicie o Ambiente

```bash
./scripts/start-local.sh
```

Este script irá:
- ✅ Verificar se Docker está rodando
- ✅ Criar arquivo `.env.local` se não existir
- ✅ Construir as imagens Docker
- ✅ Iniciar PostgreSQL, Redis e Django
- ✅ Aplicar migrações do banco de dados
- ✅ Criar superusuário (admin/admin123)
- ✅ Coletar arquivos estáticos

### 3. Acesse a Aplicação

Aguarde cerca de 1-2 minutos após o script terminar, então acesse:

- **Aplicação Principal**: http://localhost:8001
- **Admin Django**: http://localhost:8001/admin
- **API Swagger (Documentação)**: http://localhost:8001/api/swagger/
- **API ReDoc**: http://localhost:8001/api/redoc/

**Credenciais de acesso:**
- Usuário: `admin`
- Senha: `admin123`

## 📦 Restaurar Backup de Produção

Se você tem um backup do banco de dados de produção:

### 1. Coloque o arquivo de backup na pasta `backups/`

```bash
# Certifique-se que o arquivo .dump está em backups/
ls -lh backups/
```

### 2. Execute o script de restauração

```bash
./scripts/restore-backup.sh
```

Este script irá:
- Listar backups disponíveis
- Selecionar o backup mais recente
- Pedir confirmação
- Restaurar o backup no banco local
- Reiniciar a aplicação

⚠️ **ATENÇÃO**: Isso irá **SUBSTITUIR** todos os dados atuais!

## 🛠️ Scripts Úteis

Todos os scripts estão em `scripts/` e podem ser executados diretamente:

### Gerenciamento de Containers

```bash
# Iniciar ambiente
./scripts/start-local.sh

# Parar ambiente (mantém dados)
./scripts/stop-local.sh

# Parar e remover volumes (APAGA DADOS!)
docker-compose -f docker-compose.local.yml down -v
```

### Visualizar Logs

```bash
# Logs da aplicação web
./scripts/logs-local.sh web

# Logs do PostgreSQL
./scripts/logs-local.sh postgres

# Logs do Redis
./scripts/logs-local.sh redis
```

### Django Management Commands

```bash
# Executar comandos manage.py
./scripts/manage-local.sh migrate
./scripts/manage-local.sh makemigrations
./scripts/manage-local.sh createsuperuser
./scripts/manage-local.sh collectstatic

# Shell Django
./scripts/shell-local.sh

# Ou usando o script manage
./scripts/manage-local.sh shell
```

### Acesso Direto aos Containers

```bash
# Shell bash no container web
docker-compose -f docker-compose.local.yml exec web bash

# Shell PostgreSQL
docker-compose -f docker-compose.local.yml exec postgres psql -U destack_user -d destack_db

# Redis CLI
docker-compose -f docker-compose.local.yml exec redis redis-cli
```

## 📁 Estrutura do Projeto

```
destack/
├── backups/                    # Backups do banco de dados (.dump, .sql)
├── core/                       # Configurações Django
├── transport/                  # App principal
│   ├── models.py              # Modelos (50+ modelos)
│   ├── views/                 # ViewSets da API
│   ├── serializers/           # Serializers DRF
│   ├── services/              # Parsers XML e geradores PDF
│   └── admin/                 # Django Admin customizado
├── scripts/                   # Scripts de automação
├── .env.local                 # Configurações de desenvolvimento
├── docker-compose.local.yml   # Docker Compose para dev
├── Dockerfile.local           # Dockerfile para dev
├── requirements.txt           # Dependências Python
└── README_LOCAL.md           # Este arquivo
```

## 🔧 Desenvolvimento

### Hot Reload

O código local está montado no container via volume. Qualquer alteração em arquivos Python será automaticamente detectada e o servidor será recarregado.

**Exceções** (necessitam restart manual):
- Alterações em `settings.py`
- Novos arquivos criados
- Mudanças em templates (às vezes)

Para restart manual:
```bash
docker-compose -f docker-compose.local.yml restart web
```

### Criar Novas Migrações

```bash
# Fazer alterações nos models.py

# Criar migrações
./scripts/manage-local.sh makemigrations

# Aplicar migrações
./scripts/manage-local.sh migrate
```

### Instalar Novas Dependências

```bash
# 1. Adicionar ao requirements.txt
echo "new-package==1.0.0" >> requirements.txt

# 2. Rebuild da imagem
docker-compose -f docker-compose.local.yml build web

# 3. Restart do container
docker-compose -f docker-compose.local.yml up -d web
```

### Debug com IPython

O IPython já está instalado no container. Para debug:

```python
# Adicione no código onde quer debugar:
import ipdb; ipdb.set_trace()
```

Depois acesse o container:
```bash
docker attach destack_web_local
```

## 🧪 Testes

```bash
# Executar todos os testes (quando implementados)
./scripts/manage-local.sh test

# Executar testes específicos
./scripts/manage-local.sh test transport.tests.test_models

# Com pytest (se configurado)
docker-compose -f docker-compose.local.yml exec web pytest
```

## 🐛 Troubleshooting

### Erro: "Container não inicia"

```bash
# Ver logs detalhados
./scripts/logs-local.sh web

# Verificar status
docker-compose -f docker-compose.local.yml ps
```

### Erro: "Port already in use"

Se as portas 8001, 5433 ou 6380 estão em uso:

**Opção 1**: Parar outros serviços nessas portas

**Opção 2**: Alterar portas no `docker-compose.local.yml`:
```yaml
services:
  web:
    ports:
      - "8002:8000"  # Mude para 8002
```

### Erro: "Database connection failed"

```bash
# Verificar se PostgreSQL está rodando
docker-compose -f docker-compose.local.yml ps postgres

# Reiniciar PostgreSQL
docker-compose -f docker-compose.local.yml restart postgres

# Aguardar alguns segundos e reiniciar web
docker-compose -f docker-compose.local.yml restart web
```

### Resetar Completamente o Ambiente

```bash
# Parar e remover tudo (APAGA DADOS!)
docker-compose -f docker-compose.local.yml down -v

# Limpar imagens (opcional)
docker-compose -f docker-compose.local.yml down --rmi all

# Reiniciar do zero
./scripts/start-local.sh
```

## 🔌 Conexões Externas

### Conectar ao PostgreSQL com cliente externo

```
Host: localhost
Port: 5433
Database: destack_db
User: destack_user
Password: destack_local_password
```

### Conectar ao Redis com cliente externo

```
Host: localhost
Port: 6380
No password
```

## 📊 Endpoints da API

Principais endpoints disponíveis:

| Endpoint | Descrição |
|----------|-----------|
| `/api/swagger/` | Documentação Swagger interativa |
| `/api/redoc/` | Documentação ReDoc |
| `/api/token/` | Obter JWT token |
| `/api/ctes/` | Listar/criar CT-es |
| `/api/mdfes/` | Listar/criar MDF-es |
| `/api/upload/` | Upload de XML |
| `/api/dashboard/` | Dashboard geral |
| `/admin/` | Django Admin |

## 🔐 Segurança

⚠️ **IMPORTANTE**: As configurações em `.env.local` são APENAS para desenvolvimento local!

**NUNCA use em produção:**
- ❌ `DEBUG=True`
- ❌ `ALLOWED_HOSTS=*`
- ❌ Senhas fracas (`admin123`, `destack_local_password`)
- ❌ `DJANGO_SECRET_KEY` padrão

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `./scripts/logs-local.sh web`
2. Verifique a documentação: `README.md`
3. Consulte os issues no GitHub
4. Entre em contato com a equipe de desenvolvimento

## 📝 Próximos Passos

Após configurar o ambiente local:

1. ✅ Explorar a API via Swagger: http://localhost:8001/api/swagger/
2. ✅ Acessar o Admin: http://localhost:8001/admin
3. ✅ Testar upload de XMLs (CT-e/MDF-e)
4. ✅ Explorar os modelos de dados
5. ✅ Começar a desenvolver!

---

**Desenvolvido por GISC-TECH** | Última atualização: 2025-11-22
