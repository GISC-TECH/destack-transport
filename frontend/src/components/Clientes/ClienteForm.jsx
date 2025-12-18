import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clientesAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import './ClientesList.css';

function ClienteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    ie: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    distancia: '',
    tipo_frete: 'CIF',
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
        razao_social: result.razao_social || '',
        nome_fantasia: result.nome_fantasia || '',
        cnpj: result.cnpj || '',
        ie: result.ie || '',
        cep: result.cep || '',
        logradouro: result.logradouro || '',
        numero: result.numero || '',
        complemento: result.complemento || '',
        bairro: result.bairro || '',
        cidade: result.cidade || '',
        estado: result.estado || '',
        distancia: result.distancia || '',
        tipo_frete: result.tipo_frete || 'CIF',
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
          estado: data.uf || ''
        }));
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    }
  };

  const formatCNPJ = (value) => {
    const numbers = value.replace(/\D/g, '');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditing) {
        await clientesAPI.update(id, formData);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await clientesAPI.create(formData);
        toast.success('Cliente cadastrado com sucesso!');
      }
      setTimeout(() => navigate('/clientes'), 500);
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      toast.error('Erro ao salvar cliente. Verifique os dados.');
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
              <label>CNPJ *</label>
              <input
                type="text"
                name="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({...formData, cnpj: formatCNPJ(e.target.value)})}
                required
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="form-group">
              <label>Inscricao Estadual</label>
              <input
                type="text"
                name="ie"
                value={formData.ie}
                onChange={handleChange}
                placeholder="Isento ou numero"
                maxLength={20}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Razao Social *</label>
              <input
                type="text"
                name="razao_social"
                value={formData.razao_social}
                onChange={handleChange}
                required
                maxLength={255}
              />
            </div>

            <div className="form-group">
              <label>Nome Fantasia</label>
              <input
                type="text"
                name="nome_fantasia"
                value={formData.nome_fantasia}
                onChange={handleChange}
                maxLength={255}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Frete *</label>
              <select
                name="tipo_frete"
                value={formData.tipo_frete}
                onChange={handleChange}
                required
              >
                <option value="CIF">CIF (Remetente paga)</option>
                <option value="FOB">FOB (Destinatario paga)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Distancia (km)</label>
              <input
                type="number"
                name="distancia"
                value={formData.distancia}
                onChange={handleChange}
                placeholder="0"
                min="0"
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
                maxLength={255}
              />
            </div>

            <div className="form-group" style={{ maxWidth: '100px' }}>
              <label>Numero</label>
              <input
                type="text"
                name="numero"
                value={formData.numero}
                onChange={handleChange}
                maxLength={20}
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
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>Bairro</label>
              <input
                type="text"
                name="bairro"
                value={formData.bairro}
                onChange={handleChange}
                maxLength={100}
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
                maxLength={100}
              />
            </div>

            <div className="form-group" style={{ maxWidth: '100px' }}>
              <label>UF</label>
              <select
                name="estado"
                value={formData.estado}
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
