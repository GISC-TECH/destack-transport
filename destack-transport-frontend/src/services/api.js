import axios from 'axios';
import { useAuthStore } from '@/store/authStore'; // Será criado a seguir

const apiClient = axios.create({
  baseURL: '/api', // Usará o proxy configurado no vite.config.js durante o desenvolvimento
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar o token JWT aos cabeçalhos das requisições autenticadas
apiClient.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore(); // Obter a store dentro do interceptor
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Opcional: Interceptor para lidar com erros 401 (Não Autorizado) globalmente
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const authStore = useAuthStore();
      authStore.logout(); // Deslogar o usuário se o token for inválido/expirado
    }
    return Promise.reject(error);
  }
);

export default apiClient;