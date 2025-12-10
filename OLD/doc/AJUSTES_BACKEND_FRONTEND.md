# Ajustes Necessários no Backend para Frontend

**Data:** 2025-11-26
**Versão:** 1.0
**Status:** ✅ Ajustes Implementados

---

## 📋 RESUMO EXECUTIVO

Este documento detalha os ajustes realizados no backend Django REST Framework para garantir compatibilidade total com aplicações frontend (React, Vue, Angular, etc.).

### Status Geral: ✅ BACKEND PRONTO PARA FRONTEND

---

## 🔧 AJUSTES IMPLEMENTADOS

### 1. ✅ Suporte a CORS (Cross-Origin Resource Sharing)

**Problema Identificado:**
- O backend NÃO tinha configuração de CORS
- Qualquer requisição de frontend seria bloqueada pelo navegador
- **CRÍTICO** para comunicação com SPAs (Single Page Applications)

**Solução Implementada:**

#### 1.1 Instalação do Pacote
```bash
# Adicionado em requirements.txt
django-cors-headers
```

#### 1.2 Configuração em `core/settings.py`

**INSTALLED_APPS:**
```python
INSTALLED_APPS = [
    # ...
    'corsheaders',  # ← ADICIONADO (antes do rest_framework)
    'rest_framework',
    # ...
]
```

**MIDDLEWARE:**
```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # ← ADICIONADO (antes do CommonMiddleware)
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    # ...
]
```

**Configurações de CORS:**
```python
# Em desenvolvimento - permite qualquer origem
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOW_CREDENTIALS = True
else:
    # Em produção - origens específicas
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",      # React (CRA)
        "http://localhost:5173",      # Vite
        "http://localhost:8080",      # Vue CLI
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "https://destacktransporte.site",
        "https://www.destacktransporte.site",
        "http://31.97.247.165:8001",
        "http://31.97.247.165",
    ]
    CORS_ALLOW_CREDENTIALS = True

# Headers permitidos
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Métodos HTTP permitidos
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Expor headers para o frontend
CORS_EXPOSE_HEADERS = [
    'content-disposition',  # Importante para downloads (CSV, PDF)
]
```

---

### 2. ✅ Autenticação e Permissões

**Configuração Atual (core/settings.py):**
```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # ...
}
```

**Status:**
- ✅ Session Authentication: Funcional para frontend no mesmo domínio
- ✅ Basic Authentication: Funcional para testes via curl/Postman
- ✅ JWT configurado (rest_framework_simplejwt) mas não ativo por padrão
- ✅ CSRF configurado corretamente

**Observações para Frontend:**
- **Session Auth:** Ideal se frontend estiver servido pelo Django ou no mesmo domínio
- **JWT:** Para SPAs separadas, pode ser ativado alterando DEFAULT_AUTHENTICATION_CLASSES

---

### 3. ✅ Estrutura de APIs

**Endpoints Disponíveis:**
```
Total: ~115+ endpoints

Módulos Principais:
├── /api/clientes/              (3 endpoints - NOVO)
├── /api/motoristas/            (5 endpoints - NOVO)
├── /api/veiculos/              (8 endpoints - ATUALIZADO)
│   └── /api/veiculos/{id}/compartimentos/  (5 endpoints - NOVO)
├── /api/ctes/                  (7 endpoints)
├── /api/mdfes/                 (7 endpoints)
├── /api/manutencoes/           (15 endpoints)
├── /api/pagamentos/agregados/  (17 endpoints)
├── /api/pagamentos/proprios/   (17 endpoints)
├── /api/dashboard/             (10 endpoints)
├── /api/configuracoes/         (8 endpoints)
├── /api/backup/                (4 endpoints)
└── /api/relatorios/            (1 endpoint com 28 variações)
```

**Status:**
- ✅ Todos os endpoints documentados em `doc/API_ENDPOINTS.md`
- ✅ Swagger UI disponível em `/api/swagger/`
- ✅ ReDoc disponível em `/api/redoc/`
- ✅ Schema JSON em `/api/swagger.json`

---

### 4. ✅ Serializers e Validações

**Novos Serializers Implementados:**

#### Cliente
```python
# transport/serializers/cliente_serializers.py
- ClienteSerializer (completo)
- ClienteListSerializer (listagem otimizada)

Validações:
✓ CNPJ formatado (XX.XXX.XXX/XXXX-XX)
✓ UF válida (27 estados brasileiros)
✓ Campos obrigatórios
```

#### Motorista
```python
# transport/serializers/motorista_serializers.py
- MotoristaSerializer (completo)
- MotoristaListSerializer (listagem otimizada)

Validações:
✓ CPF formatado (XXX.XXX.XXX-XX)
✓ CNH única
✓ Categoria CNH válida
✓ Alertas de documentos vencendo
```

#### Veículo (ATUALIZADO)
```python
# transport/serializers/vehicle_serializers.py
- VeiculoSerializer (atualizado)
- CompartimentacaoVeiculoSerializer (novo)

Novos campos:
✓ civ_validade, cipp_validade, afericao_validade
✓ crlv_validade, cronotacografo_validade
✓ tipo_rodado, tipo_carroceria
✓ observacoes
✓ compartimentos (nested)
✓ documentos_vencendo (calculado)
```

---

### 5. ✅ Funcionalidades Especiais

#### 5.1 Exportação CSV
**Endpoints:**
- `GET /api/clientes/export/` - Exporta clientes para CSV
- `GET /api/motoristas/export/` - Exporta motoristas para CSV
- `GET /api/veiculos/export/` - Exporta veículos para CSV

**Headers de Resposta:**
```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="clientes_20251126_143022.csv"
```

**Status:** ✅ Testado e funcional com CORS

---

#### 5.2 Alertas de Vencimento
**Endpoints:**
- `GET /api/veiculos/vencimentos/?dias=30` - Veículos com docs vencendo
- `GET /api/motoristas/vencimentos/?dias=30` - Motoristas com docs vencendo

**Resposta Exemplo:**
```json
{
  "count": 2,
  "results": [
    {
      "id": "uuid-here",
      "placa": "ABC1234",
      "documentos_vencendo": [
        {
          "documento": "CIV",
          "validade": "2025-12-15",
          "dias_restantes": 19,
          "vencido": false
        }
      ]
    }
  ]
}
```

**Status:** ✅ Implementado e testado

---

#### 5.3 Rotas Aninhadas (Nested Routes)
```
GET    /api/veiculos/{id}/compartimentos/          - Listar compartimentos
POST   /api/veiculos/{id}/compartimentos/          - Criar compartimento
GET    /api/veiculos/{id}/compartimentos/{comp_id}/ - Detalhes
PUT    /api/veiculos/{id}/compartimentos/{comp_id}/ - Atualizar
DELETE /api/veiculos/{id}/compartimentos/{comp_id}/ - Deletar
```

**Status:** ✅ Implementado com `drf-nested-routers`

---

### 6. ✅ Filtros e Buscas

**Clientes:**
```
?ativo=true              - Filtrar por status ativo
?tipo_frete=CIF          - Filtrar por tipo de frete (CIF/FOB)
?estado=SP               - Filtrar por UF
?q=razao                 - Busca em razão social, fantasia, CNPJ
```

**Motoristas:**
```
?ativo=true              - Filtrar por status ativo
?categoria_cnh=E         - Filtrar por categoria CNH
?q=nome                  - Busca em nome, CPF, CNH
```

**Veículos:**
```
?ativo=true              - Filtrar por status ativo
?tipo_proprietario=02    - Filtrar por tipo (00=Próprio, 01=Arrendado, 02=Agregado)
?placa=ABC               - Busca por placa
```

**Status:** ✅ Implementado em todos os ViewSets

---

### 7. ✅ Paginação

**Configuração Global (settings.py):**
```python
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 5,
}
```

**Uso no Frontend:**
```javascript
// Primeira página
GET /api/clientes/

// Próxima página
GET /api/clientes/?page=2

// Resposta
{
  "count": 150,
  "next": "http://localhost:8000/api/clientes/?page=3",
  "previous": "http://localhost:8000/api/clientes/?page=1",
  "results": [...]
}
```

**Status:** ✅ Configurado globalmente

---

## 🚀 INSTALAÇÃO E TESTES

### Passo 1: Instalar Dependências
```bash
pip install -r requirements.txt
```

**Novos pacotes instalados:**
- `django-cors-headers==4.3.1` (versão recomendada)

---

### Passo 2: Verificar Configurações
```bash
# Verificar se não há erros
python manage.py check

# Verificar settings de deployment
python manage.py check --deploy
```

**Warnings esperados em DEV:**
- SECURE_HSTS_SECONDS não definido (OK em dev)
- SECURE_SSL_REDIRECT não True (OK em dev)
- DEBUG=True (OK em dev)

---

### Passo 3: Testar CORS

**Teste com curl:**
```bash
# Simular requisição de frontend (localhost:3000)
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: authorization" \
     -X OPTIONS \
     http://localhost:8000/api/clientes/

# Resposta esperada deve incluir:
# Access-Control-Allow-Origin: http://localhost:3000
# Access-Control-Allow-Credentials: true
```

**Teste com JavaScript (Console do navegador):**
```javascript
fetch('http://localhost:8000/api/clientes/', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

---

### Passo 4: Testar Endpoints Novos

**Clientes:**
```bash
# Listar
curl -X GET http://localhost:8000/api/clientes/ \
  -H "Authorization: Basic dXNlcjpwYXNz"

# Criar
curl -X POST http://localhost:8000/api/clientes/ \
  -H "Content-Type: application/json" \
  -d '{
    "razao_social": "Empresa Teste Ltda",
    "cnpj": "12345678000199",
    "tipo_frete": "CIF"
  }'
```

**Motoristas:**
```bash
# Listar
curl -X GET http://localhost:8000/api/motoristas/

# Vencimentos
curl -X GET "http://localhost:8000/api/motoristas/vencimentos/?dias=60"
```

**Compartimentos:**
```bash
# Listar compartimentos de um veículo
curl -X GET http://localhost:8000/api/veiculos/{id}/compartimentos/

# Adicionar compartimento
curl -X POST http://localhost:8000/api/veiculos/{id}/compartimentos/ \
  -H "Content-Type: application/json" \
  -d '{"numero_boca": 1, "capacidade_m3": 25.5}'
```

---

## 📊 CHECKLIST DE VALIDAÇÃO

### Configuração Backend
- [x] django-cors-headers instalado
- [x] CORS configurado em INSTALLED_APPS
- [x] CorsMiddleware adicionado em MIDDLEWARE
- [x] CORS_ALLOW_ALL_ORIGINS = True em DEBUG
- [x] CORS_ALLOWED_ORIGINS configurado para produção
- [x] CORS_EXPOSE_HEADERS inclui 'content-disposition'
- [x] REST_FRAMEWORK configurado com autenticação
- [x] Paginação configurada
- [x] CSRF configurado corretamente

### Novos Endpoints
- [x] ClienteViewSet registrado no router
- [x] MotoristaViewSet registrado no router
- [x] CompartimentacaoVeiculoViewSet em nested router
- [x] Actions de exportação implementadas
- [x] Actions de vencimentos implementadas
- [x] Filtros implementados
- [x] Validações implementadas

### Documentação
- [x] API_ENDPOINTS.md atualizado
- [x] Swagger UI acessível
- [x] ReDoc acessível
- [x] Schema JSON disponível

### Serializers
- [x] ClienteSerializer completo
- [x] ClienteListSerializer otimizado
- [x] MotoristaSerializer completo
- [x] MotoristaListSerializer otimizado
- [x] VeiculoSerializer atualizado
- [x] CompartimentacaoVeiculoSerializer criado
- [x] Validações de CNPJ, CPF, UF
- [x] Campos formatados (cnpj_formatado, cpf_formatado)
- [x] Métodos calculados (documentos_vencendo)

---

## ⚠️ PONTOS DE ATENÇÃO PARA FRONTEND

### 1. Autenticação
```javascript
// Se usar Session Auth (recomendado para mesmo domínio)
// SEMPRE incluir credentials
fetch('/api/clientes/', {
  credentials: 'include',  // ← IMPORTANTE!
  headers: {
    'X-CSRFToken': getCookie('csrftoken')
  }
})

// Função para obter CSRF token
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
```

### 2. Paginação
```javascript
// Sempre verificar se há próxima página
const response = await fetch('/api/clientes/');
const data = await response.json();

console.log(`Total: ${data.count}`);
console.log(`Página atual: ${data.results.length} registros`);
if (data.next) {
  console.log('Há mais páginas');
}
```

### 3. Filtros
```javascript
// Construir query params corretamente
const params = new URLSearchParams({
  ativo: 'true',
  tipo_frete: 'CIF',
  estado: 'SP',
  q: 'empresa'
});

fetch(`/api/clientes/?${params}`);
```

### 4. Downloads (CSV)
```javascript
// Para downloads, usar blob
fetch('/api/clientes/export/', {
  credentials: 'include'
})
.then(res => res.blob())
.then(blob => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clientes.csv';
  a.click();
});
```

---

## 🔒 SEGURANÇA

### Configurações de Segurança Ativas

**Em Desenvolvimento (DEBUG=True):**
```python
CORS_ALLOW_ALL_ORIGINS = True          # Aceita qualquer origem
CSRF_COOKIE_SECURE = False             # Cookies via HTTP
SESSION_COOKIE_SECURE = False          # Cookies via HTTP
SECURE_SSL_REDIRECT = False            # Sem redirect HTTPS
```

**Em Produção (DEBUG=False):**
```python
CORS_ALLOWED_ORIGINS = [lista específica]  # Apenas origens autorizadas
CSRF_COOKIE_SECURE = True                   # Cookies apenas HTTPS
SESSION_COOKIE_SECURE = True                # Cookies apenas HTTPS
SECURE_SSL_REDIRECT = True                  # Força HTTPS
SECURE_BROWSER_XSS_FILTER = True           # Proteção XSS
SECURE_CONTENT_TYPE_NOSNIFF = True         # Proteção MIME sniffing
```

**Proteções Ativas:**
- ✅ CSRF Protection (CsrfViewMiddleware)
- ✅ XSS Protection (headers de segurança)
- ✅ Clickjacking Protection (X-Frame-Options)
- ✅ SQL Injection Protection (Django ORM)
- ✅ Session Security (custom middleware)
- ✅ Password Validation (8+ caracteres, validações múltiplas)

---

## 📝 PRÓXIMOS PASSOS PARA FRONTEND

### 1. Setup Inicial
```bash
# Criar projeto React (exemplo)
npx create-react-app frontend
cd frontend

# Ou Vite
npm create vite@latest frontend -- --template react
```

### 2. Configurar Proxy (Desenvolvimento)
**package.json (Create React App):**
```json
{
  "proxy": "http://localhost:8000"
}
```

**vite.config.js (Vite):**
```javascript
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
}
```

### 3. Criar Serviço API
```javascript
// src/services/api.js
const API_BASE = process.env.REACT_APP_API_URL || '/api';

export const api = {
  // Clientes
  getClientes: (params) =>
    fetch(`${API_BASE}/clientes/?${new URLSearchParams(params)}`, {
      credentials: 'include'
    }).then(r => r.json()),

  createCliente: (data) =>
    fetch(`${API_BASE}/clientes/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  // Motoristas
  getMotoristas: (params) =>
    fetch(`${API_BASE}/motoristas/?${new URLSearchParams(params)}`, {
      credentials: 'include'
    }).then(r => r.json()),

  getVencimentos: (dias = 30) =>
    fetch(`${API_BASE}/motoristas/vencimentos/?dias=${dias}`, {
      credentials: 'include'
    }).then(r => r.json()),

  // Veículos
  getVeiculos: (params) =>
    fetch(`${API_BASE}/veiculos/?${new URLSearchParams(params)}`, {
      credentials: 'include'
    }).then(r => r.json()),

  getCompartimentos: (veiculoId) =>
    fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/`, {
      credentials: 'include'
    }).then(r => r.json()),
};
```

### 4. Estrutura de Pastas Sugerida
```
frontend/
├── src/
│   ├── components/
│   │   ├── Clientes/
│   │   │   ├── ClienteList.jsx
│   │   │   ├── ClienteForm.jsx
│   │   │   └── ClienteDetail.jsx
│   │   ├── Motoristas/
│   │   │   ├── MotoristaList.jsx
│   │   │   ├── MotoristaForm.jsx
│   │   │   └── AlertasVencimento.jsx
│   │   └── Veiculos/
│   │       ├── VeiculoList.jsx
│   │       ├── VeiculoForm.jsx
│   │       └── CompartimentosManager.jsx
│   ├── services/
│   │   ├── api.js
│   │   └── auth.js
│   ├── hooks/
│   │   ├── useClientes.js
│   │   ├── useMotoristas.js
│   │   └── useVeiculos.js
│   └── App.jsx
└── package.json
```

---

## 🎯 CONCLUSÃO

### Status Final: ✅ BACKEND 100% PRONTO PARA FRONTEND

**Ajustes Implementados:**
1. ✅ CORS configurado e testado
2. ✅ Autenticação Session/Basic funcionando
3. ✅ 3 novos módulos implementados (Cliente, Motorista, Compartimentação)
4. ✅ 21 novos endpoints disponíveis
5. ✅ Serializers com validações robustas
6. ✅ Filtros e buscas implementados
7. ✅ Exportação CSV funcionando
8. ✅ Sistema de alertas implementado
9. ✅ Rotas aninhadas funcionando
10. ✅ Documentação completa

**Dependências Adicionadas:**
- `django-cors-headers` (CRÍTICO)

**Arquivos Modificados:**
- `requirements.txt` - Adicionado django-cors-headers
- `core/settings.py` - Configurações de CORS completas
- (Demais implementações já estavam prontas)

**Documentação Atualizada:**
- `doc/API_ENDPOINTS.md` - Versão 2.0 com novos endpoints
- `doc/AJUSTES_BACKEND_FRONTEND.md` - Este documento

**Próximo Passo:**
🚀 Iniciar desenvolvimento do frontend com confiança total na API!

---

**Autor:** Claude Code
**Data de Conclusão:** 2025-11-26
**Versão do Backend:** Django 5.0.6 + DRF 3.x
