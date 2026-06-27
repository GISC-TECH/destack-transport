import { useState, useEffect, useCallback } from 'react';
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
    nr35_validade: '',
    mopp_validade: '',
    toxicologico_validade: '',
    aso_validade: '',
    telefone: '',
    email: '',
    tipo_chave_pix: '',
    chave_pix: '',
    banco: '',
    agencia: '',
    conta: '',
    tipo_conta: '',
    favorecido: '',
    ativo: true
  });

  const loadMotorista = useCallback(async () => {
    try {
      setLoading(true);
      const data = await motoristasAPI.get(id);
      // Converter valores null para string vazia nos campos de data
      setFormData({
        ...data,
        validade_cnh: data.validade_cnh || '',
        nr20_validade: data.nr20_validade || '',
        nr35_validade: data.nr35_validade || '',
        mopp_validade: data.mopp_validade || '',
        toxicologico_validade: data.toxicologico_validade || '',
        aso_validade: data.aso_validade || '',
        telefone: data.telefone || '',
        email: data.email || '',
        tipo_chave_pix: data.tipo_chave_pix || '',
        chave_pix: data.chave_pix || '',
        banco: data.banco || '',
        agencia: data.agencia || '',
        conta: data.conta || '',
        tipo_conta: data.tipo_conta || '',
        favorecido: data.favorecido || ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      loadMotorista();
    }
  }, [isEdit, loadMotorista]);

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
        nr35_validade: formData.nr35_validade || null,
        mopp_validade: formData.mopp_validade || null,
        toxicologico_validade: formData.toxicologico_validade || null,
        aso_validade: formData.aso_validade || null,
        tipo_chave_pix: formData.tipo_chave_pix || null,
        chave_pix: formData.chave_pix || null,
        banco: formData.banco || null,
        agencia: formData.agencia || null,
        conta: formData.conta || null,
        tipo_conta: formData.tipo_conta || null,
        favorecido: formData.favorecido || null
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
              <label htmlFor="nr35_validade">Validade NR35</label>
              <input
                type="date"
                id="nr35_validade"
                name="nr35_validade"
                value={formData.nr35_validade || ''}
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
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="toxicologico_validade">Validade Exame Toxicol.</label>
              <input
                type="date"
                id="toxicologico_validade"
                name="toxicologico_validade"
                value={formData.toxicologico_validade || ''}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="aso_validade">Validade ASO</label>
              <input
                type="date"
                id="aso_validade"
                name="aso_validade"
                value={formData.aso_validade || ''}
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

        <fieldset>
          <legend>Dados Bancários / Pix</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tipo_chave_pix">Tipo de Chave Pix</label>
              <select
                id="tipo_chave_pix"
                name="tipo_chave_pix"
                value={formData.tipo_chave_pix || ''}
                onChange={handleChange}
              >
                <option value="">Selecione...</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="celular">Celular</option>
                <option value="email">E-mail</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>

            <div className="form-group span-2">
              <label htmlFor="chave_pix">Chave Pix</label>
              <input
                type="text"
                id="chave_pix"
                name="chave_pix"
                value={formData.chave_pix || ''}
                onChange={handleChange}
                placeholder="Digite a chave Pix"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="banco">Banco</label>
              <input
                type="text"
                id="banco"
                name="banco"
                value={formData.banco || ''}
                onChange={handleChange}
                placeholder="Nome do banco"
              />
            </div>

            <div className="form-group">
              <label htmlFor="agencia">Agência</label>
              <input
                type="text"
                id="agencia"
                name="agencia"
                value={formData.agencia || ''}
                onChange={handleChange}
                placeholder="Agência"
              />
            </div>

            <div className="form-group">
              <label htmlFor="conta">Conta</label>
              <input
                type="text"
                id="conta"
                name="conta"
                value={formData.conta || ''}
                onChange={handleChange}
                placeholder="Conta"
              />
            </div>

            <div className="form-group">
              <label htmlFor="tipo_conta">Tipo de Conta</label>
              <select
                id="tipo_conta"
                name="tipo_conta"
                value={formData.tipo_conta || ''}
                onChange={handleChange}
              >
                <option value="">Selecione...</option>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="salario">Salário</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group full">
              <label htmlFor="favorecido">Favorecido</label>
              <input
                type="text"
                id="favorecido"
                name="favorecido"
                value={formData.favorecido || ''}
                onChange={handleChange}
                placeholder="Nome do titular da conta, se diferente do motorista"
              />
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
