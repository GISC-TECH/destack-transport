import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tabelaFreteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import Card from '../Common/Card';
import styles from './TabelaFrete.module.css';

function TabelasFreteList() {
  const toast = useToast();
  const [tabelas, setTabelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({ q: '' });
  const [simulacao, setSimulacao] = useState(null);
  const [simulando, setSimulando] = useState(false);

  const [simData, setSimData] = useState({
    origem_uf: '',
    origem_cidade: '',
    destino_uf: '',
    destino_cidade: '',
    tipo_veiculo: '',
    distancia_km: '',
    peso_kg: '',
    volume_m3: ''
  });

  useEffect(() => {
    loadTabelas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTabelas = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await tabelaFreteAPI.list(filtros);
      setTabelas(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar tabelas:', err);
      setError('Erro ao carregar tabelas de frete. Tente novamente.');
      setTabelas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = (e) => {
    e.preventDefault();
    loadTabelas();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tabela de frete?')) return;
    try {
      await tabelaFreteAPI.delete(id);
      toast.success('Tabela de frete excluída com sucesso!');
      loadTabelas();
    } catch (err) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const handleSimular = async (e) => {
    e.preventDefault();
    setSimulando(true);
    try {
      const result = await tabelaFreteAPI.simular({
        ...simData,
        distancia_km: parseFloat(simData.distancia_km) || 0,
        peso_kg: parseFloat(simData.peso_kg) || 0,
        volume_m3: parseFloat(simData.volume_m3) || 0
      });
      setSimulacao(result);
    } catch (err) {
      toast.error(err.message);
      setSimulacao(null);
    } finally {
      setSimulando(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading && tabelas.length === 0) return <Loading message="Carregando tabelas de frete..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadTabelas} />;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Tabela de Frete"
        subtitle="Cadastro de rotas e simulação de custo"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Tabela de Frete' }]}
        actions={
          <Button variant="primary" as={Link} to="/tabelas-frete/nova">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova Tabela
          </Button>
        }
      />

      <Card title="Simular Frete" style={{ marginBottom: 24 }}>
        <form onSubmit={handleSimular}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="sim_origem_uf">Origem UF</label>
              <input id="sim_origem_uf" type="text" maxLength="2" value={simData.origem_uf} onChange={e => setSimData({ ...simData, origem_uf: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="sim_origem_cidade">Origem Cidade</label>
              <input id="sim_origem_cidade" type="text" value={simData.origem_cidade} onChange={e => setSimData({ ...simData, origem_cidade: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="sim_destino_uf">Destino UF</label>
              <input id="sim_destino_uf" type="text" maxLength="2" value={simData.destino_uf} onChange={e => setSimData({ ...simData, destino_uf: e.target.value })} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="sim_destino_cidade">Destino Cidade</label>
              <input id="sim_destino_cidade" type="text" value={simData.destino_cidade} onChange={e => setSimData({ ...simData, destino_cidade: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="sim_tipo_veiculo">Tipo Veículo</label>
              <input id="sim_tipo_veiculo" type="text" value={simData.tipo_veiculo} onChange={e => setSimData({ ...simData, tipo_veiculo: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="sim_distancia_km">Distância (KM)</label>
              <input id="sim_distancia_km" type="number" value={simData.distancia_km} onChange={e => setSimData({ ...simData, distancia_km: e.target.value })} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="sim_peso_kg">Peso (KG)</label>
              <input id="sim_peso_kg" type="number" value={simData.peso_kg} onChange={e => setSimData({ ...simData, peso_kg: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="sim_volume_m3">Volume (M³)</label>
              <input id="sim_volume_m3" type="number" value={simData.volume_m3} onChange={e => setSimData({ ...simData, volume_m3: e.target.value })} />
            </div>
            <div className={styles.formGroup} style={{ display: 'flex', alignItems: 'end' }}>
              <Button type="submit" variant="primary" loading={simulando}>
                {simulando ? 'Simulando...' : 'Simular Frete'}
              </Button>
            </div>
          </div>
        </form>

        {simulacao && (
          <div className={styles.simulacaoResult}>
            <h4>Resultado da Simulação</h4>
            <p>{simulacao.origem} → {simulacao.destino}</p>
            <div className={styles.simulacaoValue}>{formatCurrency(simulacao.valor_frete)}</div>
            <small>Valor por KM: {formatCurrency(simulacao.valor_por_km)} | Mínimo: {formatCurrency(simulacao.valor_minimo)}</small>
          </div>
        )}
      </Card>

      <Card title="Filtros">
        <form onSubmit={handleFiltrar} className={styles.filtrosForm}>
          <div className={styles.filtrosRow}>
            <input
              type="text"
              placeholder="Buscar por cidade, UF, tipo de veículo..."
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            />
            <Button type="submit" variant="primary">Filtrar</Button>
          </div>
        </form>
      </Card>

      <div className={styles.listCard}>
        <TableContainer>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Origem</th>
                <th>Destino</th>
                <th>Tipo Veículo</th>
                <th>Valor/KM</th>
                <th>Mínimo</th>
                <th>Tonelada</th>
                <th>M³</th>
                <th>Vigência</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tabelas.length === 0 ? (
                <tr>
                  <td colSpan="10" className={styles.textCenter}>
                    <div className={styles.emptyState}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                      <p>Nenhuma tabela de frete encontrada.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tabelas.map(t => (
                  <tr key={t.id}>
                    <td>{t.origem_cidade}/{t.origem_uf}</td>
                    <td>{t.destino_cidade}/{t.destino_uf}</td>
                    <td>{t.tipo_veiculo || '-'}</td>
                    <td>{formatCurrency(t.valor_por_km)}</td>
                    <td>{formatCurrency(t.valor_minimo)}</td>
                    <td>{t.valor_tonelada ? formatCurrency(t.valor_tonelada) : '-'}</td>
                    <td>{t.valor_m3 ? formatCurrency(t.valor_m3) : '-'}</td>
                    <td>{formatDate(t.vigencia_inicio)} {t.vigencia_fim ? `→ ${formatDate(t.vigencia_fim)}` : ''}</td>
                    <td>
                      <StatusPill status={t.ativo ? 'ativo' : 'inativo'}>
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </StatusPill>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          as={Link}
                          to={`/tabelas-frete/${t.id}`}
                          title="Editar"
                          aria-label="Editar"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          iconOnly
                          onClick={() => handleDelete(t.id)}
                          title="Excluir"
                          aria-label="Excluir"
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

        {tabelas.map(t => (
          <div key={t.id} className={styles.mobileCard}>
            <div className={styles.mobileRow}>
              <span><strong>{t.origem_cidade}/{t.origem_uf}</strong></span>
              <span>{formatCurrency(t.valor_por_km)}/km</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Destino</span>
              <span>{t.destino_cidade}/{t.destino_uf}</span>
            </div>
            <div className={styles.mobileRow}>
              <span className={styles.mobileLabel}>Tipo</span>
              <span>{t.tipo_veiculo || '-'}</span>
            </div>
            <div className={styles.mobileRow} style={{ marginTop: 12 }}>
              <Button variant="primary" size="sm" as={Link} to={`/tabelas-frete/${t.id}`}>Editar</Button>
              <Button variant="secondary" size="sm" onClick={() => handleDelete(t.id)}>Excluir</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TabelasFreteList;
