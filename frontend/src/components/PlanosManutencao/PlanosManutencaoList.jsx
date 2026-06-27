import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { planoManutencaoAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import tokens from '../../styles/tokens.module.css';
import styles from './PlanosManutencaoList.module.css';

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

  const getTipoVariant = (tipo) => {
    const map = {
      'preventiva': 'info',
      'corretiva': 'warning',
      'preditiva': 'success'
    };
    return map[tipo] || 'default';
  };

  const getTipoLabel = (tipo) => {
    const map = {
      'preventiva': 'Preventiva',
      'corretiva': 'Corretiva',
      'preditiva': 'Preditiva'
    };
    return map[tipo] || tipo;
  };

  const isVencendo = (plano) => {
    return alertas.some(a => a.id === plano.id);
  };

  if (loading && planos.length === 0) return <Loading message="Carregando planos de manutenção..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadPlanos} />;

  return (
    <div className={styles.planosManutencaoPage}>
      <PageHeader
        title="Planos de Manutenção"
        subtitle="Gestão preventiva, preditiva e corretiva da frota"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Planos de Manutenção' }]}
        actions={
          <Button as={Link} to="/planos-manutencao/novo" variant="primary" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Novo Plano
          </Button>
        }
      />

      {alertas.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <strong>Atenção:</strong> {alertas.length} plano(s) de manutenção próximo(s) do vencimento.
        </div>
      )}

      <div className={styles.finKpiGrid}>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.infoLight, color: tokens.infoColor }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <div className={styles.finKpiLabel}>Planos Ativos</div>
            <div className={styles.finKpiValue}>{planos.filter(p => p.ativo).length}</div>
          </div>
        </div>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.warningLight, color: tokens.warningColor }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <div className={styles.finKpiLabel}>Alertas</div>
            <div className={styles.finKpiValue}>{alertas.length}</div>
          </div>
        </div>
        <div className={`${styles.finKpiCard} ${styles.principal}`}>
          <div className={styles.finKpiIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <div className={styles.finKpiLabel}>Total de Planos</div>
            <div className={styles.finKpiValue}>{planos.length}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Filtros</h3>
        </div>
        <form onSubmit={handleFiltrar} className={styles.filtrosForm}>
          <div className={styles.filtrosRow}>
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
            <Button type="submit" variant="primary">Filtrar</Button>
          </div>
        </form>
      </div>

      <div className={styles.planosListCard}>
        <TableContainer mobileCards={false}>
          <table className={styles.planosTable}>
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
                    <div className={styles.osEmptyState}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                      </svg>
                      <p>Nenhum plano de manutenção encontrado.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                planos.map(plano => (
                  <tr key={plano.id} style={isVencendo(plano) ? { background: tokens.warningLight } : {}}>
                    <td><strong>{plano.veiculo_placa || '-'}</strong></td>
                    <td>
                      <StatusPill status={getTipoVariant(plano.tipo)}>
                        {getTipoLabel(plano.tipo)}
                      </StatusPill>
                    </td>
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
                          <StatusPill status="warning">Vencendo</StatusPill>
                        ) : (
                          <StatusPill status="success">Em dia</StatusPill>
                        )
                      ) : (
                        <StatusPill status="muted">Inativo</StatusPill>
                      )}
                    </td>
                    <td>
                      <div className={styles.osActions}>
                        <Link to={`/planos-manutencao/${plano.id}`} className={styles.btnIcon} title="Editar">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </Link>
                        <Button
                          variant="ghost"
                          iconOnly
                          className={styles.btnIcon}
                          onClick={() => handleDelete(plano.id)}
                          aria-label="Excluir"
                          title="Excluir"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableContainer>

        {planos.map(plano => (
          <div key={plano.id} className={styles.planosMobileCard} style={isVencendo(plano) ? { background: tokens.warningLight } : {}}>
            <div className={styles.planosMobileRow}>
              <span><strong>{plano.veiculo_placa || '-'}</strong></span>
              <StatusPill status={getTipoVariant(plano.tipo)}>{getTipoLabel(plano.tipo)}</StatusPill>
            </div>
            <div className={styles.planosMobileRow}>
              <span className={styles.planosMobileLabel}>Descrição</span>
              <span>{plano.descricao}</span>
            </div>
            <div className={styles.planosMobileRow}>
              <span className={styles.planosMobileLabel}>Próxima</span>
              <span>
                {plano.proxima_km ? `${plano.proxima_km}km` : ''}
                {plano.proxima_data ? ` (${formatDate(plano.proxima_data)})` : '-'}
              </span>
            </div>
            <div className={styles.planosMobileRow} style={{ marginTop: 12 }}>
              <Button as={Link} to={`/planos-manutencao/${plano.id}`} variant="primary" size="sm">Editar</Button>
              <Button variant="secondary" size="sm" onClick={() => handleDelete(plano.id)}>
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlanosManutencaoList;
