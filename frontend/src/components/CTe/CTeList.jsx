import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cteAPI, dashboardAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import './CTe.css';

// Cores para os graficos
const COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6'];

function CTeList() {
  const toast = useToast();

  // useMemo ensures defaultDates is stable across renders
  const defaultDates = useMemo(() => {
    const hoje = new Date();
    const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return {
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: dataFim.toISOString().split('T')[0]
    };
  }, []);
  const [ctes, setCtes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de detalhes rapidos
  const [modalCte, setModalCte] = useState(null);
  const [atualizandoPagamento, setAtualizandoPagamento] = useState(null);

  // Dados dos graficos (API /api/painel/cte/)
  const [painelData, setPainelData] = useState(null);
  const [filtrosGraficos, setFiltrosGraficos] = useState(defaultDates);

  // Filtros da tabela
  const [filtros, setFiltros] = useState({
    q: '',
    status: '',
    pago: '',
    data_inicio: defaultDates.data_inicio,
    data_fim: defaultDates.data_fim
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0 });

  // Carregar dados do painel para graficos
  const loadPainelCTe = useCallback(async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtrosGraficos;
    try {
      const params = { ...filtrosAtivos };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await dashboardAPI.cte(params);
      setPainelData(result);
    } catch (err) {
      console.error('Erro ao carregar painel CT-e:', err);
      setPainelData(null);
    }
  }, [filtrosGraficos]);

  // Carregar CT-es para tabela (5 por pagina)
  const loadCTes = useCallback(async (customFiltros = null, customPage = null) => {
    const filtrosAtivos = customFiltros || filtros;
    const pageAtivo = customPage !== null ? customPage : pagination.page;
    try {
      setLoading(true);
      const params = { ...filtrosAtivos, page: pageAtivo, page_size: 5 };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await cteAPI.list(params);
      setCtes(result.results || result || []);
      setPagination(prev => ({ ...prev, total: result.count || (result.results ? result.results.length : result.length) || 0 }));
    } catch (err) {
      console.error('Erro ao carregar CT-es:', err);
      setCtes([]);
      setPagination(prev => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  }, [filtros, pagination.page]);

  // Carrega na montagem inicial
  useEffect(() => {
    loadPainelCTe(defaultDates);
    loadCTes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler para filtro de graficos
  const handleGraficosFilterChange = useCallback((dateFilters) => {
    setFiltrosGraficos(dateFilters);
    loadPainelCTe(dateFilters);
  }, [loadPainelCTe]);

  // Handler para filtro da tabela
  const handleTabelaFilterChange = useCallback((dateFilters) => {
    setFiltros(prev => ({
      ...prev,
      data_inicio: dateFilters.data_inicio,
      data_fim: dateFilters.data_fim
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
    loadCTes({
      q: '',
      status: '',
      pago: '',
      data_inicio: dateFilters.data_inicio,
      data_fim: dateFilters.data_fim
    }, 1);
  }, [loadCTes]);

  const handleFiltrar = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadCTes();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Funcao para baixar XML
  const handleDownloadXML = async (cteId, numeroCte) => {
    try {
      const blob = await cteAPI.downloadXML(cteId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cte_${numeroCte || cteId}.xml`;
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
  const handleOpenModal = (cte) => {
    setModalCte(cte);
  };

  // Funcao para fechar modal
  const handleCloseModal = () => {
    setModalCte(null);
  };

  // Funcao para alternar status de pagamento
  const handleTogglePagamento = async (cte) => {
    const novoPago = !cte.pago;
    setAtualizandoPagamento(cte.id);
    try {
      await cteAPI.marcarPagamento(cte.id, novoPago);
      // Atualiza o CT-e na lista localmente
      setCtes(prev => prev.map(c =>
        c.id === cte.id
          ? { ...c, pago: novoPago, data_pagamento: novoPago ? new Date().toISOString().split('T')[0] : null }
          : c
      ));
      toast.success(novoPago ? 'CT-e marcado como pago!' : 'CT-e marcado como pendente!');
    } catch (err) {
      console.error('Erro ao atualizar status de pagamento:', err);
      toast.error('Erro ao atualizar status de pagamento. Tente novamente.');
    } finally {
      setAtualizandoPagamento(null);
    }
  };

  // KPIs do painel - conforme API /api/painel/cte/
  const kpis = {
    total: painelData?.cards?.total_ctes || pagination.total || 0,
    autorizados: painelData?.cards?.total_autorizados || 0,
    cancelados: painelData?.cards?.total_cancelados || 0,
    rejeitados: painelData?.cards?.total_rejeitados || 0,
    valorTotal: painelData?.cards?.valor_total || 0
  };

  // Dados para grafico de modalidade CIF/FOB - conforme API grafico_distribuidor
  const getModalidadeData = () => {
    if (!painelData?.grafico_distribuidor || painelData.grafico_distribuidor.length === 0) return [];
    return painelData.grafico_distribuidor.map((item, index) => ({
      name: item.label || 'N/A',
      value: item.qtd || 0,
      valor: item.valor || 0,
      color: index === 0 ? '#3498db' : '#e67e22'
    }));
  };

  // Dados para grafico de clientes - conforme API grafico_cliente
  const getClienteData = () => {
    if (!painelData?.grafico_cliente || painelData.grafico_cliente.length === 0) return [];
    return painelData.grafico_cliente.slice(0, 5).map(item => ({
      nome: item.label?.substring(0, 20) || 'N/A',
      valor: item.valor || 0,
      qtd: item.qtd || 0
    }));
  };

  const cteIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
  );

  const headerActions = (
    <div className="header-buttons">
      <button
        className="btn btn-outline"
        onClick={() => cteAPI.export(filtros)}
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
  const modalidadeData = getModalidadeData();
  const clienteData = getClienteData();

  // Mostra loading apenas no carregamento inicial
  if (loading && ctes.length === 0) return <Loading message="Carregando CT-es..." />;

  return (
    <div className="cte-list">
      <PageHeader
        title="CT-e - Conhecimento de Transporte"
        subtitle={`${pagination.total} documentos`}
        icon={cteIcon}
        breadcrumbs={[{ label: 'Documentos' }, { label: 'CT-e' }]}
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
            <span className="cte-kpi-label">Total CT-es</span>
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
          <div className="cte-kpi-icon red">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">Cancelados</span>
            <span className="cte-kpi-value">{kpis.cancelados}</span>
          </div>
        </div>

        <div className="cte-kpi-card">
          <div className="cte-kpi-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">Valor Total</span>
            <span className="cte-kpi-value">{formatCurrency(kpis.valorTotal)}</span>
          </div>
        </div>
      </div>

      {/* Filtro para Graficos */}
      <div className="section-header">
        <h3>Analise de CT-es</h3>
        <DateFilter onFilterChange={handleGraficosFilterChange} defaultPeriodo="mes" />
      </div>

      {/* Graficos */}
      <div className="cte-charts-grid">
        {/* Grafico de Top Clientes */}
        <div className="cte-chart-card">
          <h3>Top 5 Clientes por Faturamento</h3>
          {clienteData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={clienteData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="valor" fill="#3498db" radius={[0, 4, 4, 0]} name="Valor" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">Sem dados para o periodo</div>
          )}
        </div>

        {/* Grafico de Modalidade */}
        <div className="cte-chart-card cte-chart-small">
          <h3>Modalidade de Frete</h3>
          {modalidadeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={modalidadeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {modalidadeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} CT-es`} />
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
      </div>

      {/* Separador e Filtro para Tabela */}
      <div className="section-header">
        <h3>Listagem de CT-es</h3>
        <DateFilter onFilterChange={handleTabelaFilterChange} defaultPeriodo="mes" />
      </div>

      {/* Filtros Adicionais */}
      <div className="filtros-section">
        <form onSubmit={handleFiltrar} className="filtros-form">
          <input
            type="text"
            placeholder="Buscar por chave, numero, remetente..."
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
            <option value="cancelado">Cancelado</option>
            <option value="rejeitado">Rejeitado</option>
          </select>
          <select
            value={filtros.pago}
            onChange={(e) => setFiltros({...filtros, pago: e.target.value})}
            className="select-filter"
          >
            <option value="">Todos (Pago/Pendente)</option>
            <option value="true">Pagos</option>
            <option value="false">Pendentes</option>
          </select>
          <button type="submit" className="btn-primary">Filtrar</button>
        </form>
      </div>

      <div className="results-info">
        <p>Total de {pagination.total} CT-e{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}</p>
      </div>

      <div className="table-container">
        {/* Desktop Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th>Numero</th>
              <th>Data Emissao</th>
              <th>Remetente</th>
              <th>Destinatario</th>
              <th>Valor</th>
              <th>Modalidade</th>
              <th>Status</th>
              <th>Pago</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {ctes.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center">Nenhum CT-e encontrado</td>
              </tr>
            ) : (
              ctes.map((cte) => (
                <tr key={cte.id}>
                  <td>
                    <strong>{cte.numero_cte || '-'}</strong>
                    <br />
                    <small className="text-muted">{cte.chave?.slice(-10)}</small>
                  </td>
                  <td>{cte.data_emissao || '-'}</td>
                  <td>
                    {cte.remetente_nome || '-'}
                  </td>
                  <td>
                    {cte.destinatario_nome || '-'}
                  </td>
                  <td className="text-right">
                    {formatCurrency(cte.valor_total)}
                  </td>
                  <td>
                    <span className={`badge badge-${cte.modalidade === 'CIF' ? 'info' : 'warning'}`}>
                      {cte.modalidade || '-'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${cte.status === 'Autorizado' ? 'success' : cte.status === 'Cancelado' ? 'danger' : cte.status?.includes('Rejeitado') ? 'warning' : 'secondary'}`}>
                      {cte.status || 'Pendente'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn-toggle-pago ${cte.pago ? 'pago' : 'nao-pago'}`}
                      onClick={() => handleTogglePagamento(cte)}
                      disabled={atualizandoPagamento === cte.id}
                      title={cte.pago ? `Pago em ${cte.data_pagamento ? new Date(cte.data_pagamento).toLocaleDateString('pt-BR') : '-'}` : 'Clique para marcar como pago'}
                    >
                      {atualizandoPagamento === cte.id ? (
                        <span className="loading-spinner-small"></span>
                      ) : cte.pago ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                      )}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-action btn-view"
                        onClick={() => handleOpenModal(cte)}
                        title="Ver Detalhes"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                      <button
                        className="btn-action btn-download"
                        onClick={() => handleDownloadXML(cte.id, cte.numero_cte)}
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
          {ctes.length === 0 ? (
            <div className="mobile-empty">
              <div className="mobile-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <p className="mobile-empty-text">Nenhum CT-e encontrado</p>
            </div>
          ) : (
            ctes.map((cte) => (
              <div key={cte.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">
                    <span className="mobile-card-number">CT-e #{cte.numero_cte || '-'}</span>
                    <span className="mobile-card-date">{cte.data_emissao || '-'}</span>
                  </div>
                  <div className="mobile-card-status">
                    <span className={`badge badge-${cte.status === 'Autorizado' ? 'success' : cte.status === 'Cancelado' ? 'danger' : cte.status?.includes('Rejeitado') ? 'warning' : 'secondary'}`}>
                      {cte.status || 'Pendente'}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Remetente</span>
                    <span className="mobile-card-value">{cte.remetente_nome || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Destinatario</span>
                    <span className="mobile-card-value">{cte.destinatario_nome || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Valor</span>
                    <span className="mobile-card-value valor">{formatCurrency(cte.valor_total)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Modalidade</span>
                    <span className={`badge badge-${cte.modalidade === 'CIF' ? 'info' : 'warning'}`}>
                      {cte.modalidade || '-'}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-footer">
                  <div className="mobile-card-pago">
                    <button
                      className={`btn-toggle-pago ${cte.pago ? 'pago' : 'nao-pago'}`}
                      onClick={() => handleTogglePagamento(cte)}
                      disabled={atualizandoPagamento === cte.id}
                    >
                      {atualizandoPagamento === cte.id ? (
                        <span className="loading-spinner-small"></span>
                      ) : cte.pago ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                        </svg>
                      )}
                    </button>
                    <span style={{ fontSize: '12px', color: cte.pago ? '#27ae60' : '#7f8c8d' }}>
                      {cte.pago ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                  <div className="mobile-card-actions">
                    <button
                      className="btn-action btn-view"
                      onClick={() => handleOpenModal(cte)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    <button
                      className="btn-action btn-download"
                      onClick={() => handleDownloadXML(cte.id, cte.numero_cte)}
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
              loadCTes(null, newPage);
            }}
            disabled={pagination.page === 1}
            className="btn-page"
          >
            Anterior
          </button>
          <div className="pagination-numbers">
            {Array.from({ length: Math.ceil(pagination.total / 5) }, (_, i) => i + 1)
              .filter(page => {
                const currentPage = pagination.page;
                return page === 1 || page === Math.ceil(pagination.total / 5) ||
                       (page >= currentPage - 2 && page <= currentPage + 2);
              })
              .map((page, index, arr) => (
                <span key={page}>
                  {index > 0 && arr[index - 1] !== page - 1 && <span className="pagination-ellipsis">...</span>}
                  <button
                    onClick={() => {
                      setPagination(p => ({...p, page}));
                      loadCTes(null, page);
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
              loadCTes(null, newPage);
            }}
            disabled={pagination.page >= Math.ceil(pagination.total / 5)}
            className="btn-page"
          >
            Proxima
          </button>
        </div>
      )}

      {/* Modal de Detalhes Rapidos */}
      {modalCte && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content cte-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>CT-e #{modalCte.numero_cte}</h2>
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
                  <span className="modal-info-label">Numero</span>
                  <span className="modal-info-value">{modalCte.numero_cte || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Data Emissao</span>
                  <span className="modal-info-value">{modalCte.data_emissao || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Remetente</span>
                  <span className="modal-info-value">{modalCte.remetente_nome || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Destinatario</span>
                  <span className="modal-info-value">{modalCte.destinatario_nome || '-'}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Valor</span>
                  <span className="modal-info-value valor-destaque">{formatCurrency(modalCte.valor_total)}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Modalidade</span>
                  <span className={`badge badge-${modalCte.modalidade === 'CIF' ? 'info' : 'warning'}`}>
                    {modalCte.modalidade || '-'}
                  </span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Status</span>
                  <span className={`badge badge-${modalCte.status === 'Autorizado' ? 'success' : modalCte.status === 'Cancelado' ? 'danger' : modalCte.status?.includes('Rejeitado') ? 'warning' : 'secondary'}`}>
                    {modalCte.status || 'Pendente'}
                  </span>
                </div>
                <div className="modal-info-item full-width">
                  <span className="modal-info-label">Chave de Acesso</span>
                  <span className="modal-info-value chave-cte">{modalCte.chave || '-'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-action btn-download"
                onClick={() => handleDownloadXML(modalCte.id, modalCte.numero_cte)}
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

export default CTeList;
