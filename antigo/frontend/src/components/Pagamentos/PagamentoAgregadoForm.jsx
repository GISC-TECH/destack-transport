import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pagamentosAPI } from '../../services/api';
import Loading from '../Common/Loading';
import './Pagamentos.css';

function PagamentoAgregadoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    placa: '',
    condutor_nome: '',
    condutor_cpf: '',
    valor_frete_total: '',
    percentual_repasse: '25.00',
    data_prevista: new Date().toISOString().split('T')[0],
    status: 'pendente',
    obs: ''
  });

  useEffect(() => {
    if (isEditing) {
      loadPagamento();
    }
  }, [id]);

  const loadPagamento = async () => {
    try {
      setLoading(true);
      const result = await pagamentosAPI.agregados.get(id);
      setFormData({
        placa: result.placa || '',
        condutor_nome: result.condutor_nome || '',
        condutor_cpf: result.condutor_cpf || '',
        valor_frete_total: result.valor_frete_total || '',
        percentual_repasse: result.percentual_repasse || '25.00',
        data_prevista: result.data_prevista || '',
        data_pagamento: result.data_pagamento || '',
        status: result.status || 'pendente',
        obs: result.obs || ''
      });
    } catch (err) {
      console.error('Erro ao carregar pagamento:', err);
      setError('Erro ao carregar dados do pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatCPF = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.slice(0, 11);
  };

  const handleCPFChange = (e) => {
    const formatted = formatCPF(e.target.value);
    setFormData(prev => ({ ...prev, condutor_cpf: formatted }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const data = {
        placa: formData.placa.toUpperCase(),
        condutor_nome: formData.condutor_nome,
        condutor_cpf: formData.condutor_cpf || null,
        valor_frete_total: parseFloat(formData.valor_frete_total),
        percentual_repasse: parseFloat(formData.percentual_repasse),
        data_prevista: formData.data_prevista,
        data_pagamento: formData.data_pagamento || null,
        status: formData.status,
        obs: formData.obs || ''
      };

      if (isEditing) {
        await pagamentosAPI.agregados.update(id, data);
      } else {
        await pagamentosAPI.agregados.create(data);
      }
      navigate('/pagamentos');
    } catch (err) {
      console.error('Erro ao salvar pagamento:', err);
      setError('Erro ao salvar pagamento. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Calcular valor repassado
  const valorRepassado = formData.valor_frete_total && formData.percentual_repasse
    ? (parseFloat(formData.valor_frete_total) * parseFloat(formData.percentual_repasse) / 100).toFixed(2)
    : '0.00';

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className="pagamento-form-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Pagamento Agregado' : 'Novo Pagamento Agregado'}</h1>
          <p>{isEditing ? 'Atualize os dados do pagamento' : 'Cadastre um novo pagamento para motorista agregado'}</p>
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
          <h3>Dados do Condutor</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Placa do Veiculo *</label>
              <input
                type="text"
                name="placa"
                value={formData.placa}
                onChange={handleChange}
                required
                maxLength="8"
                placeholder="ABC1234"
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="form-group">
              <label>CPF do Condutor</label>
              <input
                type="text"
                name="condutor_cpf"
                value={formData.condutor_cpf}
                onChange={handleCPFChange}
                maxLength="11"
                placeholder="00000000000"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Nome do Condutor *</label>
            <input
              type="text"
              name="condutor_nome"
              value={formData.condutor_nome}
              onChange={handleChange}
              required
              placeholder="Nome completo do motorista"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Valores</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Valor do Frete Total (R$) *</label>
              <input
                type="number"
                step="0.01"
                name="valor_frete_total"
                value={formData.valor_frete_total}
                onChange={handleChange}
                required
                min="0"
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label>Percentual de Repasse (%) *</label>
              <input
                type="number"
                step="0.01"
                name="percentual_repasse"
                value={formData.percentual_repasse}
                onChange={handleChange}
                required
                min="0"
                max="100"
                placeholder="25.00"
              />
            </div>

            <div className="form-group">
              <label>Valor a Repassar (R$)</label>
              <input
                type="text"
                value={`R$ ${valorRepassado}`}
                disabled
                className="input-calculated"
              />
              <small className="form-hint">Calculado automaticamente</small>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Datas e Status</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Data Prevista *</label>
              <input
                type="date"
                name="data_prevista"
                value={formData.data_prevista}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Data Pagamento</label>
              <input
                type="date"
                name="data_pagamento"
                value={formData.data_pagamento || ''}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Status *</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Observacoes</label>
            <textarea
              name="obs"
              value={formData.obs}
              onChange={handleChange}
              rows="3"
              placeholder="Observacoes adicionais..."
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/pagamentos')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Pagamento')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PagamentoAgregadoForm;
