import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import './Dashboard.css';

const COLORS = ['#40916C', '#C8A951', '#2D6A4F', '#95D5B2', '#B8941F', '#74C69D'];

function buildQueryString(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return params.toString();
}

function Dashboard() {
  const defaultDates = useMemo(() => {
    const hoje = new Date();
    const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return {
      periodo: 'mes',
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: dataFim.toISOString().split('T')[0]
    };
  }, []);

  const [filtros, setFiltros] = useState(defaultDates);
  const queryString = useMemo(() => buildQueryString(filtros), [filtros]);

  const { data, error, isLoading, mutate } = useApi(`/dashboard/?${queryString}`);
  const { data: frotaData } = useApi(`/painel/frota/?${queryString}`);
  const { data: performanceData } = useApi(`/painel/performance/?${queryString}`);
  const { data: alertasData } = useApi(`/alertas/pagamentos/?${queryString}`, { revalidateOnFocus: false });
  const { data: manutencaoData } = useApi(`/manutencao/painel/?${queryString}`, { shouldRetryOnError: false });

  const handleFilterChange = useCallback((newFilters) => {
    setFiltros(newFilters);
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  const chartData = useMemo(() => {
    if (data?.grafico_cif_fob && data.grafico_cif_fob.length > 0) {
      return data.grafico_cif_fob.map(item => {
        let label = item.data;
        if (item.data && item.data.includes('/')) {
          const partes = item.data.split('/');
          if (partes.length === 3) {
            label = `${partes[0]}/${partes[1]}`;
          } else {
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const mesIndex = parseInt(partes[0], 10) - 1;
            label = meses[mesIndex] || partes[0];
          }
        }
        return {
          mes: label,
          faturamento: item.total || 0,
          cif: item.cif || 0,
          fob: item.fob || 0
        };
      });
    }
    return [];
  }, [data]);

  const pieData = useMemo(() => {
    const cif = data?.cards?.valor_cif || 0;
    const fob = data?.cards?.valor_fob || 0;
    const total = cif + fob;

    if (total === 0) {
      return [
        { name: 'CIF', value: 0 },
        { name: 'FOB', value: 0 },
      ];
    }

    return [
      { name: 'CIF', value: Math.round((cif / total) * 100) },
      { name: 'FOB', value: Math.round((fob / total) * 100) },
    ];
  }, [data]);

  const performanceChartData = useMemo(() => {
    return performanceData?.evolucao_diaria && performanceData.evolucao_diaria.length > 0
      ? performanceData.evolucao_diaria
      : [];
  }, [performanceData]);

  const totalAlertas = (frotaData?.cards?.docs_vencendo || 0) +
                       (frotaData?.cards?.cnh_vencendo || 0) +
                       (frotaData?.cards?.certificacoes_vencendo || 0) +
                       (alertasData?.agregados_pendentes?.length || 0);

  if (isLoading && !data) return <Loading message="Carregando dashboard..." />;
  if (error && !data) return <ErrorMessage message={error.message || 'Erro ao carregar dashboard'} onRetry={() => mutate()} />;

  const dashboardIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );

  return (
    <div className="dashboard">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do sistema de transporte"
        icon={dashboardIcon}
      />

      <DateFilter onFilterChange={handleFilterChange} defaultPeriodo="mes" />

      <div className="kpi-grid">
        <Link to="/ctes" className="kpi-card">
          <div className="kpi-icon blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">CT-es Emitidos</span>
            <span className="kpi-value">{data?.cards?.total_ctes || 0}</span>
            <span className={`kpi-change ${(data?.grafico_metas?.[0]?.crescimento || 0) >= 0 ? 'positive' : 'negative'}`}>
              {data?.grafico_metas?.[0]?.crescimento > 0 ? '+' : ''}{data?.grafico_metas?.[0]?.crescimento?.toFixed(1) || 0}% vs anterior
            </span>
          </div>
        </Link>

        <Link to="/mdfes" className="kpi-card">
          <div className="kpi-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">MDF-es Ativos</span>
            <span className="kpi-value">{data?.cards?.total_mdfes || 0}</span>
            <span className="kpi-change neutral">
              {performanceData?.cards?.taxa_encerramento || 0}% encerrados
            </span>
          </div>
        </Link>

        <Link to="/veiculos" className="kpi-card">
          <div className="kpi-icon orange">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Veículos Ativos</span>
            <span className="kpi-value">{frotaData?.cards?.veiculos_ativos || 0}/{frotaData?.cards?.total_veiculos || 0}</span>
            <span className="kpi-change neutral">
              {frotaData?.cards?.total_motoristas || 0} motoristas
            </span>
          </div>
        </Link>

        <Link to="/financeiro" className="kpi-card highlight">
          <div className="kpi-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Faturamento Total</span>
            <span className="kpi-value">{formatCurrency(data?.cards?.valor_total_fretes || 0)}</span>
            <span className="kpi-change positive">
              Ticket Médio: {formatCurrency(performanceData?.cards?.ticket_medio || 0)}
            </span>
          </div>
        </Link>

        <Link to="/financeiro" className="kpi-card">
          <div className="kpi-icon cif">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Valor CIF</span>
            <span className="kpi-value">{formatCurrency(data?.cards?.valor_cif || 0)}</span>
            <span className="kpi-change neutral">
              {data?.cards?.total_ctes_cif || 0} CT-es CIF
            </span>
          </div>
        </Link>

        <Link to="/financeiro" className="kpi-card">
          <div className="kpi-icon fob">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Valor FOB</span>
            <span className="kpi-value">{formatCurrency(data?.cards?.valor_fob || 0)}</span>
            <span className="kpi-change neutral">
              {data?.cards?.total_ctes_fob || 0} CT-es FOB
            </span>
          </div>
        </Link>
      </div>

      <div className="kpi-grid kpi-grid-secondary">
        <div className="kpi-card kpi-card-small">
          <div className="kpi-icon-small blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div className="kpi-content-small">
            <span className="kpi-label-small">KM Total</span>
            <span className="kpi-value-small">{formatNumber(performanceData?.cards?.km_total || 0)} km</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-small">
          <div className="kpi-icon-small green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="kpi-content-small">
            <span className="kpi-label-small">Custo/KM</span>
            <span className="kpi-value-small">{formatCurrency(performanceData?.cards?.custo_por_km || 0)}</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-small">
          <div className="kpi-icon-small purple">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="kpi-content-small">
            <span className="kpi-label-small">Taxa Aprovação</span>
            <span className="kpi-value-small">{performanceData?.cards?.taxa_aprovacao || 0}%</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-small">
          <div className="kpi-icon-small orange">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className="kpi-content-small">
            <span className="kpi-label-small">CT-es/MDF-e</span>
            <span className="kpi-value-small">{performanceData?.cards?.media_ctes_por_mdfe || 0}</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-small">
          <div className={`kpi-icon-small ${totalAlertas > 0 ? 'red' : 'green'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="kpi-content-small">
            <span className="kpi-label-small">Alertas</span>
            <span className="kpi-value-small">{totalAlertas}</span>
          </div>
        </div>

        <Link to="/manutencoes" className="kpi-card kpi-card-small">
          <div className="kpi-icon-small orange">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <div className="kpi-content-small">
            <span className="kpi-label-small">Manutenções</span>
            <span className="kpi-value-small">{manutencaoData?.total_manutencoes || 0}</span>
          </div>
        </Link>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Faturamento CIF vs FOB</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" stroke="#7f8c8d" />
                <YAxis yAxisId="left" stroke="#7f8c8d" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" stroke="#27ae60" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="cif" name="CIF" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="fob" name="FOB" fill="#f39c12" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="faturamento" name="Total" stroke="#27ae60" strokeWidth={2} dot={{ fill: '#27ae60' }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">Sem dados para o período</div>
          )}
        </div>

        <div className="chart-card">
          <h3>Evolução Diária</h3>
          {performanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceChartData}>
                <defs>
                  <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8A951" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#C8A951" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="data" stroke="#7f8c8d" />
                <YAxis stroke="#7f8c8d" tickFormatter={(value) => `R$ ${(value/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value, name) => [name === 'valor' ? formatCurrency(value) : value, name === 'valor' ? 'Valor' : name === 'ctes' ? 'CT-es' : 'KM']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="valor"
                  name="Valor"
                  stroke="#C8A951"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValor)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">Sem dados para o período</div>
          )}
        </div>

        <div className="chart-card chart-card-small">
          <h3>Distribuição CIF/FOB</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-card-small alerts-summary-card">
          <h3>Alertas e Vencimentos</h3>
          <div className="alerts-summary">
            <div className="alert-summary-item">
              <span className="alert-summary-icon warning">!</span>
              <div className="alert-summary-content">
                <span className="alert-summary-value">{frotaData?.cards?.docs_vencendo || 0}</span>
                <span className="alert-summary-label">Docs Veículos Vencendo</span>
              </div>
            </div>
            <div className="alert-summary-item">
              <span className="alert-summary-icon danger">!</span>
              <div className="alert-summary-content">
                <span className="alert-summary-value">{frotaData?.cards?.cnh_vencendo || 0}</span>
                <span className="alert-summary-label">CNH Vencendo</span>
              </div>
            </div>
            <div className="alert-summary-item">
              <span className="alert-summary-icon info">!</span>
              <div className="alert-summary-content">
                <span className="alert-summary-value">{frotaData?.cards?.certificacoes_vencendo || 0}</span>
                <span className="alert-summary-label">Certificações Vencendo</span>
              </div>
            </div>
            <div className="alert-summary-item">
              <span className="alert-summary-icon warning">$</span>
              <div className="alert-summary-content">
                <span className="alert-summary-value">{alertasData?.agregados_pendentes?.length || 0}</span>
                <span className="alert-summary-label">Pagamentos Pendentes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="quick-actions-section">
        <div className="quick-actions-card">
          <h3>Ações Rápidas</h3>
          <div className="quick-actions-grid">
            <Link to="/upload" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload XML
            </Link>
            <Link to="/clientes" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              Clientes
            </Link>
            <Link to="/motoristas" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Motoristas
            </Link>
            <Link to="/veiculos" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              Veículos
            </Link>
            <Link to="/financeiro" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              Financeiro
            </Link>
            <Link to="/geografico" className="quick-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="10" r="3"></circle>
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"></path>
              </svg>
              Geográfico
            </Link>
          </div>
        </div>
      </div>

      <div className="recent-docs-section">
        <div className="recent-docs-card">
          <h3>Últimos CT-es</h3>
          <div className="recent-docs-list">
            {(data?.ultimos_lancamentos?.ctes || []).length > 0 ? (
              data.ultimos_lancamentos.ctes.map((cte, index) => (
                <div key={index} className="recent-doc-item">
                  <div className="doc-info">
                    <span className="doc-number">CT-e {cte.numero}</span>
                    <span className="doc-cliente">{cte.destinatario || cte.remetente || 'Sem cliente'}</span>
                  </div>
                  <div className="doc-meta">
                    <span className="doc-valor">{formatCurrency(cte.valor)}</span>
                    <span className="doc-status status-autorizado">{cte.modalidade}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-list">Nenhum CT-e no período selecionado</div>
            )}
          </div>
          <Link to="/ctes" className="view-all-link">Ver todos os CT-es</Link>
        </div>

        <div className="recent-docs-card">
          <h3>Últimos MDF-es</h3>
          <div className="recent-docs-list">
            {(data?.ultimos_lancamentos?.mdfes || []).length > 0 ? (
              data.ultimos_lancamentos.mdfes.map((mdfe, index) => (
                <div key={index} className="recent-doc-item">
                  <div className="doc-info">
                    <span className="doc-number">MDF-e {mdfe.numero}</span>
                    <span className="doc-cliente">{mdfe.uf_ini} - {mdfe.uf_fim}</span>
                  </div>
                  <div className="doc-meta">
                    <span className="doc-placa">{mdfe.placa || '-'}</span>
                    <span className="doc-data">{mdfe.data_emissao}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-list">Nenhum MDF-e no período selecionado</div>
            )}
          </div>
          <Link to="/mdfes" className="view-all-link">Ver todos os MDF-es</Link>
        </div>

        <div className="recent-docs-card">
          <h3>Top Veículos</h3>
          <div className="recent-docs-list">
            {(frotaData?.top_veiculos || []).length > 0 ? (
              frotaData.top_veiculos.map((veiculo, index) => (
                <div key={index} className="recent-doc-item">
                  <div className="doc-info">
                    <span className="doc-number">{index + 1}. {veiculo.placa}</span>
                    <span className="doc-cliente">{veiculo.viagens} viagens</span>
                  </div>
                  <div className="doc-meta">
                    <span className="doc-valor">{veiculo.ctes} CT-es</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-list">Nenhum veículo no período</div>
            )}
          </div>
          <Link to="/veiculos" className="view-all-link">Ver todos os veículos</Link>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
