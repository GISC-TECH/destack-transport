import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pagamentosAPI, cteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import './Pagamentos.css';

function PagamentoAgregadoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Lista de CT-es disponiveis para selecao
  const [ctesDisponiveis, setCtesDisponiveis] = useState([]);
  const [loadingCtes, setLoadingCtes] = useState(false);
  const [buscaCte, setBuscaCte] = useState('');

  const [formData, setFormData] = useState({
    cte: '',
    cte_numero: '',
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
    // Carregar CT-es disponiveis (sem pagamento agregado)
    loadCtesDisponiveis();
  }, [id]);

  const loadCtesDisponiveis = async () => {
    try {
      setLoadingCtes(true);
      // Busca CT-es que ainda nao tem pagamento agregado
      const result = await cteAPI.list({ pago: false, page_size: 100 });
      const ctes = result.results || result;
      setCtesDisponiveis(ctes);
    } catch (err) {
      console.error('Erro ao carregar CT-es:', err);
    } finally {
      setLoadingCtes(false);
    }
  };

  const handleSelectCte = (e) => {
    const cteId = e.target.value;
    if (!cteId) {
      setFormData(prev => ({
        ...prev,
        cte: '',
        cte_numero: '',
        valor_frete_total: ''
      }));
      return;
    }

    const cteSelecionado = ctesDisponiveis.find(c => c.id === cteId);
    if (cteSelecionado) {
      setFormData(prev => ({
        ...prev,
        cte: cteId,
        cte_numero: cteSelecionado.numero_cte || cteSelecionado.numero || '',
        valor_frete_total: cteSelecionado.valor_total || cteSelecionado.valor_prestacao || ''
      }));
    }
  };

  const loadPagamento = async () => {
    try {
      setLoading(true);
      const result = await pagamentosAPI.agregados.get(id);
      setFormData({
        cte: result.cte || '',
        cte_numero: result.cte_numero || '',
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
        cte: formData.cte || null,
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
        toast.success('Pagamento atualizado com sucesso!');
      } else {
        await pagamentosAPI.agregados.create(data);
        toast.success('Pagamento registrado com sucesso!');
      }
      setTimeout(() => navigate('/pagamentos'), 500);
    } catch (err) {
      console.error('Erro ao salvar pagamento:', err);
      toast.error('Erro ao salvar pagamento. Verifique os dados.');
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
          <h3>Vincular CT-e (Opcional)</h3>
          <p className="form-hint" style={{ marginBottom: '15px', color: '#666' }}>
            Selecione um CT-e para preencher automaticamente os dados do frete
          </p>

          <div className="form-group">
            <label>CT-e</label>
            <select
              name="cte"
              value={formData.cte}
              onChange={handleSelectCte}
              disabled={loadingCtes}
            >
              <option value="">-- Selecione um CT-e (opcional) --</option>
              {ctesDisponiveis.map(cte => (
                <option key={cte.id} value={cte.id}>
                  #{cte.numero_cte || cte.numero} - {cte.remetente_nome || 'N/I'} → {cte.destinatario_nome || 'N/I'} - R$ {(cte.valor_total || cte.valor_prestacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </option>
              ))}
            </select>
            {loadingCtes && <small className="form-hint">Carregando CT-es...</small>}
            {formData.cte_numero && (
              <small className="form-hint" style={{ color: '#27ae60' }}>
                CT-e #{formData.cte_numero} selecionado
              </small>
            )}
          </div>
        </div>

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
              maxLength={120}
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
