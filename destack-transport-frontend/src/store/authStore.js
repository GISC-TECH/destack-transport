import { defineStore } from 'pinia';
import authService from '@/services/authService';
import router from '@/router'; // Importar o router para navegação

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('authToken') || null,
    user: JSON.parse(localStorage.getItem('authUser')) || null,
    // isAuthenticated é melhor derivado da presença do token e validade potencial
    loginError: null,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token, // Usuário está autenticado se houver um token
    currentUser: (state) => state.user,
    isLoading: (state) => state.loading,
    authError: (state) => state.loginError,
  },

  actions: {
    async login(credentials) {
      this.loading = true;
      this.loginError = null;
      try {
        const response = await authService.login(credentials);
        // A API Go retorna token, expires_at, e user
        const { token, user } = response.data;

        this.token = token;
        this.user = user;

        localStorage.setItem('authToken', token);
        localStorage.setItem('authUser', JSON.stringify(user));
        // Opcional: localStorage.setItem('authTokenExpiresAt', expires_at);

        // O interceptor do Axios em api.js já deve adicionar o token automaticamente
        // para requisições subsequentes.

        await router.push(router.currentRoute.value.query.redirect || '/'); // Redireciona para home ou rota anterior
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Falha no login. Verifique suas credenciais.';
        this.loginError = errorMessage;
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        console.error('Erro no login:', error);
        throw new Error(errorMessage); // Re-throw para o componente poder tratar se necessário
      } finally {
        this.loading = false;
      }
    },

    logout() {
      // Chamar API de logout do backend se existir
      authService.logout().finally(() => {
        this.token = null;
        this.user = null;
        this.loginError = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        // localStorage.removeItem('authTokenExpiresAt');
        router.push('/login').catch(err => {
          if (err.name !== 'NavigationDuplicated') { // Ignora erro se já estiver na página de login
            console.error(err);
          }
        });
      });
    },

    async fetchProfile() {
      if (!this.token) return;
      try {
        const response = await authService.getProfile();
        this.user = response.data; // A API Go retorna os dados do perfil
        localStorage.setItem('authUser', JSON.stringify(this.user));
      } catch (error) {
        console.error('Erro ao buscar perfil, possível token inválido:', error);
        this.logout(); // Deslogar se o token for inválido
      }
    },

    // Tenta carregar o estado de autenticação do localStorage ao iniciar a app
    // Isso pode ser chamado em App.vue ou main.js
    async tryAutoLogin() {
        const token = localStorage.getItem('authToken');
        if (token) {
            this.token = token;
            this.user = JSON.parse(localStorage.getItem('authUser'));
            // É uma boa prática validar o token com o backend aqui
            await this.fetchProfile();
        }
    },

    clearLoginError() {
        this.loginError = null;
    }
  },
});