import apiClient from './api';

export default {
  getDashboardCards(params = {}) {
    // O backend espera 'periodo', 'data_inicio', 'data_fim' como query params
    return apiClient.get('/dashboard/cards', { params });
  },

  getUltimosLancamentos(params = {}) {
    // O backend espera 'limit' como query param
    return apiClient.get('/dashboard/lancamentos', { params });
  },

  getCifFobData(params = {}) {
    // O backend espera 'periodo', 'data_inicio', 'data_fim' como query params
    return apiClient.get('/dashboard/cif-fob', { params });
  }
};