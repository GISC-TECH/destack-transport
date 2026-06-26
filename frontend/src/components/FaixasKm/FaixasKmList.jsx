import { useState, useEffect } from 'react';
import { faixasKmAPI } from '../../services/api';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import './FaixasKm.css';

// Mock data para faixas de KM (usando nomes de campos do backend)
const mockFaixas = [
  {
    id: 1,
    min_km: 0,
    max_km: 100,
    valor_pago: 3.50
  },
  {
    id: 2,
    min_km: 101,
    max_km: 300,
    valor_pago: 3.20
  },
  {
    id: 3,
    min_km: 301,
    max_km: 500,
    valor_pago: 2.90
  },
  {
    id: 4,
    min_km: 501,
    max_km: 1000,
    valor_pago: 2.60
  },
  {
    id: 5,
    min_km: 1001,
    max_km: null,
    valor_pago: 2.30
  }
];

function FaixasKmList() {
  const [faixas, setFaixas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingFaixa, setEditingFaixa] = useState(null);
  const [formData, setFormData] = useState({
    min_km: '',
    max_km: '',
    valor_pago: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadFaixas();
  }, []);

  const loadFaixas = async () => {
    try {
      setLoading(true);
      const result = await faixasKmAPI.list();
      setFaixas(result.results || result);
      setUsingMockData(false);
    } catch (err) {
      console.error('Erro ao carregar faixas:', err);
      setFaixas(mockFaixas);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (faixa = null) => {
    if (faixa) {
      setEditingFaixa(faixa);
      setFormData({
        min_km: faixa.min_km,
        max_km: faixa.max_km || '',
        valor_pago: faixa.valor_pago
      });
    } else {
      setEditingFaixa(null);
      setFormData({
        min_km: '',
        max_km: '',
        valor_pago: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingFaixa(null);
    setFormData({
      min_km: '',
      max_km: '',
      valor_pago: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const data = {
        min_km: parseInt(formData.min_km),
        max_km: formData.max_km ? parseInt(formData.max_km) : null,
        valor_pago: parseFloat(formData.valor_pago)
      };

      if (usingMockData) {
        if (editingFaixa) {
          setFaixas(faixas.map(f =>
            f.id === editingFaixa.id ? { ...f, ...data } : f
          ));
          setMessage({ type: 'success', text: 'Faixa atualizada com sucesso!' });
        } else {
          const novaFaixa = { ...data, id: Date.now() };
          setFaixas([...faixas, novaFaixa].sort((a, b) => a.min_km - b.min_km));
          setMessage({ type: 'success', text: 'Faixa criada com sucesso!' });
        }
      } else {
        if (editingFaixa) {
          await faixasKmAPI.update(editingFaixa.id, data);
          setMessage({ type: 'success', text: 'Faixa atualizada com sucesso!' });
        } else {
          await faixasKmAPI.create(data);
          setMessage({ type: 'success', text: 'Faixa criada com sucesso!' });
        }
        loadFaixas();
      }
      handleCloseModal();
    } catch (err) {
      console.error('Erro ao salvar faixa:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar faixa. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta faixa de KM?')) return;

    try {
      if (usingMockData) {
        setFaixas(faixas.filter(f => f.id !== id));
        setMessage({ type: 'success', text: 'Faixa excluída com sucesso!' });
      } else {
        await faixasKmAPI.delete(id);
        setMessage({ type: 'success', text: 'Faixa excluída com sucesso!' });
        loadFaixas();
      }
    } catch (err) {
      console.error('Erro ao excluir faixa:', err);
      setMessage({ type: 'error', text: 'Erro ao excluir faixa.' });
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatKm = (value) => {
    if (value >= 99999) return 'Ilimitado';
    return new Intl.NumberFormat('pt-BR').format(value) + ' km';
  };

  if (loading) return <Loading message="Carregando faixas de KM..." />;

  const faixaIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
    </svg>
  );

  return (
    <div className="faixas-km-page">
      <PageHeader
        title="Faixas de KM"
        subtitle={usingMockData ? "Configure os valores por quilômetro para cálculo de frete (Modo Demonstração)" : "Configure os valores por quilômetro para cálculo de frete"}
        icon={faixaIcon}
        breadcrumbs={[{ label: 'Configurações' }, { label: 'Faixas de KM' }]}
        actions={
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova Faixa
          </button>
        }
      />

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button className="alert-close" onClick={() => setMessage(null)}>&times;</button>
        </div>
      )}

      {/* Tabela de Faixas */}
      <div className="faixas-table-container">
        <div className="desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>Faixa</th>
                <th>KM Mínimo</th>
                <th>KM Máximo</th>
                <th>Valor Pago</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {faixas.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center">
                    Nenhuma faixa de KM cadastrada
                  </td>
                </tr>
              ) : (
                faixas.map((faixa, index) => (
                  <tr key={faixa.id}>
                    <td>
                      <span className="faixa-badge">Faixa {index + 1}</span>
                    </td>
                    <td>{formatKm(faixa.min_km)}</td>
                    <td>{faixa.max_km ? formatKm(faixa.max_km) : 'Ilimitado'}</td>
                    <td>
                      <strong className="valor-km">{formatCurrency(faixa.valor_pago)}</strong>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-action btn-edit"
                          onClick={() => handleOpenModal(faixa)}
                          title="Editar"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(faixa.id)}
                          title="Excluir"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Cards Mobile */}
        <div className="mobile-cards mobile-only">
          {faixas.length === 0 ? (
            <div className="mobile-empty">
              <p className="mobile-empty-text">Nenhuma faixa de KM cadastrada</p>
            </div>
          ) : (
            faixas.map((faixa, index) => (
              <div key={faixa.id} className="mobile-card">
                <div className="mobile-card-header">
                  <h4>Faixa {index + 1}</h4>
                  <strong className="valor-km">{formatCurrency(faixa.valor_pago)}</strong>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">KM Mínimo</span>
                    <span className="mobile-card-value">{formatKm(faixa.min_km)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">KM Máximo</span>
                    <span className="mobile-card-value">
                      {faixa.max_km ? formatKm(faixa.max_km) : 'Ilimitado'}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-footer">
                  <button
                    className="btn-action btn-edit"
                    onClick={() => handleOpenModal(faixa)}
                    title="Editar"
                    aria-label={`Editar faixa ${index + 1}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    className="btn-action btn-delete"
                    onClick={() => handleDelete(faixa.id)}
                    title="Excluir"
                    aria-label={`Excluir faixa ${index + 1}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Visualização Gráfica */}
      <div className="faixas-visual">
        <h3>Visualização das Faixas</h3>
        <div className="faixas-bars">
          {faixas.map((faixa, index) => (
            <div key={faixa.id} className="faixa-bar">
              <div className="faixa-bar-header">
                <span className="faixa-range">{formatKm(faixa.min_km)} - {faixa.max_km ? formatKm(faixa.max_km) : 'Ilimitado'}</span>
                <span className="faixa-valor">{formatCurrency(faixa.valor_pago)}</span>
              </div>
              <div
                className="faixa-bar-fill"
                style={{
                  width: `${Math.max(20, 100 - (index * 15))}%`,
                  background: `hsl(${200 + index * 30}, 70%, 50%)`
                }}
              ></div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingFaixa ? 'Editar Faixa' : 'Nova Faixa'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>KM Mínimo *</label>
                  <input
                    type="number"
                    value={formData.min_km}
                    onChange={e => setFormData({...formData, min_km: e.target.value})}
                    required
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>KM Máximo</label>
                  <input
                    type="number"
                    value={formData.max_km}
                    onChange={e => setFormData({...formData, max_km: e.target.value})}
                    min="0"
                    placeholder="Deixe vazio para ilimitado"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Valor a Pagar (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_pago}
                  onChange={e => setFormData({...formData, valor_pago: e.target.value})}
                  required
                  min="0"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : (editingFaixa ? 'Atualizar' : 'Criar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FaixasKmList;
