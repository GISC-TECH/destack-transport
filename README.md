# Destack Transportes

Sistema de gestao de transporte para CT-e (Conhecimento de Transporte Eletronico) e MDF-e (Manifesto Eletronico de Documentos Fiscais).

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│                         Porta: 8002                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Dashboard  │  │   CT-e/MDF-e │  │  Cadastros  │             │
│  │   Paineis   │  │    Upload    │  │  Relatorios │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API REST (JSON)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Django + DRF)                      │
│                         Porta: 8001                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    APIs     │  │   Models    │  │   Admin     │             │
│  │  ViewSets   │  │ Serializers │  │  Django     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌───────────┐   ┌───────────┐   ┌───────────┐
       │ PostgreSQL│   │   Redis   │   │   Media   │
       │   :5433   │   │   :6380   │   │   Files   │
       └───────────┘   └───────────┘   └───────────┘
```

## Stack Tecnologica

### Backend
- **Django 5.0.6** - Framework web Python
- **Django REST Framework** - API REST
- **PostgreSQL 15** - Banco de dados
- **Redis 7** - Cache e sessoes
- **drf-yasg** - Documentacao Swagger/OpenAPI

### Frontend
- **React 18** - Biblioteca UI
- **Vite** - Build tool
- **React Router** - Roteamento SPA
- **Bootstrap 5** - Framework CSS
- **Chart.js** - Graficos

### Infraestrutura
- **Docker & Docker Compose** - Containerizacao
- **Nginx** (producao) - Proxy reverso

## Estrutura do Projeto

```
destack/
├── core/                    # Configuracoes Django
│   ├── settings.py          # Settings principal
│   ├── urls.py              # URLs raiz
│   ├── health.py            # Health check
│   └── simple_health.py     # Health check simples
│
├── transport/               # App principal
│   ├── models.py            # Modelos de dados
│   ├── admin/               # Admin Django
│   │   ├── __init__.py
│   │   ├── common.py        # Configs comuns
│   │   ├── vehicles.py      # Admin veiculos
│   │   ├── cliente.py       # Admin clientes
│   │   └── motorista.py     # Admin motoristas
│   │
│   ├── views/               # Views da API
│   │   ├── auth_views.py    # Autenticacao
│   │   ├── simple_auth.py   # Login/Logout simples
│   │   ├── cte_views.py     # CT-e endpoints
│   │   ├── mdfe_views.py    # MDF-e endpoints
│   │   ├── vehicle_views.py # Veiculos endpoints
│   │   ├── cliente_views.py # Clientes endpoints
│   │   ├── motorista_views.py # Motoristas endpoints
│   │   ├── payment_views.py # Pagamentos endpoints
│   │   ├── dashboard_views.py # Dashboard/Paineis
│   │   ├── config_views.py  # Configuracoes
│   │   ├── upload_views.py  # Upload XML
│   │   └── documento_views.py # Documentos anexos
│   │
│   ├── serializers/         # Serializers DRF
│   │   ├── __init__.py
│   │   ├── user_serializers.py
│   │   ├── vehicle_serializers.py
│   │   ├── cliente_serializers.py
│   │   └── motorista_serializers.py
│   │
│   ├── api_urls.py          # Rotas da API
│   ├── templates/           # Templates Django
│   │   └── index.html       # Redirect para frontend
│   └── static/img/          # Imagens estaticas
│
├── frontend/                # Aplicacao React
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   │   ├── Auth/        # Login
│   │   │   ├── Common/      # Sidebar, Header
│   │   │   ├── Dashboard/   # Dashboard principal
│   │   │   ├── Landing/     # Pagina inicial publica
│   │   │   ├── CTe/         # Gestao CT-e
│   │   │   ├── MDFe/        # Gestao MDF-e
│   │   │   ├── Veiculos/    # Cadastro veiculos
│   │   │   ├── Clientes/    # Cadastro clientes
│   │   │   ├── Motoristas/  # Cadastro motoristas
│   │   │   ├── Financeiro/  # Painel financeiro
│   │   │   ├── Manutencao/  # Manutencao veiculos
│   │   │   └── ...
│   │   ├── contexts/        # React Contexts
│   │   │   └── AuthContext.jsx
│   │   ├── services/        # API services
│   │   │   └── api.js       # Cliente API
│   │   ├── App.jsx          # App principal
│   │   └── main.jsx         # Entry point
│   │
│   ├── vite.config.js       # Config Vite + Proxy
│   └── package.json
│
├── scripts/                 # Scripts utilitarios
├── backups/                 # Backups do sistema
├── media/                   # Uploads de usuarios
│
├── docker-compose.local.yml # Docker dev local
├── Dockerfile               # Dockerfile producao
├── Dockerfile.local         # Dockerfile dev
├── requirements.txt         # Dependencias Python
└── manage.py                # CLI Django
```

## Funcionalidades

### Gestao de Documentos Fiscais
- **CT-e (Conhecimento de Transporte Eletronico)**
  - Upload e processamento de XML
  - Visualizacao e busca
  - Download de DACTE (PDF)
  - Cancelamento com justificativa
  - Controle de pagamento (Pago/Pendente)

- **MDF-e (Manifesto de Documentos Fiscais)**
  - Upload e processamento de XML
  - Vinculacao com CT-es
  - Encerramento de manifesto
  - Download de DAMDFE (PDF)

### Cadastros
- **Veiculos**
  - Cadastro completo da frota
  - Compartimentacao (tanques)
  - Controle de documentos (CRLV, etc)
  - Historico de manutencoes

- **Motoristas**
  - Dados pessoais e CNH
  - Documentos anexos
  - Vencimentos de habilitacao

- **Clientes**
  - Cadastro PJ/PF
  - Documentos anexos
  - Historico de fretes

### Financeiro
- **Pagamentos a Agregados**
  - Calculo por frete
  - Controle de status

- **Pagamentos Proprios**
  - Calculo por KM rodado
  - Faixas de valores

- **Faixas de KM**
  - Configuracao de valores por faixa

### Dashboards e Paineis
- Dashboard geral com indicadores
- Painel CT-e (estatisticas)
- Painel MDF-e (estatisticas)
- Painel Financeiro
- Painel Geografico (rotas)
- Painel de Manutencao

### Sistema
- **Autenticacao**
  - Login/Logout via API
  - Sessao Django
  - CSRF protection

- **Configuracoes**
  - Dados da empresa
  - Parametros do sistema

- **Backup/Restauracao**
  - Backup completo do banco
  - Restauracao de backups

- **Relatorios**
  - Exportacao CSV/XLSX/PDF
  - Filtros por periodo

## Instalacao e Execucao

### Pre-requisitos
- Docker e Docker Compose
- Git

### Desenvolvimento Local

1. **Clone o repositorio**
```bash
git clone https://github.com/GISC-TECH/destack-transport.git
cd destack-transport
```

2. **Configure as variaveis de ambiente**
```bash
cp .env.example .env.local
# Edite .env.local conforme necessario
```

3. **Inicie os containers**
```bash
docker-compose -f docker-compose.local.yml up -d --build
```

4. **Acesse o sistema**
- Frontend: http://localhost:8002
- Backend API: http://localhost:8001/api/
- Admin Django: http://localhost:8001/admin/
- Swagger: http://localhost:8001/api/swagger/

### Credenciais Padrao (Dev)
- **Usuario:** admin
- **Senha:** admin123

## API Endpoints

### Autenticacao
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/auth/login/` | Login |
| POST | `/api/auth/logout/` | Logout |
| GET | `/api/auth/csrf/` | Obter CSRF token |
| GET | `/api/auth/user/` | Verificar autenticacao |

### CT-e
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/ctes/` | Listar CT-es |
| GET | `/api/ctes/{id}/` | Detalhe CT-e |
| POST | `/api/ctes/{id}/cancelar/` | Cancelar CT-e |
| PATCH | `/api/ctes/{id}/pagamento/` | Marcar pagamento |
| GET | `/api/ctes/{id}/dacte/` | Download DACTE |
| GET | `/api/ctes/{id}/xml/` | Download XML |

### MDF-e
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/mdfes/` | Listar MDF-es |
| GET | `/api/mdfes/{id}/` | Detalhe MDF-e |
| POST | `/api/mdfes/{id}/encerrar/` | Encerrar MDF-e |
| POST | `/api/mdfes/{id}/cancelar/` | Cancelar MDF-e |
| GET | `/api/mdfes/{id}/damdfe/` | Download DAMDFE |

### Veiculos
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/veiculos/` | Listar veiculos |
| POST | `/api/veiculos/` | Criar veiculo |
| GET | `/api/veiculos/{id}/` | Detalhe veiculo |
| PUT | `/api/veiculos/{id}/` | Atualizar veiculo |
| DELETE | `/api/veiculos/{id}/` | Remover veiculo |
| GET | `/api/veiculos/{id}/compartimentos/` | Compartimentos |
| GET | `/api/veiculos/{id}/manutencoes/` | Manutencoes |
| GET | `/api/veiculos/{id}/documentos/` | Documentos |

### Clientes
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/clientes/` | Listar clientes |
| POST | `/api/clientes/` | Criar cliente |
| GET | `/api/clientes/{id}/` | Detalhe cliente |
| PUT | `/api/clientes/{id}/` | Atualizar cliente |
| DELETE | `/api/clientes/{id}/` | Remover cliente |

### Motoristas
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/motoristas/` | Listar motoristas |
| POST | `/api/motoristas/` | Criar motorista |
| GET | `/api/motoristas/{id}/` | Detalhe motorista |
| PUT | `/api/motoristas/{id}/` | Atualizar motorista |
| DELETE | `/api/motoristas/{id}/` | Remover motorista |

### Dashboard
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/dashboard/` | Dashboard geral |
| GET | `/api/painel/cte/` | Painel CT-e |
| GET | `/api/painel/mdfe/` | Painel MDF-e |
| GET | `/api/painel/financeiro/` | Painel financeiro |
| GET | `/api/painel/geografico/` | Painel geografico |

### Upload
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/upload/` | Upload XML individual |
| POST | `/api/upload/batch_upload/` | Upload em lote |

### Configuracoes
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/configuracoes/empresa/` | Dados empresa |
| GET | `/api/configuracoes/parametros/` | Parametros |
| POST | `/api/backup/gerar/` | Gerar backup |
| POST | `/api/backup/restaurar/` | Restaurar backup |

## Variaveis de Ambiente

```env
# Django
DEBUG=True
SECRET_KEY=sua-chave-secreta
ALLOWED_HOSTS=localhost,127.0.0.1

# Banco de dados
DB_NAME=destack_transport
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=postgres
DB_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:8002
```

## Comandos Uteis

```bash
# Logs do backend
docker logs destack_web_local -f

# Logs do frontend
docker logs destack_frontend_local -f

# Acessar shell do container
docker exec -it destack_web_local bash

# Executar migrations
docker exec destack_web_local python manage.py migrate

# Criar superusuario
docker exec -it destack_web_local python manage.py createsuperuser

# Coletar arquivos estaticos
docker exec destack_web_local python manage.py collectstatic --noinput

# Rebuild completo
docker-compose -f docker-compose.local.yml up -d --build
```

## Changelog

### v2.0.0 (Dezembro 2024)
- Migracao completa do frontend para React SPA
- Landing page movida para React
- Limpeza de templates Django (apenas redirect)
- Limpeza de arquivos estaticos legados
- Correcao de CSRF para login via API
- Organizacao da estrutura de arquivos
- Remocao de codigo duplicado
- Documentacao atualizada

### v1.0.0 (Novembro 2024)
- Versao inicial
- Backend Django + DRF
- Frontend hibrido (templates + JavaScript)
- Gestao de CT-e e MDF-e
- Cadastros basicos
- Dashboard inicial

## Licenca

MIT License - Veja o arquivo LICENSE para detalhes.

## Contato

- **Email:** contato@destacktransportes.com.br
- **GitHub:** https://github.com/GISC-TECH/destack-transport

---

## Atualizações Recentes

### 2026-02-25
- ✅ Senha do EGS Sistemas rotacionada (valor mantido apenas em `.env`, fora do versionamento)
- ✅ Rebuild do container scraper com Chrome 145
- ✅ Implementado healthcheck para auto-restart
- ✅ Atualizada documentação CLAUDE.md

### 2026-02-22
- ✅ Corrigido problema de acesso ao perfil EGS
- ✅ Robô voltou a baixar CT-es normalmente
- ✅ 895 registros processados

