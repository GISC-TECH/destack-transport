import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pagamentosAPI, faixasKmAPI } from '../../services/api';
import Loading from '../Common/Loading';
import './Pagamentos.css';

function PagamentoProprioForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [faixasKm, setFaixasKm] = useState([]);

  const [formData, setFormData] = useState({
    veiculo_placa: '',
    motorista_nome: '',
    motorista_cpf: '',
    km_total_periodo: '',
    valor_km: '',
    data_referencia: new Date().toISOString().split('T')[0],
    data_pagamento: '',
    status: 'pendente',
    obs: ''
  });

  useEffect(() => {
    loadFaixasKm();
    if (isEditing) {
      loadPagamento();
    }
  }, [id]);

  const loadFaixasKm = async () => {
    try {
      const result = await faixasKmAPI.list();
      setFaixasKm(result.results || result || []);
    } catch (err) {
      console.error('Erro ao carregar faixas de KM:', err);
    }
  };

  const loadPagamento = async () => {
    try {
      setLoading(true);
      const result = await pagamentosAPI.proprios.get(id);
      setFormData({
        veiculo_placa: result.veiculo_placa || '',
        motorista_nome: result.motorista_nome || '',
        motorista_cpf: result.motorista_cpf || '',
        km_total_periodo: result.km_total_periodo || '',
        valor_km: result.valor_km || '',
        data_referencia: result.data_referencia || '',
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
    setFormData(prev => ({ ...prev, motorista_cpf: formatted }));
  };

  // Calcular valor do KM baseado na faixa
  const calcularValorKm = (km) => {
    if (!km || faixasKm.length === 0) return null;
    const kmNum = parseFloat(km);

    // Ordenar faixas por min_km
    const faixasOrdenadas = [...faixasKm].sort((a, b) => a.min_km - b.min_km);

    for (const faixa of faixasOrdenadas) {
      if (kmNum >= faixa.min_km && (faixa.max_km === null || kmNum <= faixa.max_km)) {
        return faixa.valor_pago;
      }
    }
    return null;
  };

  const handleKmChange = (e) => {
    const km = e.target.value;
    setFormData(prev => {
      const valorKmSugerido = calcularValorKm(km);
      return {
        ...prev,
        km_total_periodo: km,
        valor_km: valorKmSugerido ? valorKmSugerido.toFixed(2) : prev.valor_km
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const data = {
        veiculo_placa: formData.veiculo_placa.toUpperCase(),
        motorista_nome: formData.motorista_nome,
        motorista_cpf: formData.motorista_cpf || null,
        km_total_periodo: parseFloat(formData.km_total_periodo),
        valor_km: parseFloat(formData.valor_km),
        data_referencia: formData.data_referencia,
        data_pagamento: formData.data_pagamento || null,
        status: formData.status,
        obs: formData.obs || ''
      };

      if (isEditing) {
        await pagamentosAPI.proprios.update(id, data);
      } else {
        await pagamentosAPI.proprios.create(data);
      }
      navigate('/pagamentos');
    } catch (err) {
      console.error('Erro ao salvar pagamento:', err);
      setError('Erro ao salvar pagamento. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Calcular valor total a pagar
  const valorTotalPagar = formData.km_total_periodo && formData.valor_km
    ? (parseFloat(formData.km_total_periodo) * parseFloat(formData.valor_km)).toFixed(2)
    : '0.00';

  // Identificar faixa atual
  const faixaAtual = formData.km_total_periodo ? calcularValorKm(formData.km_total_periodo) : null;

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className="pagamento-form-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Pagamento Proprio' : 'Novo Pagamento Proprio'}</h1>
          <p>{isEditing ? 'Atualize os dados do pagamento' : 'Cadastre um novo pagamento para motorista proprio'}</p>
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
          <h3>Dados do Veiculo e Motorista</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Placa do Veiculo *</label>
              <input
                type="text"
                name="veiculo_placa"
                value={formData.veiculo_placa}
                onChange={handleChange}
                required
                maxLength="8"
                placeholder="ABC1234"
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="form-group">
              <label>CPF do Motorista</label>
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
            <label>Nome do Motorista *</label>
            <input
              type="text"
              name="motorista_nome"
              value={formData.motorista_nome}
              onChange={handleChange}
              required
              placeholder="Nome completo do motorista"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Quilometragem e Valores</h3>

          <div className="form-row">
            <div className="form-group">
              <label>KM Total do Periodo *</label>
              <input
                type="number"
                step="0.01"
                name="km_total_periodo"
                value={formData.km_total_periodo}
                onChange={handleKmChange}
                required
                min="0"
                placeholder="0.00"
              />
              {faixaAtual && (
                <small className="form-hint form-hint-success">
                  Faixa aplicada: R$ {faixaAtual.toFixed(2)}/km
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Valor por KM (R$) *</label>
              <input
                type="number"
                step="0.01"
                name="valor_km"
                value={formData.valor_km}
                onChange={handleChange}
                required
                min="0"
                placeholder="0.00"
              />
              <small className="form-hint">Ajuste conforme necessario</small>
            </div>

            <div className="form-group">
              <label>Valor Total a Pagar (R$)</label>
              <input
                type="text"
                value={`R$ ${valorTotalPagar}`}
                disabled
                className="input-calculated"
              />
              <small className="form-hint">Calculado automaticamente</small>
            </div>
          </div>

          {/* Tabela de faixas de referencia */}
          {faixasKm.length > 0 && (
            <div className="faixas-referencia">
              <h4>Tabela de Faixas de KM</h4>
              <table className="faixas-table-mini">
                <thead>
                  <tr>
                    <th>Faixa</th>
                    <th>Valor/KM</th>
                  </tr>
                </thead>
                <tbody>
                  {faixasKm.sort((a, b) => a.min_km - b.min_km).map((faixa, index) => (
                    <tr key={faixa.id} className={faixaAtual === faixa.valor_pago ? 'faixa-ativa' : ''}>
                      <td>
                        {faixa.min_km} - {faixa.max_km ? `${faixa.max_km} km` : 'Ilimitado'}
                      </td>
                      <td>R$ {parseFloat(faixa.valor_pago).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Datas e Status</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Data de Referencia *</label>
              <input
                type="date"
                name="data_referencia"
                value={formData.data_referencia}
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

export default PagamentoProprioForm;
