import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/images/logo.svg';
import styles from './Auth.module.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';
  const sessionExpired = new URLSearchParams(location.search).get('expired') === '1';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        navigate(from, { replace: true });
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
    <div className={styles.split} role="main">
      {/* Painel da marca */}
      <aside className={styles.brand}>
        <div className={styles.brandGlow} aria-hidden="true"></div>

        <div className={styles.brandTop}>
          <div className={styles.logo}>
            <img src={logo} alt="Destack Transporte" className={styles.logoImg} />
          </div>

          <h2 className={styles.headline}>Gestão completa de transporte e logística</h2>
          <p className={styles.sub}>
            Emissão fiscal, financeiro, frota e inteligência operacional em uma única plataforma.
          </p>

          <ul className={styles.features}>
            {features.map((f, i) => (
              <li key={i}>
                <span className={styles.check} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="13" height="13">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className={styles.copy}>&copy; 2026 Destack Transportes Ltda &middot; Belo Horizonte/MG</p>
      </aside>

      {/* Painel do formulario */}
      <div className={styles.formSide}>
        <form onSubmit={handleSubmit} className={styles.card} aria-label="Formulario de login">
          <span className={styles.eyebrow}>Bem-vindo de volta</span>
          <h1 className={styles.title}>Acessar o sistema</h1>

          {sessionExpired && (
            <div className={styles.warning} role="alert" aria-live="polite">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Sua sessão expirou. Faça login novamente para continuar.</span>
            </div>
          )}

          {error && (
            <div className={styles.error} role="alert" aria-live="assertive">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.field}>
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

          <div className={styles.field}>
            <label htmlFor="password">Senha</label>
            <div className={styles.pass}>
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
                className={styles.toggle}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-controls="password"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
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

          <div className={styles.row}>
            <label className={styles.checkLabel}>
              <input type="checkbox" defaultChecked disabled={loading} />
              Manter conectado
            </label>
            <button type="button" className={styles.link}>Esqueci minha senha</button>
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={loading}
            aria-busy={loading}
            aria-label={loading ? 'Processando login' : 'Entrar no sistema'}
          >
            {loading ? (
              <>
                <span className={styles.spinner} aria-hidden="true"></span>
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>

          <p className={styles.secure}>Ambiente seguro &middot; Certificado digital A1 ativo</p>
        </form>
      </div>
    </div>
  );
}

export default Login;
