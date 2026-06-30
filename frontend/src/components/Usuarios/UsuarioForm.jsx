import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usuariosAPI, perfisAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import styles from './UsuarioForm.module.css';

function UsuarioForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [perfis, setPerfis] = useState([]);
  const [perfisLoading, setPerfisLoading] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
    is_active: true,
    perfil: 'Operacional'
  });

  const detectarPerfil = (data) => {
    if (data.is_superuser) return 'Super Admin';
    const grupoPerfil = (data.groups || []).find(g =>
      ['Leitura', 'Operacional', 'Financeiro', 'Administrativo'].includes(g)
    );
    return grupoPerfil || 'Operacional';
  };

  const loadUsuario = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usuariosAPI.get(id);
      setFormData({
        ...data,
        password: '',
        password_confirm: '',
        perfil: detectarPerfil(data)
      });
    } catch (err) {
      setError(err.message || 'Erro ao carregar usuário');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadPerfis = useCallback(async () => {
    try {
      setPerfisLoading(true);
      const data = await perfisAPI.list();
      setPerfis(data.perfis || []);
    } catch (err) {
      console.error('Erro ao carregar perfis:', err);
      setPerfis([]);
    } finally {
      setPerfisLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPerfis();
    if (isEdit) {
      loadUsuario();
    }
  }, [isEdit, loadUsuario, loadPerfis]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    if (!formData.username.trim()) {
      setError('Nome de usuário é obrigatório');
      return false;
    }

    if (!formData.email.trim()) {
      setError('E-mail é obrigatório');
      return false;
    }

    // Validação de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('E-mail inválido');
      return false;
    }

    // Se não for edição, senha é obrigatória
    if (!isEdit && !formData.password) {
      setError('Senha é obrigatória para novos usuários');
      return false;
    }

    // Se tem senha, validar confirmação
    if (formData.password) {
      if (formData.password.length < 8) {
        setError('A senha deve ter pelo menos 8 caracteres');
        return false;
      }

      if (formData.password !== formData.password_confirm) {
        setError('As senhas não conferem');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dataToSend = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        is_active: formData.is_active,
        perfil: formData.perfil
      };

      // Só envia senha se foi preenchida
      if (formData.password) {
        dataToSend.password = formData.password;
      }

      if (isEdit) {
        await usuariosAPI.update(id, dataToSend);
      } else {
        await usuariosAPI.create(dataToSend);
      }

      navigate('/usuarios');
    } catch (err) {
      setError(err.message || 'Erro ao salvar usuário');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit && !formData.username) {
    return <Loading message="Carregando usuário..." />;
  }

  const formIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title={isEdit ? 'Editar Usuário' : 'Novo Usuário'}
        icon={formIcon}
        actions={
          <Button type="button" variant="outline" onClick={() => navigate('/usuarios')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Voltar
          </Button>
        }
      />

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      <form onSubmit={handleSubmit} className={styles.form}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Dados de Acesso
          </legend>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="username">Nome de Usuário <span className={styles.required}>*</span></label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                maxLength={150}
                placeholder="Digite o nome de usuário"
                autoComplete="username"
              />
              <small className={styles.fieldHint}>Usado para fazer login no sistema</small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">E-mail <span className={styles.required}>*</span></label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                maxLength={255}
                placeholder="usuario@exemplo.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="password">
                Senha {!isEdit && <span className={styles.required}>*</span>}
              </label>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  minLength={8}
                  placeholder={isEdit ? '(deixe em branco para manter)' : 'Mínimo 8 caracteres'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.btnTogglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
              {isEdit && <small className={styles.fieldHint}>Deixe em branco para manter a senha atual</small>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password_confirm">
                Confirmar Senha {!isEdit && formData.password && <span className={styles.required}>*</span>}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password_confirm"
                name="password_confirm"
                value={formData.password_confirm}
                onChange={handleChange}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Informações Pessoais
          </legend>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="first_name">Nome</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                maxLength={150}
                placeholder="Primeiro nome"
                autoComplete="given-name"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="last_name">Sobrenome</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                maxLength={150}
                placeholder="Sobrenome"
                autoComplete="family-name"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Status e Perfil de Acesso
          </legend>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span className={styles.checkmark}></span>
                <div className={styles.permissionInfo}>
                  <span className={styles.permissionTitle}>Usuário Ativo</span>
                  <span className={styles.permissionDescription}>Permite acesso ao sistema</span>
                </div>
              </label>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="perfil">Perfil de Permissões <span className={styles.required}>*</span></label>
              <select
                id="perfil"
                name="perfil"
                value={formData.perfil}
                onChange={handleChange}
                disabled={perfisLoading}
                required
              >
                {perfisLoading && <option value="">Carregando perfis...</option>}
                {!perfisLoading && perfis.map(perfil => (
                  <option key={perfil.nome} value={perfil.nome}>
                    {perfil.nome} — {perfil.descricao}
                  </option>
                ))}
                <option value="Super Admin">Super Admin — Acesso total ao sistema</option>
              </select>
              <small className={styles.fieldHint}>
                Define o que o usuário pode ver e fazer no sistema
              </small>
            </div>
          </div>
        </fieldset>

        <div className={styles.formActions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/usuarios')}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={loading}>
            {loading ? 'Salvando...' : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                {isEdit ? 'Atualizar' : 'Cadastrar'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default UsuarioForm;
