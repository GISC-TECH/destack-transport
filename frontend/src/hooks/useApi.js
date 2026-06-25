import useSWR from 'swr';

// Em desenvolvimento sempre usa o proxy local (/api). Em produção pode usar URL absoluta.
const API_BASE = (import.meta.env.PROD && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : '/api';

async function fetcher(url) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = new Error('Erro ao carregar dados');
    error.status = response.status;
    error.info = await response.json().catch(() => ({}));
    throw error;
  }

  return response.json();
}

/**
 * Hook baseado em SWR para consumir endpoints da API com cache,
 * revalidação em foco e retry automático.
 *
 * @param {string} path - Caminho relativo da API (ex: '/dashboard/')
 * @param {object} options - Opções adicionais do SWR
 */
export function useApi(path, options = {}) {
  const url = path ? `${API_BASE}${path}` : null;

  return useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000, // 1 minuto
    errorRetryCount: 2,
    ...options,
  });
}

export default useApi;
