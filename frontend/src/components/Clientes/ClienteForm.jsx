import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clientesAPI } from '../../services/api';
import Loading from '../Common/Loading';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import './ClientesList.css';

function ClienteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    tipo_pessoa: 'PJ',
    razao_social: '',
    nome_fantasia: '',
    cnpj_cpf: '',
    inscricao_estadual: '',
    email: '',
    telefone: '',
    celular: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    observacoes: '',
    ativo: true
  });

  useEffect(() => {
    if (isEditing) {
      loadCliente();
    }
  }, [id]);

  const loadCliente = async () => {
    try {
      setLoading(true);
      const result = await clientesAPI.get(id);
      setFormData({
        tipo_pessoa: result.tipo_pessoa || 'PJ',
        razao_social: result.razao_social || '',
        nome_fantasia: result.nome_fantasia || '',
        cnpj_cpf: result.cnpj_cpf || '',
        inscricao_estadual: result.inscricao_estadual || '',
        email: result.email || '',
        telefone: result.telefone || '',
        celular: result.celular || '',
        cep: result.cep || '',
        logradouro: result.logradouro || '',
        numero: result.numero || '',
        complemento: result.complemento || '',
        bairro: result.bairro || '',
        cidade: result.cidade || '',
        uf: result.uf || '',
        observacoes: result.observacoes || '',
        ativo: result.ativo !== false
      });
    } catch (err) {
      console.error('Erro ao carregar cliente:', err);
      setError('Erro ao carregar dados do cliente.');
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

  const handleCepBlur = async () => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          logradouro: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          uf: data.uf || ''
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    }
  };

  const formatCNPJCPF = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (formData.tipo_pessoa === 'PF') {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .slice(0, 14);
    }
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      .slice(0, 18);
  };

  const formatCEP = (value) => {
    return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
  };

  const formatTelefone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        await clientesAPI.update(id, formData);
      } else {
        await clientesAPI.create(formData);
      }
      navigate('/clientes');
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      try {
        const errorData = JSON.parse(err.message);
        const messages = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('; ');
        setError(messages);
      } catch {
        setError('Erro ao salvar cliente. Verifique os dados e tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className="cliente-form-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h1>
          <p>{isEditing ? 'Atualize os dados do cliente' : 'Cadastre um novo cliente'}</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="alert-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-section">
          <h3>Identificacao</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Pessoa *</label>
              <select
                name="tipo_pessoa"
                value={formData.tipo_pessoa}
                onChange={(e) => {
                  handleChange(e);
                  setFormData(prev => ({ ...prev, cnpj_cpf: '' }));
                }}
              >
                <option value="PJ">Pessoa Juridica</option>
                <option value="PF">Pessoa Fisica</option>
              </select>
            </div>

            <div className="form-group">
              <label>{formData.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'} *</label>
              <input
                type="text"
                name="cnpj_cpf"
                value={formData.cnpj_cpf}
                onChange={(e) => setFormData({...formData, cnpj_cpf: formatCNPJCPF(e.target.value)})}
                required
                placeholder={formData.tipo_pessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{formData.tipo_pessoa === 'PF' ? 'Nome Completo' : 'Razao Social'} *</label>
              <input
                type="text"
                name="razao_social"
                value={formData.razao_social}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Nome Fantasia</label>
              <input
                type="text"
                name="nome_fantasia"
                value={formData.nome_fantasia}
                onChange={handleChange}
              />
            </div>
          </div>

          {formData.tipo_pessoa === 'PJ' && (
            <div className="form-group" style={{ maxWidth: '300px' }}>
              <label>Inscricao Estadual</label>
              <input
                type="text"
                name="inscricao_estadual"
                value={formData.inscricao_estadual}
                onChange={handleChange}
                placeholder="Isento ou numero"
              />
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Contato</h3>

          <div className="form-row">
            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="form-group">
              <label>Telefone</label>
              <input
                type="text"
                name="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({...formData, telefone: formatTelefone(e.target.value)})}
                placeholder="(00) 0000-0000"
              />
            </div>

            <div className="form-group">
              <label>Celular</label>
              <input
                type="text"
                name="celular"
                value={formData.celular}
                onChange={(e) => setFormData({...formData, celular: formatTelefone(e.target.value)})}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Endereco</h3>

          <div className="form-row">
            <div className="form-group" style={{ maxWidth: '150px' }}>
              <label>CEP</label>
              <input
                type="text"
                name="cep"
                value={formData.cep}
                onChange={(e) => setFormData({...formData, cep: formatCEP(e.target.value)})}
                onBlur={handleCepBlur}
                placeholder="00000-000"
              />
            </div>

            <div className="form-group" style={{ flex: 2 }}>
              <label>Logradouro</label>
              <input
                type="text"
                name="logradouro"
                value={formData.logradouro}
                onChange={handleChange}
                placeholder="Rua, Avenida, etc."
              />
            </div>

            <div className="form-group" style={{ maxWidth: '100px' }}>
              <label>Numero</label>
              <input
                type="text"
                name="numero"
                value={formData.numero}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Complemento</label>
              <input
                type="text"
                name="complemento"
                value={formData.complemento}
                onChange={handleChange}
                placeholder="Sala, Andar, etc."
              />
            </div>

            <div className="form-group">
              <label>Bairro</label>
              <input
                type="text"
                name="bairro"
                value={formData.bairro}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Cidade</label>
              <input
                type="text"
                name="cidade"
                value={formData.cidade}
                onChange={handleChange}
              />
            </div>

            <div className="form-group" style={{ maxWidth: '100px' }}>
              <label>UF</label>
              <select
                name="uf"
                value={formData.uf}
                onChange={handleChange}
              >
                <option value="">--</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Informacoes Adicionais</h3>

          <div className="form-group">
            <label>Observacoes</label>
            <textarea
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows="3"
              placeholder="Observacoes sobre o cliente..."
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="ativo"
                checked={formData.ativo}
                onChange={handleChange}
              />
              Cliente Ativo
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/clientes')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Cadastrar')}
          </button>
        </div>
      </form>

      {/* Documentos Anexos - apenas na edicao */}
      {isEditing && (
        <DocumentosAnexos
          entidadeTipo="cliente"
          entidadeId={id}
        />
      )}
    </div>
  );
}

export default ClienteForm;
