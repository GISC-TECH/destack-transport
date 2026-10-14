import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { financeiroAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import tokens from '../../styles/tokens.module.css';
import styles from './Financeiro.module.css';

// Cores para graficos — tokens de marca
const COLORS = {
  cif: tokens.primaryColor,
  fob: tokens.goldColor,
  faturamento: tokens.primaryDark,
  custos: tokens.dangerColor,
  lucro: tokens.goldColor
};

const PIE_COLORS = [tokens.primaryColor, tokens.goldColor, tokens.primaryDark, '#95D5B2', tokens.goldColor];

function FinanceiroPainel() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Funcao para calcular datas baseadas no periodo
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

  // Inicializa com o periodo 'mes' (mesmo do DateFilter)
  const [filtros, setFiltros] = useState(() => getDateRange('mes'));

  const handleDateFilterChange = (newFiltros) => {
    setFiltros(newFiltros);
    loadDados(newFiltros);
  };

  // Carrega dados na montagem inicial
  useEffect(() => {
    loadDados(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDados = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtros;
    try {
      setLoading(true);
      setError(null);
      const result = await financeiroAPI.painel(filtrosAtivos);
      setDados(result);
    } catch (err) {
      console.error('Erro ao carregar financeiro:', err);
      setError(err.message);
      setDados(null);
    } finally {
      setLoading(false);
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

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <p className={styles.tooltipLabel}>{label}</p>
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

  if (loading) return <Loading message="Carregando painel financeiro..." />;
  if (error && !dados) return <ErrorMessage message={error} onRetry={loadDados} />;

  const financeiroIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );

  return (
    <div className={styles.financeiroPage}>
      <PageHeader
        title="Painel Financeiro"
        subtitle="Visão geral do faturamento e indicadores"
        icon={financeiroIcon}
        breadcrumbs={[{ label: 'Financeiro' }]}
      />

      <DateFilter
        onFilterChange={handleDateFilterChange}
        defaultPeriodo="mes"
        initialDataInicio={filtros.data_inicio}
        initialDataFim={filtros.data_fim}
      />

      {/* KPIs */}
      <div className={styles.finKpiGrid}>
        <div className={`${styles.finKpiCard} ${styles.principal}`}>
          <div className={styles.finKpiIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <span className={styles.finKpiLabel}>Faturamento Total</span>
            <span className={styles.finKpiValue}>
              {formatCurrency(dados?.cards?.faturamento_total)}
            </span>
            <span className={styles.finKpiSubtext}>
              Período: {dados?.filtros?.data_inicio} a {dados?.filtros?.data_fim}
            </span>
          </div>
        </div>

        <div className={styles.finKpiCard}>
          <div className={`${styles.finKpiIcon} ${styles.cif}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <span className={styles.finKpiLabel}>Valor CIF</span>
            <span className={styles.finKpiValue}>
              {formatCurrency(dados?.cards?.valor_cif)}
            </span>
            <span className={`${styles.finKpiPercent} ${styles.cif}`}>
              {formatPercent(dados?.cards?.percentual_cif)} do total
            </span>
          </div>
        </div>

        <div className={styles.finKpiCard}>
          <div className={`${styles.finKpiIcon} ${styles.fob}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <span className={styles.finKpiLabel}>Valor FOB</span>
            <span className={styles.finKpiValue}>
              {formatCurrency(dados?.cards?.valor_fob)}
            </span>
            <span className={`${styles.finKpiPercent} ${styles.fob}`}>
              {formatPercent(dados?.cards?.percentual_fob)} do total
            </span>
          </div>
        </div>

        <div className={styles.finKpiCard}>
          <div className={`${styles.finKpiIcon} ${styles.ticket}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <span className={styles.finKpiLabel}>Ticket Médio</span>
            <span className={styles.finKpiValue}>
              {formatCurrency(dados?.cards?.ticket_medio)}
            </span>
            <span className={styles.finKpiSubtext}>
              {dados?.cards?.total_ctes || 0} CT-es emitidos
            </span>
          </div>
        </div>
      </div>

      {/* Graficos Principais */}
      <div className={styles.finChartsGrid}>
        {/* Grafico CIF vs FOB por mes */}
        <div className={styles.finChartCard}>
          <h3>Faturamento CIF vs FOB por Mes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dados?.grafico_cif_fob || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar yAxisId="left" dataKey="cif" name="CIF" fill={COLORS.cif} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="fob" name="FOB" fill={COLORS.fob} radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="entregas" name="Entregas" stroke={tokens.goldColor} strokeWidth={2} dot={{ fill: tokens.goldColor }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Grafico de Evolucao do Faturamento */}
        <div className={styles.finChartCard}>
          <h3>Evolucao do Faturamento</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dados?.grafico_cif_fob || []}>
              <defs>
                <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.faturamento} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.faturamento} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="faturamento"
                name="Faturamento"
                stroke={COLORS.faturamento}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorFat)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Segunda Linha de Graficos */}
      <div className={styles.finChartsGrid3}>
        {/* Distribuicao CIF/FOB - Pie Chart */}
        <div className={styles.finChartCard}>
          <h3>Distribuicao por Modalidade</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: 'CIF', value: dados?.cards?.percentual_cif || 0 },
                  { name: 'FOB', value: dados?.cards?.percentual_fob || 0 }
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
              >
                <Cell fill={COLORS.cif} />
                <Cell fill={COLORS.fob} />
              </Pie>
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.finPieLegend}>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: COLORS.cif }}></span>
              CIF - {formatPercent(dados?.cards?.percentual_cif)}
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: COLORS.fob }}></span>
              FOB - {formatPercent(dados?.cards?.percentual_fob)}
            </div>
          </div>
        </div>

        {/* Histórico Mensal */}
        <div className={`${styles.finChartCard} ${styles.topClientes}`}>
          <h3>Histórico por Mes</h3>
          <div className={styles.clientesList}>
            {(dados?.grafico_cif_fob || []).slice(-5).reverse().map((item, index) => (
              <div key={index} className={styles.clienteItem}>
                <div className={styles.clienteRank}>{item.mes}</div>
                <div className={styles.clienteInfo}>
                  <span className={styles.clienteNome}>{item.entregas} entregas</span>
                  <div className={styles.clienteBarContainer}>
                    <div
                      className={styles.clienteBar}
                      style={{
                        width: `${(item.faturamento / (dados?.grafico_cif_fob?.[0]?.faturamento || 1)) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
                <span className={styles.clienteValor}>{formatCurrencyShort(item.faturamento)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo Rapido */}
        <div className={`${styles.finChartCard} ${styles.resumo}`}>
          <h3>Resumo do Período</h3>
          <div className={styles.resumoGrid}>
            <div className={styles.resumoItem}>
              <span className={styles.resumoLabel}>Total de CT-es</span>
              <span className={styles.resumoValue}>{dados?.cards?.total_ctes || 0}</span>
            </div>
            <div className={styles.resumoItem}>
              <span className={styles.resumoLabel}>Ticket Medio</span>
              <span className={styles.resumoValue}>{formatCurrency(dados?.cards?.ticket_medio)}</span>
            </div>
            <div className={styles.resumoItem}>
              <span className={styles.resumoLabel}>Maior Faturamento</span>
              <span className={styles.resumoValue}>
                {formatCurrency(Math.max(...(dados?.grafico_cif_fob?.map(m => m.faturamento) || [0])))}
              </span>
            </div>
            <div className={styles.resumoItem}>
              <span className={styles.resumoLabel}>Media Mensal</span>
              <span className={styles.resumoValue}>
                {formatCurrency(
                  dados?.grafico_cif_fob?.length > 0
                    ? (dados?.cards?.faturamento_total || 0) / dados.grafico_cif_fob.length
                    : 0
                )}
              </span>
            </div>
          </div>
          <div className={styles.resumoGrowth}>
            <div className={`${styles.growthIndicator} ${styles.positive}`}>
              <span className={styles.growthText}>
                CIF: {formatCurrency(dados?.cards?.valor_cif)} | FOB: {formatCurrency(dados?.cards?.valor_fob)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinanceiroPainel;
