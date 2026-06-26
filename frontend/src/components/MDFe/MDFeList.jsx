import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { mdfeAPI, dashboardAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import '../CTe/CTe.css';

// Cores para os graficos
const STATUS_COLORS = {
  autorizado: '#27ae60',
  encerrado: '#0d9488',
  cancelado: '#e74c3c',
  pendente: '#95a5a6'
};
const PAGE_SIZE = 20;

// Funcao para obter datas do mes atual
const getDefaultMDFeDates = () => {
  const hoje = new Date();
  const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return {
    data_inicio: dataInicio.toISOString().split('T')[0],
    data_fim: dataFim.toISOString().split('T')[0]
  };
};

function MDFeList() {
  const toast = useToast();
  const defaultDates = getDefaultMDFeDates();
  const [mdfes, setMdfes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de detalhes rapidos
  const [modalMdfe, setModalMdfe] = useState(null);

  // Dados dos graficos (API /api/painel/mdfe/)
  const [painelData, setPainelData] = useState(null);
  const [filtrosGraficos, setFiltrosGraficos] = useState(defaultDates);

  // Filtros da tabela
  const [filtros, setFiltros] = useState({
    q: '',
    status: '',
    data_inicio: defaultDates.data_inicio,
    data_fim: defaultDates.data_fim
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0 });

  // Carregar dados do painel para graficos
  const loadPainelMDFe = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtrosGraficos;
    try {
      const params = { ...filtrosAtivos };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await dashboardAPI.mdfe(params);
      setPainelData(result);
    } catch (err) {
      console.error('Erro ao carregar painel MDF-e:', err);
      setPainelData(null);
    }
  };

  // Carregar MDF-es para tabela (5 por pagina)
  const loadMDFes = async (customFiltros = null, customPage = null) => {
    const filtrosAtivos = customFiltros || filtros;
    const pageAtivo = customPage !== null ? customPage : pagination.page;
    try {
      setLoading(true);
      const params = { ...filtrosAtivos, page: pageAtivo, page_size: PAGE_SIZE };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await mdfeAPI.list(params);
      setMdfes(result.results || result || []);
      setPagination(prev => ({ ...prev, total: result.count || (result.results ? result.results.length : result.length) || 0 }));
    } catch (err) {
      console.error('Erro ao carregar MDF-es:', err);
      setMdfes([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  };

  // Carrega dados na montagem inicial
  useEffect(() => {
    loadPainelMDFe(defaultDates);
    loadMDFes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler para filtro de graficos
  const handleGraficosFilterChange = (dateFilters) => {
    setFiltrosGraficos(dateFilters);
    loadPainelMDFe(dateFilters);
  };

  // Handler para filtro da tabela
  const handleTabelaFilterChange = (dateFilters) => {
    setFiltros(prev => ({
      ...prev,
      data_inicio: dateFilters.data_inicio,
      data_fim: dateFilters.data_fim
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
    loadMDFes({
      q: '',
      status: '',
      data_inicio: dateFilters.data_inicio,
      data_fim: dateFilters.data_fim
    }, 1);
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadMDFes();
  };

  const handleExport = async () => {
    try {
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      await mdfeAPI.export(params);
    } catch (err) {
      toast.error('Erro ao exportar: ' + err.message);
    }
  };

  // Funcao para baixar XML
  const handleDownloadXML = async (mdfeId, numeroMdfe) => {
    try {
      const blob = await mdfeAPI.downloadXML(mdfeId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mdfe_${numeroMdfe || mdfeId}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar XML:', err);
      toast.error('Erro ao baixar XML. Tente novamente.');
    }
  };

  // Funcao para abrir modal de detalhes rapidos
  const handleOpenModal = (mdfe) => {
    setModalMdfe(mdfe);
  };

  // Funcao para fechar modal
  const handleCloseModal = () => {
    setModalMdfe(null);
  };

  // KPIs do painel - conforme API /api/painel/mdfe/
  const kpis = {
    total: painelData?.cards?.total_mdfes || pagination.total || 0,
    autorizados: painelData?.cards?.total_autorizados || 0,
    encerrados: painelData?.cards?.total_encerrados || 0,
    cancelados: painelData?.cards?.total_cancelados || 0,
    totalCtesEmMdfes: painelData?.cards?.total_ctes_em_mdfes || 0,
    eficiencia: painelData?.eficiencia || 0
  };

  // Dados para grafico de status - conforme API
  const getStatusData = () => {
    if (!painelData?.cards) return [];
    const data = [
      { name: 'Autorizados', value: painelData.cards.total_autorizados || 0, color: STATUS_COLORS.autorizado },
      { name: 'Encerrados', value: painelData.cards.total_encerrados || 0, color: STATUS_COLORS.encerrado },
      { name: 'Cancelados', value: painelData.cards.total_cancelados || 0, color: STATUS_COLORS.cancelado }
    ];
    return data.filter(item => item.value > 0);
  };

  // Dados para grafico de CT-es por MDF-e - conforme API grafico_cte_mdfe
  const getCteDistribuicaoData = () => {
    if (!painelData?.grafico_cte_mdfe || painelData.grafico_cte_mdfe.length === 0) return [];
    return painelData.grafico_cte_mdfe.map(item => ({
      categoria: item.categoria || 'N/A',
      contagem: item.contagem || 0
    }));
  };

  // Dados para grafico de veiculos - conforme API top_veiculos
  const getVeiculosData = () => {
    if (!painelData?.top_veiculos || painelData.top_veiculos.length === 0) return [];
    return painelData.top_veiculos.slice(0, 5).map(item => ({
      placa: item.placa || 'N/A',
      total: item.total || 0
    }));
  };

  const mdfeIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>
  );

  const headerActions = (
    <div className="header-buttons">
      <button
        className="btn btn-outline"
        onClick={handleExport}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exportar
      </button>
      <Link to="/upload" className="btn btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        Upload XML
      </Link>
    </div>
  );

  // Dados para graficos
  const statusData = getStatusData();
  const cteDistribuicaoData = getCteDistribuicaoData();
  const veiculosData = getVeiculosData();

  // Mostra loading apenas no carregamento inicial
  if (loading && mdfes.length === 0) return <Loading message="Carregando MDF-es..." />;

  return (
    <div className="mdfe-list">
      <PageHeader
        title="MDF-e - Manifesto de Documentos"
        subtitle={`${pagination.total} documentos`}
        icon={mdfeIcon}
        breadcrumbs={[{ label: 'Documentos' }, { label: 'MDF-e' }]}
        actions={headerActions}
      />

      {/* KPI Cards */}
      <div className="cte-kpi-grid">
        <div className="cte-kpi-card">
          <div className="cte-kpi-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">Total MDF-es</span>
            <span className="cte-kpi-value">{kpis.total}</span>
          </div>
        </div>

        <div className="cte-kpi-card">
          <div className="cte-kpi-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">Autorizados</span>
            <span className="cte-kpi-value">{kpis.autorizados}</span>
          </div>
        </div>

        <div className="cte-kpi-card">
          <div className="cte-kpi-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <polyline points="9 11 12 14 22 4"></polyline>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">Encerrados</span>
            <span className="cte-kpi-value">{kpis.encerrados}</span>
          </div>
        </div>

        <div className="cte-kpi-card">
          <div className="cte-kpi-icon orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">CT-es Vinculados</span>
            <span className="cte-kpi-value">{kpis.totalCtesEmMdfes}</span>
          </div>
        </div>
      </div>

      {/* Filtro para Graficos */}
      <div className="section-header">
        <h3>Analise de MDF-es</h3>
        <DateFilter onFilterChange={handleGraficosFilterChange} defaultPeriodo="mes" />
      </div>

      {/* Graficos */}
      <div className="cte-charts-grid">
        {/* Grafico de Top Veículos */}
        <div className="cte-chart-card">
          <h3>Top 5 Veículos</h3>
          {veiculosData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={veiculosData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="placa" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(value) => `${value} MDF-es`} />
                <Bar dataKey="total" fill="#C8A951" radius={[0, 4, 4, 0]} name="MDF-es" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">Sem dados para o periodo</div>
          )}
        </div>

        {/* Grafico de CT-es por MDF-e */}
        <div className="cte-chart-card">
          <h3>Distribuicao de CT-es por MDF-e</h3>
          {cteDistribuicaoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={cteDistribuicaoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `${value} MDF-es`} />
                <Bar dataKey="contagem" fill="#0d9488" radius={[4, 4, 0, 0]} name="MDF-es" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">Sem dados para o periodo</div>
          )}
        </div>

        {/* Grafico de Status */}
        <div className="cte-chart-card cte-chart-small">
          <h3>Distribuicao por Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} MDF-es`} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span style={{ fontSize: '12px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">Sem dados para o periodo</div>
          )}
        </div>

        {/* Eficiencia */}
        <div className="cte-chart-card cte-chart-small">
          <h3>Eficiência de Encerramento</h3>
          <div className="eficiencia-display">
            <div className="eficiencia-value">{kpis.eficiencia.toFixed(1)}%</div>
            <div className="eficiencia-label">MDF-es Encerrados</div>
            <div className="eficiencia-detail">
              {kpis.encerrados} de {kpis.total} MDF-es
            </div>
          </div>
        </div>
      </div>

      {/* Separador e Filtro para Tabela */}
      <div className="section-header">
        <h3>Listagem de MDF-es</h3>
        <DateFilter onFilterChange={handleTabelaFilterChange} defaultPeriodo="mes" />
      </div>

      {/* Filtros Adicionais */}
      <div className="filtros-section">
        <form onSubmit={handleFiltrar} className="filtros-form">
          <input
            type="text"
            placeholder="Buscar por chave, número, placa, condutor..."
            value={filtros.q}
            onChange={(e) => setFiltros({...filtros, q: e.target.value})}
            className="input-filter"
          />
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({...filtros, status: e.target.value})}
            className="select-filter"
          >
            <option value="">Todos os Status</option>
            <option value="autorizado">Autorizado</option>
            <option value="encerrado">Encerrado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <button type="submit" className="btn-primary">Filtrar</button>
        </form>
      </div>

      <div className="results-info">
        <p>Total de {pagination.total} MDF-e{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}</p>
      </div>

      <div className="table-container">
        {/* Desktop Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Data Emissão</th>
              <th>UF Origem</th>
              <th>UF Destino</th>
              <th>Veículo</th>
              <th>CT-es</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {mdfes.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center">Nenhum MDF-e encontrado</td>
              </tr>
            ) : (
              mdfes.map((mdfe) => (
                <tr key={mdfe.id}>
                  <td>
                    <strong>{mdfe.numero_mdfe || '-'}</strong>
                    <br />
                    <small className="text-muted">{mdfe.chave?.slice(-10)}</small>
                  </td>
                  <td>{mdfe.data_emissao || '-'}</td>
                  <td>
                    <span className="badge badge-secondary">
                      {mdfe.uf_inicio || '-'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-secondary">
                      {mdfe.uf_fim || '-'}
                    </span>
                  </td>
                  <td>
                    <strong>{mdfe.placa_tracao || '-'}</strong>
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {mdfe.documentos_count || 0}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${mdfe.status === 'Autorizado' ? 'success' : mdfe.status === 'Encerrado' ? 'info' : mdfe.status === 'Cancelado' ? 'danger' : mdfe.status?.includes('Rejeitado') ? 'warning' : 'secondary'}`}>
                      {mdfe.status || 'Pendente'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-action btn-view"
                        onClick={() => handleOpenModal(mdfe)}
                        title="Ver Detalhes"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                      <button
                        className="btn-action btn-download"
                        onClick={() => handleDownloadXML(mdfe.id, mdfe.numero_mdfe)}
                        title="Baixar XML"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Mobile Cards */}
        <div className="mobile-cards">
          {mdfes.length === 0 ? (
            <div className="mobile-empty">
              <div className="mobile-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <p className="mobile-empty-text">Nenhum MDF-e encontrado</p>
            </div>
          ) : (
            mdfes.map((mdfe) => (
              <div key={mdfe.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">
                    <span className="mobile-card-number">MDF-e #{mdfe.numero_mdfe || '-'}</span>
                    <span className="mobile-card-date">{mdfe.data_emissao || '-'}</span>
                  </div>
                  <div className="mobile-card-status">
                    <span className={`badge badge-${mdfe.status === 'Autorizado' ? 'success' : mdfe.status === 'Encerrado' ? 'info' : mdfe.status === 'Cancelado' ? 'danger' : mdfe.status?.includes('Rejeitado') ? 'warning' : 'secondary'}`}>
                      {mdfe.status || 'Pendente'}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Rota</span>
                    <span className="mobile-card-value">
                      <span className="badge badge-secondary" style={{ marginRight: '6px' }}>{mdfe.uf_inicio || '-'}</span>
                      <span style={{ color: '#7f8c8d' }}>→</span>
                      <span className="badge badge-secondary" style={{ marginLeft: '6px' }}>{mdfe.uf_fim || '-'}</span>
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Veículo</span>
                    <span className="mobile-card-value" style={{ fontWeight: 700 }}>{mdfe.placa_tracao || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">CT-es</span>
                    <span className="badge badge-info">{mdfe.documentos_count || 0}</span>
                  </div>
                </div>
                <div className="mobile-card-footer">
                  <div></div>
                  <div className="mobile-card-actions">
                    <button
                      className="btn-action btn-view"
                      onClick={() => handleOpenModal(mdfe)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    <button
                      className="btn-action btn-download"
                      onClick={() => handleDownloadXML(mdfe.id, mdfe.numero_mdfe)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pagination.total > 0 && (
        <div className="pagination">
          <button
            onClick={() => {
              const newPage = pagination.page - 1;
              setPagination(p => ({...p, page: newPage}));
              loadMDFes(null, newPage);
            }}
            disabled={pagination.page === 1}
            className="btn-page"
          >
            Anterior
          </button>
          <div className="pagination-numbers">
            {Array.from({ length: Math.ceil(pagination.total / PAGE_SIZE) }, (_, i) => i + 1)
              .filter(page => {
                const currentPage = pagination.page;
                return page === 1 || page === Math.ceil(pagination.total / PAGE_SIZE) ||
                       (page >= currentPage - 2 && page <= currentPage + 2);
              })
              .map((page, index, arr) => (
                <span key={page}>
                  {index > 0 && arr[index - 1] !== page - 1 && <span className="pagination-ellipsis">...</span>}
                  <button
                    onClick={() => {
                      setPagination(p => ({...p, page}));
                      loadMDFes(null, page);
                    }}
                    className={`btn-page-num ${pagination.page === page ? 'active' : ''}`}
                  >
                    {page}
                  </button>
                </span>
              ))
            }
          </div>
          <button
            onClick={() => {
              const newPage = pagination.page + 1;
              setPagination(p => ({...p, page: newPage}));
              loadMDFes(null, newPage);
            }}
            disabled={pagination.page >= Math.ceil(pagination.total / PAGE_SIZE)}
            className="btn-page"
          >
            Proxima
          </button>
        </div>
      )}

      {/* Modal de Detalhes Rapidos */}
      {modalMdfe && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content mdfe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #40916C 0%, #2D6A4F 100%)' }}>
              <h2>MDF-e #{modalMdfe.numero_mdfe}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-info-grid">
                <div className="modal-info-item">
                  <span className="modal-info-label">Número</span>
                  <span className="modal-info-value">{modalMdfe.numero_mdfe || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Data Emissão</span>
                  <span className="modal-info-value">{modalMdfe.data_emissao || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">UF Origem</span>
                  <span className="badge badge-secondary">{modalMdfe.uf_inicio || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">UF Destino</span>
                  <span className="badge badge-secondary">{modalMdfe.uf_fim || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Veículo (Placa)</span>
                  <span className="modal-info-value" style={{ fontWeight: 700 }}>{modalMdfe.placa_tracao || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">CT-es Vinculados</span>
                  <span className="badge badge-info">{modalMdfe.documentos_count || 0}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Status</span>
                  <span className={`badge badge-${modalMdfe.status === 'Autorizado' ? 'success' : modalMdfe.status === 'Encerrado' ? 'info' : modalMdfe.status === 'Cancelado' ? 'danger' : modalMdfe.status?.includes('Rejeitado') ? 'warning' : 'secondary'}`}>
                    {modalMdfe.status || 'Pendente'}
                  </span>
                </div>
                <div className="modal-info-item full-width">
                  <span className="modal-info-label">Chave de Acesso</span>
                  <span className="modal-info-value chave-cte">{modalMdfe.chave || '-'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-action btn-download"
                onClick={() => handleDownloadXML(modalMdfe.id, modalMdfe.numero_mdfe)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Baixar XML
              </button>
              <button className="btn-action btn-secondary" onClick={handleCloseModal}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MDFeList;
