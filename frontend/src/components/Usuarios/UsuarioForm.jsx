import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usuariosAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import './Usuarios.css';

function UsuarioForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
    is_active: true,
    is_staff: false,
    is_superuser: false
  });

  const loadUsuario = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usuariosAPI.get(id);
      setFormData({
        ...data,
        password: '',
        password_confirm: ''
      });
    } catch (err) {
      setError(err.message || 'Erro ao carregar usuário');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      loadUsuario();
    }
  }, [isEdit, loadUsuario]);

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
        is_staff: formData.is_staff,
        is_superuser: formData.is_superuser
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
    <div className="usuario-form-container">
      <div className="form-header">
        <div className="form-title">
          <span className="form-icon">{formIcon}</span>
          <h2>{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h2>
        </div>
        <button type="button" className="btn-back" onClick={() => navigate('/usuarios')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Voltar
        </button>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="usuario-form">
        <fieldset>
          <legend>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Dados de Acesso
          </legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="username">Nome de Usuário <span className="required">*</span></label>
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
              <small className="field-hint">Usado para fazer login no sistema</small>
            </div>

            <div className="form-group">
              <label htmlFor="email">E-mail <span className="required">*</span></label>
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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">
                Senha {!isEdit && <span className="required">*</span>}
              </label>
              <div className="password-input-wrapper">
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
                  className="btn-toggle-password"
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
              {isEdit && <small className="field-hint">Deixe em branco para manter a senha atual</small>}
            </div>

            <div className="form-group">
              <label htmlFor="password_confirm">
                Confirmar Senha {!isEdit && formData.password && <span className="required">*</span>}
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

        <fieldset>
          <legend>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Informações Pessoais
          </legend>

          <div className="form-row">
            <div className="form-group">
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

            <div className="form-group">
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

        <fieldset>
          <legend>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Permissões
          </legend>

          <div className="permissions-grid">
            <div className="permission-card">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                <span className="checkmark"></span>
                <div className="permission-info">
                  <span className="permission-title">Usuário Ativo</span>
                  <span className="permission-description">Permite acesso ao sistema</span>
                </div>
              </label>
            </div>

            <div className="permission-card">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="is_staff"
                  checked={formData.is_staff}
                  onChange={handleChange}
                />
                <span className="checkmark"></span>
                <div className="permission-info">
                  <span className="permission-title">Staff</span>
                  <span className="permission-description">Acesso ao painel administrativo Django</span>
                </div>
              </label>
            </div>

            <div className="permission-card">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="is_superuser"
                  checked={formData.is_superuser}
                  onChange={handleChange}
                />
                <span className="checkmark"></span>
                <div className="permission-info">
                  <span className="permission-title">Superusuário</span>
                  <span className="permission-description">Todas as permissões do sistema</span>
                </div>
              </label>
            </div>
          </div>
        </fieldset>

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate('/usuarios')}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Cancelar
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Salvando...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                {isEdit ? 'Atualizar' : 'Cadastrar'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default UsuarioForm;
