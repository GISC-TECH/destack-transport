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
- **Username:** admin
- **Password:** admin123

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

Key variables in `.env.local`:
```
DJANGO_SECRET_KEY=...
DEBUG=True
DATABASE_URL=postgresql://destack_user:password@postgres:5432/destack_db
REDIS_URL=redis://redis:6379/0
```

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

# Login test
curl -X POST http://localhost:8001/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Container status
docker-compose -f docker-compose.local.yml ps
```
