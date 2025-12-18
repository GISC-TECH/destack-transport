# 🚀 Como Rodar o Projeto Destack Transport

**Guia completo para executar backend + frontend localmente**

---

## 📋 PRÉ-REQUISITOS

Antes de começar, certifique-se de ter instalado:

- ✅ **Python 3.10+** ([Download](https://www.python.org/downloads/))
- ✅ **Node.js 18+** e **npm** ([Download](https://nodejs.org/))
- ✅ **Git** (opcional)

---

## 🎯 INÍCIO RÁPIDO (5 minutos)

### Opção 1: Execução Rápida (Recomendado)

```bash
# 1. Backend (Terminal 1)
python manage.py runserver

# 2. Frontend (Terminal 2)
cd frontend
npm install  # apenas primeira vez
npm run dev


# 3. Acessar
# Frontend: http://localhost:5173
# Backend Admin: http://localhost:8000/admin
# API Docs: http://localhost:8000/api/swagger/
```

---

## 📖 PASSO A PASSO DETALHADO

### PASSO 1: Configurar Backend Django

#### 1.1 Instalar Dependências Python

```bash
# Instalar todas as dependências
pip install -r requirements.txt
```

**Dependências principais:**
- Django 5.0.6
- djangorestframework
- django-cors-headers
- drf-yasg (Swagger)
- psycopg2-binary (PostgreSQL)
- xmltodict
- reportlab

#### 1.2 Configurar Banco de Dados

O projeto usa **SQLite por padrão** (desenvolvimento local).

```bash
# Aplicar migrações
python manage.py migrate
```

**Resultado esperado:**
```
Operations to perform:
  Apply all migrations: admin, auth, contenttypes, sessions, transport
Running migrations:
  ...
  Applying transport.0002_adicionar_cliente_motorista_compartimentacao... OK
```

#### 1.3 Criar Superusuário (opcional)

```bash
python manage.py createsuperuser
```

Preencha:
- Username
- Email
- Password

#### 1.4 Iniciar Servidor Backend

```bash
python manage.py runserver
```

**Resultado esperado:**
```
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

✅ **Backend rodando em:** http://localhost:8000

**Endpoints para testar:**
- Admin: http://localhost:8000/admin
- Swagger: http://localhost:8000/api/swagger/
- API: http://localhost:8000/api/clientes/

---

### PASSO 2: Configurar Frontend React

#### 2.1 Navegar para pasta frontend

```bash
cd frontend
```

#### 2.2 Instalar Dependências Node

```bash
npm install
```

**Dependências principais:**
- react 18
- react-router-dom 6
- vite 5

**Resultado esperado:**
```
added 157 packages, and audited 158 packages in 30s
found 0 vulnerabilities
```

#### 2.3 Iniciar Servidor Frontend

```bash
npm run dev
```

**Resultado esperado:**
```
  VITE v5.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

✅ **Frontend rodando em:** http://localhost:5173

---

### PASSO 3: Testar a Aplicação

#### 3.1 Acessar Frontend

Abra o navegador em: **http://localhost:5173**

**Você verá:**
- 🏠 Dashboard com cards
- 📊 Navegação para Clientes, Motoristas, Veículos
- 🎨 Interface moderna e responsiva

#### 3.2 Testar Módulos

**Dashboard:**
```
http://localhost:5173/
```
- Visualize estatísticas gerais
- Cards com totais
- Ações rápidas

**Clientes:**
```
http://localhost:5173/clientes
```
- Lista de clientes
- Filtros (busca, tipo frete, UF, status)
- Botão exportar CSV

**Motoristas:**
```
http://localhost:5173/motoristas
```
- Lista de motoristas
- Botão "Ver Vencimentos" (alertas)
- Filtros (busca, categoria CNH, status)
- Exportar CSV

**Veículos:**
```
http://localhost:5173/veiculos
```
- Lista de veículos
- Botão "Ver Vencimentos" (documentação)
- Filtros (placa, tipo proprietário, status)
- Indicador de compartimentos

#### 3.3 Testar API Diretamente

**Swagger UI:**
```
http://localhost:8000/api/swagger/
```
- Documentação interativa
- Testar endpoints diretamente
- Ver schemas de dados

**Exemplo de requisição:**
```bash
curl http://localhost:8000/api/clientes/
```

---

## 🔧 CONFIGURAÇÕES IMPORTANTES

### Proxy do Frontend

O frontend está configurado para fazer proxy das requisições `/api` para o backend.

**Arquivo:** `frontend/vite.config.js`
```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    }
  }
}
```

**Isso significa:**
- Frontend em `http://localhost:5173`
- Requisições para `/api/*` vão para `http://localhost:8000/api/*`
- CORS configurado automaticamente

### CORS no Backend

O backend já está configurado para aceitar requisições do frontend.

**Arquivo:** `core/settings.py`
```python
CORS_ALLOW_ALL_ORIGINS = True  # Em DEBUG mode
CORS_ALLOW_CREDENTIALS = True
```

---

## 📁 ESTRUTURA DO PROJETO

```
destack/
├── core/                     # Configurações Django
│   └── settings.py           # CORS, INSTALLED_APPS
├── transport/                # App principal
│   ├── models.py             # Modelos (Cliente, Motorista, Veiculo)
│   ├── serializers/          # Serializers DRF
│   ├── views/                # ViewSets
│   ├── api_urls.py           # Rotas da API
│   └── admin/                # Admin Django
├── frontend/                 # Frontend React
│   ├── src/
│   │   ├── components/       # Componentes React
│   │   ├── services/         # API service
│   │   └── App.jsx           # App principal
│   ├── vite.config.js        # Configuração Vite
│   └── package.json          # Dependências npm
├── doc/                      # Documentação
│   ├── API_ENDPOINTS.md      # Catálogo de APIs
│   ├── FRONTEND_IMPLEMENTADO.md
│   └── AJUSTES_BACKEND_FRONTEND.md
├── manage.py                 # Django CLI
├── requirements.txt          # Dependências Python
└── COMO_RODAR.md            # Este arquivo
```

---

## 🐛 TROUBLESHOOTING

### Erro: "Port 8000 is already in use"

**Causa:** Já existe um servidor rodando na porta 8000.

**Solução:**
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:8000 | xargs kill -9
```

---

### Erro: "Cannot connect to backend"

**Sintomas:** Frontend carrega mas não mostra dados.

**Checklist:**
1. ✅ Backend está rodando? (`http://localhost:8000/api/`)
2. ✅ Vite proxy configurado? (ver `vite.config.js`)
3. ✅ Console do navegador mostra erros?

**Solução:**
```bash
# 1. Parar frontend
Ctrl+C

# 2. Verificar backend
curl http://localhost:8000/api/clientes/

# 3. Reiniciar frontend
npm run dev
```

---

### Erro: CORS blocked

**Sintomas:** Console mostra "CORS policy blocked"

**Solução:**
1. Verificar se `django-cors-headers` está instalado:
   ```bash
   pip install django-cors-headers
   ```

2. Verificar `core/settings.py`:
   ```python
   INSTALLED_APPS = [
       'corsheaders',  # ← Deve estar aqui
       # ...
   ]

   MIDDLEWARE = [
       'corsheaders.middleware.CorsMiddleware',  # ← Deve estar aqui
       # ...
   ]
   ```

3. Reiniciar backend:
   ```bash
   python manage.py runserver
   ```

---

### Erro: "Module not found" (Frontend)

**Causa:** Dependências npm não instaladas.

**Solução:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

### Erro: "No module named 'django'"

**Causa:** Dependências Python não instaladas.

**Solução:**
```bash
pip install -r requirements.txt
```

---

### Erro: Database não existe

**Sintomas:** `django.db.utils.OperationalError: no such table`

**Solução:**
```bash
# Aplicar todas as migrações
python manage.py migrate

# Se persistir, recriar banco
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

---

## 🧪 TESTANDO FUNCIONALIDADES

### 1. Testar Filtros de Clientes

```bash
# No navegador: http://localhost:5173/clientes
```

1. Digite "empresa" na busca
2. Selecione tipo de frete "CIF"
3. Digite UF "SP"
4. Clique em "Exportar CSV"

**Resultado esperado:**
- Lista filtrada
- Download de arquivo CSV

### 2. Testar Alertas de Motoristas

```bash
# No navegador: http://localhost:5173/motoristas
```

1. Clique em "⚠️ Ver Vencimentos"
2. Veja cards com motoristas e documentos vencendo

**Resultado esperado:**
- Lista de alertas
- Documentos marcados como "VENCIDO" ou "X dias"

### 3. Testar API Diretamente

```bash
# Listar clientes
curl http://localhost:8000/api/clientes/

# Vencimentos de motoristas
curl http://localhost:8000/api/motoristas/vencimentos/

# Dashboard
curl http://localhost:8000/api/dashboard/
```

---

## 📦 BUILD PARA PRODUÇÃO

### Backend

```bash
# Coletar arquivos estáticos
python manage.py collectstatic --noinput

# Usar Gunicorn (servidor WSGI)
gunicorn core.wsgi:application --bind 0.0.0.0:8000
```

### Frontend

```bash
cd frontend

# Gerar build otimizado
npm run build

# Arquivos estarão em frontend/dist/
# Tamanho: ~200KB (gzipped)
```

**Deploy do frontend:**
- Copiar conteúdo de `dist/` para servidor web (Nginx, Apache)
- Configurar proxy reverso para `/api` → backend

---

## 🎓 COMANDOS ÚTEIS

### Backend Django

```bash
# Verificar configurações
python manage.py check

# Criar migrações
python manage.py makemigrations

# Aplicar migrações
python manage.py migrate

# Shell interativo
python manage.py shell

# Admin do Django
# http://localhost:8000/admin
```

### Frontend React

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Preview do build
npm run preview

# Lint
npm run lint
```

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- **API Completa:** `doc/API_ENDPOINTS.md`
- **Frontend:** `doc/FRONTEND_IMPLEMENTADO.md`
- **Ajustes Backend:** `doc/AJUSTES_BACKEND_FRONTEND.md`
- **Quick Start:** `doc/FRONTEND_QUICKSTART.md`

---

## ✅ CHECKLIST DE INICIALIZAÇÃO

**Antes de começar:**
- [ ] Python 3.10+ instalado
- [ ] Node.js 18+ instalado
- [ ] Git clone do repositório (se aplicável)

**Backend:**
- [ ] `pip install -r requirements.txt`
- [ ] `python manage.py migrate`
- [ ] `python manage.py createsuperuser` (opcional)
- [ ] `python manage.py runserver`
- [ ] Testar: `http://localhost:8000/api/swagger/`

**Frontend:**
- [ ] `cd frontend`
- [ ] `npm install`
- [ ] `npm run dev`
- [ ] Testar: `http://localhost:5173`

**Validação:**
- [ ] Dashboard carrega corretamente
- [ ] Clientes lista funciona
- [ ] Motoristas lista funciona
- [ ] Veículos lista funciona
- [ ] Filtros funcionam
- [ ] Exportar CSV funciona

---

## 🎉 PRONTO!

Se todos os passos foram seguidos, você terá:

✅ Backend Django rodando em `http://localhost:8000`
✅ Frontend React rodando em `http://localhost:5173`
✅ API completamente funcional
✅ Interface moderna e responsiva
✅ Sistema de alertas funcionando
✅ Exportação CSV operacional

---

**Desenvolvido com ❤️ para Destack Transport**

Em caso de dúvidas, consulte a documentação em `doc/` ou o README principal.
