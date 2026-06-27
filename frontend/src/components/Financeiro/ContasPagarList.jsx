import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { contasPagarAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import tokens from '../../styles/tokens.module.css';
import styles from './Financeiro.module.css';

function ContasPagarList() {
  const toast = useToast();
  const [contas, setContas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    status: '',
    categoria: '',
    veiculo: '',
    data_inicio: '',
    data_fim: '',
    q: ''
  });

  useEffect(() => {
    loadContas();
    loadVeiculos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContas = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await contasPagarAPI.list(params);
      setContas(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar contas a pagar:', err);
      setError('Erro ao carregar contas a pagar. Tente novamente.');
      setContas([]);
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

  const handleFiltrar = (e) => {
    e.preventDefault();
    loadContas();
  };

  const handleExport = async () => {
    try {
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      await contasPagarAPI.export(params);
    } catch (err) {
      toast.error('Erro ao exportar: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta conta a pagar?')) return;
    try {
      await contasPagarAPI.delete(id);
      toast.success('Conta a pagar excluída com sucesso!');
      loadContas();
    } catch (err) {
      toast.error('Erro ao excluir: ' + err.message);
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

  const getStatusVariant = (status) => {
    const map = {
      'pendente': 'warning',
      'paga': 'success',
      'atrasada': 'danger',
      'cancelada': 'danger'
    };
    return map[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const map = {
      'pendente': 'Pendente',
      'paga': 'Paga',
      'atrasada': 'Atrasada',
      'cancelada': 'Cancelada'
    };
    return map[status] || status;
  };

  const getCategoriaLabel = (categoria) => {
    const map = {
      'combustivel': 'Combustível',
      'pedagio': 'Pedágio',
      'seguro': 'Seguro',
      'oficina': 'Oficina',
      'outras': 'Outras'
    };
    return map[categoria] || categoria;
  };

  const contagens = {
    pendente: contas.filter(c => c.status === 'pendente').length,
    atrasada: contas.filter(c => c.status === 'atrasada').length,
    paga: contas.filter(c => c.status === 'paga').length,
    total: contas.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0)
  };

  if (loading && contas.length === 0) return <Loading message="Carregando contas a pagar..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadContas} />;

  return (
    <div className={styles.financeiroPage}>
      <PageHeader
        title="Contas a Pagar"
        subtitle="Gerencie despesas, fornecedores e pagamentos"
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Contas a Pagar' }]}
        actions={
          <>
            <Button variant="secondary" onClick={handleExport}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Exportar CSV
            </Button>
            <Button as={Link} to="/financeiro/contas-a-pagar/nova" variant="primary" size="sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nova Conta
            </Button>
          </>
        }
      />

      <div className={styles.finKpiGrid}>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className={styles.finKpiInfo}>
            <span className={styles.finKpiValue}>{contagens.pendente}</span>
            <span className={styles.finKpiLabel}>Pendentes</span>
          </div>
        </div>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ color: tokens.dangerColor, background: tokens.dangerLight }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className={styles.finKpiInfo}>
            <span className={styles.finKpiValue}>{contagens.atrasada}</span>
            <span className={styles.finKpiLabel}>Atrasadas</span>
          </div>
        </div>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ color: tokens.successColor, background: tokens.successLight }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className={styles.finKpiInfo}>
            <span className={styles.finKpiValue}>{contagens.paga}</span>
            <span className={styles.finKpiLabel}>Pagas</span>
          </div>
        </div>
        <div className={`${styles.finKpiCard} ${styles.principal}`}>
          <div className={styles.finKpiIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className={styles.finKpiInfo}>
            <span className={styles.finKpiValue}>{formatCurrency(contagens.total)}</span>
            <span className={styles.finKpiLabel}>Total em Contas</span>
          </div>
        </div>
      </div>

      <div className={styles.filtrosSection}>
        <form onSubmit={handleFiltrar} className={styles.filtrosForm}>
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className={styles.selectFilter}
          >
            <option value="">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="paga">Paga</option>
            <option value="atrasada">Atrasada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <select
            value={filtros.categoria}
            onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
            className={styles.selectFilter}
          >
            <option value="">Todas as Categorias</option>
            <option value="combustivel">Combustível</option>
            <option value="pedagio">Pedágio</option>
            <option value="seguro">Seguro</option>
            <option value="oficina">Oficina</option>
            <option value="outras">Outras</option>
          </select>
          <select
            value={filtros.veiculo}
            onChange={(e) => setFiltros({ ...filtros, veiculo: e.target.value })}
            className={styles.selectFilter}
          >
            <option value="">Todos os Veículos</option>
            {veiculos.map(v => (
              <option key={v.id} value={v.id}>{v.placa}</option>
            ))}
          </select>
          <input
            type="date"
            value={filtros.data_inicio}
            onChange={(e) => setFiltros({ ...filtros, data_inicio: e.target.value })}
            className={styles.inputFilter}
            placeholder="Vencimento inicial"
          />
          <input
            type="date"
            value={filtros.data_fim}
            onChange={(e) => setFiltros({ ...filtros, data_fim: e.target.value })}
            className={styles.inputFilter}
            placeholder="Vencimento final"
          />
          <input
            type="text"
            placeholder="Buscar descrição, fornecedor..."
            value={filtros.q}
            onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            className={styles.inputFilter}
          />
          <Button type="submit" variant="primary">Filtrar</Button>
        </form>
      </div>

      <div className={styles.resultsInfo}>
        <p>Total de {contas.length} conta{contas.length !== 1 ? 's' : ''}</p>
      </div>

      <TableContainer>
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Veículo</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {contas.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center">Nenhuma conta a pagar encontrada</td>
              </tr>
            ) : (
              contas.map((conta) => (
                <tr key={conta.id}>
                  <td>
                    <strong>{conta.descricao}</strong>
                    {conta.observacao && <small className="text-muted block">{conta.observacao}</small>}
                  </td>
                  <td>{getCategoriaLabel(conta.categoria)}</td>
                  <td>{conta.fornecedor || '-'}</td>
                  <td>{conta.veiculo_placa || '-'}</td>
                  <td>{formatDate(conta.data_vencimento)}</td>
                  <td className="text-right">
                    <strong>{formatCurrency(conta.valor)}</strong>
                  </td>
                  <td>
                    <StatusPill status={getStatusVariant(conta.status)}>
                      {getStatusLabel(conta.status)}
                    </StatusPill>
                  </td>
                  <td className={styles.actionsCell}>
                    <Link to={`/financeiro/contas-a-pagar/${conta.id}/editar`} className={`${styles.actionBtn} ${styles.view}`} title="Editar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </Link>
                    <button
                      className={`${styles.actionBtn} ${styles.delete}`}
                      title="Excluir"
                      onClick={() => handleDelete(conta.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );
}

export default ContasPagarList;
