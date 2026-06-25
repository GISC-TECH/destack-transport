import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { conciliacaoAPI, clientesAPI, cteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import { SkeletonTable, SkeletonMobileCards } from '../Common/Skeleton';
import EmptyState from '../Common/EmptyState';
import ErrorMessage from '../Common/ErrorMessage';
import './Faturas.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

function statusClass(status) {
  switch (status) {
    case 'paga': return 'badge-success';
    case 'enviada': return 'badge-info';
    case 'atrasada': return 'badge-danger';
    case 'cancelada': return 'badge-secondary';
    default: return 'badge-warning';
  }
}

function FaturasList() {
  const navigate = useNavigate();
  const toast = useToast();

  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null });

  const defaultDates = (() => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return {
      data_inicio: inicio.toISOString().split('T')[0],
      data_fim: fim.toISOString().split('T')[0]
    };
  })();

  const [filtros, setFiltros] = useState({
    status: '',
    busca: '',
    data_inicio: defaultDates.data_inicio,
    data_fim: defaultDates.data_fim
  });

  // Modal de geração em lote
  const [showLoteModal, setShowLoteModal] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [ctes, setCtes] = useState([]);
  const [lote, setLote] = useState({
    cliente: '',
    data_vencimento: '',
    observacao: '',
    cte_ids: []
  });
  const [loadingModal, setLoadingModal] = useState(false);
  const [gerandoLote, setGerandoLote] = useState(false);

  const fetchPage = async (url) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Erro ao carregar faturas');
      const data = await response.json();
      setFaturas(data.results || data);
      setPagination({
        count: data.count ?? data.length ?? 0,
        next: data.next,
        previous: data.previous
      });
    } catch (err) {
      setError(err.message || 'Erro ao carregar faturas');
      setFaturas([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFaturas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== '')
      );
      const data = await conciliacaoAPI.faturas.list(params);
      setFaturas(data.results || data);
      setPagination({
        count: data.count ?? data.length ?? 0,
        next: data.next,
        previous: data.previous
      });
    } catch (err) {
      setError(err.message || 'Erro ao carregar faturas');
      setFaturas([]);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    loadFaturas();
  }, [loadFaturas]);

  const handleFiltroChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  const handleDateFilterChange = (newFiltros) => {
    setFiltros(prev => ({
      ...prev,
      data_inicio: newFiltros.data_inicio,
      data_fim: newFiltros.data_fim
    }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta fatura?')) return;
    try {
      await conciliacaoAPI.faturas.delete(id);
      toast.success('Fatura excluída com sucesso!');
      loadFaturas();
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir fatura');
    }
  };

  const openLoteModal = async () => {
    setShowLoteModal(true);
    setLoadingModal(true);
    setLote({ cliente: '', data_vencimento: '', observacao: '', cte_ids: [] });
    try {
      const [clientesData, ctesData] = await Promise.all([
        clientesAPI.list({ ativo: true }),
        cteAPI.list({ nao_faturado: true, pago: false, page_size: 100 })
      ]);
      setClientes(clientesData.results || clientesData);
      setCtes(ctesData.results || ctesData);
    } catch {
      toast.error('Erro ao carregar dados para geração em lote');
    } finally {
      setLoadingModal(false);
    }
  };

  const toggleCte = (cteId) => {
    setLote(prev => ({
      ...prev,
      cte_ids: prev.cte_ids.includes(cteId)
        ? prev.cte_ids.filter(id => id !== cteId)
        : [...prev.cte_ids, cteId]
    }));
  };

  const handleGerarLote = async (e) => {
    e.preventDefault();
    if (!lote.cliente || !lote.data_vencimento || lote.cte_ids.length === 0) {
      toast.error('Preencha cliente, data de vencimento e selecione ao menos um CT-e.');
      return;
    }
    try {
      setGerandoLote(true);
      await conciliacaoAPI.faturas.gerarLote({
        cliente: lote.cliente,
        data_vencimento: lote.data_vencimento,
        observacao: lote.observacao,
        cte_ids: lote.cte_ids
      });
      toast.success('Fatura gerada com sucesso!');
      setShowLoteModal(false);
      loadFaturas();
    } catch (err) {
      toast.error(err.message || 'Erro ao gerar fatura em lote');
    } finally {
      setGerandoLote(false);
    }
  };

  const faturaIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="12" y1="18" x2="12" y2="12"></line>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>
  );

  const headerActions = (
    <div className="header-actions">
      <button className="btn btn-secondary" onClick={openLoteModal}>
        Gerar em Lote
      </button>
      <button className="btn btn-primary" onClick={() => navigate('/faturas/nova')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Nova Fatura
      </button>
    </div>
  );

  if (error) {
    return (
      <div className="faturas-list">
        <PageHeader
          title="Faturas"
          subtitle="Contas a Receber"
          icon={faturaIcon}
          breadcrumbs={[{ label: 'Financeiro' }, { label: 'Faturas' }]}
          actions={headerActions}
        />
        <ErrorMessage message={error} onRetry={loadFaturas} />
      </div>
    );
  }

  return (
    <div className="faturas-list">
      <PageHeader
        title="Faturas"
        subtitle={`${pagination.count} registros`}
        icon={faturaIcon}
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Faturas' }]}
        actions={headerActions}
      />

      <div className="filtros-container">
        <input
          type="text"
          className="input-filter"
          placeholder="Buscar por número, cliente ou observação..."
          value={filtros.busca}
          onChange={(e) => handleFiltroChange('busca', e.target.value)}
        />

        <select
          className="select-filter"
          value={filtros.status}
          onChange={(e) => handleFiltroChange('status', e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="enviada">Enviada</option>
          <option value="paga">Paga</option>
          <option value="atrasada">Atrasada</option>
          <option value="cancelada">Cancelada</option>
        </select>

        <DateFilter
          onFilterChange={handleDateFilterChange}
          initialDataInicio={filtros.data_inicio}
          initialDataFim={filtros.data_fim}
          showPeriodButtons={false}
        />

        <button className="btn btn-outline" onClick={loadFaturas}>
          Buscar
        </button>
      </div>

      {loading ? (
        <>
          <div className="table-container desktop-only">
            <SkeletonTable rows={5} columns={7} />
          </div>
          <div className="mobile-only">
            <SkeletonMobileCards count={4} />
          </div>
        </>
      ) : faturas.length === 0 ? (
        <EmptyState
          title="Nenhuma fatura encontrada"
          description="Ajuste os filtros ou crie uma nova fatura."
        />
      ) : (
        <>
          <div className="table-container desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Emissão</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Valor Total</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((f) => (
                  <tr key={f.id}>
                    <td><strong>{f.numero}</strong></td>
                    <td>{f.cliente_nome || '-'}</td>
                    <td>{formatDate(f.data_emissao)}</td>
                    <td>{formatDate(f.data_vencimento)}</td>
                    <td>
                      <span className={`badge ${statusClass(f.status)}`}>
                        {f.status}
                      </span>
                    </td>
                    <td>{formatCurrency(f.valor_total)}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => navigate(`/faturas/${f.id}/editar`)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(f.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-only mobile-cards">
            {faturas.map((f) => (
              <div key={f.id} className="mobile-card">
                <div className="mobile-card-header">
                  <span className="mobile-card-title">{f.numero}</span>
                  <span className={`badge ${statusClass(f.status)}`}>{f.status}</span>
                </div>
                <div className="mobile-card-body">
                  <p><strong>Cliente:</strong> {f.cliente_nome || '-'}</p>
                  <p><strong>Vencimento:</strong> {formatDate(f.data_vencimento)}</p>
                  <p><strong>Valor:</strong> {formatCurrency(f.valor_total)}</p>
                </div>
                <div className="mobile-card-actions">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => navigate(`/faturas/${f.id}/editar`)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(f.id)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button
              className="btn btn-outline"
              onClick={() => pagination.previous && fetchPage(pagination.previous)}
              disabled={!pagination.previous}
            >
              Anterior
            </button>
            <span>{pagination.count} registros</span>
            <button
              className="btn btn-outline"
              onClick={() => pagination.next && fetchPage(pagination.next)}
              disabled={!pagination.next}
            >
              Próximo
            </button>
          </div>
        </>
      )}

      {showLoteModal && (
        <div className="modal-overlay" onClick={() => setShowLoteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Gerar Fatura em Lote</h3>
              <button className="modal-close" onClick={() => setShowLoteModal(false)}>×</button>
            </div>
            <form onSubmit={handleGerarLote}>
              <div className="form-group">
                <label>Cliente *</label>
                <select
                  value={lote.cliente}
                  onChange={(e) => setLote(prev => ({ ...prev, cliente: e.target.value }))}
                  required
                >
                  <option value="">Selecione o cliente</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razao_social}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Data de Vencimento *</label>
                  <input
                    type="date"
                    value={lote.data_vencimento}
                    onChange={(e) => setLote(prev => ({ ...prev, data_vencimento: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Observação</label>
                <textarea
                  rows="2"
                  value={lote.observacao}
                  onChange={(e) => setLote(prev => ({ ...prev, observacao: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>CT-es disponíveis *</label>
                {loadingModal ? (
                  <p>Carregando...</p>
                ) : ctes.length === 0 ? (
                  <p>Nenhum CT-e disponível para faturamento.</p>
                ) : (
                  <div className="cte-checkbox-list">
                    {ctes.map(cte => (
                      <label key={cte.id} className="cte-checkbox">
                        <input
                          type="checkbox"
                          checked={lote.cte_ids.includes(cte.id)}
                          onChange={() => toggleCte(cte.id)}
                        />
                        <span>
                          CT-e {cte.numero_cte || cte.chave?.slice(-8)} - {cte.remetente_nome || '-'} → {cte.destinatario_nome || '-'} ({formatCurrency(cte.valor_total)})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowLoteModal(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={gerandoLote || lote.cte_ids.length === 0}
                >
                  {gerandoLote ? 'Gerando...' : 'Gerar Fatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FaturasList;
