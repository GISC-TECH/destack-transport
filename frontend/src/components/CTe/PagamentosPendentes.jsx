import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { cteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import { SkeletonTable, SkeletonMobileCards } from '../Common/Skeleton';
import EmptyState from '../Common/EmptyState';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import { useIsMobile } from '../../hooks/useMediaQuery';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import sharedStyles from './CTeShared.module.css';
import styles from './PagamentosPendentes.module.css';

const COLORS = ['#0d9488', '#f39c12', '#27ae60', '#e74c3c', '#C8A951'];

function PagamentosPendentes() {
  const toast = useToast();
  const isMobile = useIsMobile();

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

  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);
  const [filtros, setFiltros] = useState(defaultDates);
  const [atualizandoPagamento, setAtualizandoPagamento] = useState(null);
  // Modal para selecionar data de pagamento
  const [modalBaixa, setModalBaixa] = useState({ show: false, cteId: null, cteNumero: null });
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().split('T')[0]);
  const [comprovanteFile, setComprovanteFile] = useState(null);
  // Paginacao da tabela
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;

  // Filtros avançados (multi-select)
  const [filtrosAvancados, setFiltrosAvancados] = useState({
    remetentes: [],
    destinatarios: [],
    modalidades: []
  });
  const [filtrosDisponiveis, setFiltrosDisponiveis] = useState({
    remetentes: [],
    destinatarios: [],
    modalidades: []
  });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const loadDados = useCallback(async (customFiltros = null, customFiltrosAvancados = null) => {
    const filtrosAtivos = customFiltros || filtros;
    const avancados = customFiltrosAvancados || filtrosAvancados;
    try {
      setLoading(true);

      // Monta os parâmetros incluindo filtros avançados
      const params = { ...filtrosAtivos };
      if (avancados.remetentes.length > 0) {
        params.remetentes = avancados.remetentes.join(',');
      }
      if (avancados.destinatarios.length > 0) {
        params.destinatarios = avancados.destinatarios.join(',');
      }
      if (avancados.modalidades.length > 0) {
        params.modalidades = avancados.modalidades.join(',');
      }

      const result = await cteAPI.pagamentosPendentes(params);
      setDados(result);

      // Atualiza filtros disponíveis (só na primeira carga ou quando muda período)
      if (result.filtros_disponiveis) {
        setFiltrosDisponiveis(result.filtros_disponiveis);
      }
    } catch (err) {
      console.error('Erro ao carregar pagamentos pendentes:', err);
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, [filtros, filtrosAvancados]);

  // Carrega dados na montagem inicial
  useEffect(() => {
    loadDados(defaultDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateFilterChange = (newFiltros) => {
    setFiltros(newFiltros);
    setPaginaAtual(1); // Reset pagina ao mudar filtros
    // Reseta filtros avançados ao mudar período
    setFiltrosAvancados({ remetentes: [], destinatarios: [], modalidades: [] });
    loadDados(newFiltros, { remetentes: [], destinatarios: [], modalidades: [] });
  };

  // Toggle de seleção de filtro (multi-select)
  const toggleFiltro = (tipo, valor) => {
    setFiltrosAvancados(prev => {
      const atual = prev[tipo] || [];
      const novo = atual.includes(valor)
        ? atual.filter(v => v !== valor)
        : [...atual, valor];
      return { ...prev, [tipo]: novo };
    });
  };

  // Aplica os filtros avançados
  const aplicarFiltros = () => {
    setPaginaAtual(1);
    loadDados(filtros, filtrosAvancados);
  };

  // Limpa todos os filtros avançados
  const limparFiltros = () => {
    const limpo = { remetentes: [], destinatarios: [], modalidades: [] };
    setFiltrosAvancados(limpo);
    setPaginaAtual(1);
    loadDados(filtros, limpo);
  };

  // Conta quantos filtros estão ativos
  const totalFiltrosAtivos = filtrosAvancados.remetentes.length +
    filtrosAvancados.destinatarios.length +
    filtrosAvancados.modalidades.length;

  // Paginacao - calculos
  const ctesPendentes = dados?.ctes_pendentes_recentes || [];
  const totalItens = ctesPendentes.length;
  const totalPaginas = Math.ceil(totalItens / itensPorPagina);
  const indiceInicial = (paginaAtual - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const ctesPaginados = ctesPendentes.slice(indiceInicial, indiceFinal);

  const handlePaginaAnterior = () => {
    if (paginaAtual > 1) setPaginaAtual(paginaAtual - 1);
  };

  const handleProximaPagina = () => {
    if (paginaAtual < totalPaginas) setPaginaAtual(paginaAtual + 1);
  };

  // Abre o modal para selecionar data de baixa
  const handleAbrirModalBaixa = (cteId, cteNumero) => {
    setDataBaixa(new Date().toISOString().split('T')[0]); // Reset para data atual
    setComprovanteFile(null); // Reset comprovante
    setModalBaixa({ show: true, cteId, cteNumero });
  };

  const closeModalBaixa = () => {
    setModalBaixa({ show: false, cteId: null, cteNumero: null });
  };

  // Confirma a baixa com a data selecionada
  const handleConfirmarBaixa = async () => {
    const { cteId } = modalBaixa;
    setAtualizandoPagamento(cteId);
    closeModalBaixa();
    try {
      await cteAPI.marcarPagamento(cteId, true, null, dataBaixa, comprovanteFile);
      toast.success('CT-e marcado como pago!');
      setComprovanteFile(null);
      // Recarrega os dados
      loadDados();
    } catch (err) {
      console.error('Erro ao marcar como pago:', err);
      toast.error('Erro ao marcar como pago. Tente novamente.');
    } finally {
      setAtualizandoPagamento(null);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatCurrencyShort = (value) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  // Dados para grafico de pizza
  const pieData = (dados?.por_modalidade || []).map((item, index) => ({
    name: item.modalidade,
    value: item.valor,
    quantidade: item.quantidade,
    fill: COLORS[index % COLORS.length]
  }));

  // Dados para grafico de barras (top clientes)
  const barData = (dados?.top_clientes_pendentes || []).slice(0, 5).map(item => ({
    nome: item.razao_social?.substring(0, 15) || 'N/I',
    valor: item.valor_total,
    quantidade: item.quantidade
  }));

  const pendentesIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  );

  const resumo = dados?.resumo || {};
  const percentualPago = resumo.total_pagos + resumo.total_pendentes > 0
    ? ((resumo.total_pagos / (resumo.total_pagos + resumo.total_pendentes)) * 100).toFixed(1)
    : 0;

  const getModalidadePill = (modalidade) => ({
    status: modalidade === 'CIF' ? 'info' : 'warning',
    text: modalidade || '-'
  });

  return (
    <div className={sharedStyles.cteList}>
      <PageHeader
        title="Pagamentos Pendentes"
        subtitle={`${resumo.total_pendentes || 0} CT-es aguardando pagamento`}
        icon={pendentesIcon}
        breadcrumbs={[{ label: 'Documentos' }, { label: 'CT-e' }, { label: 'Pendentes' }]}
        actions={
          <div className={sharedStyles.headerButtons}>
            <DateFilter
              onFilterChange={handleDateFilterChange}
              defaultPeriodo="mes"
              initialDataInicio={filtros.data_inicio}
              initialDataFim={filtros.data_fim}
            />
            <Link to="/ctes" className={sharedStyles.btnOutline}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Voltar para CT-es
            </Link>
          </div>
        }
      />

      {loading ? (
        <>
          <div className={styles.skeletonDesktop}>
            <SkeletonTable rows={6} columns={7} />
          </div>
          <div className={styles.skeletonMobile}>
            <SkeletonMobileCards count={4} />
          </div>
        </>
      ) : (
      <>
      {/* Filtros Avançados */}
      <div className={styles.filtrosAvancadosContainer}>
        <Button
          variant={mostrarFiltros ? 'primary' : 'outline'}
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          Filtros {totalFiltrosAtivos > 0 && <StatusPill status="info" className={styles.filtroCount}>{totalFiltrosAtivos}</StatusPill>}
        </Button>

        {mostrarFiltros && (
          <div className={styles.filtrosAvancadosPanel}>
            <div className={styles.filtrosAvancadosGrid}>

              {/* Filtro Modalidade */}
              <div className={styles.filtroGrupo}>
                <label>Modalidade</label>
                <div className={styles.filterTagList}>
                  {(filtrosDisponiveis.modalidades || []).map(modalidade => (
                    <Button
                      key={modalidade}
                      variant={filtrosAvancados.modalidades.includes(modalidade) ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => toggleFiltro('modalidades', modalidade)}
                    >
                      {modalidade}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Filtro Remetente */}
              <div className={styles.filtroGrupo}>
                <label>
                  Remetente ({filtrosAvancados.remetentes.length} selecionado{filtrosAvancados.remetentes.length !== 1 ? 's' : ''})
                </label>
                <div className={styles.checkboxList}>
                  {(filtrosDisponiveis.remetentes || []).map(remetente => (
                    <label
                      key={remetente}
                      className={styles.checkboxLabel}
                    >
                      <input
                        type="checkbox"
                        checked={filtrosAvancados.remetentes.includes(remetente)}
                        onChange={() => toggleFiltro('remetentes', remetente)}
                      />
                      <span>{remetente}</span>
                    </label>
                  ))}
                  {(filtrosDisponiveis.remetentes || []).length === 0 && (
                    <span className={styles.emptyFilterMessage}>Nenhum remetente disponível</span>
                  )}
                </div>
              </div>

              {/* Filtro Destinatário */}
              <div className={styles.filtroGrupo}>
                <label>
                  Destinatário ({filtrosAvancados.destinatarios.length} selecionado{filtrosAvancados.destinatarios.length !== 1 ? 's' : ''})
                </label>
                <div className={styles.checkboxList}>
                  {(filtrosDisponiveis.destinatarios || []).map(destinatario => (
                    <label
                      key={destinatario}
                      className={styles.checkboxLabel}
                    >
                      <input
                        type="checkbox"
                        checked={filtrosAvancados.destinatarios.includes(destinatario)}
                        onChange={() => toggleFiltro('destinatarios', destinatario)}
                      />
                      <span>{destinatario}</span>
                    </label>
                  ))}
                  {(filtrosDisponiveis.destinatarios || []).length === 0 && (
                    <span className={styles.emptyFilterMessage}>Nenhum destinatário disponível</span>
                  )}
                </div>
              </div>
            </div>

            {/* Botões de ação dos filtros */}
            <div className={styles.filtroActions}>
              <Button
                variant="outline"
                onClick={limparFiltros}
                disabled={totalFiltrosAtivos === 0}
              >
                Limpar Filtros
              </Button>
              <Button
                variant="primary"
                onClick={aplicarFiltros}
              >
                Aplicar Filtros
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className={sharedStyles.kpiGrid}>
        <div className={sharedStyles.kpiCard}>
          <div className={`${sharedStyles.kpiIcon} ${sharedStyles.orange}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className={sharedStyles.kpiContent}>
            <span className={sharedStyles.kpiLabel}>CT-es Pendentes</span>
            <span className={sharedStyles.kpiValue}>{resumo.total_pendentes || 0}</span>
          </div>
        </div>

        <div className={sharedStyles.kpiCard}>
          <div className={`${sharedStyles.kpiIcon} ${sharedStyles.red}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className={sharedStyles.kpiContent}>
            <span className={sharedStyles.kpiLabel}>Valor Pendente</span>
            <span className={sharedStyles.kpiValue}>{formatCurrency(resumo.valor_total_pendente)}</span>
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
            <span className={sharedStyles.kpiLabel}>CT-es Pagos</span>
            <span className={sharedStyles.kpiValue}>{resumo.total_pagos || 0}</span>
          </div>
        </div>

        <div className={sharedStyles.kpiCard}>
          <div className={`${sharedStyles.kpiIcon} ${sharedStyles.purple}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10"></path>
              <path d="M12 20V4"></path>
              <path d="M6 20v-6"></path>
            </svg>
          </div>
          <div className={sharedStyles.kpiContent}>
            <span className={sharedStyles.kpiLabel}>Taxa de Pagamento</span>
            <span className={sharedStyles.kpiValue}>{percentualPago}%</span>
          </div>
        </div>
      </div>

      {/* Graficos */}
      <div className={sharedStyles.chartsGrid}>
        {/* Top Clientes com Pendências */}
        <div className={sharedStyles.chartCard}>
          <h3>Top Clientes com Pendências</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: isMobile ? 20 : 30, bottom: 5, left: isMobile ? 60 : 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: isMobile ? 10 : 12 }} tickFormatter={formatCurrencyShort} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: isMobile ? 10 : 11 }} width={isMobile ? 60 : 100} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="valor" fill="#e74c3c" radius={[0, 4, 4, 0]} name="Valor Pendente" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="Nenhuma pendência no período"
              description="Não há clientes com pendências para o período selecionado."
            />
          )}
        </div>

        {/* Distribuicao por Modalidade */}
        <div className={`${sharedStyles.chartCard} ${sharedStyles.chartSmall}`}>
          <h3>Pendências por Modalidade</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 35 : 50}
                    outerRadius={isMobile ? 60 : 80}
                    paddingAngle={2}
                    dataKey="value"
                    label={isMobile ? false : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={!isMobile}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              {isMobile && (
                <div className={styles.chartLegendMobile}>
                  {pieData.map((entry, index) => (
                    <div key={index} className={styles.chartLegendItem}>
                      <span className={styles.chartLegendDot} style={{ background: entry.fill }} />
                      <span className={styles.chartLegendText}>{entry.name} ({(entry.value / pieData.reduce((a, b) => a + b.value, 0) * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="Sem dados para o período"
              description="Não há pendências por modalidade no período selecionado."
            />
          )}
        </div>
      </div>

      {/* Tabela de CT-es Pendentes Recentes */}
      <div className={sharedStyles.sectionHeader}>
        <h3>CT-es Pendentes Mais Recentes</h3>
        <div className={styles.dataTableHeaderActions}>
          <span className={sharedStyles.textMuted}>
            {totalItens > 0 ? `${indiceInicial + 1}-${Math.min(indiceFinal, totalItens)} de ${totalItens}` : '0 itens'}
          </span>
          <Link to="/ctes?pago=false" className={`${sharedStyles.btnOutline} ${sharedStyles.btnSm}`}>
            Ver Todos
          </Link>
        </div>
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
              <th>Modalidade</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ctesPaginados.length === 0 ? (
              <tr>
                <td colSpan="7" className={sharedStyles.textCenter}>
                  <EmptyState
                    title="Nenhum CT-e pendente no período"
                    description="Tente ajustar os filtros de data ou limpar os filtros avançados."
                  />
                </td>
              </tr>
            ) : (
              ctesPaginados.map((cte) => {
                const modalidadePill = getModalidadePill(cte.modalidade);
                return (
                  <tr key={cte.id}>
                    <td data-label="Número">
                      <strong>{cte.numero || '-'}</strong>
                      <br />
                      <small className={sharedStyles.textMuted}>{cte.chave?.slice(-10)}</small>
                    </td>
                    <td data-label="Data Emissão">{cte.data_emissao || '-'}</td>
                    <td data-label="Remetente">{cte.remetente || '-'}</td>
                    <td data-label="Destinatario">{cte.destinatario || '-'}</td>
                    <td data-label="Valor" className={sharedStyles.textRight}>
                      <strong>{formatCurrency(cte.valor)}</strong>
                    </td>
                    <td data-label="Modalidade">
                      <StatusPill status={modalidadePill.status}>{modalidadePill.text}</StatusPill>
                    </td>
                    <td>
                      <div className={sharedStyles.actionButtons}>
                        <button
                          className={`${sharedStyles.btnAction} ${sharedStyles.btnDownload}`}
                          onClick={() => handleAbrirModalBaixa(cte.id, cte.numero)}
                          disabled={atualizandoPagamento === cte.id}
                          title="Baixar Pagamento"
                        >
                          {atualizandoPagamento === cte.id ? (
                            <span className={sharedStyles.loadingSpinnerSmall}></span>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                          )}
                        </button>
                        <Link
                          to={`/ctes/${cte.id}`}
                          className={`${sharedStyles.btnAction} ${sharedStyles.btnView}`}
                          title="Ver Detalhes"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableContainer>

      {/* Paginacao */}
      {totalPaginas > 1 && (
        <div className={sharedStyles.pagination}>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaginaAnterior}
            disabled={paginaAtual === 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Anterior
          </Button>
          <span className={sharedStyles.textMuted}>
            Pagina <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleProximaPagina}
            disabled={paginaAtual === totalPaginas}
          >
            Proxima
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </Button>
        </div>
      )}

      {/* Resumo por Modalidade */}
      <div className={sharedStyles.sectionHeader} style={{ marginTop: '30px' }}>
        <h3>Resumo por Modalidade</h3>
      </div>

      <div className={sharedStyles.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {(dados?.por_modalidade || []).map((item, index) => (
          <div key={index} className={sharedStyles.kpiCard}>
            <div className={sharedStyles.kpiIcon} style={{ background: COLORS[index % COLORS.length] }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              </svg>
            </div>
            <div className={sharedStyles.kpiContent}>
              <span className={sharedStyles.kpiLabel}>{item.modalidade || 'N/I'}</span>
              <span className={sharedStyles.kpiValue}>{item.quantidade} CT-es</span>
              <small className={sharedStyles.textMuted}>{formatCurrency(item.valor)}</small>
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {/* Modal de Baixa de Pagamento */}
      <Modal
        isOpen={modalBaixa.show}
        onClose={closeModalBaixa}
        title="Baixar Pagamento"
        size="sm"
        footer={
          <>
            <button className={styles.btnCancel} onClick={closeModalBaixa}>
              Cancelar
            </button>
            <Button variant="primary" onClick={handleConfirmarBaixa}>
              Confirmar Baixa
            </Button>
          </>
        }
      >
        <p style={{ marginBottom: '20px' }}>
          Confirmar baixa do CT-e <strong>#{modalBaixa.cteNumero}</strong>?
        </p>
        <div className={styles.formGroup}>
          <label>Data do Pagamento</label>
          <input
            type="date"
            value={dataBaixa}
            onChange={(e) => setDataBaixa(e.target.value)}
            className={styles.inputDate}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Comprovante (opcional)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setComprovanteFile(e.target.files[0] || null)}
            className={styles.inputFile}
          />
          {comprovanteFile && (
            <small className={styles.fileName}>
              Arquivo: {comprovanteFile.name}
            </small>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default PagamentosPendentes;
