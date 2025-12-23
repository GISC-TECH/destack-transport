import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { manutencaoAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import './Manutencao.css';

// Mock data para manutenções
const mockManutencoes = [
  {
    id: 1,
    veiculo: { placa: 'ABC-1234', modelo: 'Volvo FH 540' },
    tipo: 'preventiva',
    descricao: 'Troca de óleo e filtros - revisão 50.000 km',
    data_agendada: '2024-12-05',
    custo: 2500.00,
    status: 'agendada'
  },
  {
    id: 2,
    veiculo: { placa: 'DEF-5678', modelo: 'Scania R450' },
    tipo: 'corretiva',
    descricao: 'Substituição de pastilhas de freio dianteiras',
    data_agendada: '2024-11-28',
    custo: 1800.00,
    status: 'em_andamento'
  },
  {
    id: 3,
    veiculo: { placa: 'GHI-9012', modelo: 'Mercedes Actros' },
    tipo: 'preventiva',
    descricao: 'Revisão completa sistema de arrefecimento',
    data_agendada: '2024-11-25',
    custo: 3200.00,
    status: 'concluida'
  },
  {
    id: 4,
    veiculo: { placa: 'MNO-7890', modelo: 'DAF XF 530' },
    tipo: 'corretiva',
    descricao: 'Reparo no sistema de injeção eletrônica',
    data_agendada: '2024-11-22',
    custo: 4500.00,
    status: 'concluida'
  },
  {
    id: 5,
    veiculo: { placa: 'PQR-1234', modelo: 'Iveco Stralis' },
    tipo: 'preditiva',
    descricao: 'Análise de vibração e balanceamento',
    data_agendada: '2024-12-10',
    custo: 850.00,
    status: 'agendada'
  },
  {
    id: 6,
    veiculo: { placa: 'ABC-1234', modelo: 'Volvo FH 540' },
    tipo: 'corretiva',
    descricao: 'Substituição de bateria e alternador',
    data_agendada: '2024-11-20',
    custo: 2100.00,
    status: 'concluida'
  },
  {
    id: 7,
    veiculo: { placa: 'GHI-9012', modelo: 'Mercedes Actros' },
    tipo: 'preventiva',
    descricao: 'Alinhamento e balanceamento - pneus novos',
    data_agendada: '2024-12-15',
    custo: 1200.00,
    status: 'agendada'
  }
];

// Mock data para gráficos
const mockGraficos = {
  por_tipo: [
    { tipo: 'Preventiva', quantidade: 45, custo: 85000 },
    { tipo: 'Corretiva', quantidade: 28, custo: 62000 },
    { tipo: 'Preditiva', quantidade: 12, custo: 18000 }
  ],
  evolucao_mensal: [
    { mes: 'Jul', preventiva: 8, corretiva: 4, preditiva: 2, custo_total: 15200 },
    { mes: 'Ago', preventiva: 10, corretiva: 6, preditiva: 3, custo_total: 22400 },
    { mes: 'Set', preventiva: 7, corretiva: 5, preditiva: 2, custo_total: 18600 },
    { mes: 'Out', preventiva: 12, corretiva: 7, preditiva: 3, custo_total: 28500 },
    { mes: 'Nov', preventiva: 8, corretiva: 6, preditiva: 2, custo_total: 21300 }
  ],
  por_veiculo: [
    { placa: 'ABC-1234', manutencoes: 8, custo: 12500 },
    { placa: 'DEF-5678', manutencoes: 6, custo: 9800 },
    { placa: 'GHI-9012', manutencoes: 5, custo: 8200 },
    { placa: 'MNO-7890', manutencoes: 4, custo: 7100 },
    { placa: 'PQR-1234', manutencoes: 3, custo: 4500 }
  ]
};

const COLORS = ['#3498db', '#f39c12', '#27ae60', '#9b59b6', '#e74c3c'];

function ManutencaoList() {
  const [manutencoes, setManutencoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [graficos, setGraficos] = useState(null);
  const [showGraficos, setShowGraficos] = useState(true);
  const [filtros, setFiltros] = useState({
    status: '',
    tipo: '',
    veiculo: ''
  });

  useEffect(() => {
    loadManutencoes();
    loadGraficos();
  }, []);

  const loadManutencoes = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await manutencaoAPI.list(params);
      setManutencoes(result.results || result);
      setUsingMockData(false);
    } catch (err) {
      console.error('Erro ao carregar manutenções:', err);
      // Usar mock data
      let filteredMock = [...mockManutencoes];

      if (filtros.status) {
        filteredMock = filteredMock.filter(m => m.status === filtros.status);
      }
      if (filtros.tipo) {
        filteredMock = filteredMock.filter(m => m.tipo === filtros.tipo);
      }
      if (filtros.veiculo) {
        filteredMock = filteredMock.filter(m =>
          m.veiculo.placa.toLowerCase().includes(filtros.veiculo.toLowerCase())
        );
      }

      setManutencoes(filteredMock);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const loadGraficos = async () => {
    try {
      const data = await manutencaoAPI.painel.graficos();
      setGraficos(data);
    } catch (err) {
      console.error('Erro ao carregar gráficos:', err);
      setGraficos(mockGraficos);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    loadManutencoes();
  };

  const handleExport = async () => {
    if (usingMockData) {
      alert('Exportação não disponível em modo demonstração');
      return;
    }
    try {
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      await manutencaoAPI.export(params);
    } catch (err) {
      alert('Erro ao exportar: ' + err.message);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'agendada': { class: 'info', text: 'Agendada' },
      'em_andamento': { class: 'warning', text: 'Em Andamento' },
      'concluida': { class: 'success', text: 'Concluída' },
      'cancelada': { class: 'danger', text: 'Cancelada' }
    };
    const s = statusMap[status] || { class: 'secondary', text: status };
    return <span className={`badge badge-${s.class}`}>{s.text}</span>;
  };

  const getTipoBadge = (tipo) => {
    const tipoMap = {
      'preventiva': { class: 'info', text: 'Preventiva' },
      'corretiva': { class: 'warning', text: 'Corretiva' },
      'preditiva': { class: 'success', text: 'Preditiva' }
    };
    const t = tipoMap[tipo] || { class: 'secondary', text: tipo };
    return <span className={`badge badge-${t.class}`}>{t.text}</span>;
  };

  // Calcular contagens
  const contagens = {
    agendadas: manutencoes.filter(m => m.status === 'agendada').length,
    em_andamento: manutencoes.filter(m => m.status === 'em_andamento').length,
    concluidas: manutencoes.filter(m => m.status === 'concluida').length
  };

  if (loading && manutencoes.length === 0) return <Loading message="Carregando manutenções..." />;

  const manutencaoIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
  );

  return (
    <div className="manutencao-page">
      <PageHeader
        title="Manutenção de Veículos"
        subtitle={usingMockData ? "Gerencie as manutenções preventivas e corretivas (Modo Demonstração)" : "Gerencie as manutenções preventivas e corretivas"}
        icon={manutencaoIcon}
        breadcrumbs={[{ label: 'Manutenção' }]}
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={handleExport}
              disabled={usingMockData}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Exportar CSV
            </button>
            <Link to="/manutencoes/nova" className="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nova Manutenção
            </Link>
          </>
        }
      />

      {/* Cards de resumo */}
      <div className="manutencao-summary">
        <div className="summary-item">
          <div className="summary-icon agendadas">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="summary-info">
            <span className="summary-number">{contagens.agendadas}</span>
            <span className="summary-label">Agendadas</span>
          </div>
        </div>
        <div className="summary-item">
          <div className="summary-icon andamento">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="summary-info">
            <span className="summary-number">{contagens.em_andamento}</span>
            <span className="summary-label">Em Andamento</span>
          </div>
        </div>
        <div className="summary-item">
          <div className="summary-icon concluidas">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="summary-info">
            <span className="summary-number">{contagens.concluidas}</span>
            <span className="summary-label">Concluídas</span>
          </div>
        </div>
      </div>

      {/* Toggle Gráficos */}
      <div className="graficos-toggle">
        <button
          className={`btn-toggle ${showGraficos ? 'active' : ''}`}
          onClick={() => setShowGraficos(!showGraficos)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          {showGraficos ? 'Ocultar Gráficos' : 'Mostrar Gráficos'}
        </button>
      </div>

      {/* Seção de Gráficos */}
      {showGraficos && graficos && (
        <div className="graficos-section">
          <div className="graficos-row">
            {/* Gráfico por Tipo (Pizza) */}
            <div className="grafico-card">
              <h3>Manutenções por Tipo</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={graficos.por_tipo || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="quantidade"
                    nameKey="tipo"
                    label={({ tipo, percent }) => `${tipo} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(graficos.por_tipo || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} manutenções`, props?.payload?.tipo || '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Evolução Mensal */}
            <div className="grafico-card wide">
              <h3>Evolução Mensal</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={graficos.evolucao_mensal || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="preventiva" stackId="1" stroke="#3498db" fill="#3498db" fillOpacity={0.6} name="Preventiva" />
                  <Area type="monotone" dataKey="corretiva" stackId="1" stroke="#f39c12" fill="#f39c12" fillOpacity={0.6} name="Corretiva" />
                  <Area type="monotone" dataKey="preditiva" stackId="1" stroke="#27ae60" fill="#27ae60" fillOpacity={0.6} name="Preditiva" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="graficos-row">
            {/* Custos por Tipo */}
            <div className="grafico-card">
              <h3>Custos por Tipo</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={graficos.por_tipo || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="custo" fill="#9b59b6" radius={[4, 4, 0, 0]} name="Custo Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Veículos */}
            <div className="grafico-card wide">
              <h3>Veículos com Mais Manutenções</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={graficos.por_veiculo || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="placa" type="category" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(value, name) => name === 'custo' ? formatCurrency(value) : value} />
                  <Legend />
                  <Bar dataKey="manutencoes" fill="#3498db" radius={[0, 4, 4, 0]} name="Manutenções" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Evolução de Custos */}
          <div className="graficos-row">
            <div className="grafico-card full-width">
              <h3>Evolução de Custos Mensal</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={graficos.evolucao_mensal || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Line
                    type="monotone"
                    dataKey="custo_total"
                    stroke="#e74c3c"
                    strokeWidth={3}
                    dot={{ fill: '#e74c3c', strokeWidth: 2 }}
                    name="Custo Total"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="filtros-section">
        <form onSubmit={handleFiltrar} className="filtros-form">
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({...filtros, status: e.target.value})}
            className="select-filter"
          >
            <option value="">Todos os Status</option>
            <option value="agendada">Agendada</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <select
            value={filtros.tipo}
            onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
            className="select-filter"
          >
            <option value="">Todos os Tipos</option>
            <option value="preventiva">Preventiva</option>
            <option value="corretiva">Corretiva</option>
            <option value="preditiva">Preditiva</option>
          </select>
          <input
            type="text"
            placeholder="Placa do veículo..."
            value={filtros.veiculo}
            onChange={(e) => setFiltros({...filtros, veiculo: e.target.value})}
            className="input-filter"
          />
          <button type="submit" className="btn-primary">Filtrar</button>
        </form>
      </div>

      <div className="results-info">
        <p>Total de {manutencoes.length} manutenç{manutencoes.length !== 1 ? 'ões' : 'ão'}</p>
      </div>

      {/* Tabela */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Veículo</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Data Agendada</th>
              <th>Custo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {manutencoes.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center">Nenhuma manutenção encontrada</td>
              </tr>
            ) : (
              manutencoes.map((manutencao) => (
                <tr key={manutencao.id}>
                  <td>
                    <strong>{manutencao.veiculo_info?.placa || manutencao.veiculo_placa || '-'}</strong>
                    <br />
                    <small className="text-muted">
                      {manutencao.veiculo_info?.modelo || ''}
                    </small>
                  </td>
                  <td>{getTipoBadge(manutencao.tipo)}</td>
                  <td>
                    <span className="descricao-truncate">
                      {manutencao.descricao || '-'}
                    </span>
                  </td>
                  <td>{formatDate(manutencao.data_agendada)}</td>
                  <td className="text-right">
                    <strong>{formatCurrency(manutencao.custo)}</strong>
                  </td>
                  <td>{getStatusBadge(manutencao.status)}</td>
                  <td className="actions-cell">
                    <Link to={`/manutencoes/${manutencao.id}`} className="btn-action btn-view" title="Ver detalhes">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManutencaoList;
