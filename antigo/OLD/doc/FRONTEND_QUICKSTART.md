# Frontend Quick Start Guide

**Guia Rápido para Integração com a API Destack Transport**

Data: 2025-11-26
Versão: 1.0
Backend URL: `http://localhost:8000/api`

---

## 🚀 INÍCIO RÁPIDO - 5 MINUTOS

### Passo 1: Escolha seu Framework

```bash
# React (Create React App)
npx create-react-app destack-frontend
cd destack-frontend

# OU React (Vite - Recomendado, mais rápido)
npm create vite@latest destack-frontend -- --template react
cd destack-frontend
npm install

# OU Vue 3
npm create vue@latest destack-frontend
cd destack-frontend
npm install

# OU Angular
ng new destack-frontend
cd destack-frontend
```

---

### Passo 2: Configure o Proxy (Desenvolvimento)

#### React (CRA) - package.json
```json
{
  "name": "destack-frontend",
  "version": "0.1.0",
  "proxy": "http://localhost:8000",
  "dependencies": {
    "react": "^18.0.0"
  }
}
```

#### React (Vite) - vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

#### Vue (Vite) - vite.config.js
```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
```

---

### Passo 3: Crie o Serviço de API

#### React/Vue - `src/services/api.js`

```javascript
/**
 * API Service para Destack Transport
 * Base URL: /api (proxy) ou http://localhost:8000/api (direto)
 */

const API_BASE = '/api'; // Usa proxy configurado

// Helper para obter CSRF token (necessário para POST/PUT/DELETE)
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

// Configuração padrão para todas as requisições
const defaultOptions = {
  credentials: 'include', // IMPORTANTE: envia cookies de sessão
  headers: {
    'Content-Type': 'application/json',
  }
};

// ======================================
// CLIENTES
// ======================================

export const clientesAPI = {
  // Listar clientes com filtros opcionais
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/clientes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar clientes');
    return response.json();
  },

  // Obter detalhes de um cliente
  get: async (id) => {
    const response = await fetch(`${API_BASE}/clientes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar cliente');
    return response.json();
  },

  // Criar novo cliente
  create: async (data) => {
    const response = await fetch(`${API_BASE}/clientes/`, {
      ...defaultOptions,
      method: 'POST',
      headers: {
        ...defaultOptions.headers,
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  // Atualizar cliente
  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/clientes/${id}/`, {
      ...defaultOptions,
      method: 'PUT',
      headers: {
        ...defaultOptions.headers,
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Erro ao atualizar cliente');
    return response.json();
  },

  // Deletar cliente
  delete: async (id) => {
    const response = await fetch(`${API_BASE}/clientes/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: {
        'X-CSRFToken': getCookie('csrftoken'),
      },
    });
    if (!response.ok) throw new Error('Erro ao deletar cliente');
    return true;
  },

  // Exportar para CSV
  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/clientes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar clientes');

    // Baixar arquivo
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
};

// ======================================
// MOTORISTAS
// ======================================

export const motoristasAPI = {
  // Listar motoristas
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/motoristas/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar motoristas');
    return response.json();
  },

  // Obter detalhes
  get: async (id) => {
    const response = await fetch(`${API_BASE}/motoristas/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar motorista');
    return response.json();
  },

  // Criar motorista
  create: async (data) => {
    const response = await fetch(`${API_BASE}/motoristas/`, {
      ...defaultOptions,
      method: 'POST',
      headers: {
        ...defaultOptions.headers,
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  // Atualizar motorista
  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/motoristas/${id}/`, {
      ...defaultOptions,
      method: 'PUT',
      headers: {
        ...defaultOptions.headers,
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Erro ao atualizar motorista');
    return response.json();
  },

  // Deletar motorista
  delete: async (id) => {
    const response = await fetch(`${API_BASE}/motoristas/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: {
        'X-CSRFToken': getCookie('csrftoken'),
      },
    });
    if (!response.ok) throw new Error('Erro ao deletar motorista');
    return true;
  },

  // Buscar motoristas com documentos vencendo
  vencimentos: async (dias = 30) => {
    const response = await fetch(`${API_BASE}/motoristas/vencimentos/?dias=${dias}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar vencimentos');
    return response.json();
  },

  // Exportar para CSV
  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/motoristas/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar motoristas');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motoristas_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
};

// ======================================
// VEÍCULOS
// ======================================

export const veiculosAPI = {
  // Listar veículos
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/veiculos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar veículos');
    return response.json();
  },

  // Obter detalhes
  get: async (id) => {
    const response = await fetch(`${API_BASE}/veiculos/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar veículo');
    return response.json();
  },

  // Criar veículo
  create: async (data) => {
    const response = await fetch(`${API_BASE}/veiculos/`, {
      ...defaultOptions,
      method: 'POST',
      headers: {
        ...defaultOptions.headers,
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  // Atualizar veículo
  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/veiculos/${id}/`, {
      ...defaultOptions,
      method: 'PUT',
      headers: {
        ...defaultOptions.headers,
        'X-CSRFToken': getCookie('csrftoken'),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Erro ao atualizar veículo');
    return response.json();
  },

  // Deletar veículo
  delete: async (id) => {
    const response = await fetch(`${API_BASE}/veiculos/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: {
        'X-CSRFToken': getCookie('csrftoken'),
      },
    });
    if (!response.ok) throw new Error('Erro ao deletar veículo');
    return true;
  },

  // Buscar veículos com documentos vencendo
  vencimentos: async (dias = 30) => {
    const response = await fetch(`${API_BASE}/veiculos/vencimentos/?dias=${dias}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar vencimentos');
    return response.json();
  },

  // COMPARTIMENTOS (nested)
  compartimentos: {
    list: async (veiculoId) => {
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar compartimentos');
      return response.json();
    },

    create: async (veiculoId, data) => {
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/`, {
        ...defaultOptions,
        method: 'POST',
        headers: {
          ...defaultOptions.headers,
          'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }
      return response.json();
    },

    update: async (veiculoId, compartimentoId, data) => {
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/${compartimentoId}/`, {
        ...defaultOptions,
        method: 'PUT',
        headers: {
          ...defaultOptions.headers,
          'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao atualizar compartimento');
      return response.json();
    },

    delete: async (veiculoId, compartimentoId) => {
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/${compartimentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
        },
      });
      if (!response.ok) throw new Error('Erro ao deletar compartimento');
      return true;
    }
  }
};

// ======================================
// DASHBOARD
// ======================================

export const dashboardAPI = {
  geral: async () => {
    const response = await fetch(`${API_BASE}/dashboard/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar dashboard');
    return response.json();
  },

  cte: async () => {
    const response = await fetch(`${API_BASE}/painel/cte/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel CT-e');
    return response.json();
  },

  mdfe: async () => {
    const response = await fetch(`${API_BASE}/painel/mdfe/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel MDF-e');
    return response.json();
  },

  financeiro: async () => {
    const response = await fetch(`${API_BASE}/painel/financeiro/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel financeiro');
    return response.json();
  }
};

// Exportar tudo
export default {
  clientes: clientesAPI,
  motoristas: motoristasAPI,
  veiculos: veiculosAPI,
  dashboard: dashboardAPI,
};
```

---

### Passo 4: Exemplo de Componente React

#### `src/components/ClientesList.jsx`

```jsx
import { useState, useEffect } from 'react';
import { clientesAPI } from '../services/api';

function ClientesList() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    ativo: 'true',
    tipo_frete: '',
    estado: '',
    q: ''
  });

  // Carregar clientes
  useEffect(() => {
    loadClientes();
  }, [filtros]);

  const loadClientes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Filtrar apenas valores não vazios
      const params = Object.fromEntries(
        Object.entries(filtros).filter(([_, v]) => v !== '')
      );

      const data = await clientesAPI.list(params);
      setClientes(data.results || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await clientesAPI.export(filtros);
    } catch (err) {
      alert('Erro ao exportar: ' + err.message);
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div className="clientes-list">
      <h2>Clientes</h2>

      {/* Filtros */}
      <div className="filtros">
        <input
          type="text"
          placeholder="Buscar..."
          value={filtros.q}
          onChange={(e) => setFiltros({...filtros, q: e.target.value})}
        />

        <select
          value={filtros.tipo_frete}
          onChange={(e) => setFiltros({...filtros, tipo_frete: e.target.value})}
        >
          <option value="">Todos os tipos</option>
          <option value="CIF">CIF</option>
          <option value="FOB">FOB</option>
        </select>

        <input
          type="text"
          placeholder="UF"
          maxLength="2"
          value={filtros.estado}
          onChange={(e) => setFiltros({...filtros, estado: e.target.value.toUpperCase()})}
        />

        <button onClick={handleExport}>Exportar CSV</button>
      </div>

      {/* Tabela */}
      <table>
        <thead>
          <tr>
            <th>Razão Social</th>
            <th>CNPJ</th>
            <th>Cidade</th>
            <th>UF</th>
            <th>Tipo Frete</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id}>
              <td>{cliente.razao_social}</td>
              <td>{cliente.cnpj_formatado || cliente.cnpj}</td>
              <td>{cliente.cidade}</td>
              <td>{cliente.estado}</td>
              <td>{cliente.tipo_frete}</td>
              <td>{cliente.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {clientes.length === 0 && (
        <p>Nenhum cliente encontrado.</p>
      )}
    </div>
  );
}

export default ClientesList;
```

---

### Passo 5: Exemplo de Componente Vue 3

#### `src/components/ClientesList.vue`

```vue
<template>
  <div class="clientes-list">
    <h2>Clientes</h2>

    <!-- Filtros -->
    <div class="filtros">
      <input
        v-model="filtros.q"
        type="text"
        placeholder="Buscar..."
      />

      <select v-model="filtros.tipo_frete">
        <option value="">Todos os tipos</option>
        <option value="CIF">CIF</option>
        <option value="FOB">FOB</option>
      </select>

      <input
        v-model="filtros.estado"
        type="text"
        placeholder="UF"
        maxlength="2"
        @input="filtros.estado = filtros.estado.toUpperCase()"
      />

      <button @click="exportarCSV">Exportar CSV</button>
    </div>

    <!-- Loading -->
    <div v-if="loading">Carregando...</div>

    <!-- Erro -->
    <div v-else-if="error">Erro: {{ error }}</div>

    <!-- Tabela -->
    <table v-else>
      <thead>
        <tr>
          <th>Razão Social</th>
          <th>CNPJ</th>
          <th>Cidade</th>
          <th>UF</th>
          <th>Tipo Frete</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cliente in clientes" :key="cliente.id">
          <td>{{ cliente.razao_social }}</td>
          <td>{{ cliente.cnpj_formatado || cliente.cnpj }}</td>
          <td>{{ cliente.cidade }}</td>
          <td>{{ cliente.estado }}</td>
          <td>{{ cliente.tipo_frete }}</td>
          <td>{{ cliente.ativo ? '✅ Ativo' : '❌ Inativo' }}</td>
        </tr>
      </tbody>
    </table>

    <p v-if="clientes.length === 0 && !loading">
      Nenhum cliente encontrado.
    </p>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { clientesAPI } from '../services/api';

const clientes = ref([]);
const loading = ref(true);
const error = ref(null);
const filtros = reactive({
  ativo: 'true',
  tipo_frete: '',
  estado: '',
  q: ''
});

// Carregar clientes quando filtros mudarem
watch(filtros, loadClientes, { immediate: true });

async function loadClientes() {
  try {
    loading.value = true;
    error.value = null;

    // Filtrar apenas valores não vazios
    const params = Object.fromEntries(
      Object.entries(filtros).filter(([_, v]) => v !== '')
    );

    const data = await clientesAPI.list(params);
    clientes.value = data.results || data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function exportarCSV() {
  try {
    await clientesAPI.export(filtros);
  } catch (err) {
    alert('Erro ao exportar: ' + err.message);
  }
}
</script>

<style scoped>
.clientes-list {
  padding: 20px;
}

.filtros {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 10px;
  border: 1px solid #ddd;
  text-align: left;
}

th {
  background-color: #f5f5f5;
}
</style>
```

---

## 📱 EXEMPLO DE USO - TESTES RÁPIDOS

### Console do Navegador

Abra o console do navegador (F12) e teste:

```javascript
// 1. Importar o serviço (se estiver em um módulo ES6)
import api from './services/api.js';

// 2. Listar clientes
api.clientes.list({ ativo: 'true' })
  .then(data => console.log('Clientes:', data))
  .catch(err => console.error('Erro:', err));

// 3. Criar cliente
api.clientes.create({
  razao_social: 'Empresa Teste Ltda',
  cnpj: '12345678000199',
  tipo_frete: 'CIF',
  ativo: true
})
  .then(data => console.log('Cliente criado:', data))
  .catch(err => console.error('Erro:', err));

// 4. Buscar motoristas com docs vencendo
api.motoristas.vencimentos(30)
  .then(data => console.log('Vencimentos:', data))
  .catch(err => console.error('Erro:', err));

// 5. Listar compartimentos de um veículo
api.veiculos.compartimentos.list('veiculo-uuid-aqui')
  .then(data => console.log('Compartimentos:', data))
  .catch(err => console.error('Erro:', err));
```

---

## 🎨 ESTRUTURA DE PASTAS RECOMENDADA

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Clientes/
│   │   │   ├── ClientesList.jsx
│   │   │   ├── ClienteForm.jsx
│   │   │   ├── ClienteDetail.jsx
│   │   │   └── ClienteFilters.jsx
│   │   ├── Motoristas/
│   │   │   ├── MotoristasList.jsx
│   │   │   ├── MotoristaForm.jsx
│   │   │   ├── MotoristaDetail.jsx
│   │   │   └── AlertasVencimento.jsx
│   │   ├── Veiculos/
│   │   │   ├── VeiculosList.jsx
│   │   │   ├── VeiculoForm.jsx
│   │   │   ├── VeiculoDetail.jsx
│   │   │   └── CompartimentosManager.jsx
│   │   ├── Dashboard/
│   │   │   ├── DashboardGeral.jsx
│   │   │   ├── PainelFinanceiro.jsx
│   │   │   └── Alertas.jsx
│   │   └── Common/
│   │       ├── Navbar.jsx
│   │       ├── Sidebar.jsx
│   │       ├── Loading.jsx
│   │       └── ErrorMessage.jsx
│   ├── services/
│   │   ├── api.js          ← Código fornecido acima
│   │   └── auth.js
│   ├── hooks/              ← Custom hooks (React)
│   │   ├── useClientes.js
│   │   ├── useMotoristas.js
│   │   └── useVeiculos.js
│   ├── composables/        ← Composables (Vue)
│   │   ├── useClientes.js
│   │   └── useMotoristas.js
│   ├── pages/              ← Páginas principais
│   │   ├── HomePage.jsx
│   │   ├── ClientesPage.jsx
│   │   ├── MotoristasPage.jsx
│   │   └── VeiculosPage.jsx
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── vite.config.js
```

---

## 🔑 PONTOS IMPORTANTES

### 1. Sempre use `credentials: 'include'`
```javascript
fetch('/api/clientes/', {
  credentials: 'include'  // ← CRÍTICO para autenticação
})
```

### 2. Use CSRF Token em mutações (POST/PUT/DELETE)
```javascript
headers: {
  'X-CSRFToken': getCookie('csrftoken')  // ← Obrigatório
}
```

### 3. Trate paginação corretamente
```javascript
const data = await api.clientes.list();
console.log(`Total: ${data.count}`);
console.log(`Resultados: ${data.results.length}`);
console.log(`Próxima página: ${data.next}`);
```

### 4. Filtros são opcionais
```javascript
// Sem filtros
api.clientes.list()

// Com filtros
api.clientes.list({ ativo: 'true', estado: 'SP' })
```

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Copie o arquivo `api.js` para seu projeto
2. ✅ Configure o proxy no vite.config.js ou package.json
3. ✅ Inicie o backend: `python manage.py runserver`
4. ✅ Inicie o frontend: `npm run dev`
5. ✅ Acesse http://localhost:5173 (Vite) ou http://localhost:3000 (CRA)
6. ✅ Teste os componentes de exemplo

---

## 📚 DOCUMENTAÇÃO COMPLETA

- **API Endpoints:** `doc/API_ENDPOINTS.md`
- **Ajustes Backend:** `doc/AJUSTES_BACKEND_FRONTEND.md`
- **Swagger UI:** http://localhost:8000/api/swagger/
- **ReDoc:** http://localhost:8000/api/redoc/

---

## ❓ TROUBLESHOOTING

### Erro: CORS blocked
**Solução:** Verifique se o backend está rodando e se o CORS está configurado.

### Erro: 403 Forbidden (CSRF)
**Solução:** Certifique-se de incluir o X-CSRFToken header em POST/PUT/DELETE.

### Erro: 401 Unauthorized
**Solução:** Você precisa estar autenticado. Faça login primeiro via `/admin` ou endpoint de login.

### Dados não carregam
**Solução:**
1. Verifique se `credentials: 'include'` está presente
2. Verifique se o proxy está configurado corretamente
3. Verifique o console do navegador para erros

---

**Pronto para começar!** 🎉

Qualquer dúvida, consulte a documentação completa em `doc/`.
