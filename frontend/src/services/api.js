/**
 * API Service para Destack Transport
 * Base URL: /api (usa proxy configurado no vite.config.js)
 */

const API_BASE = '/api';

// Nome do cookie CSRF (deve corresponder ao CSRF_COOKIE_NAME no Django settings)
const CSRF_COOKIE_NAME = 'cte_mdfe_csrftoken';

// Helper para obter CSRF token do cookie (necessário para POST/PUT/DELETE)
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

// Obtém o CSRF token - SEMPRE do cookie (Django valida cookie vs header)
function getCSRFToken() {
  // O token CSRF deve vir do cookie, não do cache
  // Django compara o token do header X-CSRFToken com o cookie
  return getCookie(CSRF_COOKIE_NAME) || getCookie('csrftoken') || '';
}

// Configuração padrão para todas as requisições
const defaultOptions = {
  credentials: 'include', // IMPORTANTE: envia cookies de sessão
  headers: {
    'Content-Type': 'application/json',
  }
};

// Helper para requisições POST/PUT/DELETE
const mutationOptions = (method, data) => {
  const isFormData = data instanceof FormData;
  const headers = {
    ...defaultOptions.headers,
    'X-CSRFToken': getCSRFToken(),
  };
  // Se for FormData, não define Content-Type (o browser define automaticamente com boundary)
  if (isFormData) {
    delete headers['Content-Type'];
  }
  return {
    ...defaultOptions,
    method,
    headers,
    body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
  };
};

// Timeout padrão para requisições fetch (30 segundos)
const DEFAULT_TIMEOUT = 30000;

// Emite evento global quando a sessão expirar (401 em endpoints protegidos)
function notifySessionExpired(url) {
  if (typeof window === 'undefined') return;
  if (url.includes('/auth/')) return; // Ignora endpoints de autenticação
  window.dispatchEvent(new CustomEvent('auth:session-expired', {
    detail: { url, status: 401 }
  }));
}

// Wrapper para fetch com AbortController/timeout
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await window.fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });

    if (response.status === 401) {
      notifySessionExpired(url);
    }

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`A requisição excedeu o tempo limite de ${timeout / 1000}s`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper para refresh do CSRF token
async function refreshCSRFToken() {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/auth/csrf/`, defaultOptions);
    if (response.ok) {
      // O cookie foi setado pela resposta
      return true;
    }
  } catch (e) {
    console.warn('Falha ao atualizar CSRF token:', e);
  }
  return false;
}

// Wrapper para requisições com retry automático em caso de CSRF failure (403)
async function fetchWithCSRFRetry(url, options, retried = false, timeout = DEFAULT_TIMEOUT) {
  const response = await fetchWithTimeout(url, options, timeout);

  // Se for 403 e ainda não tentamos retry, atualizar CSRF e tentar novamente
  if (response.status === 403 && !retried) {
    const refreshed = await refreshCSRFToken();
    if (refreshed) {
      // Atualizar o header com novo token
      const newOptions = {
        ...options,
        headers: {
          ...options.headers,
          'X-CSRFToken': getCSRFToken(),
        }
      };
      return fetchWithCSRFRetry(url, newOptions, true, timeout);
    }
  }

  return response;
}

// Helper para validar IDs antes de requisições aninhadas
const validateId = (id, name = 'ID') => {
  if (id === undefined || id === null || id === '') {
    throw new Error(`${name} é obrigatório`);
  }
  return id;
};

// Helper para extrair mensagem de erro legível do objeto de erro da API
const extractErrorMessage = (error, defaultMsg = 'Erro na operação') => {
  if (!error || typeof error !== 'object') return defaultMsg;
  if (error.detail) return error.detail;
  if (error.message) return error.message;
  if (error.error) return error.error;
  // Handle field validation errors like {"field": ["error message"]}
  const firstField = Object.keys(error)[0];
  if (firstField && Array.isArray(error[firstField])) {
    return `${firstField}: ${error[firstField][0]}`;
  }
  if (firstField && typeof error[firstField] === 'string') {
    return `${firstField}: ${error[firstField]}`;
  }
  return defaultMsg;
};

// Helper para download de arquivos (elimina duplicação de código)
const triggerDownload = async (response, filename) => {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

// Helper para tratar erros HTTP com mensagens específicas
const handleHttpError = async (response, defaultMsg) => {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  let message = extractErrorMessage(payload, defaultMsg);
  if (!payload && response.status === 404) {
    message = 'Recurso não encontrado. Verifique se o registro existe.';
  } else if (!payload && response.status === 403) {
    message = 'Acesso negado. Você não tem permissão para esta ação.';
  } else if (!payload && response.status === 409) {
    message = 'Os dados foram alterados por outra sessão. Recarregue e tente novamente.';
  }

  const error = new Error(message || defaultMsg);
  error.status = response.status;
  error.code = payload?.code || payload?.error_code || null;
  error.data = payload;
  if (response.status === 403 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:permissions-changed', {
      detail: { status: 403, code: error.code },
    }));
  }
  throw error;
};

// ======================================
// AUTENTICAÇÃO
// ======================================

export const authAPI = {
  login: async (username, password) => {
    // Garantir que temos o cookie CSRF antes de fazer login
    // Isso faz uma chamada GET que seta o cookie CSRF
    if (!getCSRFToken()) {
      await authAPI.fetchCSRFToken();
    }

    const response = await fetchWithTimeout(`${API_BASE}/auth/login/`, {
      ...defaultOptions,
      method: 'POST',
      headers: {
        ...defaultOptions.headers,
        'X-CSRFToken': getCSRFToken(),
      },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erro ao fazer login');
    }
    return response.json();
  },

  logout: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/auth/logout/`, {
      ...defaultOptions,
      method: 'POST',
      headers: {
        ...defaultOptions.headers,
        'X-CSRFToken': getCSRFToken(),
      },
    });
    if (!response.ok) throw new Error('Erro ao fazer logout');
    return true;
  },

  checkAuth: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/auth/user/`, defaultOptions);
    if (!response.ok) {
      // 401 é esperado quando não está logado - retorna estado não autenticado
      return { authenticated: false, user: null };
    }
    const data = await response.json();
    return { authenticated: true, user: data.user || data };
  },

  // Busca CSRF token - o token fica no cookie após esta chamada
  fetchCSRFToken: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/auth/csrf/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao obter CSRF token');
    // O importante é que esta chamada seta o cookie CSRF
    // O token retornado no JSON é o mesmo do cookie
    return response.json();
  },

  // Alias para compatibilidade
  getCSRFToken: async () => {
    return authAPI.fetchCSRFToken();
  },

  // Permissoes efetivas do usuario logado
  getPermissions: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/users/me/permissions/`, defaultOptions);
    if (!response.ok) {
      if (response.status === 401) {
        const err = new Error('Sessão expirada');
        err.status = 401;
        throw err;
      }
      return { superuser: false, modulos: {} };
    }
    return response.json();
  }
};

// ======================================
// PERFIS / GRUPOS DE PERMISSOES
// ======================================

export const perfisAPI = {
  list: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/perfis/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar perfis');
    return response.json();
  },

  get: async (nome) => {
    const response = await fetchWithTimeout(`${API_BASE}/perfis/${encodeURIComponent(nome)}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar perfil');
    return response.json();
  },

  update: async (nome, data) => {
    const response = await fetchWithCSRFRetry(
      `${API_BASE}/perfis/${encodeURIComponent(nome)}/`,
      mutationOptions('PUT', data)
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao atualizar perfil');
    return response.json();
  },

  getModulos: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/perfis/modulos/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar módulos');
    return response.json();
  },

  sincronizar: async () => {
    const response = await fetchWithCSRFRetry(
      `${API_BASE}/perfis/sincronizar/`,
      mutationOptions('POST')
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao sincronizar perfis');
    return response.json();
  }
};

// ======================================
// CLIENTES
// ======================================

export const clientesAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/clientes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar clientes');
    return response.json();
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/clientes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar cliente');
    return response.json();
  },

  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/clientes/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/clientes/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar cliente');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/clientes/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar cliente');
    return true;
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/clientes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar clientes');
    await triggerDownload(response, `clientes_${new Date().toISOString().split('T')[0]}.csv`);
  }
};

// ======================================
// MOTORISTAS
// ======================================

export const motoristasAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/motoristas/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar motoristas');
    return response.json();
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/motoristas/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar motorista');
    return response.json();
  },

  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/motoristas/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/motoristas/${id}/`, mutationOptions('PATCH', data));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(error, 'Erro ao atualizar motorista'));
    }
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/motoristas/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar motorista');
    return true;
  },

  vencimentos: async (dias = 30, mostrarTodos = false) => {
    const params = new URLSearchParams({ dias, mostrar_todos: mostrarTodos });
    const response = await fetchWithTimeout(`${API_BASE}/motoristas/vencimentos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar vencimentos');
    return response.json();
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/motoristas/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar motoristas');
    await triggerDownload(response, `motoristas_${new Date().toISOString().split('T')[0]}.csv`);
  }
};

// ======================================
// VEÍCULOS
// ======================================

export const veiculosAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/veiculos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar veículos');
    return response.json();
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/veiculos/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar veículo');
    return response.json();
  },

  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/veiculos/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/veiculos/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar veículo');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/veiculos/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar veículo');
    return true;
  },

  vencimentos: async (dias = 30, mostrarTodos = false) => {
    const params = new URLSearchParams({ dias, mostrar_todos: mostrarTodos });
    const response = await fetchWithTimeout(`${API_BASE}/veiculos/vencimentos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar vencimentos');
    return response.json();
  },

  estatisticas: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/veiculos/${id}/estatisticas/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar estatísticas');
    return response.json();
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/veiculos/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar veículos');
    await triggerDownload(response, `veiculos_${new Date().toISOString().split('T')[0]}.csv`);
  },

  compartimentos: {
    list: async (veiculoId) => {
      validateId(veiculoId, 'ID do veículo');
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/compartimentos/`, defaultOptions);
      if (!response.ok) await handleHttpError(response, 'Erro ao buscar compartimentos');
      return response.json();
    },

    create: async (veiculoId, data) => {
      validateId(veiculoId, 'ID do veículo');
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/compartimentos/`, mutationOptions('POST', data));
      if (!response.ok) await handleHttpError(response, 'Erro ao criar compartimento');
      return response.json();
    },

    update: async (veiculoId, compartimentoId, data) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(compartimentoId, 'ID do compartimento');
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/compartimentos/${compartimentoId}/`, mutationOptions('PUT', data));
      if (!response.ok) await handleHttpError(response, 'Erro ao atualizar compartimento');
      return response.json();
    },

    delete: async (veiculoId, compartimentoId) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(compartimentoId, 'ID do compartimento');
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/compartimentos/${compartimentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) await handleHttpError(response, 'Erro ao deletar compartimento');
      return true;
    }
  },

  // Manutenções de um veículo específico (rota aninhada)
  manutencoes: {
    list: async (veiculoId, filters = {}) => {
      validateId(veiculoId, 'ID do veículo');
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/manutencoes/?${params}`, defaultOptions);
      if (!response.ok) await handleHttpError(response, 'Erro ao buscar manutenções do veículo');
      return response.json();
    },

    get: async (veiculoId, manutencaoId) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(manutencaoId, 'ID da manutenção');
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/manutencoes/${manutencaoId}/`, defaultOptions);
      if (!response.ok) await handleHttpError(response, 'Erro ao buscar manutenção');
      return response.json();
    },

    create: async (veiculoId, data) => {
      validateId(veiculoId, 'ID do veículo');
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/manutencoes/`, mutationOptions('POST', data));
      if (!response.ok) await handleHttpError(response, 'Erro ao criar manutenção');
      return response.json();
    },

    update: async (veiculoId, manutencaoId, data) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(manutencaoId, 'ID da manutenção');
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/manutencoes/${manutencaoId}/`, mutationOptions('PUT', data));
      if (!response.ok) await handleHttpError(response, 'Erro ao atualizar manutenção');
      return response.json();
    },

    delete: async (veiculoId, manutencaoId) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(manutencaoId, 'ID da manutenção');
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/manutencoes/${manutencaoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) await handleHttpError(response, 'Erro ao deletar manutenção');
      return true;
    }
  }
};

// ======================================
// CT-e
// ======================================

export const cteAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/ctes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar CT-es');
    return response.json();
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ctes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar CT-e');
    return response.json();
  },

  editarValorFrete: async (id, valorTotalPrestado) => {
    const response = await fetchWithCSRFRetry(
      `${API_BASE}/ctes/${id}/valor-frete/`,
      mutationOptions('PATCH', { valor_total_prestado: valorTotalPrestado })
    );
    if (!response.ok) {
      await handleHttpError(response, 'Erro ao atualizar o valor do frete');
    }
    return response.json();
  },

  excluir: async (id) => {
    const response = await fetchWithCSRFRetry(
      `${API_BASE}/ctes/${id}/excluir/`,
      mutationOptions('DELETE')
    );
    if (!response.ok) {
      await handleHttpError(response, 'Erro ao excluir CT-e');
    }
    return true;
  },

  cancelar: async (id, justificativa) => {
    const response = await fetchWithTimeout(`${API_BASE}/ctes/${id}/cancelar/`, mutationOptions('POST', { justificativa }));
    if (!response.ok) throw new Error('Erro ao cancelar CT-e');
    return response.json();
  },

  downloadPDF: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ctes/${id}/dacte/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar DACTE');
    return response.blob();
  },

  downloadXML: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ctes/${id}/xml/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar XML');
    return response.blob();
  },

  reprocessar: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ctes/${id}/reprocessar/`, mutationOptions('POST'));
    if (!response.ok) throw new Error('Erro ao reprocessar CT-e');
    return response.json();
  },

  estatisticas: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/ctes/estatisticas/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar estatísticas');
    return response.json();
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/ctes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar CT-es');
    await triggerDownload(response, `ctes_${new Date().toISOString().split('T')[0]}.csv`);
  },

  marcarPagamento: async (id, pago, observacao = null, dataPagamento = null, comprovante = null) => {
    let requestOptions;

    if (comprovante) {
      // Se tiver comprovante, usa FormData
      const formData = new FormData();
      formData.append('pago', pago);
      if (observacao !== null) formData.append('observacao_pagamento', observacao);
      if (dataPagamento !== null) formData.append('data_pagamento', dataPagamento);
      formData.append('comprovante', comprovante);

      requestOptions = {
        ...defaultOptions,
        method: 'PATCH',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      };
    } else {
      // Sem comprovante, envia JSON
      const data = { pago };
      if (observacao !== null) data.observacao_pagamento = observacao;
      if (dataPagamento !== null) data.data_pagamento = dataPagamento;
      requestOptions = mutationOptions('PATCH', data);
    }

    const response = await fetchWithTimeout(`${API_BASE}/ctes/${id}/pagamento/`, requestOptions);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar status de pagamento');
    }
    return response.json();
  },

  pagamentosPendentes: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/ctes/pagamentos_pendentes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar pagamentos pendentes');
    return response.json();
  }
};

// ======================================
// MDF-e
// ======================================

export const mdfeAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar MDF-es');
    return response.json();
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar MDF-e');
    return response.json();
  },

  // create/update/delete nao suportados: MDFeDocumentoViewSet e ReadOnlyModelViewSet.

  encerrar: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/${id}/encerrar/`, mutationOptions('POST', data));
    if (!response.ok) throw new Error('Erro ao encerrar MDF-e');
    return response.json();
  },

  cancelar: async (id, justificativa) => {
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/${id}/cancelar/`, mutationOptions('POST', { justificativa }));
    if (!response.ok) throw new Error('Erro ao cancelar MDF-e');
    return response.json();
  },

  downloadPDF: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/${id}/damdfe/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar DAMDFE');
    return response.blob();
  },

  downloadXML: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/${id}/xml/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar XML');
    return response.blob();
  },

  reprocessar: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/${id}/reprocessar/`, mutationOptions('POST'));
    if (!response.ok) throw new Error('Erro ao reprocessar MDF-e');
    return response.json();
  },

  documentos: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/${id}/documentos/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar documentos vinculados');
    return response.json();
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/mdfes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar MDF-es');
    await triggerDownload(response, `mdfes_${new Date().toISOString().split('T')[0]}.csv`);
  }
};

// ======================================
// UPLOAD XML
// ======================================

export const uploadAPI = {
  // Upload individual de XML (CT-e, MDF-e ou evento)
  processar: async (file, fileRetorno = null) => {
    const formData = new FormData();
    formData.append('arquivo_xml', file);
    if (fileRetorno) {
      formData.append('arquivo_xml_retorno', fileRetorno);
    }

    const response = await fetchWithTimeout(`${API_BASE}/upload/`, {
      credentials: 'include',
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRFToken(),
      },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Erro ao processar arquivo');
    }
    return response.json();
  },

  // Upload em lote de múltiplos XMLs
  batch: async (files) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('arquivos_xml', file);
    });

    const response = await fetchWithTimeout(`${API_BASE}/upload/batch_upload/`, {
      credentials: 'include',
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRFToken(),
      },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.detail || 'Erro ao processar arquivos');
    }
    return response.json();
  },

  // Historico de uploads removido: endpoint nao existe no backend.
};

// ======================================
// PAGAMENTOS
// ======================================

export const pagamentosAPI = {
  // API para pagamentos de agregados (motoristas terceirizados)
  agregados: {
    list: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar pagamentos de agregados');
      return response.json();
    },

    get: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar pagamento');
      return response.json();
    },

    create: async (data) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error));
      }
      return response.json();
    },

    update: async (id, data) => {
      // Usa PATCH para atualização parcial (ex: dar baixa só com status e data)
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/${id}/`, mutationOptions('PATCH', data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(extractErrorMessage(error, 'Erro ao atualizar pagamento'));
      }
      return response.json();
    },

    delete: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/${id}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar pagamento');
      return true;
    },

    // Geração em lote de pagamentos para agregados
    gerar: async (data) => {
      const response = await fetchWithCSRFRetry(`${API_BASE}/pagamentos/agregados/gerar/`, mutationOptions('POST', data));
      if (!response.ok) throw new Error('Erro ao gerar pagamentos');
      return response.json();
    },

    export: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/export/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao exportar pagamentos');
      await triggerDownload(response, `pagamentos_agregados_${new Date().toISOString().split('T')[0]}.csv`);
    },

    baixarComprovantes: async (payload, filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithCSRFRetry(
        `${API_BASE}/pagamentos/agregados/comprovantes/download/?${params}`,
        mutationOptions('POST', payload),
        false,
        120000,
      );
      if (!response.ok) await handleHttpError(response, 'Erro ao baixar comprovantes');
      await triggerDownload(response, `comprovantes_agregados_${new Date().toISOString().split('T')[0]}.zip`);
    },

    // Converte pagamento agregado para próprio
    converterParaProprio: async (id, data = {}) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/${id}/converter-para-proprio/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao converter pagamento');
      }
      return response.json();
    },

    // Reenvia notificação WhatsApp para o gestor
    notificarGestor: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/${id}/notificar-gestor/`, mutationOptions('POST', {}));
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(extractErrorMessage(error, 'Erro ao notificar gestor'));
      }
      return response.json();
    },

    // Reverte a baixa de um pagamento agregado (volta para pendente)
    reverterBaixa: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/agregados/${id}/reverter-baixa/`, mutationOptions('POST', {}));
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(extractErrorMessage(error, 'Erro ao reverter baixa'));
      }
      return response.json();
    }
  },

  // API para pagamentos próprios (veículos da empresa)
  proprios: {
    list: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar pagamentos próprios');
      return response.json();
    },

    get: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar pagamento');
      return response.json();
    },

    create: async (data) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error));
      }
      return response.json();
    },

    update: async (id, data) => {
      // Usa PATCH para atualização parcial (ex: dar baixa só com status e data)
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/${id}/`, mutationOptions('PATCH', data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(extractErrorMessage(error, 'Erro ao atualizar pagamento'));
      }
      return response.json();
    },

    delete: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/${id}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar pagamento');
      return true;
    },

    // Calcular valores por KM (POST: veiculo_id, periodo, km_total opcional)
    calcularKm: async (veiculoId, periodo, kmTotal = null) => {
      const body = { veiculo_id: veiculoId, periodo };
      if (kmTotal !== null) body.km_total = kmTotal;
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/calcular_km/`, mutationOptions('POST', body));
      if (!response.ok) throw new Error('Erro ao calcular valores por KM');
      return response.json();
    },

    // Geração em lote de pagamentos próprios
    gerar: async (data) => {
      const response = await fetchWithCSRFRetry(`${API_BASE}/pagamentos/proprios/gerar/`, mutationOptions('POST', data));
      if (!response.ok) throw new Error('Erro ao gerar pagamentos');
      return response.json();
    },

    export: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/export/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao exportar pagamentos');
      await triggerDownload(response, `pagamentos_proprios_${new Date().toISOString().split('T')[0]}.csv`);
    },

    baixarComprovantes: async (payload, filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithCSRFRetry(
        `${API_BASE}/pagamentos/proprios/comprovantes/download/?${params}`,
        mutationOptions('POST', payload),
        false,
        120000,
      );
      if (!response.ok) await handleHttpError(response, 'Erro ao baixar comprovantes');
      await triggerDownload(response, `comprovantes_proprios_${new Date().toISOString().split('T')[0]}.zip`);
    },

    // Converte pagamento próprio para agregado
    converterParaAgregado: async (id, data) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/${id}/converter-para-agregado/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao converter pagamento');
      }
      return response.json();
    },

    // Reenvia notificação WhatsApp para o gestor
    notificarGestor: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/${id}/notificar-gestor/`, mutationOptions('POST', {}));
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(extractErrorMessage(error, 'Erro ao notificar gestor'));
      }
      return response.json();
    },

    // Reverte a baixa de um pagamento próprio (volta para pendente)
    reverterBaixa: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/pagamentos/proprios/${id}/reverter-baixa/`, mutationOptions('POST', {}));
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(extractErrorMessage(error, 'Erro ao reverter baixa'));
      }
      return response.json();
    }
  },

  // Metodos legados/removidos: list/get/create/update/delete duplicavam pagamentosAPI.agregados.
  // marcarPago (/pagamentos/agregados/{id}/pagar/) e resumo (/pagamentos/resumo/) nao existem no backend.
};

// ======================================
// MANUTENÇÃO
// ======================================

export const manutencaoAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/manutencoes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar manutenções');
    return response.json();
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/manutencoes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar manutenção');
    return response.json();
  },

  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/manutencoes/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/manutencoes/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar manutenção');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/manutencoes/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar manutenção');
    return true;
  },

  // resumo removido: endpoint /manutencoes/resumo/ nao existe no backend.

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/manutencoes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar manutenções');
    await triggerDownload(response, `manutencoes_${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Painel de manutenção
  painel: {
    indicadores: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/manutencao/painel/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar indicadores');
      return response.json();
    },

    graficos: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/manutencao/painel/graficos/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar gráficos');
      return response.json();
    },

    ultimos: async (limite = 10) => {
      const response = await fetchWithTimeout(`${API_BASE}/manutencao/painel/ultimos/?limite=${limite}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar últimas manutenções');
      return response.json();
    },

    tendencias: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/manutencao/painel/tendencias/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar tendências');
      return response.json();
    }
  }
};

// ======================================
// FINANCEIRO
// ======================================

export const financeiroAPI = {
  painel: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/painel/financeiro/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel financeiro');
    return response.json();
  },

  mensal: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/financeiro/mensal/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar dados mensais');
    return response.json();
  },

  detalhe: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/financeiro/detalhe/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar detalhes');
    return response.json();
  },

  inadimplencia: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/financeiro/inadimplencia/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar inadimplência');
    return response.json();
  },

  fluxoCaixa: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/financeiro/fluxo-caixa/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar fluxo de caixa');
    return response.json();
  },

  dre: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/financeiro/dre/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar DRE');
    return response.json();
  },

  // faturamento e evolucao removidos: endpoints /financeiro/faturamento/ e /financeiro/evolucao/ nao existem no backend.
  // Use painel, mensal, detalhe, inadimplencia, fluxoCaixa ou dre conforme necessario.
};

// ======================================
// CONCILIAÇÃO BANCÁRIA
// ======================================

export const conciliacaoAPI = {
  // Faturas
  faturas: {
    list: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/faturas/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar faturas');
      return response.json();
    },
    get: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/faturas/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar fatura');
      return response.json();
    },
    create: async (data) => {
      const response = await fetchWithTimeout(`${API_BASE}/faturas/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error));
      }
      return response.json();
    },
    update: async (id, data) => {
      const response = await fetchWithTimeout(`${API_BASE}/faturas/${id}/`, mutationOptions('PUT', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error));
      }
      return response.json();
    },
    delete: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/faturas/${id}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar fatura');
      return true;
    },

    gerarLote: async (data) => {
      const response = await fetchWithTimeout(`${API_BASE}/faturas/gerar_lote/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(extractErrorMessage(error, 'Erro ao gerar fatura em lote'));
      }
      return response.json();
    }
  },

  // Contas a Pagar
  contasPagar: {
    list: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/contas-a-pagar/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar contas a pagar');
      return response.json();
    },
    get: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/contas-a-pagar/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar conta a pagar');
      return response.json();
    },
    create: async (data) => {
      const response = await fetchWithTimeout(`${API_BASE}/contas-a-pagar/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error));
      }
      return response.json();
    },
    update: async (id, data) => {
      const response = await fetchWithTimeout(`${API_BASE}/contas-a-pagar/${id}/`, mutationOptions('PUT', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error));
      }
      return response.json();
    },
    delete: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/contas-a-pagar/${id}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar conta a pagar');
      return true;
    },
    export: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/contas-a-pagar/export/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao exportar contas a pagar');
      await triggerDownload(response, `contas_a_pagar_${new Date().toISOString().split('T')[0]}.csv`);
    }
  },

  // Transações Bancárias
  transacoes: {
    list: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/transacoes/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar transações');
      return response.json();
    },
    get: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/transacoes/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar transação');
      return response.json();
    },
    upload: async (file) => {
      const formData = new FormData();
      formData.append('arquivo', file);
      const response = await fetchWithTimeout(`${API_BASE}/transacoes/upload/`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.error || 'Erro ao processar arquivo');
      }
      return response.json();
    },
    importar: async (file) => {
      const formData = new FormData();
      formData.append('arquivo', file);
      const response = await fetchWithTimeout(`${API_BASE}/transacoes/importar/`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.error || 'Erro ao importar transações');
      }
      return response.json();
    },
    vincular: async (id, data) => {
      const response = await fetchWithTimeout(`${API_BASE}/transacoes/${id}/vincular/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.error || 'Erro ao vincular transação');
      }
      return response.json();
    },
    desvincular: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/transacoes/${id}/desvincular/`, mutationOptions('POST'));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.error || 'Erro ao desvincular transação');
      }
      return response.json();
    },
    delete: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/transacoes/${id}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar transação');
      return true;
    }
  }
};

// ======================================
// ORDENS DE VIAGEM (OS)
// ======================================

export const tabelaFreteAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/tabelas-frete/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar tabelas de frete');
    return response.json();
  },
  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/tabelas-frete/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar tabela de frete');
    return response.json();
  },
  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/tabelas-frete/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/tabelas-frete/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/tabelas-frete/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar tabela de frete');
    return true;
  },
  simular: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/tabelas-frete/simular/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error, 'Erro na simulação'));
    }
    return response.json();
  }
};

export const pedagioAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/pedagios/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar pedágios');
    return response.json();
  },
  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/pedagios/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar pedágio');
    return response.json();
  },
  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/pedagios/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/pedagios/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/pedagios/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar pedágio');
    return true;
  }
};

export const multaAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/multas/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar multas');
    return response.json();
  },
  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/multas/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar multa');
    return response.json();
  },
  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/multas/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/multas/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/multas/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar multa');
    return true;
  }
};

export const sinistroAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/sinistros/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar sinistros');
    return response.json();
  },
  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/sinistros/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar sinistro');
    return response.json();
  },
  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/sinistros/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/sinistros/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/sinistros/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar sinistro');
    return true;
  }
};

export const planoManutencaoAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/planos-manutencao/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar planos de manutenção');
    return response.json();
  },
  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/planos-manutencao/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar plano de manutenção');
    return response.json();
  },
  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/planos-manutencao/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/planos-manutencao/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/planos-manutencao/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar plano de manutenção');
    return true;
  },
  alertas: async (dias = 30) => {
    const response = await fetchWithTimeout(`${API_BASE}/planos-manutencao/alertas/?dias=${dias}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar alertas');
    return response.json();
  }
};

export const abastecimentoAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/abastecimentos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar abastecimentos');
    return response.json();
  },
  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/abastecimentos/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar abastecimento');
    return response.json();
  },
  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/abastecimentos/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/abastecimentos/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/abastecimentos/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar abastecimento');
    return true;
  },
  resumo: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/abastecimentos/resumo/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar resumo');
    return response.json();
  }
};

export const ordemViagemAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar ordens de viagem');
    return response.json();
  },
  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar ordem de viagem');
    return response.json();
  },
  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar ordem de viagem');
    return true;
  },
  alterarStatus: async (id, status) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/alterar-status/`, mutationOptions('POST', { status }));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error, 'Erro ao alterar status'));
    }
    return response.json();
  },
  addDespesa: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/despesas/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error, 'Erro ao adicionar despesa'));
    }
    return response.json();
  },
  getETA: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/eta/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar ETA');
    return response.json();
  },
  registrarPosicao: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/posicoes/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error, 'Erro ao registrar posição'));
    }
    return response.json();
  },
  deleteDespesa: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/despesas-viagem/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar despesa');
    return true;
  },
  listarRotas: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/rotas/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar rotas');
    return response.json();
  },
  calcularRota: async (id, data = {}) => {
    const response = await fetchWithTimeout(`${API_BASE}/ordens-viagem/${id}/calcular-rota/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(error, 'Erro ao calcular rota'));
    }
    return response.json();
  }
};

// ======================================
// CONFIGURAÇÕES
// ======================================

export const configAPI = {
  empresa: {
    get: async () => {
      const response = await fetchWithTimeout(`${API_BASE}/configuracoes/empresa/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar dados da empresa');
      return response.json();
    },

    save: async (data) => {
      const response = await fetchWithTimeout(`${API_BASE}/configuracoes/empresa/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error));
      }
      return response.json();
    }
  },

  parametros: {
    list: async () => {
      const response = await fetchWithTimeout(`${API_BASE}/configuracoes/parametros/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar parâmetros');
      return response.json();
    },

    get: async (chave) => {
      const response = await fetchWithTimeout(`${API_BASE}/configuracoes/parametros/${chave}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar parâmetro');
      return response.json();
    },

    atualizar: async (chave, valor) => {
      const response = await fetchWithTimeout(`${API_BASE}/configuracoes/parametros/${chave}/`, mutationOptions('PUT', { valor }));
      if (!response.ok) throw new Error('Erro ao atualizar parâmetro');
      return response.json();
    },

    atualizarMultiplos: async (valores) => {
      // Backend espera formato: {"parametros": {chave: valor, ...}}
      const response = await fetchWithTimeout(`${API_BASE}/configuracoes/parametros/atualizar-multiplos/`, mutationOptions('POST', { parametros: valores }));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar parâmetros');
      }
      return response.json();
    },

    valores: async () => {
      const response = await fetchWithTimeout(`${API_BASE}/configuracoes/parametros/valores/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar valores');
      return response.json();
    }
  }
};

// ======================================
// RELATÓRIOS
// ======================================

export const relatoriosAPI = {
  gerar: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    // Backend usa GET em /relatorios/ com query params (tipo, formato, data_inicio, data_fim, etc)
    const response = await fetchWithTimeout(`${API_BASE}/relatorios/?${queryParams}`, defaultOptions);

    if (!response.ok) {
      // Tenta extrair mensagem de erro do JSON
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar relatorio');
      } catch {
        throw new Error('Erro ao gerar relatorio');
      }
    }

    // Verifica o Content-Type para determinar se é blob ou JSON
    const contentType = response.headers.get('Content-Type') || '';

    if (contentType.includes('application/json')) {
      // Se for JSON, retorna o JSON (para formato=json ou mensagens de erro)
      return response.json();
    } else {
      // Se for arquivo (CSV, XLSX, PDF), retorna blob
      return response.blob();
    }
  },

  tipos: () => {
    // Lista de tipos de relatorios disponiveis
    return [
      { id: 'ctes', nome: 'CT-es Emitidos', descricao: 'Relatorio de todos os CT-es emitidos no periodo' },
      { id: 'mdfes', nome: 'MDF-es Emitidos', descricao: 'Relatorio de manifestos de documentos fiscais' },
      { id: 'faturamento', nome: 'Faturamento', descricao: 'Relatorio financeiro com faturamento por periodo' },
      { id: 'pagamentos', nome: 'Pagamentos', descricao: 'Relatorio de pagamentos a agregados e proprios' },
      { id: 'veiculos', nome: 'Veiculos', descricao: 'Relatorio da frota de veiculos' },
      { id: 'manutencoes', nome: 'Manutencoes', descricao: 'Relatorio de manutencoes realizadas e agendadas' },
      { id: 'km_rodado', nome: 'KM Rodado', descricao: 'Relatorio de quilometragem por veiculo' },
    ];
  }
};

// ======================================
// DASHBOARD
// ======================================

export const dashboardAPI = {
  geral: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/dashboard/?${params}` : `${API_BASE}/dashboard/`;
    const response = await fetchWithTimeout(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar dashboard');
    return response.json();
  },

  cte: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/painel/cte/?${params}` : `${API_BASE}/painel/cte/`;
    const response = await fetchWithTimeout(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel CT-e');
    return response.json();
  },

  mdfe: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/painel/mdfe/?${params}` : `${API_BASE}/painel/mdfe/`;
    const response = await fetchWithTimeout(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel MDF-e');
    return response.json();
  },

  financeiro: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/painel/financeiro/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel financeiro');
    return response.json();
  },

  geografico: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/painel/geografico/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel geográfico');
    return response.json();
  },

  manutencao: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/manutencao/painel/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel de manutenção');
    return response.json();
  },

  frota: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/painel/frota/?${params}` : `${API_BASE}/painel/frota/`;
    const response = await fetchWithTimeout(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel de frota');
    return response.json();
  },

  performance: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/painel/performance/?${params}` : `${API_BASE}/painel/performance/`;
    const response = await fetchWithTimeout(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel de performance');
    return response.json();
  },

  alertasPagamentos: async (dias = 7) => {
    const response = await fetchWithTimeout(`${API_BASE}/alertas/pagamentos/?dias=${dias}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar alertas de pagamentos');
    return response.json();
  }
};

// ======================================
// BACKUP
// ======================================

export const backupAPI = {
  list: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/backup/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao listar backups');
    const data = await response.json();
    // Backend retorna lista direta, frontend espera { backups: [...] } ou lista
    return Array.isArray(data) ? data : (data.results || data.backups || []);
  },

  gerar: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/backup/gerar/`, mutationOptions('POST'));
    // Backend retorna FileResponse (blob) em caso de sucesso
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao gerar backup');
    }
    // Se sucesso, pode ser blob ou JSON
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    // Se for arquivo, retorna blob
    return { success: true, message: 'Backup gerado com sucesso!', blob: await response.blob() };
  },

  download: async (backupId) => {
    // Backend usa ID do registro: /backup/{id}/download/
    const response = await fetchWithTimeout(`${API_BASE}/backup/${backupId}/download/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar backup');
    return response.blob();
  },

  restaurar: async (file) => {
    const formData = new FormData();
    // Backend espera campo 'arquivo_backup'
    formData.append('arquivo_backup', file);

    const response = await fetchWithTimeout(`${API_BASE}/backup/restaurar/`, {
      credentials: 'include',
      method: 'POST',
      headers: {
        'X-CSRFToken': getCSRFToken(),
      },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao restaurar backup');
    }
    return response.json();
  }
};

// ======================================
// ALERTAS
// ======================================

export const alertasAPI = {
  sistema: {
    list: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetchWithTimeout(`${API_BASE}/alertas/sistema/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar alertas do sistema');
      return response.json();
    },

    get: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/alertas/sistema/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar alerta');
      return response.json();
    },

    create: async (data) => {
      const response = await fetchWithTimeout(`${API_BASE}/alertas/sistema/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error));
      }
      return response.json();
    },

    update: async (id, data) => {
      const response = await fetchWithTimeout(`${API_BASE}/alertas/sistema/${id}/`, mutationOptions('PUT', data));
      if (!response.ok) throw new Error('Erro ao atualizar alerta');
      return response.json();
    },

    delete: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/alertas/sistema/${id}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar alerta');
      return true;
    },

    marcarLido: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/alertas/sistema/${id}/marcar_lido/`, mutationOptions('PATCH'));
      if (!response.ok) throw new Error('Erro ao marcar como lido');
      return response.json();
    },

    marcarResolvido: async (id) => {
      const response = await fetchWithTimeout(`${API_BASE}/alertas/sistema/${id}/marcar_resolvido/`, mutationOptions('PATCH'));
      if (!response.ok) throw new Error('Erro ao marcar como resolvido');
      return response.json();
    },

    limparTodos: async () => {
      const response = await fetchWithTimeout(`${API_BASE}/alertas/sistema/limpar_todos/`, mutationOptions('POST'));
      if (!response.ok) throw new Error('Erro ao limpar alertas');
      return response.json();
    }
  },

  pagamentos: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/alertas/pagamentos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar alertas de pagamentos');
    return response.json();
  }
};

// ======================================
// FAIXAS KM
// ======================================

export const faixasKmAPI = {
  list: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/faixas-km/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar faixas de KM');
    return response.json();
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/faixas-km/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar faixa de KM');
    return response.json();
  },

  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/faixas-km/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/faixas-km/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar faixa de KM');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/faixas-km/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar faixa de KM');
    return true;
  },

  // Busca a faixa correspondente a um valor de KM
  buscarPorKm: async (km) => {
    const response = await fetchWithTimeout(`${API_BASE}/faixas-km/buscar_por_km/?km=${km}`, defaultOptions);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Nenhuma faixa encontrada para este KM');
    }
    return response.json();
  }
};

// ======================================
// DOCUMENTOS ANEXOS
// ======================================

export const documentosAPI = {
  // Lista geral de documentos (para admin/gerenciamento)
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/documentos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar documentos');
    return response.json();
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/documentos/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar documento');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/documentos/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar documento');
    return true;
  },

  download: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/documentos/${id}/download/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar documento');
    return response.blob();
  },

  view: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/documentos/${id}/download/?inline=1`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao visualizar documento');
    return response.blob();
  },

  // Documentos de Clientes
  clientes: {
    list: async (clienteId) => {
      const response = await fetchWithTimeout(`${API_BASE}/clientes/${clienteId}/documentos/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar documentos do cliente');
      return response.json();
    },

    upload: async (clienteId, file, dados = {}) => {
      const formData = new FormData();
      formData.append('arquivo', file);
      if (dados.tipo) formData.append('tipo', dados.tipo);
      if (dados.nome) formData.append('nome', dados.nome);
      if (dados.validade) formData.append('validade', dados.validade);
      if (dados.observacoes) formData.append('observacoes', dados.observacoes);

      const response = await fetchWithTimeout(`${API_BASE}/clientes/${clienteId}/documentos/`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Erro ao enviar documento'));
      }
      return response.json();
    },

    delete: async (clienteId, documentoId) => {
      const response = await fetchWithTimeout(`${API_BASE}/clientes/${clienteId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar documento');
      return true;
    },

    update: async (clienteId, documentoId, dados) => {
      const response = await fetchWithCSRFRetry(`${API_BASE}/clientes/${clienteId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'PATCH',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify(dados),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Erro ao atualizar documento'));
      }
      return response.json();
    }
  },

  // Documentos de Motoristas
  motoristas: {
    list: async (motoristaId) => {
      const response = await fetchWithTimeout(`${API_BASE}/motoristas/${motoristaId}/documentos/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar documentos do motorista');
      return response.json();
    },

    upload: async (motoristaId, file, dados = {}) => {
      const formData = new FormData();
      formData.append('arquivo', file);
      if (dados.tipo) formData.append('tipo', dados.tipo);
      if (dados.nome) formData.append('nome', dados.nome);
      if (dados.validade) formData.append('validade', dados.validade);
      if (dados.observacoes) formData.append('observacoes', dados.observacoes);

      const response = await fetchWithTimeout(`${API_BASE}/motoristas/${motoristaId}/documentos/`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Erro ao enviar documento'));
      }
      return response.json();
    },

    delete: async (motoristaId, documentoId) => {
      const response = await fetchWithTimeout(`${API_BASE}/motoristas/${motoristaId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar documento');
      return true;
    },

    update: async (motoristaId, documentoId, dados) => {
      const response = await fetchWithCSRFRetry(`${API_BASE}/motoristas/${motoristaId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'PATCH',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify(dados),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Erro ao atualizar documento'));
      }
      return response.json();
    }
  },

  // Documentos de Veículos
  veiculos: {
    list: async (veiculoId) => {
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/documentos/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar documentos do veículo');
      return response.json();
    },

    upload: async (veiculoId, file, dados = {}) => {
      const formData = new FormData();
      formData.append('arquivo', file);
      if (dados.tipo) formData.append('tipo', dados.tipo);
      if (dados.nome) formData.append('nome', dados.nome);
      if (dados.validade) formData.append('validade', dados.validade);
      if (dados.observacoes) formData.append('observacoes', dados.observacoes);

      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/documentos/`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Erro ao enviar documento'));
      }
      return response.json();
    },

    delete: async (veiculoId, documentoId) => {
      const response = await fetchWithTimeout(`${API_BASE}/veiculos/${veiculoId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar documento');
      return true;
    },

    update: async (veiculoId, documentoId, dados) => {
      const response = await fetchWithCSRFRetry(`${API_BASE}/veiculos/${veiculoId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'PATCH',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify(dados),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Erro ao atualizar documento'));
      }
      return response.json();
    }
  },

  // Documentos de CT-es
  ctes: {
    list: async (cteId) => {
      const response = await fetchWithTimeout(`${API_BASE}/ctes/${cteId}/documentos/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar documentos do CT-e');
      return response.json();
    },

    upload: async (cteId, file, dados = {}) => {
      const formData = new FormData();
      formData.append('arquivo', file);
      if (dados.tipo) formData.append('tipo', dados.tipo);
      if (dados.nome) formData.append('nome', dados.nome);
      if (dados.validade) formData.append('validade', dados.validade);
      if (dados.observacoes) formData.append('observacoes', dados.observacoes);

      const response = await fetchWithTimeout(`${API_BASE}/ctes/${cteId}/documentos/`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'X-CSRFToken': getCSRFToken() },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Erro ao enviar documento'));
      }
      return response.json();
    },

    delete: async (cteId, documentoId) => {
      const response = await fetchWithTimeout(`${API_BASE}/ctes/${cteId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar documento');
      return true;
    },

    update: async (cteId, documentoId, dados) => {
      const response = await fetchWithCSRFRetry(`${API_BASE}/ctes/${cteId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'PATCH',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify(dados),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(extractErrorMessage(error, 'Erro ao atualizar documento'));
      }
      return response.json();
    }
  },

};

// ======================================
// USUÁRIOS (Admin)
// ======================================

export const usuariosAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/usuarios/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar usuários');
    return response.json();
  },

  listAll: async (filters = {}) => {
    const firstPage = await usuariosAPI.list(filters);
    if (Array.isArray(firstPage)) return firstPage;

    const users = [...(firstPage.results || [])];
    let next = firstPage.next;
    let pageCount = 1;
    const maxPages = 100;

    while (next && pageCount < maxPages) {
      const nextUrl = new URL(next, window.location.origin);
      if (nextUrl.origin !== window.location.origin) {
        throw new Error('A paginação de usuários retornou um endereço inválido.');
      }
      const response = await fetchWithTimeout(
        `${nextUrl.pathname}${nextUrl.search}`,
        defaultOptions
      );
      if (!response.ok) await handleHttpError(response, 'Erro ao buscar todos os usuários');
      const page = await response.json();
      users.push(...(page.results || []));
      next = page.next;
      pageCount += 1;
    }

    if (next) {
      throw new Error('A lista de usuários excedeu o limite seguro de paginação. Refine os filtros.');
    }
    return users;
  },

  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/usuarios/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar usuário');
    return response.json();
  },

  create: async (data) => {
    const response = await fetchWithCSRFRetry(`${API_BASE}/usuarios/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(extractErrorMessage(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetchWithCSRFRetry(`${API_BASE}/usuarios/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) await handleHttpError(response, 'Erro ao atualizar usuário');
    return response.json();
  },

  patch: async (id, data) => {
    const response = await fetchWithCSRFRetry(`${API_BASE}/usuarios/${id}/`, mutationOptions('PATCH', data));
    if (!response.ok) await handleHttpError(response, 'Erro ao atualizar usuário');
    return response.json();
  },

  delete: async (id, data) => {
    const response = await fetchWithCSRFRetry(
      `${API_BASE}/usuarios/${validateId(id, 'Usuário')}/`,
      mutationOptions('DELETE', data)
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao remover usuário');
    if (response.status === 204) return { success: true, is_active: false };
    return response.json();
  },

  getAccessCatalog: async () => {
    const response = await fetchWithTimeout(
      `${API_BASE}/usuarios/catalogo-acessos/`,
      defaultOptions
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao buscar catálogo de acessos');
    return response.json();
  },

  getAccess: async (id) => {
    const response = await fetchWithTimeout(
      `${API_BASE}/usuarios/${validateId(id, 'Usuário')}/acessos/`,
      defaultOptions
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao buscar acessos do usuário');
    return response.json();
  },

  updateAccess: async (id, data) => {
    const response = await fetchWithCSRFRetry(
      `${API_BASE}/usuarios/${validateId(id, 'Usuário')}/acessos/`,
      mutationOptions('PUT', data)
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao atualizar acessos do usuário');
    return response.json();
  },

  updateStatus: async (id, data) => {
    const response = await fetchWithCSRFRetry(
      `${API_BASE}/usuarios/${validateId(id, 'Usuário')}/status/`,
      mutationOptions('PATCH', data)
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao alterar status do usuário');
    return response.json();
  },

  resetPassword: async (id, data) => {
    const response = await fetchWithCSRFRetry(
      `${API_BASE}/usuarios/${validateId(id, 'Usuário')}/redefinir-senha/`,
      mutationOptions('POST', data)
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao redefinir senha do usuário');
    return response.json();
  },

  getAccessAudit: async (id, filters = {}) => {
    const params = new URLSearchParams(filters);
    const query = params.toString();
    const response = await fetchWithTimeout(
      `${API_BASE}/usuarios/${validateId(id, 'Usuário')}/auditoria/${query ? `?${query}` : ''}`,
      defaultOptions
    );
    if (!response.ok) await handleHttpError(response, 'Erro ao buscar histórico de acessos');
    return response.json();
  },

  // Endpoint para o usuario atual gerenciar seu proprio perfil
  me: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/users/me/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar perfil');
    return response.json();
  },

  updateMe: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/users/me/`, mutationOptions('PATCH', data));
    if (!response.ok) throw new Error('Erro ao atualizar perfil');
    return response.json();
  }
};

// ======================================
// EXTERNAL APIs (ViaCEP, BrasilAPI)
// ======================================

export const externalAPI = {
  /**
   * Busca endereco pelo CEP usando a API ViaCEP
   * @param {string} cep - CEP (apenas numeros, 8 digitos)
   * @returns {Promise<Object>} Dados do endereco ou erro
   */
  buscarCEP: async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      throw new Error('CEP deve ter 8 digitos');
    }

    const response = await fetchWithTimeout(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    if (!response.ok) {
      throw new Error('Erro ao consultar CEP. Tente novamente.');
    }

    const data = await response.json();
    if (data.erro) {
      throw new Error('CEP nao encontrado');
    }

    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      estado: data.uf || '',
      complemento: data.complemento || ''
    };
  },

  /**
   * Busca dados da empresa pelo CNPJ usando a BrasilAPI
   * @param {string} cnpj - CNPJ (apenas numeros, 14 digitos)
   * @returns {Promise<Object>} Dados da empresa ou erro
   */
  buscarCNPJ: async (cnpj) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      throw new Error('CNPJ deve ter 14 digitos');
    }

    const response = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('CNPJ nao encontrado na base da Receita Federal');
      }
      throw new Error('Erro ao consultar CNPJ. Tente novamente.');
    }

    const data = await response.json();

    return {
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || '',
      email: data.email || '',
      telefone: data.ddd_telefone_1 || '',
      cep: data.cep ? data.cep.toString() : '',
      logradouro: data.logradouro || '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.municipio || '',
      estado: data.uf || ''
    };
  }
};

// APIs individuais para importação direta
export const contasPagarAPI = conciliacaoAPI.contasPagar;

// ======================================
// CIOT
// ======================================
export const ciotAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/ciots/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar CIOTs');
    return response.json();
  },
  get: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ciots/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar CIOT');
    return response.json();
  },
  create: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/ciots/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(error, 'Erro ao criar CIOT'));
    }
    return response.json();
  },
  update: async (id, data) => {
    const response = await fetchWithTimeout(`${API_BASE}/ciots/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(error, 'Erro ao atualizar CIOT'));
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ciots/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar CIOT');
    return true;
  },
  cancelar: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ciots/${id}/cancelar/`, mutationOptions('POST', {}));
    if (!response.ok) throw new Error('Erro ao cancelar CIOT');
    return response.json();
  },
  usar: async (id) => {
    const response = await fetchWithTimeout(`${API_BASE}/ciots/${id}/usar/`, mutationOptions('POST', {}));
    if (!response.ok) throw new Error('Erro ao marcar CIOT como usado');
    return response.json();
  },
  resumo: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/ciots/resumo/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar resumo');
    return response.json();
  }
};

// ======================================
// COMUNICAÇÃO (E-mail / WhatsApp)
// ======================================
export const comunicacaoAPI = {
  enviar: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/comunicacoes/enviar/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(error, 'Erro ao enviar comunicação'));
    }
    return response.json();
  },
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetchWithTimeout(`${API_BASE}/comunicacoes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar histórico');
    return response.json();
  },
  testarWhatsapp: async () => {
    const response = await fetchWithTimeout(`${API_BASE}/comunicacoes/whatsapp/testar/`, defaultOptions);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(error, 'Erro ao testar conexão WhatsApp'));
    }
    return response.json();
  }
};

// ======================================
// GPS / RASTREAMENTO
// ======================================
export const gpsAPI = {
  enviarWebhook: async (data) => {
    const response = await fetchWithTimeout(`${API_BASE}/gps/webhook/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(extractErrorMessage(error, 'Erro ao enviar posição GPS'));
    }
    return response.json();
  },
  ultimaPosicaoVeiculo: async (veiculoId) => {
    const response = await fetchWithTimeout(`${API_BASE}/gps/veiculos/${veiculoId}/ultima-posicao/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar última posição');
    return response.json();
  }
};

// Exportar tudo
export default {
  auth: authAPI,
  clientes: clientesAPI,
  motoristas: motoristasAPI,
  veiculos: veiculosAPI,
  cte: cteAPI,
  mdfe: mdfeAPI,
  upload: uploadAPI,
  pagamentos: pagamentosAPI,
  manutencao: manutencaoAPI,
  financeiro: financeiroAPI,
  conciliacao: conciliacaoAPI,
  config: configAPI,
  relatorios: relatoriosAPI,
  dashboard: dashboardAPI,
  backup: backupAPI,
  alertas: alertasAPI,
  faixasKm: faixasKmAPI,
  documentos: documentosAPI,
  usuarios: usuariosAPI,
  perfis: perfisAPI,
  external: externalAPI,
  gps: gpsAPI,
  comunicacao: comunicacaoAPI,
  ciot: ciotAPI,
};
