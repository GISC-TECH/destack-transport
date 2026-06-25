import { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { financeiroAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import './Financeiro.css';

const COLORS = {
  receitas: '#27ae60',
  despesas: '#e74c3c',
  saldo: '#3498db',
  acumulado: '#9b59b6'
};

function FluxoCaixa() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agrupamento, setAgrupamento] = useState('dia');

  const getDateRange = (periodo) => {
    const hoje = new Date();
    let dataInicio, dataFim;

    switch (periodo) {
      case 'hoje':
        dataInicio = new Date(hoje);
        dataFim = new Date(hoje);
        break;
      case '7dias':
        dataFim = new Date(hoje);
        dataInicio = new Date(hoje);
        dataInicio.setDate(dataInicio.getDate() - 7);
        break;
      case 'mes':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case 'ano':
        dataInicio = new Date(hoje.getFullYear(), 0, 1);
        dataFim = new Date(hoje.getFullYear(), 11, 31);
        break;
      default:
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    }

    return {
      periodo: periodo,
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: dataFim.toISOString().split('T')[0]
    };
  };

  const [filtros, setFiltros] = useState(() => getDateRange('mes'));

  const loadDados = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtros;
    try {
      setLoading(true);
      setError(null);
      const result = await financeiroAPI.fluxoCaixa({
        ...filtrosAtivos,
        agrupamento
      });
      setDados(result);
    } catch (err) {
      console.error('Erro ao carregar fluxo de caixa:', err);
      setError(err.message);
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDados(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agrupamento]);

  const handleDateFilterChange = (newFiltros) => {
    setFiltros(newFiltros);
    loadDados(newFiltros);
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) return <Loading message="Carregando fluxo de caixa..." />;
  if (error && !dados) return <ErrorMessage message={error} onRetry={loadDados} />;

  const fluxoIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  );

  return (
    <div className="financeiro-page">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Projeção de receitas e despesas"
        icon={fluxoIcon}
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Fluxo de Caixa' }]}
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={agrupamento}
              onChange={(e) => setAgrupamento(e.target.value)}
              className="date-input"
              style={{ minWidth: '120px' }}
            >
              <option value="dia">Por Dia</option>
              <option value="semana">Por Semana</option>
              <option value="mes">Por Mês</option>
            </select>
            <DateFilter
              onFilterChange={handleDateFilterChange}
              defaultPeriodo="mes"
              initialDataInicio={filtros.data_inicio}
              initialDataFim={filtros.data_fim}
            />
          </div>
        }
      />

      {/* KPIs */}
      <div className="fin-kpi-grid">
        <div className="fin-kpi-card principal">
          <div className="fin-kpi-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <span className="fin-kpi-label">Saldo Projetado</span>
            <span className="fin-kpi-value">{formatCurrency(dados?.totais?.saldo_projetado)}</span>
            <span className="fin-kpi-subtext">
              Período: {dados?.filtros?.data_inicio} a {dados?.filtros?.data_fim}
            </span>
          </div>
        </div>

        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(39, 174, 96, 0.12)', color: '#27ae60' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <span className="fin-kpi-label">Receitas Projetadas</span>
            <span className="fin-kpi-value">{formatCurrency(dados?.totais?.receitas)}</span>
          </div>
        </div>

        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(231, 76, 60, 0.12)', color: '#e74c3c' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
              <polyline points="17 18 23 18 23 12"></polyline>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <span className="fin-kpi-label">Despesas Projetadas</span>
            <span className="fin-kpi-value">{formatCurrency(dados?.totais?.despesas)}</span>
          </div>
        </div>

        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(155, 89, 182, 0.12)', color: '#9b59b6' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="20" x2="12" y2="10"></line>
              <line x1="18" y1="20" x2="18" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="16"></line>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <span className="fin-kpi-label">Períodos</span>
            <span className="fin-kpi-value">{dados?.serie?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="fin-charts-grid">
        {/* Gráfico de receitas vs despesas */}
        <div className="fin-chart-card">
          <h3>Receitas vs Despesas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dados?.serie || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="receitas" name="Receitas" fill={COLORS.receitas} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="despesas" name="Despesas" fill={COLORS.despesas} radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" type="monotone" dataKey="saldo_periodo" name="Saldo do Período" stroke={COLORS.saldo} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Saldo acumulado */}
        <div className="fin-chart-card">
          <h3>Saldo Acumulado Projetado</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dados?.serie || []}>
              <defs>
                <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.acumulado} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.acumulado} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="saldo_acumulado"
                name="Saldo Acumulado"
                stroke={COLORS.acumulado}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAcumulado)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela resumo */}
      <div className="fin-chart-card" style={{ marginTop: '30px' }}>
        <h3>Resumo por Período</h3>
        <div className="clientes-list">
          {(dados?.serie || []).map((item, index) => (
            <div key={index} className="cliente-item">
              <div className="cliente-rank" style={{ fontSize: '10px', width: 'auto', padding: '0 8px' }}>
                {item.periodo}
              </div>
              <div className="cliente-info">
                <span className="cliente-nome">Receitas: {formatCurrency(item.receitas)} | Despesas: {formatCurrency(item.despesas)}</span>
                <div className="cliente-bar-container">
                  <div
                    className="cliente-bar"
                    style={{
                      width: `${Math.min((Math.abs(item.saldo_periodo) / (Math.max(...(dados?.serie?.map(s => Math.abs(s.saldo_periodo)) || [1]))) * 100), 100)}%`,
                      background: item.saldo_periodo >= 0 ? '#27ae60' : '#e74c3c'
                    }}
                  ></div>
                </div>
              </div>
              <span className="cliente-valor" style={{ color: item.saldo_periodo >= 0 ? '#27ae60' : '#e74c3c' }}>
                {formatCurrency(item.saldo_periodo)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FluxoCaixa;
