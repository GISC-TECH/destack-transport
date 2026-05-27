# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Destack Transport** is a full-stack transport management system for CT-e (Conhecimento de Transporte Eletronico) and MDF-e (Manifesto de Documentos Fiscais Eletronico) document processing. It manages electronic transport documents, clients, drivers, vehicles, payments, and fleet maintenance for Brazilian transport companies.

## Technology Stack

- **Backend:** Django 5.0.6 + Django REST Framework
- **Frontend:** React 18 + Vite + Recharts
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **Infrastructure:** Docker, Docker Compose

## Current Production Status

Last verified: 2026-05-27 00:55 UTC.

Production host and repo:
- SSH host: `31.97.247.165`
- Repository path: `/root/apps/destack`
- Branch: `main`
- Synced commit: `64de607 chore: sync production deployment config`
- Remote: `git@github.com:GISC-TECH/destack-transport.git`

Public access:
- Public URL: `https://destacktransporte.site/`
- HTTPS check returned `HTTP/2 200`.
- TLS verification passed for `destacktransporte.site`.
- Current certificate expires at `2026-07-24 19:32:27 UTC`.

Certbot status:
- `systemctl --failed` returned zero failed units.
- `certbot.service` last run completed with `status=0/SUCCESS`.
- Active certificates on this server are only:
  - `destacktransporte.site` / `www.destacktransporte.site`
  - `fabrafarma.com.br` / `www.fabrafarma.com.br`
- Obsolete certificates removed from Certbot on 2026-05-26 UTC:
  - `admin.mypila.gisctech.com.br`
  - `flutter.mypila.gisctech.com.br`
  - `gisctech.com.br`
  - `mypila.gisctech.com.br`

Runtime layout:
- Public reverse proxy is managed by the `/root/apps` compose project.
- Public Nginx container: `nginx_multi_django` (`healthy`).
- Destack frontend container served by public proxy: `destack_frontend_app` (`healthy`).
- Destack backend container served by public proxy: `destack_app` (`healthy`).
- Separate Destack app stack lives in `/root/apps/destack` and includes `destack_web`, `destack_postgres`, `destack_redis`, and `destack_scraper`.
- `destack_scraper` currently has no Docker health state in this compose stack; confirm it through process/log checks until a healthcheck is added and the container is recreated.

Health checks verified:
```bash
curl -fsS http://localhost:8001/health/
curl -fsS http://localhost:8000/health/
curl -k -fsS https://localhost/health/
```

All three returned:
```json
{"status": "healthy", "message": "Django is running"}
```

Recent log scan:
- `nginx_multi_django`: no recent `error`, `critical`, `certificate`, or upstream failure lines in the last hour.
- `destack_app`: no recent `error`, `exception`, `traceback`, or critical failure lines in the last hour.
- `destack_scraper`: no recent error/traceback lines in the last two hours.

Known non-blocking maintenance:
- GitHub Dependabot reported 43 vulnerabilities on `GISC-TECH/destack-transport` after the latest push. Treat this as dependency maintenance, not an active outage.
- Credentials that appeared in older history should be rotated; current committed files must not contain real passwords.

## Development Commands

### Docker Environment (Recommended)
```bash
# Start all services (PostgreSQL, Redis, Django, React)
docker-compose -f docker-compose.local.yml up -d --build

# Rebuild specific service after code changes
docker-compose -f docker-compose.local.yml up -d --build web      # Backend
docker-compose -f docker-compose.local.yml up -d --build frontend # Frontend

# View logs
docker logs destack_web_local -f
docker logs destack_frontend_local -f

# Stop all services
docker-compose -f docker-compose.local.yml down
```

### Backend (Django) - Inside Container
```bash
# Run migrations
docker exec destack_web_local python manage.py migrate

# Create superuser
docker exec -it destack_web_local python manage.py createsuperuser

# Create new migrations after model changes
docker exec destack_web_local python manage.py makemigrations transport --name descriptive_name

# Django shell
docker exec -it destack_web_local python manage.py shell
```

### Frontend (React/Vite)
```bash
cd frontend
npm install
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run lint     # Run ESLint
```

### Access Points (Docker)
| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:8002 | React SPA |
| Backend API | http://localhost:8001/api/ | REST API |
| Swagger | http://localhost:8001/api/swagger/ | API Documentation |
| ReDoc | http://localhost:8001/api/redoc/ | API Documentation (alternative) |
| Django Admin | http://localhost:8001/admin/ | Admin interface |

### Default Credentials (Dev)
Do not document or commit real passwords. Create local development users with `createsuperuser` or define local-only credentials in `.env.local`.

## Architecture

```
Frontend (React :8002)  -->  Vite Proxy  -->  Backend (Django :8001)  -->  PostgreSQL/Redis
```

### Backend Structure
```
transport/
├── models.py           # All database models
├── api_urls.py         # API route definitions (main routing file)
├── views/              # ViewSets organized by feature
│   ├── auth_views.py       # CSRF token, check auth
│   ├── simple_auth.py      # Login/Logout (csrf_exempt)
│   ├── cte_views.py        # CT-e operations
│   ├── mdfe_views.py       # MDF-e operations
│   ├── dashboard_views.py  # Dashboard and analytics
│   ├── cliente_views.py    # Client CRUD
│   ├── motorista_views.py  # Driver CRUD
│   ├── vehicle_views.py    # Vehicle CRUD + maintenance
│   ├── payment_views.py    # Payment processing
│   ├── upload_views.py     # XML file upload
│   ├── config_views.py     # System configuration
│   └── documento_views.py  # Document attachments
├── serializers/        # DRF serializers
├── admin/              # Django admin configurations
└── migrations/         # Database migrations

core/
├── settings.py         # Django settings
├── urls.py             # Root URL config (includes api_urls)
└── health.py           # Health check endpoint
```

### Frontend Structure
```
frontend/src/
├── App.jsx             # Main routing configuration
├── main.jsx            # Entry point
├── services/api.js     # Centralized API client (all endpoints)
├── contexts/AuthContext.jsx  # Authentication state
└── components/
    ├── Landing/        # Public landing page
    ├── Auth/           # Login
    ├── Dashboard/      # Main dashboard
    ├── CTe/            # CT-e management
    ├── MDFe/           # MDF-e management
    ├── Clientes/       # Client management
    ├── Motoristas/     # Driver management
    ├── Veiculos/       # Vehicle management
    ├── Financeiro/     # Financial dashboard
    ├── Pagamentos/     # Payment management
    ├── Manutencao/     # Maintenance
    ├── Upload/         # XML upload
    ├── Configuracoes/  # Settings
    ├── Relatorios/     # Reports
    └── Common/         # Shared (Sidebar, Header, Loading)
```

## Key Patterns

### Adding a New API Endpoint
1. Create/update ViewSet in `transport/views/`
2. Create/update Serializer in `transport/serializers/`
3. Register route in `transport/api_urls.py`
4. Add API method in `frontend/src/services/api.js`

### Adding a New Frontend Page
1. Create component in `frontend/src/components/FeatureName/`
2. Add CSS file in same directory
3. Add route in `frontend/src/App.jsx`
4. Add navigation link in `frontend/src/components/Common/Sidebar.jsx`

### Database Changes
1. Modify models in `transport/models.py`
2. Create migration: `docker exec destack_web_local python manage.py makemigrations transport --name descriptive_name`
3. Apply migration: `docker exec destack_web_local python manage.py migrate`
4. Rebuild: `docker-compose -f docker-compose.local.yml up -d --build web`

### Adding Custom ViewSet Actions
```python
from rest_framework.decorators import action
from rest_framework.response import Response

@action(detail=True, methods=['patch'], url_path='custom-action')
def custom_action(self, request, pk=None):
    instance = self.get_object()
    # ... business logic
    return Response({'status': 'success'})
```

## Authentication

- Login/Logout handled by `transport/views/simple_auth.py` with `@csrf_exempt`
- Routes defined in `core/urls.py`: `/api/auth/login/`, `/api/auth/logout/`
- CSRF token endpoint: `/api/auth/csrf/` (in `api_urls.py`)
- Auth check endpoint: `/api/auth/user/` (in `api_urls.py`)
- CSRF cookie name: `cte_mdfe_csrftoken` (in `core/settings.py`)
- Frontend must include `credentials: 'include'` in fetch requests
- POST/PUT/DELETE requests require `X-CSRFToken` header

## API Response Patterns

List views return **flattened fields**:
- CT-e: `numero_cte`, `data_emissao`, `remetente_nome`, `destinatario_nome`, `valor_total`, `status`, `pago`
- MDF-e: `numero_mdfe`, `data_emissao`, `uf_inicio`, `uf_fim`, `placa_tracao`, `documentos_count`, `status`

Detail views return full nested objects with related data.

## Docker Services

| Service | Internal Port | External Port |
|---------|--------------|---------------|
| postgres | 5432 | 5433 |
| redis | 6379 | 6380 |
| web (Django) | 8000 | 8001 |
| frontend (Vite) | 8000 | 8002 |

## Environment Variables

Real credentials belong only in ignored environment files (`.env`, `.env.local`) on the server or developer machine. Do not commit real passwords, access keys, or tokens.

Key local variables in `.env.local`:
```
DJANGO_SECRET_KEY=change_me
DEBUG=True
DATABASE_URL=postgresql://destack_user:change_me@postgres:5432/destack_db
REDIS_URL=redis://redis:6379/0
EGS_USERNAME=DESTACK
EGS_PASSWORD=change_me
EGS_ACCESS_KEY=change_me
DESTACK_USERNAME=admin
DESTACK_PASSWORD=change_me
```

Production `docker-compose.yml` requires these scraper credentials from the server `.env` file:
- `EGS_PASSWORD`
- `EGS_ACCESS_KEY`
- `DESTACK_PASSWORD`

## Model Relationships

- `CTeDocumento` has OneToOne with `CTeIdentificacao`, `CTeEmitente`, `CTeRemetente`, `CTEDestinatario`, `CTePrestacaoServico`
- `MDFeDocumento` has OneToOne with `MDFeIdentificacao`, `MDFeEmitente`, `MDFeVeiculoTracao`
- `Veiculo` has ForeignKey to `Cliente` (owner) and many `CompartimentacaoVeiculo`
- `PagamentoAgregado` links to `Motorista` and optionally to `CTeDocumento`

## XML Processing Flow

1. XML uploaded via `/api/upload/` or `/api/upload/batch_upload/`
2. `UnifiedUploadViewSet` detects document type (CT-e or MDF-e)
3. Parser extracts data from XML
4. Creates main document + related records in transaction
5. Sets `processado=True` on success

## CSS Breakpoints

All components use:
- Desktop: > 1024px
- Tablet: 768px - 1024px
- Mobile: < 768px
- Small mobile: < 480px

## Quick Testing

```bash
# Health check
curl http://localhost:8001/api/health/

# Login test - replace with local-only credentials
curl -X POST http://localhost:8001/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"<local-user>","password":"<local-password>"}'

# Container status
docker-compose -f docker-compose.local.yml ps
```

## Production Operations

Common checks on the server:
```bash
cd /root/apps/destack
git status --short
git log -1 --oneline --decorate
docker compose config --quiet
docker compose ps

cd /root/apps
docker compose ps

systemctl --failed --no-pager
systemctl status certbot --no-pager -l
certbot certificates
```

Certificate renewal hook:
- Versioned reference: `deploy/certbot/reload-docker-nginx.sh`
- Live hook path: `/etc/letsencrypt/renewal-hooks/deploy/reload-docker-nginx.sh`
- Purpose: reload `nginx_multi_django` after Certbot renews a certificate so Nginx serves the new cert immediately.

Production Nginx reference:
- Versioned reference: `deploy/nginx/destack.conf`
- Live public config: `/root/apps/nginx/sites/destack.conf`
- Public Nginx config is mounted into container `nginx_multi_django`.

Secret hygiene:
- `.env`, `.env.local`, logs, media/static outputs, SQL/dump backups, `node_modules`, and Python caches are intentionally ignored.
- Never add real EGS, Django, database, Redis, SSH, or GitHub credentials to committed files.
- If a credential appears in Git history, rotate it instead of relying only on deletion from the latest commit.
