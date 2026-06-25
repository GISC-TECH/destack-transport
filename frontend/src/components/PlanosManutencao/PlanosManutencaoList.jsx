import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { planoManutencaoAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './PlanosManutencao.css';
import '../Financeiro/Financeiro.css';

function PlanosManutencaoList() {
  const toast = useToast();
  const [planos, setPlanos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    veiculo: '',
    tipo: '',
    q: ''
  });

  useEffect(() => {
    loadPlanos();
    loadAlertas();
    loadVeiculos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlanos = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await planoManutencaoAPI.list(params);
      setPlanos(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
      setError('Erro ao carregar planos de manutenção. Tente novamente.');
      setPlanos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAlertas = async () => {
    try {
      const result = await planoManutencaoAPI.alertas();
      setAlertas(result);
    } catch (err) {
      console.error('Erro ao carregar alertas:', err);
      setAlertas([]);
    }
  };

  const loadVeiculos = async () => {
    try {
      const result = await veiculosAPI.list({ ativo: true });
      setVeiculos(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
      setVeiculos([]);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    loadPlanos();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este plano de manutenção?')) return;
    try {
      await planoManutencaoAPI.delete(id);
      toast.success('Plano de manutenção excluído com sucesso!');
      loadPlanos();
      loadAlertas();
    } catch (err) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getTipoBadge = (tipo) => {
    const map = {
      'preventiva': { class: 'info', text: 'Preventiva' },
      'corretiva': { class: 'warning', text: 'Corretiva' },
      'preditiva': { class: 'success', text: 'Preditiva' }
    };
    const s = map[tipo] || { class: 'secondary', text: tipo };
    return <span className={`badge badge-${s.class}`}>{s.text}</span>;
  };

  const isVencendo = (plano) => {
    return alertas.some(a => a.id === plano.id);
  };

  if (loading && planos.length === 0) return <Loading message="Carregando planos de manutenção..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadPlanos} />;

  return (
    <div className="planos-manutencao-page">
      <PageHeader
        title="Planos de Manutenção"
        subtitle="Gestão preventiva, preditiva e corretiva da frota"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Planos de Manutenção' }]}
        actions={
          <Link to="/planos-manutencao/novo" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Novo Plano
          </Link>
        }
      />

      {alertas.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <strong>Atenção:</strong> {alertas.length} plano(s) de manutenção próximo(s) do vencimento.
        </div>
      )}

      <div className="fin-kpi-grid">
        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(0, 123, 255, 0.1)', color: '#007bff' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <div className="fin-kpi-label">Planos Ativos</div>
            <div className="fin-kpi-value">{planos.filter(p => p.ativo).length}</div>
          </div>
        </div>
        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(255, 193, 7, 0.1)', color: '#ffc107' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <div className="fin-kpi-label">Alertas</div>
            <div className="fin-kpi-value">{alertas.length}</div>
          </div>
        </div>
        <div className="fin-kpi-card principal">
          <div className="fin-kpi-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <div className="fin-kpi-label">Total de Planos</div>
            <div className="fin-kpi-value">{planos.length}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Filtros</h3>
        </div>
        <form onSubmit={handleFiltrar} className="filtros-form">
          <div className="filtros-row">
            <select
              value={filtros.veiculo}
              onChange={(e) => setFiltros({ ...filtros, veiculo: e.target.value })}
            >
              <option value="">Todos os veículos</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>{v.placa}</option>
              ))}
            </select>
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
            >
              <option value="">Todos os tipos</option>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
              <option value="preditiva">Preditiva</option>
            </select>
            <input
              type="text"
              placeholder="Buscar por descrição..."
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            />
            <button type="submit" className="btn-primary">Filtrar</button>
          </div>
        </form>
      </div>

      <div className="planos-list-card">
        <table className="planos-table">
          <thead>
            <tr>
              <th>Veículo</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Intervalo</th>
              <th>Última</th>
              <th>Próxima</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {planos.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center">
                  <div className="os-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    <p>Nenhum plano de manutenção encontrado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              planos.map(plano => (
                <tr key={plano.id} style={isVencendo(plano) ? { background: 'rgba(255, 193, 7, 0.1)' } : {}}>
                  <td><strong>{plano.veiculo_placa || '-'}</strong></td>
                  <td>{getTipoBadge(plano.tipo)}</td>
                  <td>{plano.descricao}</td>
                  <td>
                    {plano.intervalo_km ? `${plano.intervalo_km}km` : ''}
                    {plano.intervalo_km && plano.intervalo_dias ? ' / ' : ''}
                    {plano.intervalo_dias ? `${plano.intervalo_dias}d` : ''}
                  </td>
                  <td>
                    {plano.ultima_km ? `${plano.ultima_km}km` : ''}
                    {plano.ultima_data ? ` (${formatDate(plano.ultima_data)})` : '-'}
                  </td>
                  <td>
                    {plano.proxima_km ? `${plano.proxima_km}km` : ''}
                    {plano.proxima_data ? ` (${formatDate(plano.proxima_data)})` : '-'}
                  </td>
                  <td>
                    {plano.ativo ? (
                      isVencendo(plano) ? (
                        <span className="badge badge-warning">Vencendo</span>
                      ) : (
                        <span className="badge badge-success">Em dia</span>
                      )
                    ) : (
                      <span className="badge badge-secondary">Inativo</span>
                    )}
                  </td>
                  <td>
                    <div className="os-actions">
                      <Link to={`/planos-manutencao/${plano.id}`} className="btn-icon" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </Link>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(plano.id)}
                        title="Excluir"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {planos.map(plano => (
          <div key={plano.id} className="planos-mobile-card" style={isVencendo(plano) ? { background: 'rgba(255, 193, 7, 0.05)' } : {}}>
            <div className="planos-mobile-row">
              <span><strong>{plano.veiculo_placa || '-'}</strong></span>
              {getTipoBadge(plano.tipo)}
            </div>
            <div className="planos-mobile-row">
              <span className="planos-mobile-label">Descrição</span>
              <span>{plano.descricao}</span>
            </div>
            <div className="planos-mobile-row">
              <span className="planos-mobile-label">Próxima</span>
              <span>
                {plano.proxima_km ? `${plano.proxima_km}km` : ''}
                {plano.proxima_data ? ` (${formatDate(plano.proxima_data)})` : '-'}
              </span>
            </div>
            <div className="planos-mobile-row" style={{ marginTop: 12 }}>
              <Link to={`/planos-manutencao/${plano.id}`} className="btn-primary btn-sm">Editar</Link>
              <button
                className="btn-secondary btn-sm"
                onClick={() => handleDelete(plano.id)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlanosManutencaoList;
