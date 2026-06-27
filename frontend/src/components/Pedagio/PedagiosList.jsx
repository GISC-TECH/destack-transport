import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { pedagioAPI, veiculosAPI, ordemViagemAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import TableContainer from '../Common/TableContainer';
import tokens from '../../styles/tokens.module.css';
import styles from './PedagiosList.module.css';

function PedagiosList() {
  const toast = useToast();
  const [pedagios, setPedagios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    veiculo: '',
    ordem: '',
    q: ''
  });

  useEffect(() => {
    loadPedagios();
    loadVeiculos();
    loadOrdens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPedagios = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await pedagioAPI.list(params);
      setPedagios(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar pedágios:', err);
      setError('Erro ao carregar pedágios. Tente novamente.');
      setPedagios([]);
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

  const loadOrdens = async () => {
    try {
      const result = await ordemViagemAPI.list();
      setOrdens(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar ordens:', err);
      setOrdens([]);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    loadPedagios();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este pedágio?')) return;
    try {
      await pedagioAPI.delete(id);
      toast.success('Pedágio excluído com sucesso!');
      loadPedagios();
    } catch (err) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const totalGeral = pedagios.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);

  if (loading && pedagios.length === 0) return <Loading message="Carregando pedágios..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadPedagios} />;

  return (
    <div className={styles.pedagioPage}>
      <PageHeader
        title="Pedágios"
        subtitle="Controle de pedágios e gastos com viagem"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Pedágios' }]}
        actions={
          <Button as={Link} to="/pedagios/novo" variant="primary" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Novo Pedágio
          </Button>
        }
      />

      <div className={styles.finKpiGrid}>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.infoLight, color: tokens.infoColor }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect>
              <line x1="6" y1="10" x2="6.01" y2="10"></line>
              <line x1="6" y1="14" x2="6.01" y2="14"></line>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <div className={styles.finKpiLabel}>Total de Pedágios</div>
            <div className={styles.finKpiValue}>{pedagios.length}</div>
          </div>
        </div>
        <div className={`${styles.finKpiCard} ${styles.principal}`}>
          <div className={styles.finKpiIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <div className={styles.finKpiLabel}>Gasto Total</div>
            <div className={styles.finKpiValue}>{formatCurrency(totalGeral)}</div>
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
              value={filtros.ordem}
              onChange={(e) => setFiltros({ ...filtros, ordem: e.target.value })}
            >
              <option value="">Todas as ordens</option>
              {ordens.map(o => (
                <option key={o.id} value={o.id}>{o.numero}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Buscar por praça, rodovia..."
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            />
            <Button type="submit" variant="primary">Filtrar</Button>
          </div>
        </form>
      </div>

      <div className={styles.pedagioListCard}>
        <TableContainer>
          <table className={styles.pedagioTable}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Veículo</th>
                <th>Ordem</th>
                <th>Praça</th>
                <th>Rodovia</th>
                <th>KM</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedagios.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center">
                    <div className={styles.osEmptyState}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect>
                        <line x1="6" y1="10" x2="6.01" y2="10"></line>
                        <line x1="6" y1="14" x2="6.01" y2="14"></line>
                      </svg>
                      <p>Nenhum pedágio encontrado.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pedagios.map(p => (
                  <tr key={p.id}>
                    <td data-label="Data">{formatDate(p.data)}</td>
                    <td data-label="Veículo"><strong>{p.veiculo_placa || '-'}</strong></td>
                    <td data-label="Ordem">{p.ordem_numero || '-'}</td>
                    <td data-label="Praça">{p.praca}</td>
                    <td data-label="Rodovia">{p.rodovia || '-'}</td>
                    <td data-label="KM">{p.km || '-'}</td>
                    <td data-label="Categoria">{p.categoria || '-'}</td>
                    <td data-label="Valor">{formatCurrency(p.valor)}</td>
                    <td>
                      <div className={styles.osActions}>
                        <Link to={`/pedagios/${p.id}`} className={styles.btnIcon} title="Editar">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </Link>
                        <Button
                          variant="ghost"
                          iconOnly
                          className={styles.btnIcon}
                          onClick={() => handleDelete(p.id)}
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
      </div>
    </div>
  );
}

export default PedagiosList;
