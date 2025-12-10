import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pagamentosAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import './Pagamentos.css';

// Mock data para pagamentos de agregados (usando nomes de campos do backend)
const mockPagamentosAgregados = [
  {
    id: 1,
    cte_numero: 1001,
    condutor_nome: 'João da Silva',
    placa: 'DEF-5678',
    data_prevista: '2024-12-05',
    valor_repassado: 1850.00,
    status: 'pendente'
  },
  {
    id: 2,
    cte_numero: 1002,
    condutor_nome: 'Carlos Pereira',
    placa: 'MNO-7890',
    data_prevista: '2024-12-03',
    valor_repassado: 2200.00,
    status: 'pago'
  },
  {
    id: 3,
    cte_numero: 1003,
    condutor_nome: 'João da Silva',
    placa: 'DEF-5678',
    data_prevista: '2024-11-28',
    valor_repassado: 1650.00,
    status: 'atrasado'
  },
  {
    id: 4,
    cte_numero: 1004,
    condutor_nome: 'Pedro Santos',
    placa: 'STU-3456',
    data_prevista: '2024-12-10',
    valor_repassado: 3100.00,
    status: 'pendente'
  },
  {
    id: 5,
    cte_numero: 1005,
    condutor_nome: 'Carlos Pereira',
    placa: 'MNO-7890',
    data_prevista: '2024-11-25',
    valor_repassado: 1900.00,
    status: 'pago'
  }
];

// Mock data para pagamentos próprios (usando nomes de campos do backend)
const mockPagamentosProprios = [
  {
    id: 101,
    periodo: 'Novembro/2024',
    veiculo_placa: 'ABC-1234',
    km_total_periodo: 5200,
    valor_total_pagar: 8500.00,
    status: 'pago'
  },
  {
    id: 102,
    periodo: 'Novembro/2024',
    veiculo_placa: 'GHI-9012',
    km_total_periodo: 6100,
    valor_total_pagar: 9200.00,
    status: 'pago'
  },
  {
    id: 103,
    periodo: 'Novembro/2024',
    veiculo_placa: 'PQR-1234',
    km_total_periodo: 2300,
    valor_total_pagar: 3500.00,
    status: 'pendente'
  },
  {
    id: 104,
    periodo: 'Dezembro/2024',
    veiculo_placa: 'ABC-1234',
    km_total_periodo: 4800,
    valor_total_pagar: 7800.00,
    status: 'pendente'
  },
  {
    id: 105,
    periodo: 'Dezembro/2024',
    veiculo_placa: 'GHI-9012',
    km_total_periodo: 2800,
    valor_total_pagar: 4200.00,
    status: 'pendente'
  }
];

function PagamentosList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('agregados');
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [showGerarLote, setShowGerarLote] = useState(false);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [loteConfig, setLoteConfig] = useState({
    data_inicio: '',
    data_fim: '',
    tipo: 'agregados'
  });
  // Função para calcular datas do mês atual
  const getDefaultPagDates = () => {
    const hoje = new Date();
    const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return {
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: dataFim.toISOString().split('T')[0]
    };
  };

  const defaultDates = getDefaultPagDates();
  const [filtros, setFiltros] = useState({
    status: '',
    data_inicio: defaultDates.data_inicio,
    data_fim: defaultDates.data_fim
  });

  const handleDateFilterChange = useCallback((newFiltros) => {
    const newState = {
      ...filtros,
      data_inicio: newFiltros.data_inicio,
      data_fim: newFiltros.data_fim
    };
    setFiltros(newState);
    loadPagamentos(newState);
  }, [filtros]);

  // Carrega na montagem inicial
  useEffect(() => {
    loadPagamentos();
  }, []);

  // Carrega quando muda a tab
  useEffect(() => {
    if (filtros.data_inicio && filtros.data_fim) {
      loadPagamentos();
    }
  }, [activeTab]);

  const loadPagamentos = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtros;
    try {
      setLoading(true);
      setError(null);
      const params = { ...filtrosAtivos };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

      let result;
      if (activeTab === 'agregados') {
        result = await pagamentosAPI.agregados.list(params);
      } else {
        result = await pagamentosAPI.proprios.list(params);
      }
      setPagamentos(result.results || result);
      setUsingMockData(false);
    } catch (err) {
      console.error('Erro ao carregar pagamentos:', err);
      // Usar mock data
      const mockData = activeTab === 'agregados' ? mockPagamentosAgregados : mockPagamentosProprios;
      let filteredMock = [...mockData];

      if (filtros.status) {
        filteredMock = filteredMock.filter(p => p.status === filtros.status);
      }

      setPagamentos(filteredMock);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    loadPagamentos();
  };

  const handleExport = async () => {
    if (usingMockData) {
      alert('Exportação não disponível em modo demonstração');
      return;
    }
    try {
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      if (activeTab === 'agregados') {
        await pagamentosAPI.agregados.export(params);
      } else {
        await pagamentosAPI.proprios.export(params);
      }
    } catch (err) {
      alert('Erro ao exportar: ' + err.message);
    }
  };

  const handleGerarLote = async () => {
    if (!loteConfig.data_inicio || !loteConfig.data_fim) {
      alert('Por favor, selecione o período para geração');
      return;
    }

    if (usingMockData) {
      // Simular geração em modo demo
      alert(`Modo Demonstração: Seriam gerados pagamentos de ${loteConfig.tipo} para o período de ${loteConfig.data_inicio} a ${loteConfig.data_fim}`);
      setShowGerarLote(false);
      return;
    }

    try {
      setGerandoLote(true);
      if (loteConfig.tipo === 'agregados') {
        await pagamentosAPI.agregados.gerar({
          data_inicio: loteConfig.data_inicio,
          data_fim: loteConfig.data_fim
        });
      } else {
        await pagamentosAPI.proprios.gerar({
          data_inicio: loteConfig.data_inicio,
          data_fim: loteConfig.data_fim
        });
      }
      alert('Pagamentos gerados com sucesso!');
      setShowGerarLote(false);
      loadPagamentos();
    } catch (err) {
      alert('Erro ao gerar pagamentos: ' + err.message);
    } finally {
      setGerandoLote(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pendente': { class: 'warning', text: 'Pendente' },
      'pago': { class: 'success', text: 'Pago' },
      'atrasado': { class: 'danger', text: 'Atrasado' },
      'cancelado': { class: 'secondary', text: 'Cancelado' }
    };
    const s = statusMap[status] || { class: 'secondary', text: status };
    return <span className={`badge badge-${s.class}`}>{s.text}</span>;
  };

  const calcularTotais = () => {
    // Para agregados: valor_repassado; Para próprios: valor_total_pagar
    const getValor = (p) => {
      if (activeTab === 'agregados') {
        return parseFloat(p.valor_repassado) || 0;
      }
      return parseFloat(p.valor_total_pagar) || 0;
    };

    const total = pagamentos.reduce((acc, p) => acc + getValor(p), 0);
    const pendente = pagamentos
      .filter(p => p.status === 'pendente' || p.status === 'atrasado')
      .reduce((acc, p) => acc + getValor(p), 0);
    const pago = pagamentos
      .filter(p => p.status === 'pago')
      .reduce((acc, p) => acc + getValor(p), 0);
    return { total, pendente, pago };
  };

  const totais = calcularTotais();

  const pagamentosIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );

  const handleNovoPagamento = () => {
    if (activeTab === 'agregados') {
      navigate('/pagamentos/agregados/novo');
    } else {
      navigate('/pagamentos/proprios/novo');
    }
  };

  const handleEditarPagamento = (id) => {
    if (activeTab === 'agregados') {
      navigate(`/pagamentos/agregados/${id}/editar`);
    } else {
      navigate(`/pagamentos/proprios/${id}/editar`);
    }
  };

  const headerActions = (
    <div className="header-buttons">
      <button
        className="btn btn-outline"
        onClick={handleExport}
        disabled={usingMockData}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exportar
      </button>
      <button
        className="btn btn-secondary"
        onClick={() => setShowGerarLote(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        Gerar Lote
      </button>
      <button
        className="btn btn-primary"
        onClick={handleNovoPagamento}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Novo Pagamento
      </button>
    </div>
  );

  if (loading && pagamentos.length === 0) return <Loading message="Carregando pagamentos..." />;

  return (
    <div className="pagamentos-page">
      <PageHeader
        title="Pagamentos"
        subtitle={usingMockData ? "Modo Demonstracao" : "Gerencie pagamentos de agregados e proprios"}
        icon={pagamentosIcon}
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Pagamentos' }]}
        actions={headerActions}
      />

      {/* Modal de Geração em Lote */}
      {showGerarLote && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Gerar Pagamentos em Lote</h3>
              <button className="modal-close" onClick={() => setShowGerarLote(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Gere pagamentos automaticamente para todos os CT-es do período selecionado.
              </p>

              <div className="form-group">
                <label>Tipo de Pagamento</label>
                <select
                  value={loteConfig.tipo}
                  onChange={(e) => setLoteConfig({...loteConfig, tipo: e.target.value})}
                  className="select-filter"
                >
                  <option value="agregados">Agregados</option>
                  <option value="proprios">Próprios</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Data Início</label>
                  <input
                    type="date"
                    value={loteConfig.data_inicio}
                    onChange={(e) => setLoteConfig({...loteConfig, data_inicio: e.target.value})}
                    className="input-filter"
                  />
                </div>
                <div className="form-group">
                  <label>Data Fim</label>
                  <input
                    type="date"
                    value={loteConfig.data_fim}
                    onChange={(e) => setLoteConfig({...loteConfig, data_fim: e.target.value})}
                    className="input-filter"
                  />
                </div>
              </div>

              {usingMockData && (
                <div className="alert-warning">
                  Modo Demonstração: A geração será simulada
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowGerarLote(false)}
                disabled={gerandoLote}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleGerarLote}
                disabled={gerandoLote}
              >
                {gerandoLote ? 'Gerando...' : 'Gerar Pagamentos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Total</span>
          <span className="summary-value">{formatCurrency(totais.total)}</span>
        </div>
        <div className="summary-card pendente">
          <span className="summary-label">Pendente</span>
          <span className="summary-value">{formatCurrency(totais.pendente)}</span>
        </div>
        <div className="summary-card pago">
          <span className="summary-label">Pago</span>
          <span className="summary-value">{formatCurrency(totais.pago)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'agregados' ? 'active' : ''}`}
          onClick={() => setActiveTab('agregados')}
        >
          Agregados
        </button>
        <button
          className={`tab-button ${activeTab === 'proprios' ? 'active' : ''}`}
          onClick={() => setActiveTab('proprios')}
        >
          Próprios
        </button>
      </div>

      {/* Filtros */}
      <div className="filtros-section">
        <div className="filtros-form">
          <select
            value={filtros.status}
            onChange={(e) => {
              setFiltros({...filtros, status: e.target.value});
              setTimeout(loadPagamentos, 100);
            }}
            className="select-filter"
          >
            <option value="">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>
          <DateFilter
            onFilterChange={handleDateFilterChange}
            defaultPeriodo="mes"
          />
        </div>
      </div>

      <div className="results-info">
        <p>Total de {pagamentos.length} pagamento{pagamentos.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabela */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {activeTab === 'agregados' ? (
                <>
                  <th>CT-e</th>
                  <th>Condutor</th>
                  <th>Placa</th>
                  <th>Data Prevista</th>
                  <th>Valor Repasse</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </>
              ) : (
                <>
                  <th>Periodo</th>
                  <th>Placa</th>
                  <th>KM Total</th>
                  <th>Valor a Pagar</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {pagamentos.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'agregados' ? 7 : 6} className="text-center">
                  Nenhum pagamento encontrado
                </td>
              </tr>
            ) : (
              pagamentos.map((pagamento) => (
                <tr key={pagamento.id}>
                  {activeTab === 'agregados' ? (
                    <>
                      <td>
                        <strong>#{pagamento.cte_numero || '-'}</strong>
                      </td>
                      <td>{pagamento.condutor_nome || '-'}</td>
                      <td>{pagamento.placa || '-'}</td>
                      <td>{formatDate(pagamento.data_prevista)}</td>
                      <td className="text-right">
                        <strong>{formatCurrency(pagamento.valor_repassado)}</strong>
                      </td>
                      <td>{getStatusBadge(pagamento.status)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEditarPagamento(pagamento.id)}
                            title="Editar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><strong>{pagamento.periodo || '-'}</strong></td>
                      <td>{pagamento.veiculo_placa || '-'}</td>
                      <td>{pagamento.km_total_periodo ? `${pagamento.km_total_periodo.toLocaleString('pt-BR')} km` : '-'}</td>
                      <td className="text-right">
                        <strong>{formatCurrency(pagamento.valor_total_pagar)}</strong>
                      </td>
                      <td>{getStatusBadge(pagamento.status)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEditarPagamento(pagamento.id)}
                            title="Editar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PagamentosList;
