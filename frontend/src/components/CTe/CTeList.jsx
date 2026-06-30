import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cteAPI, dashboardAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import PermissionGuard from '../Common/PermissionGuard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import sharedStyles from './CTeShared.module.css';
import styles from './CTeList.module.css';

// Cores para os graficos
const COLORS = ['#0d9488', '#2ecc71', '#e74c3c', '#f39c12', '#C8A951'];
const PAGE_SIZE = 20;

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

  // Filtros da tabela (e do painel — unificado)
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
    const filtrosAtivos = customFiltros || filtros;
    try {
      const params = { data_inicio: filtrosAtivos.data_inicio, data_fim: filtrosAtivos.data_fim };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await dashboardAPI.cte(params);
      setPainelData(result);
    } catch (err) {
      console.error('Erro ao carregar painel CT-e:', err);
      setPainelData(null);
    }
  }, [filtros]);

  // Carregar CT-es para tabela (20 por pagina)
  const loadCTes = useCallback(async (customFiltros = null, customPage = null) => {
    const filtrosAtivos = customFiltros || filtros;
    const pageAtivo = customPage !== null ? customPage : pagination.page;
    try {
      setLoading(true);
      const params = { ...filtrosAtivos, page: pageAtivo, page_size: PAGE_SIZE };
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

  // Carrega dados na montagem inicial
  useEffect(() => {
    loadPainelCTe(defaultDates);
    loadCTes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler unico para filtro de data (painel + tabela)
  const handleDateFilterChange = useCallback((dateFilters) => {
    const novosFiltros = {
      q: '',
      status: '',
      pago: '',
      data_inicio: dateFilters.data_inicio,
      data_fim: dateFilters.data_fim
    };
    setFiltros(novosFiltros);
    setPagination(prev => ({ ...prev, page: 1 }));
    loadCTes(novosFiltros, 1);
    loadPainelCTe(novosFiltros);
  }, [loadCTes, loadPainelCTe]);

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
      color: index === 0 ? '#0d9488' : '#e67e22'
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

  const getStatusPill = (status) => {
    if (status === 'Autorizado') return { status: 'success', text: 'Autorizado' };
    if (status === 'Cancelado') return { status: 'danger', text: 'Cancelado' };
    if (status?.includes('Rejeitado')) return { status: 'warning', text: status };
    return { status: 'muted', text: status || 'Pendente' };
  };

  const getModalidadePill = (modalidade) => ({
    status: modalidade === 'CIF' ? 'info' : 'warning',
    text: modalidade || '-'
  });

  const headerActions = (
    <div className={sharedStyles.headerButtons}>
      <Button
        variant="outline"
        onClick={() => cteAPI.export(filtros)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exportar
      </Button>
      <Link
        to="/upload"
        className={sharedStyles.btnPrimary}
      >
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
    <div className={sharedStyles.cteList}>
      <PageHeader
        title="CT-e - Conhecimento de Transporte"
        subtitle={`${pagination.total} documentos`}
        icon={cteIcon}
        breadcrumbs={[{ label: 'Documentos' }, { label: 'CT-e' }]}
        actions={headerActions}
      />

      {/* KPI Cards */}
      <div className={sharedStyles.kpiGrid}>
        <div className={sharedStyles.kpiCard}>
          <div className={`${sharedStyles.kpiIcon} ${sharedStyles.blue}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className={sharedStyles.kpiContent}>
            <span className={sharedStyles.kpiLabel}>Total CT-es</span>
            <span className={sharedStyles.kpiValue}>{kpis.total}</span>
          </div>
        </div>

        <div className={sharedStyles.kpiCard}>
          <div className={`${sharedStyles.kpiIcon} ${sharedStyles.green}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className={sharedStyles.kpiContent}>
            <span className={sharedStyles.kpiLabel}>Autorizados</span>
            <span className={sharedStyles.kpiValue}>{kpis.autorizados}</span>
          </div>
        </div>

        <div className={sharedStyles.kpiCard}>
          <div className={`${sharedStyles.kpiIcon} ${sharedStyles.red}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div className={sharedStyles.kpiContent}>
            <span className={sharedStyles.kpiLabel}>Cancelados</span>
            <span className={sharedStyles.kpiValue}>{kpis.cancelados}</span>
          </div>
        </div>

        <div className={sharedStyles.kpiCard}>
          <div className={`${sharedStyles.kpiIcon} ${sharedStyles.purple}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className={sharedStyles.kpiContent}>
            <span className={sharedStyles.kpiLabel}>Valor Total</span>
            <span className={sharedStyles.kpiValue}>{formatCurrency(kpis.valorTotal)}</span>
          </div>
        </div>
      </div>

      <DateFilter
        onFilterChange={handleDateFilterChange}
        defaultPeriodo="mes"
        initialDataInicio={filtros.data_inicio}
        initialDataFim={filtros.data_fim}
      />

      {/* Graficos */}
      <h3 className={sharedStyles.sectionTitle}>Analise de CT-es</h3>
      <div className={sharedStyles.chartsGrid}>
        {/* Grafico de Top Clientes */}
        <div className={sharedStyles.chartCard}>
          <h3>Top 5 Clientes por Faturamento</h3>
          {clienteData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={clienteData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="valor" fill="#0d9488" radius={[0, 4, 4, 0]} name="Valor" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={sharedStyles.emptyChart}>Sem dados para o periodo</div>
          )}
        </div>

        {/* Grafico de Modalidade */}
        <div className={`${sharedStyles.chartCard} ${sharedStyles.chartSmall}`}>
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
            <div className={sharedStyles.emptyChart}>Sem dados para o periodo</div>
          )}
        </div>
      </div>

      {/* Filtros Adicionais */}
      <div className={sharedStyles.filtrosSection}>
        <form onSubmit={handleFiltrar} className={sharedStyles.filtrosForm}>
          <input
            type="text"
            placeholder="Buscar por chave, número, remetente, condutor..."
            value={filtros.q}
            onChange={(e) => setFiltros({...filtros, q: e.target.value})}
            className={sharedStyles.inputFilter}
          />
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({...filtros, status: e.target.value})}
            className={sharedStyles.selectFilter}
          >
            <option value="">Todos os Status</option>
            <option value="autorizado">Autorizado</option>
            <option value="cancelado">Cancelado</option>
            <option value="rejeitado">Rejeitado</option>
          </select>
          <select
            value={filtros.pago}
            onChange={(e) => setFiltros({...filtros, pago: e.target.value})}
            className={sharedStyles.selectFilter}
          >
            <option value="">Todos (Pago/Pendente)</option>
            <option value="true">Pagos</option>
            <option value="false">Pendentes</option>
          </select>
          <Button type="submit" variant="primary">Filtrar</Button>
        </form>
      </div>

      <div className={sharedStyles.resultsInfo}>
        <p>Total de {pagination.total} CT-e{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}</p>
      </div>

      <TableContainer>
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Data Emissão</th>
              <th>Remetente</th>
              <th>Destinatario</th>
              <th>Valor</th>
              <th className={sharedStyles.hideTablet}>Modalidade</th>
              <th>Status</th>
              <th className={sharedStyles.hideTablet}>Pago</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ctes.length === 0 ? (
              <tr>
                <td colSpan="9" className={sharedStyles.textCenter}>Nenhum CT-e encontrado</td>
              </tr>
            ) : (
              ctes.map((cte) => {
                const statusPill = getStatusPill(cte.status);
                const modalidadePill = getModalidadePill(cte.modalidade);
                return (
                  <tr key={cte.id}>
                    <td data-label="Número">
                      <strong>{cte.numero_cte || '-'}</strong>
                      <br />
                      <small className={sharedStyles.textMuted}>{cte.chave?.slice(-10)}</small>
                    </td>
                    <td data-label="Data Emissão">{cte.data_emissao || '-'}</td>
                    <td data-label="Remetente">
                      {cte.remetente_nome || '-'}
                    </td>
                    <td data-label="Destinatario">
                      {cte.destinatario_nome || '-'}
                    </td>
                    <td data-label="Valor" className={sharedStyles.textRight}>
                      {formatCurrency(cte.valor_total)}
                    </td>
                    <td data-label="Modalidade" className={sharedStyles.hideTablet}>
                      <StatusPill status={modalidadePill.status}>{modalidadePill.text}</StatusPill>
                    </td>
                    <td data-label="Status">
                      <StatusPill status={statusPill.status}>{statusPill.text}</StatusPill>
                    </td>
                    <td data-label="Pago" className={sharedStyles.hideTablet}>
                      <button
                        className={`${sharedStyles.btnTogglePago} ${cte.pago ? sharedStyles.pago : sharedStyles.naoPago}`}
                        onClick={() => handleTogglePagamento(cte)}
                        disabled={atualizandoPagamento === cte.id}
                        title={cte.pago ? `Pago em ${cte.data_pagamento ? new Date(cte.data_pagamento).toLocaleDateString('pt-BR') : '-'}` : 'Clique para marcar como pago'}
                      >
                        {atualizandoPagamento === cte.id ? (
                          <span className={sharedStyles.loadingSpinnerSmall}></span>
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
                    <td data-label="Ações">
                      <div className={sharedStyles.actionButtons}>
                        <button
                          className={`${sharedStyles.btnAction} ${sharedStyles.btnView}`}
                          onClick={() => handleOpenModal(cte)}
                          title="Ver Detalhes"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
                        <button
                          className={`${sharedStyles.btnAction} ${sharedStyles.btnDownload}`}
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
                );
              })
            )}
          </tbody>
        </table>
      </TableContainer>

      {pagination.total > 0 && (
        <div className={sharedStyles.pagination}>
          <button
            onClick={() => {
              const newPage = pagination.page - 1;
              setPagination(p => ({...p, page: newPage}));
              loadCTes(null, newPage);
            }}
            disabled={pagination.page === 1}
            className={sharedStyles.btnPage}
          >
            Anterior
          </button>
          <div className={sharedStyles.paginationNumbers}>
            {Array.from({ length: Math.ceil(pagination.total / PAGE_SIZE) }, (_, i) => i + 1)
              .filter(page => {
                const currentPage = pagination.page;
                return page === 1 || page === Math.ceil(pagination.total / PAGE_SIZE) ||
                       (page >= currentPage - 2 && page <= currentPage + 2);
              })
              .map((page, index, arr) => (
                <span key={page}>
                  {index > 0 && arr[index - 1] !== page - 1 && <span className={sharedStyles.paginationEllipsis}>...</span>}
                  <button
                    onClick={() => {
                      setPagination(p => ({...p, page}));
                      loadCTes(null, page);
                    }}
                    className={`${sharedStyles.btnPageNum} ${pagination.page === page ? sharedStyles.active : ''}`}
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
            disabled={pagination.page >= Math.ceil(pagination.total / PAGE_SIZE)}
            className={sharedStyles.btnPage}
          >
            Proxima
          </button>
        </div>
      )}

      {/* Modal de Detalhes Rapidos */}
      <Modal
        isOpen={!!modalCte}
        onClose={handleCloseModal}
        title={modalCte ? `CT-e #${modalCte.numero_cte}` : ''}
        size="md"
        footer={
          <>
            <Button
              variant="success"
              onClick={() => handleDownloadXML(modalCte.id, modalCte.numero_cte)}
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
        {modalCte && (
          <div className={styles.modalInfoGrid}>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Número</span>
              <span className={styles.modalInfoValue}>{modalCte.numero_cte || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Data Emissão</span>
              <span className={styles.modalInfoValue}>{modalCte.data_emissao || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Remetente</span>
              <span className={styles.modalInfoValue}>{modalCte.remetente_nome || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Destinatario</span>
              <span className={styles.modalInfoValue}>{modalCte.destinatario_nome || '-'}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Valor</span>
              <span className={`${styles.modalInfoValue} ${styles.valorDestaque}`}>{formatCurrency(modalCte.valor_total)}</span>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Modalidade</span>
              <StatusPill status={getModalidadePill(modalCte.modalidade).status}>
                {getModalidadePill(modalCte.modalidade).text}
              </StatusPill>
            </div>
            <div className={styles.modalInfoItem}>
              <span className={styles.modalInfoLabel}>Status</span>
              <StatusPill status={getStatusPill(modalCte.status).status}>
                {getStatusPill(modalCte.status).text}
              </StatusPill>
            </div>
            <div className={`${styles.modalInfoItem} ${styles.fullWidth}`}>
              <span className={styles.modalInfoLabel}>Chave de Acesso</span>
              <span className={`${styles.modalInfoValue} ${styles.chaveCte}`}>{modalCte.chave || '-'}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CTeList;
