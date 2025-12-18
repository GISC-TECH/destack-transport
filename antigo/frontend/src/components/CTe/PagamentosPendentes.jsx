import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { cteAPI } from '../../services/api';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import './CTe.css';

const COLORS = ['#3498db', '#f39c12', '#27ae60', '#e74c3c', '#9b59b6'];

// Funcao para obter datas do mes atual
const getDefaultDates = () => {
  const hoje = new Date();
  const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return {
    data_inicio: dataInicio.toISOString().split('T')[0],
    data_fim: dataFim.toISOString().split('T')[0]
  };
};

function PagamentosPendentes() {
  const defaultDates = getDefaultDates();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);
  const [filtros, setFiltros] = useState(defaultDates);
  const [atualizandoPagamento, setAtualizandoPagamento] = useState(null);

  const loadDados = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtros;
    try {
      setLoading(true);
      const result = await cteAPI.pagamentosPendentes(filtrosAtivos);
      setDados(result);
    } catch (err) {
      console.error('Erro ao carregar pagamentos pendentes:', err);
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDados(defaultDates);
  }, []);

  const handleDateFilterChange = useCallback((newFiltros) => {
    setFiltros(newFiltros);
    loadDados(newFiltros);
  }, []);

  const handleMarcarPago = async (cteId) => {
    setAtualizandoPagamento(cteId);
    try {
      await cteAPI.marcarPagamento(cteId, true);
      // Recarrega os dados
      loadDados();
    } catch (err) {
      console.error('Erro ao marcar como pago:', err);
      alert('Erro ao marcar como pago. Tente novamente.');
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

  if (loading) return <Loading message="Carregando pagamentos pendentes..." />;

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
            <DateFilter onFilterChange={handleDateFilterChange} defaultPeriodo="mes" />
            <Link to="/ctes" className="btn btn-outline">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Voltar para CT-es
            </Link>
          </div>
        }
      />

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
        <Link to="/ctes?pago=false" className="btn btn-outline btn-sm">
          Ver Todos
        </Link>
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
            {(dados?.ctes_pendentes_recentes || []).length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center">Nenhum CT-e pendente no periodo</td>
              </tr>
            ) : (
              (dados?.ctes_pendentes_recentes || []).map((cte) => (
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
                        onClick={() => handleMarcarPago(cte.id)}
                        disabled={atualizandoPagamento === cte.id}
                        title="Marcar como Pago"
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
    </div>
  );
}

export default PagamentosPendentes;
