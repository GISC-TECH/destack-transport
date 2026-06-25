import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const initializeAuth = useCallback(async () => {
    try {
      // Primeiro, buscar o CSRF token para todas as requisições futuras
      await authAPI.fetchCSRFToken();

      // Depois, verificar se já está autenticado
      const response = await authAPI.checkAuth();
      if (response.authenticated) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Inicializacao de autenticacao ao montar o provider.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    initializeAuth();
  }, [initializeAuth]);

  const checkAuth = async () => {
    try {
      const response = await authAPI.checkAuth();
      if (response.authenticated) {
        setUser(response.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  const login = async (username, password) => {
    try {
      // O authAPI.login já garante que o CSRF token está disponível
      const response = await authAPI.login(username, password);

      if (response.success) {
        setUser(response.user);
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
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
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
