import apiClient from './api';

export default {
  login(credentials) {
    // A URL completa será /api/auth/login devido ao baseURL e ao proxy
    return apiClient.post('/auth/login', credentials);
  },
  getProfile() {
    return apiClient.get('/auth/profile');
  },
  // O logout no frontend geralmente envolve limpar o token e o estado local.
  // Se o backend tiver um endpoint de logout (ex: para invalidar o token no servidor), chame-o aqui.
  logout() {
    // Exemplo: return apiClient.post('/auth/logout');
    return Promise.resolve(); // Por enquanto, apenas resolve, o store cuidará do resto.
  }
};