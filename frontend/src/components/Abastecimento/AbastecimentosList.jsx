import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { abastecimentoAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import TableContainer from '../Common/TableContainer';
import tokens from '../../styles/tokens.module.css';
import styles from './AbastecimentosList.module.css';

function AbastecimentosList() {
  const toast = useToast();
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    veiculo: '',
    tipo_combustivel: '',
    q: ''
  });

  useEffect(() => {
    loadAbastecimentos();
    loadVeiculos();
    loadResumo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAbastecimentos = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const result = await abastecimentoAPI.list(params);
      setAbastecimentos(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar abastecimentos:', err);
      setError('Erro ao carregar abastecimentos. Tente novamente.');
      setAbastecimentos([]);
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

  const loadResumo = async () => {
    try {
      const result = await abastecimentoAPI.resumo();
      setResumo(result);
    } catch (err) {
      console.error('Erro ao carregar resumo:', err);
      setResumo([]);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    loadAbastecimentos();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este abastecimento?')) return;
    try {
      await abastecimentoAPI.delete(id);
      toast.success('Abastecimento excluído com sucesso!');
      loadAbastecimentos();
      loadResumo();
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

  const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined) return '-';
    return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const getCombustivelLabel = (tipo) => {
    const map = {
      'diesel': 'Diesel',
      'diesel_s10': 'Diesel S10',
      'arla': 'Arla 32',
      'gasolina': 'Gasolina',
      'etanol': 'Etanol',
      'gnv': 'GNV',
      'outros': 'Outros'
    };
    return map[tipo] || tipo;
  };

  const totalGeral = abastecimentos.reduce((acc, a) => acc + (parseFloat(a.valor_total) || 0), 0);
  const totalLitros = abastecimentos.reduce((acc, a) => acc + (parseFloat(a.litros) || 0), 0);

  if (loading && abastecimentos.length === 0) return <Loading message="Carregando abastecimentos..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadAbastecimentos} />;

  return (
    <div className={styles.abastecimentoPage}>
      <PageHeader
        title="Abastecimentos"
        subtitle="Controle de combustível e consumo da frota"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Abastecimentos' }]}
        actions={
          <Button as={Link} to="/abastecimentos/novo" variant="primary" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Novo Abastecimento
          </Button>
        }
      />

      <div className={styles.finKpiGrid}>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.infoLight, color: tokens.infoColor }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
              <circle cx="7" cy="17" r="2"></circle>
              <path d="M9 17h6"></path>
              <circle cx="17" cy="17" r="2"></circle>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <div className={styles.finKpiLabel}>Total de Abastecimentos</div>
            <div className={styles.finKpiValue}>{abastecimentos.length}</div>
          </div>
        </div>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.warningLight, color: tokens.warningColor }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20"></path>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <div className={styles.finKpiLabel}>Total Litros</div>
            <div className={styles.finKpiValue}>{formatNumber(totalLitros)}L</div>
          </div>
        </div>
        <div className={styles.finKpiCard}>
          <div className={styles.finKpiIcon} style={{ background: tokens.successLight, color: tokens.successColor }}>
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
        <div className={`${styles.finKpiCard} ${styles.principal}`}>
          <div className={styles.finKpiIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <div className={styles.finKpiContent}>
            <div className={styles.finKpiLabel}>Veículos Abastecidos</div>
            <div className={styles.finKpiValue}>{resumo.length}</div>
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
              value={filtros.tipo_combustivel}
              onChange={(e) => setFiltros({ ...filtros, tipo_combustivel: e.target.value })}
            >
              <option value="">Todos os combustíveis</option>
              <option value="diesel">Diesel</option>
              <option value="diesel_s10">Diesel S10</option>
              <option value="arla">Arla 32</option>
              <option value="gasolina">Gasolina</option>
              <option value="etanol">Etanol</option>
              <option value="gnv">GNV</option>
              <option value="outros">Outros</option>
            </select>
            <input
              type="text"
              placeholder="Buscar por posto, observação..."
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            />
            <Button type="submit" variant="primary">Filtrar</Button>
          </div>
        </form>
      </div>

      <div className={styles.abastecimentoListCard}>
        <TableContainer mobileCards={false}>
          <table className={styles.abastecimentoTable}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Veículo</th>
                <th>Combustível</th>
                <th>Litros</th>
                <th>Valor Total</th>
                <th>Preço/L</th>
                <th>KM</th>
                <th>Consumo</th>
                <th>Posto</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {abastecimentos.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center">
                    <div className={styles.osEmptyState}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
                        <circle cx="7" cy="17" r="2"></circle>
                        <path d="M9 17h6"></path>
                        <circle cx="17" cy="17" r="2"></circle>
                      </svg>
                      <p>Nenhum abastecimento encontrado.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                abastecimentos.map(item => (
                  <tr key={item.id}>
                    <td>{formatDate(item.data)}</td>
                    <td><strong>{item.veiculo_placa || '-'}</strong></td>
                    <td>{getCombustivelLabel(item.tipo_combustivel)}</td>
                    <td>{formatNumber(item.litros)}L</td>
                    <td>{formatCurrency(item.valor_total)}</td>
                    <td>{formatCurrency(item.preco_litro)}</td>
                    <td>{item.hodometro?.toLocaleString('pt-BR') || '-'}</td>
                    <td>{item.consumo_medio ? `${item.consumo_medio} km/l` : '-'}</td>
                    <td>{item.posto || '-'}</td>
                    <td>
                      <div className={styles.osActions}>
                        <Link to={`/abastecimentos/${item.id}`} className={styles.btnIcon} title="Editar">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </Link>
                        <Button
                          variant="ghost"
                          iconOnly
                          className={styles.btnIcon}
                          onClick={() => handleDelete(item.id)}
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

        {abastecimentos.map(item => (
          <div key={item.id} className={styles.abastecimentoMobileCard}>
            <div className={styles.abastecimentoMobileRow}>
              <span><strong>{item.veiculo_placa || '-'}</strong></span>
              <span>{formatDate(item.data)}</span>
            </div>
            <div className={styles.abastecimentoMobileRow}>
              <span className={styles.abastecimentoMobileLabel}>Combustível</span>
              <span>{getCombustivelLabel(item.tipo_combustivel)}</span>
            </div>
            <div className={styles.abastecimentoMobileRow}>
              <span className={styles.abastecimentoMobileLabel}>Litros</span>
              <span>{formatNumber(item.litros)}L</span>
            </div>
            <div className={styles.abastecimentoMobileRow}>
              <span className={styles.abastecimentoMobileLabel}>Valor</span>
              <span>{formatCurrency(item.valor_total)}</span>
            </div>
            <div className={styles.abastecimentoMobileRow}>
              <span className={styles.abastecimentoMobileLabel}>Consumo</span>
              <span>{item.consumo_medio ? `${item.consumo_medio} km/l` : '-'}</span>
            </div>
            <div className={styles.abastecimentoMobileRow} style={{ marginTop: 12 }}>
              <Button as={Link} to={`/abastecimentos/${item.id}`} variant="primary" size="sm">Editar</Button>
              <Button variant="secondary" size="sm" onClick={() => handleDelete(item.id)}>
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AbastecimentosList;
