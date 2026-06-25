import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tabelaFreteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './TabelaFrete.css';

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
    <div className="tabela-frete-page">
      <PageHeader
        title="Tabela de Frete"
        subtitle="Cadastro de rotas e simulação de custo"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Tabela de Frete' }]}
        actions={
          <Link to="/tabelas-frete/nova" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova Tabela
          </Link>
        }
      />

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Simular Frete</h3>
        </div>
        <form onSubmit={handleSimular}>
          <div className="tabela-form-row">
            <div className="tabela-form-group">
              <label>Origem UF</label>
              <input type="text" maxLength="2" value={simData.origem_uf} onChange={e => setSimData({ ...simData, origem_uf: e.target.value })} />
            </div>
            <div className="tabela-form-group">
              <label>Origem Cidade</label>
              <input type="text" value={simData.origem_cidade} onChange={e => setSimData({ ...simData, origem_cidade: e.target.value })} />
            </div>
            <div className="tabela-form-group">
              <label>Destino UF</label>
              <input type="text" maxLength="2" value={simData.destino_uf} onChange={e => setSimData({ ...simData, destino_uf: e.target.value })} />
            </div>
          </div>
          <div className="tabela-form-row">
            <div className="tabela-form-group">
              <label>Destino Cidade</label>
              <input type="text" value={simData.destino_cidade} onChange={e => setSimData({ ...simData, destino_cidade: e.target.value })} />
            </div>
            <div className="tabela-form-group">
              <label>Tipo Veículo</label>
              <input type="text" value={simData.tipo_veiculo} onChange={e => setSimData({ ...simData, tipo_veiculo: e.target.value })} />
            </div>
            <div className="tabela-form-group">
              <label>Distância (KM)</label>
              <input type="number" value={simData.distancia_km} onChange={e => setSimData({ ...simData, distancia_km: e.target.value })} />
            </div>
          </div>
          <div className="tabela-form-row">
            <div className="tabela-form-group">
              <label>Peso (KG)</label>
              <input type="number" value={simData.peso_kg} onChange={e => setSimData({ ...simData, peso_kg: e.target.value })} />
            </div>
            <div className="tabela-form-group">
              <label>Volume (M³)</label>
              <input type="number" value={simData.volume_m3} onChange={e => setSimData({ ...simData, volume_m3: e.target.value })} />
            </div>
            <div className="tabela-form-group" style={{ display: 'flex', alignItems: 'end' }}>
              <button type="submit" className="btn-primary" disabled={simulando}>
                {simulando ? 'Simulando...' : 'Simular Frete'}
              </button>
            </div>
          </div>
        </form>

        {simulacao && (
          <div className="simulacao-result">
            <h4>Resultado da Simulação</h4>
            <p>{simulacao.origem} → {simulacao.destino}</p>
            <div className="simulacao-result-value">{formatCurrency(simulacao.valor_frete)}</div>
            <small>Valor por KM: {formatCurrency(simulacao.valor_por_km)} | Mínimo: {formatCurrency(simulacao.valor_minimo)}</small>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Filtros</h3>
        </div>
        <form onSubmit={handleFiltrar} className="filtros-form">
          <div className="filtros-row">
            <input
              type="text"
              placeholder="Buscar por cidade, UF, tipo de veículo..."
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
            />
            <button type="submit" className="btn-primary">Filtrar</button>
          </div>
        </form>
      </div>

      <div className="tabela-list-card">
        <table className="tabela-table">
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
                <td colSpan="10" className="text-center">
                  <div className="os-empty-state">
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
                    {t.ativo ? (
                      <span className="badge badge-success">Ativo</span>
                    ) : (
                      <span className="badge badge-secondary">Inativo</span>
                    )}
                  </td>
                  <td>
                    <div className="os-actions">
                      <Link to={`/tabelas-frete/${t.id}`} className="btn-icon" title="Editar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </Link>
                      <button className="btn-icon" onClick={() => handleDelete(t.id)} title="Excluir">
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

        {tabelas.map(t => (
          <div key={t.id} className="tabela-mobile-card">
            <div className="tabela-mobile-row">
              <span><strong>{t.origem_cidade}/{t.origem_uf}</strong></span>
              <span>{formatCurrency(t.valor_por_km)}/km</span>
            </div>
            <div className="tabela-mobile-row">
              <span className="tabela-mobile-label">Destino</span>
              <span>{t.destino_cidade}/{t.destino_uf}</span>
            </div>
            <div className="tabela-mobile-row">
              <span className="tabela-mobile-label">Tipo</span>
              <span>{t.tipo_veiculo || '-'}</span>
            </div>
            <div className="tabela-mobile-row" style={{ marginTop: 12 }}>
              <Link to={`/tabelas-frete/${t.id}`} className="btn-primary btn-sm">Editar</Link>
              <button className="btn-secondary btn-sm" onClick={() => handleDelete(t.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TabelasFreteList;
