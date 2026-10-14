import { useState, useEffect } from 'react';
import { dashboardAPI } from '../../services/api';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import styles from './Geografico.module.css';

const COLORS = ['#0d9488', '#27ae60', '#f39c12', '#C8A951', '#e74c3c', '#1abc9c', '#34495e', '#e67e22'];

// Funcao para calcular datas do mes atual
const getDefaultGeoDates = () => {
  const hoje = new Date();
  const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return {
    data_inicio: dataInicio.toISOString().split('T')[0],
    data_fim: dataFim.toISOString().split('T')[0]
  };
};

function GeograficoPainel() {
  const defaultDates = getDefaultGeoDates();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);
  const [filtros, setFiltros] = useState(defaultDates);

  const handleDateFilterChange = (newFiltros) => {
    setFiltros(newFiltros);
    loadDados(newFiltros);
  };

  // Carrega dados na montagem inicial
  useEffect(() => {
    loadDados(defaultDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDados = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtros;
    try {
      setLoading(true);
      const data = await dashboardAPI.geografico(filtrosAtivos);
      setDados(data);
    } catch (err) {
      console.error('Erro ao carregar dados geograficos:', err);
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  // Calcular totais a partir dos dados reais
  const totais = {
    origens: dados?.top_origens?.length || 0,
    destinos: dados?.top_destinos?.length || 0,
    rotas: dados?.rotas_frequentes?.length || 0,
    valor: dados?.top_origens?.reduce((acc, o) => acc + (o.valor || 0), 0) || 0,
    ctes: dados?.top_origens?.reduce((acc, o) => acc + (o.total || 0), 0) || 0
  };

  // Dados para grafico de pizza - Fluxos por UF
  const pieData = (dados?.rotas || []).map((r, index) => ({
    name: `${r.uf_ini} -> ${r.uf_fim}`,
    value: r.contagem,
    fill: COLORS[index % COLORS.length]
  }));

  const geoIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Painel Geográfico"
        subtitle="Análise de operações por região e rotas"
        icon={geoIcon}
        breadcrumbs={[{ label: 'Analises' }, { label: 'Geografico' }]}
        actions={
          <DateFilter
            onFilterChange={handleDateFilterChange}
            defaultPeriodo="mes"
            initialDataInicio={filtros.data_inicio}
            initialDataFim={filtros.data_fim}
          />
        }
      />

      {loading ? (
        <Loading message="Carregando dados geograficos..." />
      ) : (
      <>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.kpiBlue}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{totais.ctes.toLocaleString()}</span>
            <span className={styles.kpiLabel}>CT-es no Período</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.kpiPurple}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="10" r="3"></circle>
              <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"></path>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{totais.origens}</span>
            <span className={styles.kpiLabel}>Cidades de Origem</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.kpiGreen}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{formatCurrency(totais.valor)}</span>
            <span className={styles.kpiLabel}>Valor Total</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIcon} ${styles.kpiOrange}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div className={styles.kpiContent}>
            <span className={styles.kpiValue}>{totais.rotas}</span>
            <span className={styles.kpiLabel}>Rotas Ativas</span>
          </div>
        </div>
      </div>

      {/* Graficos - Linha 1 */}
      <div className={styles.chartsRow}>
        {/* Grafico Top Origens */}
        <div className={`${styles.chartCard} ${styles.chartLarge}`}>
          <h3>Top Origens (por quantidade de CT-es)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dados?.top_origens || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="municipio" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'valor') return formatCurrency(value);
                  return value.toLocaleString();
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="total"
                fill="#0d9488"
                radius={[4, 4, 0, 0]}
                name="CT-es"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="valor"
                stroke="#27ae60"
                strokeWidth={2}
                dot={{ fill: '#27ae60' }}
                name="Valor (R$)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuicao por Fluxo UF */}
        <div className={styles.chartCard}>
          <h3>Principais Fluxos por UF</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#7f8c8d', strokeWidth: 1 }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value} operacoes`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graficos - Linha 2 */}
      <div className={styles.chartsRow}>
        {/* Top Destinos */}
        <div className={styles.chartCard}>
          <h3>Top Destinos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados?.top_destinos || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey={(item) => `${item.municipio}/${item.uf}`}
                tick={{ fontSize: 11 }}
                width={100}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'valor') return formatCurrency(value);
                  return value;
                }}
              />
              <Legend />
              <Bar
                dataKey="total"
                fill="#C8A951"
                radius={[0, 4, 4, 0]}
                name="CT-es"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela de rotas com valores */}
        <div className={styles.chartCard}>
          <h3>Rotas Mais Frequentes</h3>
          <div className={styles.tableContainer}>
            <TableContainer mobileCards={false}>
              <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rota</th>
                  <th>CT-es</th>
                  <th>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.rotas_frequentes || []).map((rota, index) => (
                  <tr key={index}>
                    <td>
                      <span className={styles.rotaOrigem}>{rota.origem?.municipio}/{rota.origem?.uf}</span>
                      <span className={styles.rotaArrow}>-</span>
                      <span className={styles.rotaDestino}>{rota.destino?.municipio}/{rota.destino?.uf}</span>
                    </td>
                    <td>
                      <StatusPill status="info">{rota.total}</StatusPill>
                    </td>
                    <td className={styles.textRight}>
                      <strong>{formatCurrency(rota.valor)}</strong>
                    </td>
                  </tr>
                ))}
                {(!dados?.rotas_frequentes || dados.rotas_frequentes.length === 0) && (
                  <tr>
                    <td colSpan="3" className="text-center">Nenhuma rota no periodo</td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableContainer>
          </div>
        </div>
      </div>

      {/* Lista de Fluxos entre UFs */}
      <div className={styles.chartsRow}>
        <div className={`${styles.chartCard} ${styles.chartFullWidth}`}>
          <h3>Resumo de Fluxos por UF</h3>
          <div className={styles.tableContainer}>
            <TableContainer mobileCards={false}>
              <table className={styles.table}>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Quantidade</th>
                  <th>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {(dados?.rotas || []).map((fluxo, index) => (
                  <tr key={index}>
                    <td>
                      <StatusPill status="info">{fluxo.uf_ini}</StatusPill>
                    </td>
                    <td>
                      <StatusPill status="success">{fluxo.uf_fim}</StatusPill>
                    </td>
                    <td>{fluxo.contagem}</td>
                    <td className={styles.textRight}>
                      <strong>{formatCurrency(fluxo.valor)}</strong>
                    </td>
                  </tr>
                ))}
                {(!dados?.rotas || dados.rotas.length === 0) && (
                  <tr>
                    <td colSpan="4" className="text-center">Nenhum fluxo no periodo</td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableContainer>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

export default GeograficoPainel;
