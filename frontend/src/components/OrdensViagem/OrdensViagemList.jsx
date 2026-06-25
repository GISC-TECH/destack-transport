import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ordemViagemAPI, veiculosAPI, motoristasAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './OrdensViagem.css';
import '../Financeiro/Financeiro.css';

function OrdensViagemList() {
  const toast = useToast();
  const [ordens, setOrdens] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    status: '',
    veiculo: '',
    motorista: '',
    q: ''
  });

  useEffect(() => {
    loadOrdens();
    loadVeiculos();
    loadMotoristas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrdens = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await ordemViagemAPI.list(params);
      setOrdens(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar ordens de viagem:', err);
      setError('Erro ao carregar ordens de viagem. Tente novamente.');
      setOrdens([]);
    } finally {
      setLoading(false);
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

  const loadMotoristas = async () => {
    try {
      const result = await motoristasAPI.list({ ativo: true });
      setMotoristas(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar motoristas:', err);
      setMotoristas([]);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    loadOrdens();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta ordem de viagem?')) return;
    try {
      await ordemViagemAPI.delete(id);
      toast.success('Ordem de viagem excluída com sucesso!');
      loadOrdens();
    } catch (err) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusBadge = (status) => {
    return <span className={`status-badge status-${status}`}>{status.replace('_', ' ')}</span>;
  };

  const contagens = {
    em_andamento: ordens.filter(o => o.status === 'em_andamento').length,
    agendada: ordens.filter(o => o.status === 'agendada').length,
    concluida: ordens.filter(o => o.status === 'concluida').length,
    total: ordens.length
  };

  if (loading && ordens.length === 0) return <Loading message="Carregando ordens de viagem..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadOrdens} />;

  return (
    <div className="ordens-viagem-page">
      <PageHeader
        title="Ordens de Viagem"
        subtitle="Gerencie viagens, motoristas e CT-es vinculados"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Ordens de Viagem' }]}
        actions={
          <Link to="/ordens-viagem/nova" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova OS
          </Link>
        }
      />

      <div className="fin-kpi-grid">
        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(0, 123, 255, 0.1)', color: '#007bff' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <div className="fin-kpi-label">Em Andamento</div>
            <div className="fin-kpi-value">{contagens.em_andamento}</div>
          </div>
        </div>
        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(255, 193, 7, 0.1)', color: '#ffc107' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <div className="fin-kpi-label">Agendadas</div>
            <div className="fin-kpi-value">{contagens.agendada}</div>
          </div>
        </div>
        <div className="fin-kpi-card">
          <div className="fin-kpi-icon" style={{ background: 'rgba(40, 167, 69, 0.1)', color: '#28a745' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <div className="fin-kpi-label">Concluídas</div>
            <div className="fin-kpi-value">{contagens.concluida}</div>
          </div>
        </div>
        <div className="fin-kpi-card principal">
          <div className="fin-kpi-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div className="fin-kpi-content">
            <div className="fin-kpi-label">Total de OS</div>
            <div className="fin-kpi-value">{contagens.total}</div>
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
              value={filtros.status}
              onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            >
              <option value="">Todos os status</option>
              <option value="rascunho">Rascunho</option>
              <option value="agendada">Agendada</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
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
              value={filtros.motorista}
              onChange={(e) => setFiltros({ ...filtros, motorista: e.target.value })}
            >
              <option value="">Todos os motoristas</option>
              {motoristas.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Buscar por número, cidade..."
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            />
            <button type="submit" className="btn-primary">Filtrar</button>
          </div>
        </form>
      </div>

      <div className="os-list-card">
        <table className="os-table">
          <thead>
            <tr>
              <th>OS</th>
              <th>Status</th>
              <th>Veículo</th>
              <th>Motorista</th>
              <th>Saída</th>
              <th>Previsão</th>
              <th>Rota</th>
              <th>CT-es</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {ordens.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center">
                  <div className="os-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    </svg>
                    <p>Nenhuma ordem de viagem encontrada.</p>
                  </div>
                </td>
              </tr>
            ) : (
              ordens.map(ordem => (
                <tr key={ordem.id}>
                  <td><strong>{ordem.numero}</strong></td>
                  <td>{getStatusBadge(ordem.status)}</td>
                  <td>{ordem.veiculo_placa || '-'}</td>
                  <td>{ordem.motorista_nome || '-'}</td>
                  <td>{formatDateTime(ordem.data_saida)}</td>
                  <td>{formatDateTime(ordem.data_previsao_chegada)}</td>
                  <td>
                    {ordem.origem_cidade && ordem.destino_cidade
                      ? `${ordem.origem_cidade}/${ordem.origem_uf} → ${ordem.destino_cidade}/${ordem.destino_uf}`
                      : '-'}
                  </td>
                  <td>{ordem.ctes_count || 0}</td>
                  <td>
                    <div className="os-actions">
                      <Link to={`/ordens-viagem/${ordem.id}`} className="btn-icon" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </Link>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(ordem.id)}
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

        {ordens.map(ordem => (
          <div key={ordem.id} className="os-mobile-card">
            <div className="os-mobile-row">
              <span><strong>{ordem.numero}</strong></span>
              {getStatusBadge(ordem.status)}
            </div>
            <div className="os-mobile-row">
              <span className="os-mobile-label">Veículo</span>
              <span>{ordem.veiculo_placa || '-'}</span>
            </div>
            <div className="os-mobile-row">
              <span className="os-mobile-label">Motorista</span>
              <span>{ordem.motorista_nome || '-'}</span>
            </div>
            <div className="os-mobile-row">
              <span className="os-mobile-label">Saída</span>
              <span>{formatDateTime(ordem.data_saida)}</span>
            </div>
            <div className="os-mobile-row">
              <span className="os-mobile-label">Rota</span>
              <span>
                {ordem.origem_cidade && ordem.destino_cidade
                  ? `${ordem.origem_cidade} → ${ordem.destino_cidade}`
                  : '-'}
              </span>
            </div>
            <div className="os-mobile-row" style={{ marginTop: 12 }}>
              <Link to={`/ordens-viagem/${ordem.id}`} className="btn-primary btn-sm">Editar</Link>
              <button
                className="btn-secondary btn-sm"
                onClick={() => handleDelete(ordem.id)}
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

export default OrdensViagemList;
