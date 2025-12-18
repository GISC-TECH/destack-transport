import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pagamentosAPI, cteAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import './Pagamentos.css';

function PagamentoProprioForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Lista de CT-es e veiculos disponiveis
  const [ctesDisponiveis, setCtesDisponiveis] = useState([]);
  const [veiculosDisponiveis, setVeiculosDisponiveis] = useState([]);
  const [loadingCtes, setLoadingCtes] = useState(false);

  const [formData, setFormData] = useState({
    veiculo: '',
    cte: '',
    cte_numero: '',
    motorista_nome: '',
    motorista_cpf: '',
    periodo: new Date().toISOString().slice(0, 7), // AAAA-MM
    data_prevista: new Date().toISOString().split('T')[0],
    valor_base_faixa: '',
    ajustes: '0',
    status: 'pendente',
    data_pagamento: '',
    obs: ''
  });

  useEffect(() => {
    loadVeiculos();
    loadCtesDisponiveis();
    if (isEditing) {
      loadPagamento();
    }
  }, [id]);

  const loadVeiculos = async () => {
    try {
      // Busca veiculos proprios (tipo_proprietario = '00')
      const result = await veiculosAPI.list({ tipo_proprietario: '00', ativo: true });
      setVeiculosDisponiveis(result.results || result || []);
    } catch (err) {
      console.error('Erro ao carregar veiculos:', err);
    }
  };

  const loadCtesDisponiveis = async () => {
    try {
      setLoadingCtes(true);
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
        valor_base_faixa: ''
      }));
      return;
    }

    const cteSelecionado = ctesDisponiveis.find(c => c.id === cteId);
    if (cteSelecionado) {
      setFormData(prev => ({
        ...prev,
        cte: cteId,
        cte_numero: cteSelecionado.numero_cte || cteSelecionado.numero || '',
        valor_base_faixa: cteSelecionado.valor_total || cteSelecionado.valor_prestacao || ''
      }));
    }
  };

  const loadPagamento = async () => {
    try {
      setLoading(true);
      const result = await pagamentosAPI.proprios.get(id);
      setFormData({
        veiculo: result.veiculo || '',
        cte: result.cte || '',
        cte_numero: result.cte_numero || '',
        motorista_nome: result.motorista_nome || result.condutor_nome || '',
        motorista_cpf: result.motorista_cpf || result.condutor_cpf || '',
        periodo: result.periodo || '',
        data_prevista: result.data_prevista || '',
        valor_base_faixa: result.valor_base_faixa || result.valor_repassado || '',
        ajustes: result.ajustes || '0',
        status: result.status || 'pendente',
        data_pagamento: result.data_pagamento || '',
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
    setFormData(prev => ({ ...prev, motorista_cpf: formatted }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const data = {
        veiculo: formData.veiculo || null,
        cte: formData.cte || null,
        cte_numero: formData.cte_numero || null,
        motorista_nome: formData.motorista_nome,
        motorista_cpf: formData.motorista_cpf || null,
        periodo: formData.periodo,
        data_prevista: formData.data_prevista || null,
        valor_base_faixa: parseFloat(formData.valor_base_faixa) || 0,
        ajustes: parseFloat(formData.ajustes) || 0,
        status: formData.status,
        data_pagamento: formData.data_pagamento || null,
        obs: formData.obs || ''
      };

      if (isEditing) {
        await pagamentosAPI.proprios.update(id, data);
        toast.success('Pagamento atualizado com sucesso!');
      } else {
        await pagamentosAPI.proprios.create(data);
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

  // Calcular valor total a pagar
  const valorTotal = (parseFloat(formData.valor_base_faixa) || 0) + (parseFloat(formData.ajustes) || 0);

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className="pagamento-form-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Pagamento Proprio' : 'Novo Pagamento Proprio'}</h1>
          <p>{isEditing ? 'Atualize os dados do pagamento' : 'Cadastre um novo pagamento para veiculo proprio'}</p>
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
          <h3>Dados do Veiculo e Condutor</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Veiculo Proprio *</label>
              <select
                name="veiculo"
                value={formData.veiculo}
                onChange={handleChange}
                required
              >
                <option value="">-- Selecione o veiculo --</option>
                {veiculosDisponiveis.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.placa} - {v.modelo || 'N/I'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>CPF do Condutor</label>
              <input
                type="text"
                name="motorista_cpf"
                value={formData.motorista_cpf}
                onChange={handleCPFChange}
                maxLength="11"
                placeholder="00000000000"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Nome do Condutor</label>
            <input
              type="text"
              name="motorista_nome"
              value={formData.motorista_nome}
              onChange={handleChange}
              placeholder="Nome completo do motorista"
              maxLength={255}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Valores</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Valor Base / Repasse (R$) *</label>
              <input
                type="number"
                step="0.01"
                name="valor_base_faixa"
                value={formData.valor_base_faixa}
                onChange={handleChange}
                required
                min="0"
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label>Ajustes (R$)</label>
              <input
                type="number"
                step="0.01"
                name="ajustes"
                value={formData.ajustes}
                onChange={handleChange}
                placeholder="0.00"
              />
              <small className="form-hint">Adicional ou desconto</small>
            </div>

            <div className="form-group">
              <label>Valor Total a Pagar (R$)</label>
              <input
                type="text"
                value={`R$ ${valorTotal.toFixed(2)}`}
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
              <label>Periodo (AAAA-MM) *</label>
              <input
                type="month"
                name="periodo"
                value={formData.periodo}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Data Prevista</label>
              <input
                type="date"
                name="data_prevista"
                value={formData.data_prevista}
                onChange={handleChange}
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
          </div>

          <div className="form-row">
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

export default PagamentoProprioForm;
