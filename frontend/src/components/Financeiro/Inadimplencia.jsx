import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { financeiroAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './Financeiro.css';

const COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#3498db', '#2ecc71'];

function Inadimplencia() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataCorte, setDataCorte] = useState(new Date().toISOString().split('T')[0]);

  const loadDados = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await financeiroAPI.inadimplencia({ data_corte: dataCorte });
      setDados(result);
    } catch (err) {
      console.error('Erro ao carregar inadimplência:', err);
      setError(err.message);
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataCorte]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('R$') || entry.dataKey.includes('valor') ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) return <Loading message="Carregando inadimplência..." />;
  if (error && !dados) return <ErrorMessage message={error} onRetry={loadDados} />;

  const inadimplenciaIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );

  const faixaAtividade = [
    { nome: '1-30 dias', valor: dados.faturas.filter(f => f.dias_atraso >= 1 && f.dias_atraso <= 30).reduce((acc, f) => acc + f.valor, 0) },
    { nome: '31-60 dias', valor: dados.faturas.filter(f => f.dias_atraso >= 31 && f.dias_atraso <= 60).reduce((acc, f) => acc + f.valor, 0) },
    { nome: '61-90 dias', valor: dados.faturas.filter(f => f.dias_atraso >= 61 && f.dias_atraso <= 90).reduce((acc, f) => acc + f.valor, 0) },
    { nome: '90+ dias', valor: dados.faturas.filter(f => f.dias_atraso > 90).reduce((acc, f) => acc + f.valor, 0) },
  ].filter(f => f.valor > 0);

  return (
    <div className="financeiro-page">
      <PageHeader
        title="Inadimplência"
        subtitle="Faturas atrasadas por cliente e total em aberto"
        icon={inadimplenciaIcon}
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Inadimplência' }]}
        actions={
          <div className="date-inputs">
            <div className="date-input-group">
              <label htmlFor="data-corte">Data de corte:</label>
              <input
                id="data-corte"
                type="date"
                value={dataCorte}
                onChange={(e) => setDataCorte(e.target.value)}
                className="date-input"
              />
            </div>
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
            <span className="fin-kpi-label">Total em Aberto</span>
            <span className="fin-kpi-value">{formatCurrency(dados?.total_em_aberto)}</span>
            <span className="fin-kpi-subtext">Data de corte: {dados?.data_corte}</span>
          </div>
        </div>

        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(231, 76, 60, 0.12)', color: '#e74c3c' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <span className="fin-kpi-label">Faturas Atrasadas</span>
            <span className="fin-kpi-value">{dados?.quantidade_faturas || 0}</span>
          </div>
        </div>

        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(230, 126, 34, 0.12)', color: '#e67e22' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <span className="fin-kpi-label">Clientes Inadimplentes</span>
            <span className="fin-kpi-value">{dados?.quantidade_clientes || 0}</span>
          </div>
        </div>

        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(52, 152, 219, 0.12)', color: '#3498db' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <span className="fin-kpi-label">Maior Atraso</span>
            <span className="fin-kpi-value">
              {dados?.clientes?.length > 0
                ? `${Math.max(...dados.clientes.map(c => c.maior_atraso))} dias`
                : '0 dias'}
            </span>
          </div>
        </div>
      </div>

      <div className="fin-charts-grid">
        {/* Top clientes inadimplentes */}
        <div className="fin-chart-card">
          <h3>Top Clientes Inadimplentes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados?.clientes?.slice(0, 10) || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_aberto" name="Total em aberto (R$)" fill="#e74c3c" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribuição por faixa de atraso */}
        <div className="fin-chart-card">
          <h3>Distribuição por Faixa de Atraso</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={faixaAtividade}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="valor"
                nameKey="nome"
                label={({ nome, percent }) => `${nome}: ${(percent * 100).toFixed(0)}%`}
              >
                {faixaAtividade.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de faturas */}
      <div className="fin-chart-card" style={{ marginTop: '30px' }}>
        <h3>Faturas em Atraso</h3>
        <div className="clientes-list">
          {(dados?.faturas || []).slice(0, 50).map((fatura, index) => (
            <div key={index} className="cliente-item">
              <div className="cliente-rank">{index + 1}</div>
              <div className="cliente-info">
                <span className="cliente-nome">{fatura.cliente_nome}</span>
                <div className="cliente-bar-container">
                  <div
                    className="cliente-bar"
                    style={{
                      width: `${Math.min((fatura.valor / (dados?.total_em_aberto || 1)) * 100, 100)}%`,
                      background: '#e74c3c'
                    }}
                  ></div>
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: '140px' }}>
                <div style={{ fontWeight: 600 }}>{formatCurrency(fatura.valor)}</div>
                <div style={{ fontSize: '12px', color: '#e74c3c' }}>{fatura.dias_atraso} dias atraso</div>
              </div>
            </div>
          ))}
          {(!dados?.faturas || dados.faturas.length === 0) && (
            <p style={{ textAlign: 'center', color: '#95a5a6', padding: '20px' }}>
              Nenhuma fatura em atraso encontrada.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Inadimplencia;
