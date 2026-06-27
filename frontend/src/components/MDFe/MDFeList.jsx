import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { mdfeAPI, dashboardAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import Modal from '../Common/Modal';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import Button from '../Common/Button';
import tokens from '../../styles/tokens.module.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import styles from './MDFe.module.css';

// Cores para os graficos
const STATUS_COLORS = {
  autorizado: tokens.successColor,
  encerrado: tokens.infoColor,
  cancelado: tokens.dangerColor,
  pendente: '#9AA8A0'
};
const PAGE_SIZE = 20;

const getStatusVariant = (status) => {
  const s = status?.toLowerCase() || '';
  if (s === 'autorizado') return 'success';
  if (s === 'encerrado') return 'info';
  if (s === 'cancelado') return 'danger';
  if (s.includes('rejeitado')) return 'warning';
  return 'muted';
};

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

  // Filtros da tabela (e do painel — unificado)
  const [filtros, setFiltros] = useState({
    q: '',
    status: '',
    data_inicio: defaultDates.data_inicio,
    data_fim: defaultDates.data_fim
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0 });

  // Carregar dados do painel para graficos
  const loadPainelMDFe = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtros;
    try {
      const params = { data_inicio: filtrosAtivos.data_inicio, data_fim: filtrosAtivos.data_fim };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await dashboardAPI.mdfe(params);
      setPainelData(result);
    } catch (err) {
      console.error('Erro ao carregar painel MDF-e:', err);
      setPainelData(null);
    }
  };

  // Carregar MDF-es para tabela
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

  // Handler unico para filtro de data (painel + tabela)
  const handleDateFilterChange = (dateFilters) => {
    const novosFiltros = {
      q: '',
      status: '',
      data_inicio: dateFilters.data_inicio,
      data_fim: dateFilters.data_fim
    };
    setFiltros(novosFiltros);
    setPagination(prev => ({ ...prev, page: 1 }));
    loadMDFes(novosFiltros, 1);
    loadPainelMDFe(novosFiltros);
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
    <div className={styles.headerButtons}>
      <Button variant="outline" onClick={handleExport}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exportar
      </Button>
      <Link to="/upload" className={styles.uploadLink}>
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
    <div className={styles.mdfeList}>
      <PageHeader
        title="MDF-e - Manifesto de Documentos"
        subtitle={`${pagination.total} documentos`}
        icon={mdfeIcon}
        breadcrumbs={[{ label: 'Documentos' }, { label: 'MDF-e' }]}
        actions={headerActions}
      />

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBlue}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total MDF-es</span>
            <span className={styles.kpiValue}>{kpis.total}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconGreen}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Autorizados</span>
            <span className={styles.kpiValue}>{kpis.autorizados}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconPurple}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <polyline points="9 11 12 14 22 4"></polyline>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Encerrados</span>
            <span className={styles.kpiValue}>{kpis.encerrados}</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconOrange}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>CT-es Vinculados</span>
            <span className={styles.kpiValue}>{kpis.totalCtesEmMdfes}</span>
          </div>
        </div>
      </div>

      {/* Filtro para Graficos */}
      <div className={styles.sectionHeader}>
        <h3>Analise de MDF-es</h3>
        <DateFilter
          onFilterChange={handleDateFilterChange}
          defaultPeriodo="mes"
          initialDataInicio={filtros.data_inicio}
          initialDataFim={filtros.data_fim}
        />
      </div>

      {/* Graficos */}
      <div className={styles.chartsGrid}>
        {/* Grafico de Top Veículos */}
        <div className={styles.chartCard}>
          <h3>Top 5 Veículos</h3>
          {veiculosData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={veiculosData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderColor || '#f0f0f0'} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="placa" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(value) => `${value} MDF-es`} />
                <Bar dataKey="total" fill={tokens.goldColor} radius={[0, 4, 4, 0]} name="MDF-es" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>Sem dados para o periodo</div>
          )}
        </div>

        {/* Grafico de CT-es por MDF-e */}
        <div className={styles.chartCard}>
          <h3>Distribuicao de CT-es por MDF-e</h3>
          {cteDistribuicaoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={cteDistribuicaoData}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderColor || '#f0f0f0'} />
                <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `${value} MDF-es`} />
                <Bar dataKey="contagem" fill={tokens.infoColor} radius={[4, 4, 0, 0]} name="MDF-es" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>Sem dados para o periodo</div>
          )}
        </div>

        {/* Grafico de Status */}
        <div className={`${styles.chartCard} ${styles.chartSmall}`}>
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
            <div className={styles.emptyChart}>Sem dados para o periodo</div>
          )}
        </div>

        {/* Eficiencia */}
        <div className={`${styles.chartCard} ${styles.chartSmall}`}>
          <h3>Eficiência de Encerramento</h3>
          <div className={styles.eficienciaDisplay}>
            <div className={styles.eficienciaValue}>{kpis.eficiencia.toFixed(1)}%</div>
            <div className={styles.eficienciaLabel}>MDF-es Encerrados</div>
            <div className={styles.eficienciaDetail}>
              {kpis.encerrados} de {kpis.total} MDF-es
            </div>
          </div>
        </div>
      </div>

      {/* Filtros Adicionais */}
      <div className={styles.filtrosSection}>
        <form onSubmit={handleFiltrar} className={styles.filtrosForm}>
          <input
            type="text"
            placeholder="Buscar por chave, número, placa, condutor..."
            value={filtros.q}
            onChange={(e) => setFiltros({...filtros, q: e.target.value})}
            className={styles.inputFilter}
          />
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({...filtros, status: e.target.value})}
            className={styles.selectFilter}
          >
            <option value="">Todos os Status</option>
            <option value="autorizado">Autorizado</option>
            <option value="encerrado">Encerrado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <Button type="submit" variant="primary">Filtrar</Button>
        </form>
      </div>

      <div className={styles.resultsInfo}>
        <p>Total de {pagination.total} MDF-e{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}</p>
      </div>

      <TableContainer mobileCards={false} className={styles.tableWrapper}>
        {/* Desktop Table */}
        <table className={styles.dataTable}>
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
                <td colSpan="8" className={styles.textCenter}>Nenhum MDF-e encontrado</td>
              </tr>
            ) : (
              mdfes.map((mdfe) => (
                <tr key={mdfe.id}>
                  <td>
                    <strong>{mdfe.numero_mdfe || '-'}</strong>
                    <br />
                    <small className={styles.textMuted}>{mdfe.chave?.slice(-10)}</small>
                  </td>
                  <td>{mdfe.data_emissao || '-'}</td>
                  <td>
                    <span className={styles.badgeSecondary}>
                      {mdfe.uf_inicio || '-'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.badgeSecondary}>
                      {mdfe.uf_fim || '-'}
                    </span>
                  </td>
                  <td>
                    <strong>{mdfe.placa_tracao || '-'}</strong>
                  </td>
                  <td>
                    <span className={styles.badgeInfo}>
                      {mdfe.documentos_count || 0}
                    </span>
                  </td>
                  <td>
                    <StatusPill status={getStatusVariant(mdfe.status)}>
                      {mdfe.status || 'Pendente'}
                    </StatusPill>
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button
                        className={styles.actionBtnView}
                        onClick={() => handleOpenModal(mdfe)}
                        title="Ver Detalhes"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                      <button
                        className={styles.actionBtnDownload}
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
      </TableContainer>

      {/* Mobile Cards */}
      <div className={styles.mobileCards}>
        {mdfes.length === 0 ? (
          <div className={styles.mobileEmpty}>
            <div className={styles.mobileEmptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <p className={styles.mobileEmptyText}>Nenhum MDF-e encontrado</p>
          </div>
        ) : (
          mdfes.map((mdfe) => (
            <div key={mdfe.id} className={styles.mobileCard}>
              <div className={styles.mobileCardHeader}>
                <div className={styles.mobileCardTitle}>
                  <span className={styles.mobileCardNumber}>MDF-e #{mdfe.numero_mdfe || '-'}</span>
                  <span className={styles.mobileCardDate}>{mdfe.data_emissao || '-'}</span>
                </div>
                <div className={styles.mobileCardStatus}>
                  <StatusPill status={getStatusVariant(mdfe.status)}>
                    {mdfe.status || 'Pendente'}
                  </StatusPill>
                </div>
              </div>
              <div className={styles.mobileCardBody}>
                <div className={styles.mobileCardRow}>
                  <span className={styles.mobileCardLabel}>Rota</span>
                  <span className={styles.mobileCardValue}>
                    <span className={styles.badgeSecondary} style={{ marginRight: '6px' }}>{mdfe.uf_inicio || '-'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span className={styles.badgeSecondary} style={{ marginLeft: '6px' }}>{mdfe.uf_fim || '-'}</span>
                  </span>
                </div>
                <div className={styles.mobileCardRow}>
                  <span className={styles.mobileCardLabel}>Veículo</span>
                  <span className={styles.mobileCardValue} style={{ fontWeight: 700 }}>{mdfe.placa_tracao || '-'}</span>
                </div>
                <div className={styles.mobileCardRow}>
                  <span className={styles.mobileCardLabel}>CT-es</span>
                  <span className={styles.badgeInfo}>{mdfe.documentos_count || 0}</span>
                </div>
              </div>
              <div className={styles.mobileCardFooter}>
                <div></div>
                <div className={styles.mobileCardActions}>
                  <button
                    className={styles.actionBtnView}
                    onClick={() => handleOpenModal(mdfe)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                  <button
                    className={styles.actionBtnDownload}
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

      {pagination.total > 0 && (
        <div className={styles.pagination}>
          <button
            onClick={() => {
              const newPage = pagination.page - 1;
              setPagination(p => ({...p, page: newPage}));
              loadMDFes(null, newPage);
            }}
            disabled={pagination.page === 1}
            className={styles.btnPage}
          >
            Anterior
          </button>
          <div className={styles.paginationNumbers}>
            {Array.from({ length: Math.ceil(pagination.total / PAGE_SIZE) }, (_, i) => i + 1)
              .filter(page => {
                const currentPage = pagination.page;
                return page === 1 || page === Math.ceil(pagination.total / PAGE_SIZE) ||
                       (page >= currentPage - 2 && page <= currentPage + 2);
              })
              .map((page, index, arr) => (
                <span key={page}>
                  {index > 0 && arr[index - 1] !== page - 1 && <span className={styles.paginationEllipsis}>...</span>}
                  <button
                    onClick={() => {
                      setPagination(p => ({...p, page}));
                      loadMDFes(null, page);
                    }}
                    className={`${styles.btnPageNum} ${pagination.page === page ? styles.active : ''}`}
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
            className={styles.btnPage}
          >
            Proxima
          </button>
        </div>
      )}

      {/* Modal de Detalhes Rapidos */}
      <Modal
        isOpen={!!modalMdfe}
        onClose={handleCloseModal}
        title={modalMdfe ? `MDF-e #${modalMdfe.numero_mdfe}` : ''}
        size="md"
        footer={
          <>
            <Link
              to={modalMdfe ? `/mdfes/${modalMdfe.id}` : '#'}
              className={styles.actionBtnView}
              onClick={handleCloseModal}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Ver Detalhes
            </Link>
            <Button
              variant="outline"
              onClick={() => modalMdfe && handleDownloadXML(modalMdfe.id, modalMdfe.numero_mdfe)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Baixar XML
            </Button>
            <Button variant="secondary" onClick={handleCloseModal}>
              Fechar
            </Button>
          </>
        }
      >
        {modalMdfe && (
          <div className={styles.modalInfoGrid}>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Número</span>
              <span className={styles.modalInfoValue}>{modalMdfe.numero_mdfe || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Data Emissão</span>
              <span className={styles.modalInfoValue}>{modalMdfe.data_emissao || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>UF Origem</span>
              <span className={styles.badgeSecondary}>{modalMdfe.uf_inicio || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>UF Destino</span>
              <span className={styles.badgeSecondary}>{modalMdfe.uf_fim || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Veículo (Placa)</span>
              <span className={styles.modalInfoValue} style={{ fontWeight: 700 }}>{modalMdfe.placa_tracao || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>CT-es Vinculados</span>
              <span className={styles.badgeInfo}>{modalMdfe.documentos_count || 0}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Status</span>
              <StatusPill status={getStatusVariant(modalMdfe.status)}>
                {modalMdfe.status || 'Pendente'}
              </StatusPill>
            </div>
            <div className={`${styles.modalInfoItem} ${styles.modalInfoItemFull}`}>
              <span className={styles.modalInfoLabel}>Chave de Acesso</span>
              <span className={`${styles.modalInfoValue} ${styles.chaveCte}`}>{modalMdfe.chave || '-'}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default MDFeList;
