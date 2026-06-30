import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { financeiroAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import Button from '../Common/Button';
import tokens from '../../styles/tokens.module.css';
import styles from './Financeiro.module.css';

const COLORS = [tokens.successColor, tokens.dangerColor, tokens.warningColor, tokens.infoColor];

function DRE() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const [filtros, setFiltros] = useState(() => getDateRange('ano'));

  const loadDados = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtros;
    try {
      setLoading(true);
      setError(null);
      const result = await financeiroAPI.dre(filtrosAtivos);
      setDados(result);
    } catch (err) {
      console.error('Erro ao carregar DRE:', err);
      setError(err.message);
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDados(filtros);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/financeiro/dre/?data_inicio=${filtros.data_inicio}&data_fim=${filtros.data_fim}&formato=csv`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Erro ao exportar DRE');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dre_${filtros.data_inicio}_${filtros.data_fim}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar:', err);
      setError(err.message);
    }
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

  if (loading) return <Loading message="Carregando DRE..." />;
  if (error && !dados) return <ErrorMessage message={error} onRetry={loadDados} />;

  const dreIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );

  const custosData = [
    { nome: 'Agregados', valor: dados?.resumo?.custos?.agregados || 0 },
    { nome: 'Próprios', valor: dados?.resumo?.custos?.proprios || 0 },
    { nome: 'Manutenções', valor: dados?.resumo?.custos?.manutencoes || 0 },
  ].filter(c => c.valor > 0);

  return (
    <div className={styles.financeiroPage}>
      <PageHeader
        title="DRE Simplificada"
        subtitle="Demonstrativo de resultado por período"
        icon={dreIcon}
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'DRE' }]}
        actions={
          <Button
            onClick={handleExport}
            variant="primary"
          >
            Exportar CSV
          </Button>
        }
      />

      <DateFilter
        onFilterChange={handleDateFilterChange}
        defaultPeriodo="ano"
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
            <span className={styles.finKpiLabel}>Receita Total</span>
            <span className={styles.finKpiValue}>{formatCurrency(dados?.resumo?.receita_total)}</span>
            <span className={styles.finKpiSubtext}>
              Período: {dados?.filtros?.data_inicio} a {dados?.filtros?.data_fim}
            </span>
          </div>
        </div>

        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.dangerLight, color: tokens.dangerColor }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <span className={styles.finKpiLabel}>Custos Totais</span>
            <span className={styles.finKpiValue}>{formatCurrency(dados?.resumo?.custos?.total)}</span>
          </div>
        </div>

        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.successLight, color: tokens.successColor }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <span className={styles.finKpiLabel}>Lucro</span>
            <span className={styles.finKpiValue}>{formatCurrency(dados?.resumo?.lucro)}</span>
          </div>
        </div>

        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.infoLight, color: tokens.infoColor }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="6" x2="12" y2="12"></line>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <span className={styles.finKpiLabel}>Margem</span>
            <span className={styles.finKpiValue}>{(dados?.resumo?.margem_percentual || 0).toFixed(1)}%</span>
            <span className={styles.finKpiSubtext}>{dados?.resumo?.qtd_ctes || 0} CT-es</span>
          </div>
        </div>
      </div>

      <div className={styles.finChartsGrid}>
        {/* Evolução mensal */}
        <div className={styles.finChartCard}>
          <h3>Evolução Mensal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados?.evolucao_mensal || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatCurrencyShort} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill={tokens.successColor} radius={[4, 4, 0, 0]} />
              <Bar dataKey="custos" name="Custos" fill={tokens.dangerColor} radius={[4, 4, 0, 0]} />
              <Bar dataKey="lucro" name="Lucro" fill={tokens.infoColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Composição de custos */}
        <div className={styles.finChartCard}>
          <h3>Composição de Custos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={custosData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="valor"
                nameKey="nome"
                label={({ nome, percent }) => `${nome}: ${(percent * 100).toFixed(0)}%`}
              >
                {custosData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela DRE */}
      <div className={styles.finChartCard} style={{ marginTop: '30px' }}>
        <h3>Demonstrativo por Mês</h3>
        <div className={styles.clientesList}>
          {(dados?.evolucao_mensal || []).map((item, index) => (
            <div key={index} className={styles.clienteItem}>
              <div className={styles.clienteRank}>{item.mes}</div>
              <div className={styles.clienteInfo}>
                <span className={styles.clienteNome}>
                  Receita: {formatCurrency(item.receita)} | Custos: {formatCurrency(item.custos)} | Margem: {item.margem.toFixed(1)}%
                </span>
                <div className={styles.clienteBarContainer}>
                  <div
                    className={styles.clienteBar}
                    style={{
                      width: `${Math.min((Math.abs(item.lucro) / (Math.max(...(dados?.evolucao_mensal?.map(e => Math.abs(e.lucro)) || [1]))) * 100), 100)}%`,
                      background: item.lucro >= 0 ? tokens.successColor : tokens.dangerColor
                    }}
                  ></div>
                </div>
              </div>
              <span className={styles.clienteValor} style={{ color: item.lucro >= 0 ? tokens.successColor : tokens.dangerColor }}>
                {formatCurrency(item.lucro)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DRE;
