import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { cteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import './CTe.css';

const COLORS = ['#3498db', '#f39c12', '#27ae60', '#e74c3c', '#9b59b6'];

function PagamentosPendentes() {
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
  const itensPorPagina = 10;

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

  // Confirma a baixa com a data selecionada
  const handleConfirmarBaixa = async () => {
    const { cteId } = modalBaixa;
    setAtualizandoPagamento(cteId);
    setModalBaixa({ show: false, cteId: null, cteNumero: null });
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

  return (
    <div className="cte-list">
      <PageHeader
        title="Pagamentos Pendentes"
        subtitle={`${resumo.total_pendentes || 0} CT-es aguardando pagamento`}
        icon={pendentesIcon}
        breadcrumbs={[{ label: 'Documentos' }, { label: 'CT-e' }, { label: 'Pendentes' }]}
        actions={
          <div className="header-buttons">
            <DateFilter
              onFilterChange={handleDateFilterChange}
              defaultPeriodo="mes"
              initialDataInicio={filtros.data_inicio}
              initialDataFim={filtros.data_fim}
            />
            <Link to="/ctes" className="btn btn-outline">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Voltar para CT-es
            </Link>
          </div>
        }
      />

      {loading ? (
        <Loading message="Carregando pagamentos pendentes..." />
      ) : (
      <>
      {/* Filtros Avançados */}
      <div className="filtros-avancados-container" style={{ marginBottom: '20px' }}>
        <button
          className={`btn ${mostrarFiltros ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          Filtros {totalFiltrosAtivos > 0 && <span className="badge badge-info" style={{ marginLeft: '5px' }}>{totalFiltrosAtivos}</span>}
        </button>

        {mostrarFiltros && (
          <div className="filtros-avancados-panel" style={{
            marginTop: '15px',
            padding: '20px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>

              {/* Filtro Modalidade */}
              <div className="filtro-grupo">
                <label style={{ fontWeight: '600', marginBottom: '10px', display: 'block', color: '#333' }}>
                  Modalidade
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(filtrosDisponiveis.modalidades || []).map(modalidade => (
                    <button
                      key={modalidade}
                      className={`btn btn-sm ${filtrosAvancados.modalidades.includes(modalidade) ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleFiltro('modalidades', modalidade)}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      {modalidade}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro Remetente */}
              <div className="filtro-grupo">
                <label style={{ fontWeight: '600', marginBottom: '10px', display: 'block', color: '#333' }}>
                  Remetente ({filtrosAvancados.remetentes.length} selecionado{filtrosAvancados.remetentes.length !== 1 ? 's' : ''})
                </label>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '8px' }}>
                  {(filtrosDisponiveis.remetentes || []).map(remetente => (
                    <label
                      key={remetente}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'background 0.2s',
                        fontSize: '13px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={filtrosAvancados.remetentes.includes(remetente)}
                        onChange={() => toggleFiltro('remetentes', remetente)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {remetente}
                      </span>
                    </label>
                  ))}
                  {(filtrosDisponiveis.remetentes || []).length === 0 && (
                    <span style={{ color: '#999', fontSize: '13px' }}>Nenhum remetente disponível</span>
                  )}
                </div>
              </div>

              {/* Filtro Destinatário */}
              <div className="filtro-grupo">
                <label style={{ fontWeight: '600', marginBottom: '10px', display: 'block', color: '#333' }}>
                  Destinatário ({filtrosAvancados.destinatarios.length} selecionado{filtrosAvancados.destinatarios.length !== 1 ? 's' : ''})
                </label>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '8px' }}>
                  {(filtrosDisponiveis.destinatarios || []).map(destinatario => (
                    <label
                      key={destinatario}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'background 0.2s',
                        fontSize: '13px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={filtrosAvancados.destinatarios.includes(destinatario)}
                        onChange={() => toggleFiltro('destinatarios', destinatario)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {destinatario}
                      </span>
                    </label>
                  ))}
                  {(filtrosDisponiveis.destinatarios || []).length === 0 && (
                    <span style={{ color: '#999', fontSize: '13px' }}>Nenhum destinatário disponível</span>
                  )}
                </div>
              </div>
            </div>

            {/* Botões de ação dos filtros */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-outline"
                onClick={limparFiltros}
                disabled={totalFiltrosAtivos === 0}
              >
                Limpar Filtros
              </button>
              <button
                className="btn btn-primary"
                onClick={aplicarFiltros}
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="cte-kpi-grid">
        <div className="cte-kpi-card">
          <div className="cte-kpi-icon orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">CT-es Pendentes</span>
            <span className="cte-kpi-value">{resumo.total_pendentes || 0}</span>
          </div>
        </div>

        <div className="cte-kpi-card">
          <div className="cte-kpi-icon red">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">Valor Pendente</span>
            <span className="cte-kpi-value">{formatCurrency(resumo.valor_total_pendente)}</span>
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
            <span className="cte-kpi-label">CT-es Pagos</span>
            <span className="cte-kpi-value">{resumo.total_pagos || 0}</span>
          </div>
        </div>

        <div className="cte-kpi-card">
          <div className="cte-kpi-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10"></path>
              <path d="M12 20V4"></path>
              <path d="M6 20v-6"></path>
            </svg>
          </div>
          <div className="cte-kpi-content">
            <span className="cte-kpi-label">Taxa de Pagamento</span>
            <span className="cte-kpi-value">{percentualPago}%</span>
          </div>
        </div>
      </div>

      {/* Graficos */}
      <div className="cte-charts-grid">
        {/* Top Clientes com Pendencias */}
        <div className="cte-chart-card">
          <h3>Top Clientes com Pendencias</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={formatCurrencyShort} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="valor" fill="#e74c3c" radius={[0, 4, 4, 0]} name="Valor Pendente" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">Nenhuma pendencia no periodo</div>
          )}
        </div>

        {/* Distribuicao por Modalidade */}
        <div className="cte-chart-card cte-chart-small">
          <h3>Pendencias por Modalidade</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">Sem dados para o periodo</div>
          )}
        </div>
      </div>

      {/* Tabela de CT-es Pendentes Recentes */}
      <div className="section-header">
        <h3>CT-es Pendentes Mais Recentes</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span className="text-muted" style={{ fontSize: '13px' }}>
            {totalItens > 0 ? `${indiceInicial + 1}-${Math.min(indiceFinal, totalItens)} de ${totalItens}` : '0 itens'}
          </span>
          <Link to="/ctes?pago=false" className="btn btn-outline btn-sm">
            Ver Todos
          </Link>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Numero</th>
              <th>Data Emissao</th>
              <th>Remetente</th>
              <th>Destinatario</th>
              <th>Valor</th>
              <th>Modalidade</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {ctesPaginados.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center">Nenhum CT-e pendente no periodo</td>
              </tr>
            ) : (
              ctesPaginados.map((cte) => (
                <tr key={cte.id}>
                  <td>
                    <strong>{cte.numero || '-'}</strong>
                    <br />
                    <small className="text-muted">{cte.chave?.slice(-10)}</small>
                  </td>
                  <td>{cte.data_emissao || '-'}</td>
                  <td>{cte.remetente || '-'}</td>
                  <td>{cte.destinatario || '-'}</td>
                  <td className="text-right">
                    <strong>{formatCurrency(cte.valor)}</strong>
                  </td>
                  <td>
                    <span className={`badge badge-${cte.modalidade === 'CIF' ? 'info' : 'warning'}`}>
                      {cte.modalidade || '-'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-action btn-download"
                        onClick={() => handleAbrirModalBaixa(cte.id, cte.numero)}
                        disabled={atualizandoPagamento === cte.id}
                        title="Baixar Pagamento"
                      >
                        {atualizandoPagamento === cte.id ? (
                          <span className="loading-spinner-small"></span>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                        )}
                      </button>
                      <Link
                        to={`/ctes/${cte.id}`}
                        className="btn-action btn-view"
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacao */}
      {totalPaginas > 1 && (
        <div className="pagination" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={handlePaginaAnterior}
            disabled={paginaAtual === 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Anterior
          </button>
          <span style={{ padding: '0 15px', fontSize: '14px' }}>
            Pagina <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
          </span>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleProximaPagina}
            disabled={paginaAtual === totalPaginas}
          >
            Proxima
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      )}

      {/* Resumo por Modalidade */}
      <div className="section-header" style={{ marginTop: '30px' }}>
        <h3>Resumo por Modalidade</h3>
      </div>

      <div className="cte-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {(dados?.por_modalidade || []).map((item, index) => (
          <div key={index} className="cte-kpi-card">
            <div className="cte-kpi-icon" style={{ background: COLORS[index % COLORS.length] }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              </svg>
            </div>
            <div className="cte-kpi-content">
              <span className="cte-kpi-label">{item.modalidade || 'N/I'}</span>
              <span className="cte-kpi-value">{item.quantidade} CT-es</span>
              <small className="text-muted">{formatCurrency(item.valor)}</small>
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {/* Modal de Baixa de Pagamento */}
      {modalBaixa.show && (
        <div className="modal-overlay" onClick={() => setModalBaixa({ show: false, cteId: null, cteNumero: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Baixar Pagamento</h3>
              <button
                className="modal-close"
                onClick={() => setModalBaixa({ show: false, cteId: null, cteNumero: null })}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '20px' }}>
                Confirmar baixa do CT-e <strong>#{modalBaixa.cteNumero}</strong>?
              </p>
              <div className="form-group">
                <label>Data do Pagamento</label>
                <input
                  type="date"
                  value={dataBaixa}
                  onChange={(e) => setDataBaixa(e.target.value)}
                  className="input-filter"
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              <div className="form-group" style={{ marginTop: '15px' }}>
                <label>Comprovante (opcional)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setComprovanteFile(e.target.files[0] || null)}
                  className="input-filter"
                  style={{ width: '100%', padding: '8px' }}
                />
                {comprovanteFile && (
                  <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                    Arquivo: {comprovanteFile.name}
                  </small>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setModalBaixa({ show: false, cteId: null, cteNumero: null })}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmarBaixa}
              >
                Confirmar Baixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PagamentosPendentes;
