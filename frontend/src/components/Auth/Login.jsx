import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Erro ao fazer login');
      }
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Emissão de CT-e e MDF-e integrada à SEFAZ',
    'Repasses a motoristas e DRE em tempo real',
    'Frota, compliance e analytics em um só lugar'
  ];

  return (
    <div className="auth-split" role="main">
      {/* Painel da marca */}
      <aside className="auth-brand">
        <div className="auth-brand-glow" aria-hidden="true"></div>

        <div className="auth-brand-top">
          <div className="auth-logo">
            <span className="auth-logo-tile" aria-hidden="true">D</span>
            <span className="auth-logo-text">
              <strong>Destack</strong>
              <small>Transport ERP</small>
            </span>
          </div>

          <h2 className="auth-headline">Gestão completa de transporte e logística</h2>
          <p className="auth-sub">
            Emissão fiscal, financeiro, frota e inteligência operacional em uma única plataforma.
          </p>

          <ul className="auth-features">
            {features.map((f, i) => (
              <li key={i}>
                <span className="auth-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="13" height="13">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-copy">&copy; 2026 Destack Transportes Ltda &middot; Belo Horizonte/MG</p>
      </aside>

      {/* Painel do formulario */}
      <div className="auth-form-side">
        <form onSubmit={handleSubmit} className="auth-card" aria-label="Formulario de login">
          <span className="auth-eyebrow">Bem-vindo de volta</span>
          <h1 className="auth-title">Acessar o sistema</h1>

          {error && (
            <div className="auth-error" role="alert" aria-live="assertive">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="username">Usuário</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário"
              required
              disabled={loading}
              autoComplete="username"
              aria-label="Nome de usuário"
              aria-required="true"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Senha</label>
            <div className="auth-pass">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                disabled={loading}
                autoComplete="current-password"
                aria-label="Senha"
                aria-required="true"
              />
              <button
                type="button"
                className="auth-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="auth-row">
            <label className="auth-check-label">
              <input type="checkbox" defaultChecked disabled={loading} />
              Manter conectado
            </label>
            <button type="button" className="auth-link">Esqueci minha senha</button>
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
            aria-busy={loading}
            aria-label={loading ? 'Processando login' : 'Entrar no sistema'}
          >
            {loading ? (
              <>
                <span className="auth-spinner" aria-hidden="true"></span>
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>

          <p className="auth-secure">Ambiente seguro &middot; Certificado digital A1 ativo</p>
        </form>
      </div>
    </div>
  );
}

export default Login;
