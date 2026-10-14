import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const DEFAULT_PERMISSIONS = {
  superuser: false,
  modulos: {},
  capabilities: {},
  version: null,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    try {
      const perms = await authAPI.getPermissions();
      const nextPermissions = { ...DEFAULT_PERMISSIONS, ...(perms || {}) };
      setPermissions(nextPermissions);
      setUser((currentUser) => currentUser ? {
        ...currentUser,
        is_superuser: !!nextPermissions.superuser,
      } : currentUser);
      return nextPermissions;
    } catch (error) {
      // Se a sessão expirou (401), desloga e redireciona para login.
      if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        setUser(null);
        setPermissions(DEFAULT_PERMISSIONS);
        window.location.href = '/login?expired=1';
        return;
      }
      setPermissions(DEFAULT_PERMISSIONS);
      return DEFAULT_PERMISSIONS;
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      // Primeiro, buscar o CSRF token para todas as requisições futuras
      await authAPI.fetchCSRFToken();

      // Depois, verificar se já está autenticado
      const response = await authAPI.checkAuth();
      if (response.authenticated) {
        setUser(response.user);
        await loadPermissions();
      } else {
        setUser(null);
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } catch {
      setUser(null);
      setPermissions(DEFAULT_PERMISSIONS);
    } finally {
      setLoading(false);
    }
  }, [loadPermissions]);

  useEffect(() => {
    // Inicializacao de autenticação ao montar o provider.

    initializeAuth();
  }, [initializeAuth]);

  // Recarrega permissões quando a aba/janela volta ao foco.
  // Isso garante que mudanças de perfil feitas em outra sessão/admin
  // sejam refletidas sem precisar de logout/login manual.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        loadPermissions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, loadPermissions]);

  // Revalida a autorização quando uma chamada informa que as permissões da
  // sessão mudaram. O backend continua sendo a fonte de verdade.
  useEffect(() => {
    const handlePermissionsChanged = () => {
      if (user) loadPermissions();
    };

    window.addEventListener('auth:permissions-changed', handlePermissionsChanged);
    return () => window.removeEventListener('auth:permissions-changed', handlePermissionsChanged);
  }, [user, loadPermissions]);

  // Escuta sessão expirada durante uso da aplicação e redireciona para login
  // Não redireciona se estiver na landing page (/) ou na página de login (/login)
  useEffect(() => {
    const handleSessionExpired = () => {
      const publicPaths = ['/', '/login'];
      const currentPath = window.location.pathname;
      if (!publicPaths.includes(currentPath)) {
        window.location.href = '/login?expired=1';
      }
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  const checkAuth = async () => {
    try {
      const response = await authAPI.checkAuth();
      if (response.authenticated) {
        setUser(response.user);
        await loadPermissions();
      } else {
        setUser(null);
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } catch {
      setUser(null);
      setPermissions(DEFAULT_PERMISSIONS);
    }
  };

  const login = async (username, password) => {
    try {
      // O authAPI.login já garante que o CSRF token está disponível
      const response = await authAPI.login(username, password);

      if (response.success) {
        setUser(response.user);
        await loadPermissions();
        return { success: true };
      }

      return { success: false, error: 'Credenciais inválidas' };
    } catch (error) {
      console.error('Erro no login:', error);
      return { success: false, error: error.message || 'Erro ao fazer login' };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
    setUser(null);
    setPermissions(DEFAULT_PERMISSIONS);
  };

  const refreshPermissions = loadPermissions;

  return (
    <AuthContext.Provider value={{
      user,
      permissions,
      loading,
      login,
      logout,
      checkAuth,
      refreshPermissions,
      permissionsVersion: permissions?.version ?? null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

export default AuthContext;
