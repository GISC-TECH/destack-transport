import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/store/authStore';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true } // Rota para usuários não autenticados
  },
  {
    path: '/ctes',
    name: 'CTes',
    component: () => import('../views/CTe/CTeListView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/mdfes',
    name: 'MDFes',
    component: () => import('../views/MDFe/MDFeListView.vue'),
    meta: { requiresAuth: true }
  },
  // Rota de fallback para URLs não encontradas
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue'), // Crie este componente
  },
  // Rota para upload de arquivos
  {
    path: '/uploads',
    name: 'Uploads',
    component: () => import('../views/Upload/UploadView.vue'),
    meta: { requiresAuth: true }
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Tenta carregar o estado de autenticação ao iniciar (se ainda não foi feito)
  // ou se a página for recarregada diretamente em uma rota protegida.
  if (authStore.token === null && localStorage.getItem('authToken')) {
    await authStore.tryAutoLogin(); // Tenta revalidar o token com o backend
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const guestOnly = to.matched.some(record => record.meta.guest);

  if (requiresAuth && !authStore.isAuthenticated) {
    // Se a rota requer autenticação e o usuário não está autenticado,
    // redireciona para a página de login, guardando a rota que ele tentou acessar.
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else if (guestOnly && authStore.isAuthenticated) {
    // Se a rota é apenas para visitantes (ex: login) e o usuário já está autenticado,
    // redireciona para o dashboard.
    next({ name: 'Dashboard' });
  } else {
    // Caso contrário, permite a navegação.
    next();
  }
});

export default router;