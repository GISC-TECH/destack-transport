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
const mutationOptions = (method, data) => ({
  ...defaultOptions,
  method,
  headers: {
    ...defaultOptions.headers,
    'X-CSRFToken': getCSRFToken(),
  },
  body: data ? JSON.stringify(data) : undefined,
});

// Helper para refresh do CSRF token
async function refreshCSRFToken() {
  try {
    const response = await fetch(`${API_BASE}/auth/csrf/`, defaultOptions);
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
async function fetchWithCSRFRetry(url, options, retried = false) {
  const response = await fetch(url, options);

  // Se for 403 e ainda não tentamos retry, atualizar CSRF e tentar novamente
  if (response.status === 403 && !retried) {
    console.log('CSRF token expirado, atualizando...');
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
      return fetchWithCSRFRetry(url, newOptions, true);
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

// Helper para tratar erros HTTP com mensagens específicas
const handleHttpError = async (response, defaultMsg) => {
  if (response.status === 404) {
    throw new Error('Recurso não encontrado. Verifique se o registro existe.');
  }
  if (response.status === 403) {
    throw new Error('Acesso negado. Você não tem permissão para esta ação.');
  }
  try {
    const error = await response.json();
    throw new Error(JSON.stringify(error));
  } catch (e) {
    if (e.message.startsWith('{')) throw e; // Já é um JSON
    throw new Error(defaultMsg);
  }
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

    const response = await fetch(`${API_BASE}/auth/login/`, {
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
    const response = await fetch(`${API_BASE}/auth/logout/`, {
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
    const response = await fetch(`${API_BASE}/auth/user/`, defaultOptions);
    if (!response.ok) throw new Error('Não autenticado');
    return response.json();
  },

  // Busca CSRF token - o token fica no cookie após esta chamada
  fetchCSRFToken: async () => {
    const response = await fetch(`${API_BASE}/auth/csrf/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao obter CSRF token');
    // O importante é que esta chamada seta o cookie CSRF
    // O token retornado no JSON é o mesmo do cookie
    return response.json();
  },

  // Alias para compatibilidade
  getCSRFToken: async () => {
    return authAPI.fetchCSRFToken();
  }
};

// ======================================
// CLIENTES
// ======================================

export const clientesAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/clientes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar clientes');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/clientes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar cliente');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/clientes/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/clientes/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar cliente');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/clientes/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar cliente');
    return true;
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/clientes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar clientes');

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
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/motoristas/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar motoristas');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/motoristas/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar motorista');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/motoristas/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/motoristas/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar motorista');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/motoristas/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar motorista');
    return true;
  },

  vencimentos: async (dias = 30) => {
    const response = await fetch(`${API_BASE}/motoristas/vencimentos/?dias=${dias}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar vencimentos');
    return response.json();
  },

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
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/veiculos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar veículos');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/veiculos/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar veículo');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/veiculos/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/veiculos/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar veículo');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/veiculos/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar veículo');
    return true;
  },

  vencimentos: async (dias = 30) => {
    const response = await fetch(`${API_BASE}/veiculos/vencimentos/?dias=${dias}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar vencimentos');
    return response.json();
  },

  estatisticas: async (id) => {
    const response = await fetch(`${API_BASE}/veiculos/${id}/estatisticas/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar estatísticas');
    return response.json();
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/veiculos/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar veículos');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veiculos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  compartimentos: {
    list: async (veiculoId) => {
      validateId(veiculoId, 'ID do veículo');
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/`, defaultOptions);
      if (!response.ok) await handleHttpError(response, 'Erro ao buscar compartimentos');
      return response.json();
    },

    create: async (veiculoId, data) => {
      validateId(veiculoId, 'ID do veículo');
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/`, mutationOptions('POST', data));
      if (!response.ok) await handleHttpError(response, 'Erro ao criar compartimento');
      return response.json();
    },

    update: async (veiculoId, compartimentoId, data) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(compartimentoId, 'ID do compartimento');
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/${compartimentoId}/`, mutationOptions('PUT', data));
      if (!response.ok) await handleHttpError(response, 'Erro ao atualizar compartimento');
      return response.json();
    },

    delete: async (veiculoId, compartimentoId) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(compartimentoId, 'ID do compartimento');
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/compartimentos/${compartimentoId}/`, {
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
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/manutencoes/?${params}`, defaultOptions);
      if (!response.ok) await handleHttpError(response, 'Erro ao buscar manutenções do veículo');
      return response.json();
    },

    get: async (veiculoId, manutencaoId) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(manutencaoId, 'ID da manutenção');
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/manutencoes/${manutencaoId}/`, defaultOptions);
      if (!response.ok) await handleHttpError(response, 'Erro ao buscar manutenção');
      return response.json();
    },

    create: async (veiculoId, data) => {
      validateId(veiculoId, 'ID do veículo');
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/manutencoes/`, mutationOptions('POST', data));
      if (!response.ok) await handleHttpError(response, 'Erro ao criar manutenção');
      return response.json();
    },

    update: async (veiculoId, manutencaoId, data) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(manutencaoId, 'ID da manutenção');
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/manutencoes/${manutencaoId}/`, mutationOptions('PUT', data));
      if (!response.ok) await handleHttpError(response, 'Erro ao atualizar manutenção');
      return response.json();
    },

    delete: async (veiculoId, manutencaoId) => {
      validateId(veiculoId, 'ID do veículo');
      validateId(manutencaoId, 'ID da manutenção');
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/manutencoes/${manutencaoId}/`, {
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
    const response = await fetch(`${API_BASE}/ctes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar CT-es');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/ctes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar CT-e');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/ctes/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/ctes/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar CT-e');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/ctes/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar CT-e');
    return true;
  },

  cancelar: async (id, justificativa) => {
    const response = await fetch(`${API_BASE}/ctes/${id}/cancelar/`, mutationOptions('POST', { justificativa }));
    if (!response.ok) throw new Error('Erro ao cancelar CT-e');
    return response.json();
  },

  downloadPDF: async (id) => {
    const response = await fetch(`${API_BASE}/ctes/${id}/dacte/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar DACTE');
    return response.blob();
  },

  downloadXML: async (id) => {
    const response = await fetch(`${API_BASE}/ctes/${id}/xml/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar XML');
    return response.blob();
  },

  reprocessar: async (id) => {
    const response = await fetch(`${API_BASE}/ctes/${id}/reprocessar/`, mutationOptions('POST'));
    if (!response.ok) throw new Error('Erro ao reprocessar CT-e');
    return response.json();
  },

  estatisticas: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/ctes/estatisticas/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar estatísticas');
    return response.json();
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/ctes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar CT-es');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  marcarPagamento: async (id, pago, observacao = null, dataPagamento = null) => {
    const data = { pago };
    if (observacao !== null) {
      data.observacao_pagamento = observacao;
    }
    if (dataPagamento !== null) {
      data.data_pagamento = dataPagamento;
    }
    const response = await fetch(`${API_BASE}/ctes/${id}/pagamento/`, mutationOptions('PATCH', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar status de pagamento');
    }
    return response.json();
  },

  pagamentosPendentes: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/ctes/pagamentos_pendentes/?${params}`, defaultOptions);
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
    const response = await fetch(`${API_BASE}/mdfes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar MDF-es');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar MDF-e');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/mdfes/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar MDF-e');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar MDF-e');
    return true;
  },

  encerrar: async (id, data) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/encerrar/`, mutationOptions('POST', data));
    if (!response.ok) throw new Error('Erro ao encerrar MDF-e');
    return response.json();
  },

  cancelar: async (id, justificativa) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/cancelar/`, mutationOptions('POST', { justificativa }));
    if (!response.ok) throw new Error('Erro ao cancelar MDF-e');
    return response.json();
  },

  downloadPDF: async (id) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/damdfe/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar DAMDFE');
    return response.blob();
  },

  downloadXML: async (id) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/xml/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar XML');
    return response.blob();
  },

  reprocessar: async (id) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/reprocessar/`, mutationOptions('POST'));
    if (!response.ok) throw new Error('Erro ao reprocessar MDF-e');
    return response.json();
  },

  documentos: async (id) => {
    const response = await fetch(`${API_BASE}/mdfes/${id}/documentos/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar documentos vinculados');
    return response.json();
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/mdfes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar MDF-es');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mdfes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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

    const response = await fetch(`${API_BASE}/upload/`, {
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

    const response = await fetch(`${API_BASE}/upload/batch_upload/`, {
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

  historico: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/upload/historico/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar histórico');
    return response.json();
  }
};

// ======================================
// PAGAMENTOS
// ======================================

export const pagamentosAPI = {
  // API para pagamentos de agregados (motoristas terceirizados)
  agregados: {
    list: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_BASE}/pagamentos/agregados/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar pagamentos de agregados');
      return response.json();
    },

    get: async (id) => {
      const response = await fetch(`${API_BASE}/pagamentos/agregados/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar pagamento');
      return response.json();
    },

    create: async (data) => {
      const response = await fetch(`${API_BASE}/pagamentos/agregados/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }
      return response.json();
    },

    update: async (id, data) => {
      const response = await fetch(`${API_BASE}/pagamentos/agregados/${id}/`, mutationOptions('PUT', data));
      if (!response.ok) throw new Error('Erro ao atualizar pagamento');
      return response.json();
    },

    delete: async (id) => {
      const response = await fetch(`${API_BASE}/pagamentos/agregados/${id}/`, {
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
      const response = await fetch(`${API_BASE}/pagamentos/agregados/export/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao exportar pagamentos');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagamentos_agregados_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },

    // Converte pagamento agregado para próprio
    converterParaProprio: async (id, data = {}) => {
      const response = await fetch(`${API_BASE}/pagamentos/agregados/${id}/converter-para-proprio/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao converter pagamento');
      }
      return response.json();
    }
  },

  // API para pagamentos próprios (veículos da empresa)
  proprios: {
    list: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_BASE}/pagamentos/proprios/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar pagamentos próprios');
      return response.json();
    },

    get: async (id) => {
      const response = await fetch(`${API_BASE}/pagamentos/proprios/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar pagamento');
      return response.json();
    },

    create: async (data) => {
      const response = await fetch(`${API_BASE}/pagamentos/proprios/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }
      return response.json();
    },

    update: async (id, data) => {
      const response = await fetch(`${API_BASE}/pagamentos/proprios/${id}/`, mutationOptions('PUT', data));
      if (!response.ok) throw new Error('Erro ao atualizar pagamento');
      return response.json();
    },

    delete: async (id) => {
      const response = await fetch(`${API_BASE}/pagamentos/proprios/${id}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar pagamento');
      return true;
    },

    // Calcular valores por KM
    calcularKm: async (veiculoId, kmInicial, kmFinal) => {
      const params = new URLSearchParams({ veiculo_id: veiculoId, km_inicial: kmInicial, km_final: kmFinal });
      const response = await fetch(`${API_BASE}/pagamentos/proprios/calcular_km/?${params}`, defaultOptions);
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
      const response = await fetch(`${API_BASE}/pagamentos/proprios/export/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao exportar pagamentos');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pagamentos_proprios_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },

    // Converte pagamento próprio para agregado
    converterParaAgregado: async (id, data) => {
      const response = await fetch(`${API_BASE}/pagamentos/proprios/${id}/converter-para-agregado/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao converter pagamento');
      }
      return response.json();
    }
  },

  // Métodos legados para compatibilidade
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/pagamentos/agregados/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar pagamentos');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/pagamentos/agregados/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar pagamento');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/pagamentos/agregados/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/pagamentos/agregados/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar pagamento');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/pagamentos/agregados/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar pagamento');
    return true;
  },

  marcarPago: async (id) => {
    const response = await fetch(`${API_BASE}/pagamentos/agregados/${id}/pagar/`, mutationOptions('POST'));
    if (!response.ok) throw new Error('Erro ao marcar como pago');
    return response.json();
  },

  resumo: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/pagamentos/resumo/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar resumo');
    return response.json();
  }
};

// ======================================
// MANUTENÇÃO
// ======================================

export const manutencaoAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/manutencoes/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar manutenções');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/manutencoes/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar manutenção');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/manutencoes/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/manutencoes/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar manutenção');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/manutencoes/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar manutenção');
    return true;
  },

  resumo: async () => {
    const response = await fetch(`${API_BASE}/manutencoes/resumo/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar resumo');
    return response.json();
  },

  export: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/manutencoes/export/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao exportar manutenções');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manutencoes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Painel de manutenção
  painel: {
    indicadores: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_BASE}/manutencao/painel/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar indicadores');
      return response.json();
    },

    graficos: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_BASE}/manutencao/painel/graficos/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar gráficos');
      return response.json();
    },

    ultimos: async (limite = 10) => {
      const response = await fetch(`${API_BASE}/manutencao/painel/ultimos/?limite=${limite}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar últimas manutenções');
      return response.json();
    },

    tendencias: async (filters = {}) => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_BASE}/manutencao/painel/tendencias/?${params}`, defaultOptions);
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
    const response = await fetch(`${API_BASE}/painel/financeiro/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel financeiro');
    return response.json();
  },

  mensal: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/financeiro/mensal/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar dados mensais');
    return response.json();
  },

  detalhe: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/financeiro/detalhe/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar detalhes');
    return response.json();
  },

  faturamento: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/financeiro/faturamento/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar faturamento');
    return response.json();
  },

  evolucao: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/financeiro/evolucao/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar evolução');
    return response.json();
  }
};

// ======================================
// CONFIGURAÇÕES
// ======================================

export const configAPI = {
  empresa: {
    get: async () => {
      const response = await fetch(`${API_BASE}/configuracoes/empresa/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar dados da empresa');
      return response.json();
    },

    save: async (data) => {
      const response = await fetch(`${API_BASE}/configuracoes/empresa/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }
      return response.json();
    }
  },

  parametros: {
    list: async () => {
      const response = await fetch(`${API_BASE}/configuracoes/parametros/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar parâmetros');
      return response.json();
    },

    get: async (chave) => {
      const response = await fetch(`${API_BASE}/configuracoes/parametros/${chave}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar parâmetro');
      return response.json();
    },

    atualizar: async (chave, valor) => {
      const response = await fetch(`${API_BASE}/configuracoes/parametros/${chave}/`, mutationOptions('PUT', { valor }));
      if (!response.ok) throw new Error('Erro ao atualizar parâmetro');
      return response.json();
    },

    atualizarMultiplos: async (valores) => {
      // Backend espera formato: {"parametros": {chave: valor, ...}}
      const response = await fetch(`${API_BASE}/configuracoes/parametros/atualizar-multiplos/`, mutationOptions('POST', { parametros: valores }));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar parâmetros');
      }
      return response.json();
    },

    valores: async () => {
      const response = await fetch(`${API_BASE}/configuracoes/parametros/valores/`, defaultOptions);
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
    const response = await fetch(`${API_BASE}/relatorios/?${queryParams}`, defaultOptions);

    if (!response.ok) {
      // Tenta extrair mensagem de erro do JSON
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar relatorio');
      } catch (e) {
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
    const response = await fetch(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar dashboard');
    return response.json();
  },

  cte: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/painel/cte/?${params}` : `${API_BASE}/painel/cte/`;
    const response = await fetch(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel CT-e');
    return response.json();
  },

  mdfe: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/painel/mdfe/?${params}` : `${API_BASE}/painel/mdfe/`;
    const response = await fetch(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel MDF-e');
    return response.json();
  },

  financeiro: async () => {
    const response = await fetch(`${API_BASE}/painel/financeiro/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel financeiro');
    return response.json();
  },

  geografico: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/painel/geografico/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel geográfico');
    return response.json();
  },

  manutencao: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/manutencao/painel/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel de manutenção');
    return response.json();
  },

  frota: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/painel/frota/?${params}` : `${API_BASE}/painel/frota/`;
    const response = await fetch(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel de frota');
    return response.json();
  },

  performance: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const url = params.toString() ? `${API_BASE}/painel/performance/?${params}` : `${API_BASE}/painel/performance/`;
    const response = await fetch(url, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar painel de performance');
    return response.json();
  },

  alertasPagamentos: async (dias = 7) => {
    const response = await fetch(`${API_BASE}/alertas/pagamentos/?dias=${dias}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar alertas de pagamentos');
    return response.json();
  }
};

// ======================================
// BACKUP
// ======================================

export const backupAPI = {
  list: async () => {
    const response = await fetch(`${API_BASE}/backup/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao listar backups');
    const data = await response.json();
    // Backend retorna lista direta, frontend espera { backups: [...] } ou lista
    return Array.isArray(data) ? data : (data.results || data.backups || []);
  },

  gerar: async () => {
    const response = await fetch(`${API_BASE}/backup/gerar/`, mutationOptions('POST'));
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
    const response = await fetch(`${API_BASE}/backup/${backupId}/download/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar backup');
    return response.blob();
  },

  restaurar: async (file) => {
    const formData = new FormData();
    // Backend espera campo 'arquivo_backup'
    formData.append('arquivo_backup', file);

    const response = await fetch(`${API_BASE}/backup/restaurar/`, {
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
      const response = await fetch(`${API_BASE}/alertas/sistema/?${params}`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar alertas do sistema');
      return response.json();
    },

    get: async (id) => {
      const response = await fetch(`${API_BASE}/alertas/sistema/${id}/`, defaultOptions);
      if (!response.ok) throw new Error('Erro ao buscar alerta');
      return response.json();
    },

    create: async (data) => {
      const response = await fetch(`${API_BASE}/alertas/sistema/`, mutationOptions('POST', data));
      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }
      return response.json();
    },

    update: async (id, data) => {
      const response = await fetch(`${API_BASE}/alertas/sistema/${id}/`, mutationOptions('PUT', data));
      if (!response.ok) throw new Error('Erro ao atualizar alerta');
      return response.json();
    },

    delete: async (id) => {
      const response = await fetch(`${API_BASE}/alertas/sistema/${id}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar alerta');
      return true;
    },

    marcarLido: async (id) => {
      const response = await fetch(`${API_BASE}/alertas/sistema/${id}/marcar_lido/`, mutationOptions('POST'));
      if (!response.ok) throw new Error('Erro ao marcar como lido');
      return response.json();
    },

    limparTodos: async () => {
      const response = await fetch(`${API_BASE}/alertas/sistema/limpar_todos/`, mutationOptions('POST'));
      if (!response.ok) throw new Error('Erro ao limpar alertas');
      return response.json();
    }
  },

  pagamentos: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/alertas/pagamentos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar alertas de pagamentos');
    return response.json();
  }
};

// ======================================
// FAIXAS KM
// ======================================

export const faixasKmAPI = {
  list: async () => {
    const response = await fetch(`${API_BASE}/faixas-km/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar faixas de KM');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/faixas-km/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar faixa de KM');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/faixas-km/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/faixas-km/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar faixa de KM');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/faixas-km/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar faixa de KM');
    return true;
  }
};

// ======================================
// DOCUMENTOS ANEXOS
// ======================================

export const documentosAPI = {
  // Lista geral de documentos (para admin/gerenciamento)
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/documentos/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar documentos');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/documentos/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar documento');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/documentos/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar documento');
    return true;
  },

  download: async (id) => {
    const response = await fetch(`${API_BASE}/documentos/${id}/download/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao baixar documento');
    return response.blob();
  },

  // Documentos de Clientes
  clientes: {
    list: async (clienteId) => {
      const response = await fetch(`${API_BASE}/clientes/${clienteId}/documentos/`, defaultOptions);
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

      const response = await fetch(`${API_BASE}/clientes/${clienteId}/documentos/`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || JSON.stringify(error) || 'Erro ao enviar documento');
      }
      return response.json();
    },

    delete: async (clienteId, documentoId) => {
      const response = await fetch(`${API_BASE}/clientes/${clienteId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar documento');
      return true;
    }
  },

  // Documentos de Motoristas
  motoristas: {
    list: async (motoristaId) => {
      const response = await fetch(`${API_BASE}/motoristas/${motoristaId}/documentos/`, defaultOptions);
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

      const response = await fetch(`${API_BASE}/motoristas/${motoristaId}/documentos/`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || JSON.stringify(error) || 'Erro ao enviar documento');
      }
      return response.json();
    },

    delete: async (motoristaId, documentoId) => {
      const response = await fetch(`${API_BASE}/motoristas/${motoristaId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar documento');
      return true;
    }
  },

  // Documentos de Veículos
  veiculos: {
    list: async (veiculoId) => {
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/documentos/`, defaultOptions);
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

      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/documentos/`, {
        credentials: 'include',
        method: 'POST',
        headers: {
          'X-CSRFToken': getCSRFToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || JSON.stringify(error) || 'Erro ao enviar documento');
      }
      return response.json();
    },

    delete: async (veiculoId, documentoId) => {
      const response = await fetch(`${API_BASE}/veiculos/${veiculoId}/documentos/${documentoId}/`, {
        ...defaultOptions,
        method: 'DELETE',
        headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
      });
      if (!response.ok) throw new Error('Erro ao deletar documento');
      return true;
    }
  }
};

// ======================================
// USUÁRIOS (Admin)
// ======================================

export const usuariosAPI = {
  list: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE}/usuarios/?${params}`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar usuários');
    return response.json();
  },

  get: async (id) => {
    const response = await fetch(`${API_BASE}/usuarios/${id}/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar usuário');
    return response.json();
  },

  create: async (data) => {
    const response = await fetch(`${API_BASE}/usuarios/`, mutationOptions('POST', data));
    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }
    return response.json();
  },

  update: async (id, data) => {
    const response = await fetch(`${API_BASE}/usuarios/${id}/`, mutationOptions('PUT', data));
    if (!response.ok) throw new Error('Erro ao atualizar usuário');
    return response.json();
  },

  patch: async (id, data) => {
    const response = await fetch(`${API_BASE}/usuarios/${id}/`, mutationOptions('PATCH', data));
    if (!response.ok) throw new Error('Erro ao atualizar usuário');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_BASE}/usuarios/${id}/`, {
      ...defaultOptions,
      method: 'DELETE',
      headers: { ...defaultOptions.headers, 'X-CSRFToken': getCSRFToken() },
    });
    if (!response.ok) throw new Error('Erro ao deletar usuário');
    return true;
  },

  // Endpoint para o usuário atual gerenciar seu próprio perfil
  me: async () => {
    const response = await fetch(`${API_BASE}/usuarios/me/`, defaultOptions);
    if (!response.ok) throw new Error('Erro ao buscar perfil');
    return response.json();
  },

  updateMe: async (data) => {
    const response = await fetch(`${API_BASE}/usuarios/me/`, mutationOptions('PATCH', data));
    if (!response.ok) throw new Error('Erro ao atualizar perfil');
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
  config: configAPI,
  relatorios: relatoriosAPI,
  dashboard: dashboardAPI,
  backup: backupAPI,
  alertas: alertasAPI,
  faixasKm: faixasKmAPI,
  documentos: documentosAPI,
  usuarios: usuariosAPI,
};
