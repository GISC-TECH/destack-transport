import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motoristasAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import './MotoristaForm.css';

function MotoristaForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    cnh: '',
    categoria_cnh: 'E',
    validade_cnh: '',
    nr20_validade: '',
    mopp_validade: '',
    telefone: '',
    email: '',
    ativo: true
  });

  useEffect(() => {
    if (isEdit) {
      loadMotorista();
    }
  }, [id]);

  const loadMotorista = async () => {
    try {
      setLoading(true);
      const data = await motoristasAPI.get(id);
      setFormData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const formatCPF = (value) => {
    const digits = value.replace(/\D/g, '').substring(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleCPFChange = (e) => {
    const formatted = formatCPF(e.target.value);
    setFormData(prev => ({ ...prev, cpf: formatted }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Converte strings vazias para null nos campos de data
      const dataToSend = {
        ...formData,
        cpf: formData.cpf.replace(/\D/g, ''),
        validade_cnh: formData.validade_cnh || null,
        nr20_validade: formData.nr20_validade || null,
        mopp_validade: formData.mopp_validade || null
      };

      if (isEdit) {
        await motoristasAPI.update(id, dataToSend);
        toast.success('Motorista atualizado com sucesso!');
      } else {
        await motoristasAPI.create(dataToSend);
        toast.success('Motorista cadastrado com sucesso!');
      }

      setTimeout(() => navigate('/motoristas'), 500);
    } catch (err) {
      setError(err.message);
      toast.error('Erro ao salvar motorista. Verifique os dados.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit && !formData.nome) {
    return <Loading message="Carregando motorista..." />;
  }

  return (
    <div className="motorista-form-container">
      <div className="form-header">
        <h2>{isEdit ? 'Editar Motorista' : 'Novo Motorista'}</h2>
        <button type="button" className="btn-back" onClick={() => navigate('/motoristas')}>
          ← Voltar
        </button>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="motorista-form">
        <fieldset>
          <legend>Dados Pessoais</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nome">Nome Completo <span className="required">*</span></label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                required
                maxLength={255}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cpf">CPF <span className="required">*</span></label>
              <input
                type="text"
                id="cpf"
                name="cpf"
                value={formData.cpf}
                onChange={handleCPFChange}
                required
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="telefone">Telefone</label>
              <input
                type="tel"
                id="telefone"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                maxLength={255}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Documentação</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cnh">CNH <span className="required">*</span></label>
              <input
                type="text"
                id="cnh"
                name="cnh"
                value={formData.cnh}
                onChange={handleChange}
                required
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label htmlFor="categoria_cnh">Categoria CNH <span className="required">*</span></label>
              <select
                id="categoria_cnh"
                name="categoria_cnh"
                value={formData.categoria_cnh}
                onChange={handleChange}
                required
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="validade_cnh">Validade CNH</label>
              <input
                type="date"
                id="validade_cnh"
                name="validade_cnh"
                value={formData.validade_cnh || ''}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nr20_validade">Validade NR20</label>
              <input
                type="date"
                id="nr20_validade"
                name="nr20_validade"
                value={formData.nr20_validade || ''}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="mopp_validade">Validade MOPP</label>
              <input
                type="date"
                id="mopp_validade"
                name="mopp_validade"
                value={formData.mopp_validade || ''}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="ativo"
                  checked={formData.ativo}
                  onChange={handleChange}
                />
                Motorista Ativo
              </label>
            </div>
          </div>
        </fieldset>

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate('/motoristas')}
            disabled={loading}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Cadastrar')}
          </button>
        </div>
      </form>

      {/* Documentos Anexos - apenas na edicao */}
      {isEdit && (
        <DocumentosAnexos
          entidadeTipo="motorista"
          entidadeId={id}
        />
      )}
    </div>
  );
}

export default MotoristaForm;
