import { useState, useEffect, useRef, useCallback } from 'react';
import { conciliacaoAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './ConciliacaoBancaria.css';

function formatCurrency(value) {
  if (value === undefined || value === null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

function ConciliacaoBancaria() {
  const [transacoes, setTransacoes] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [contasPagar, setContasPagar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filtros, setFiltros] = useState({
    conciliado: '',
    tipo: '',
    busca: '',
    data_inicio: '',
    data_fim: ''
  });
  const [previewTransacoes, setPreviewTransacoes] = useState([]);
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const fileInputRef = useRef(null);

  const loadDados = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filtros.conciliado !== '') params.conciliado = filtros.conciliado;
      if (filtros.tipo) params.tipo = filtros.tipo;
      if (filtros.busca) params.busca = filtros.busca;
      if (filtros.data_inicio) params.data_inicio = filtros.data_inicio;
      if (filtros.data_fim) params.data_fim = filtros.data_fim;

      const [txResponse, faturasResponse, contasResponse] = await Promise.all([
        conciliacaoAPI.transacoes.list(params),
        conciliacaoAPI.faturas.list({ status: 'enviada' }),
        conciliacaoAPI.contasPagar.list({ status: 'pendente' })
      ]);

      setTransacoes(txResponse.results || txResponse);
      setFaturas(faturasResponse.results || faturasResponse);
      setContasPagar(contasResponse.results || contasResponse);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    loadDados();
  }, [loadDados]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArquivoSelecionado(file);
    setUploadLoading(true);
    setError(null);
    setSuccess(null);
    setPreviewTransacoes([]);

    try {
      const data = await conciliacaoAPI.transacoes.upload(file);
      setPreviewTransacoes(data.transacoes || []);
      setSuccess(`${data.quantidade} transações detectadas em ${data.arquivo}. Clique em Importar para salvar.`);
    } catch (err) {
      setError(err.message || 'Erro ao processar arquivo');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleImportar = async () => {
    if (!arquivoSelecionado) return;
    setUploadLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await conciliacaoAPI.transacoes.importar(arquivoSelecionado);
      setPreviewTransacoes([]);
      setArquivoSelecionado(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess(`${data.quantidade} transações importadas com sucesso.`);
      await loadDados();
    } catch (err) {
      setError(err.message || 'Erro ao importar transações');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleVincular = async (transacaoId, tipo, id) => {
    try {
      setLoading(true);
      setError(null);
      const payload = tipo === 'fatura' ? { fatura_id: id } : { conta_pagar_id: id };
      await conciliacaoAPI.transacoes.vincular(transacaoId, payload);
      setSuccess('Transação vinculada com sucesso.');
      await loadDados();
    } catch (err) {
      setError(err.message || 'Erro ao vincular transação');
    } finally {
      setLoading(false);
    }
  };

  const handleDesvincular = async (transacaoId) => {
    try {
      setLoading(true);
      setError(null);
      await conciliacaoAPI.transacoes.desvincular(transacaoId);
      setSuccess('Transação desvinculada com sucesso.');
      await loadDados();
    } catch (err) {
      setError(err.message || 'Erro ao desvincular transação');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const handleBuscar = (e) => {
    e.preventDefault();
    loadDados();
  };

  const totalCreditos = transacoes
    .filter(t => t.tipo === 'credito')
    .reduce((acc, t) => acc + Number(t.valor), 0);
  const totalDebitos = transacoes
    .filter(t => t.tipo === 'debito')
    .reduce((acc, t) => acc + Number(t.valor), 0);

  return (
    <div className="conciliacao-container">
      <PageHeader title="Conciliação Bancária" subtitle="Importe extratos e vincule transações a faturas e contas a pagar" />

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
      {success && (
        <div className="success-message">
          {success}
          <button onClick={() => setSuccess(null)} aria-label="Fechar">×</button>
        </div>
      )}

      <section className="card upload-section">
        <h2>Importar Extrato Bancário</h2>
        <p className="hint">Arquivos suportados: OFX, QFX ou CSV.</p>
        <div className="upload-row">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ofx,.qfx,.csv"
            onChange={handleFileChange}
            disabled={uploadLoading}
          />
          {previewTransacoes.length > 0 && (
            <button
              className="btn-primary"
              onClick={handleImportar}
              disabled={uploadLoading}
            >
              {uploadLoading ? 'Importando...' : `Importar ${previewTransacoes.length} transações`}
            </button>
          )}
        </div>
        {uploadLoading && <Loading size="small" />}

        {previewTransacoes.length > 0 && (
          <div className="preview-table">
            <h3>Pré-visualização</h3>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {previewTransacoes.slice(0, 10).map((tx, idx) => (
                  <tr key={idx}>
                    <td>{formatDate(tx.data)}</td>
                    <td>{tx.descricao}</td>
                    <td>{tx.tipo === 'credito' ? 'Crédito' : 'Débito'}</td>
                    <td className={tx.tipo === 'credito' ? 'valor-credito' : 'valor-debito'}>
                      {formatCurrency(tx.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewTransacoes.length > 10 && (
              <p className="hint">...e mais {previewTransacoes.length - 10} transações.</p>
            )}
          </div>
        )}
      </section>

      <section className="card filtros-section">
        <form onSubmit={handleBuscar} className="filtros-row">
          <div className="filtro-group">
            <label htmlFor="busca">Buscar</label>
            <input
              id="busca"
              name="busca"
              type="text"
              placeholder="Descrição..."
              value={filtros.busca}
              onChange={handleFiltroChange}
            />
          </div>
          <div className="filtro-group">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" value={filtros.tipo} onChange={handleFiltroChange}>
              <option value="">Todos</option>
              <option value="credito">Crédito</option>
              <option value="debito">Débito</option>
            </select>
          </div>
          <div className="filtro-group">
            <label htmlFor="conciliado">Conciliação</label>
            <select id="conciliado" name="conciliado" value={filtros.conciliado} onChange={handleFiltroChange}>
              <option value="">Todas</option>
              <option value="true">Conciliadas</option>
              <option value="false">Pendentes</option>
            </select>
          </div>
          <div className="filtro-group">
            <label htmlFor="data_inicio">De</label>
            <input id="data_inicio" name="data_inicio" type="date" value={filtros.data_inicio} onChange={handleFiltroChange} />
          </div>
          <div className="filtro-group">
            <label htmlFor="data_fim">Até</label>
            <input id="data_fim" name="data_fim" type="date" value={filtros.data_fim} onChange={handleFiltroChange} />
          </div>
          <button type="submit" className="btn-primary">Buscar</button>
        </form>

        <div className="resumo-cards">
          <div className="resumo-card">
            <span className="resumo-label">Total Créditos</span>
            <span className="resumo-valor valor-credito">{formatCurrency(totalCreditos)}</span>
          </div>
          <div className="resumo-card">
            <span className="resumo-label">Total Débitos</span>
            <span className="resumo-valor valor-debito">{formatCurrency(totalDebitos)}</span>
          </div>
          <div className="resumo-card">
            <span className="resumo-label">Saldo</span>
            <span className={`resumo-valor ${totalCreditos - totalDebitos >= 0 ? 'valor-credito' : 'valor-debito'}`}>
              {formatCurrency(totalCreditos - totalDebitos)}
            </span>
          </div>
        </div>
      </section>

      <section className="card transacoes-section">
        <h2>Transações</h2>
        {loading && transacoes.length === 0 ? (
          <Loading />
        ) : transacoes.length === 0 ? (
          <p className="empty-message">Nenhuma transação encontrada.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Origem</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Vínculo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {transacoes.map(tx => (
                  <tr key={tx.id} className={tx.conciliado ? 'conciliada' : 'pendente'}>
                    <td>{formatDate(tx.data)}</td>
                    <td>{tx.descricao}</td>
                    <td>{tx.arquivo_origem}</td>
                    <td>{tx.tipo === 'credito' ? 'Crédito' : 'Débito'}</td>
                    <td className={tx.tipo === 'credito' ? 'valor-credito' : 'valor-debito'}>
                      {formatCurrency(tx.valor)}
                    </td>
                    <td>
                      <span className={`badge ${tx.conciliado ? 'badge-success' : 'badge-warning'}`}>
                        {tx.conciliado ? 'Conciliada' : 'Pendente'}
                      </span>
                    </td>
                    <td>
                      {tx.fatura_id ? (
                        <span className="vinculo-info">Fatura: {tx.fatura_numero}</span>
                      ) : tx.conta_pagar_id ? (
                        <span className="vinculo-info">Conta: {tx.conta_pagar_descricao}</span>
                      ) : (
                        <span className="vinculo-vazio">—</span>
                      )}
                    </td>
                    <td>
                      {!tx.conciliado && tx.tipo === 'credito' && faturas.length > 0 && (
                        <select
                          className="vinculo-select"
                          value=""
                          onChange={(e) => handleVincular(tx.id, 'fatura', e.target.value)}
                        >
                          <option value="">Vincular fatura...</option>
                          {faturas.map(f => (
                            <option key={f.id} value={f.id}>
                              {f.numero} - {formatCurrency(f.valor_total)}
                            </option>
                          ))}
                        </select>
                      )}
                      {!tx.conciliado && tx.tipo === 'debito' && contasPagar.length > 0 && (
                        <select
                          className="vinculo-select"
                          value=""
                          onChange={(e) => handleVincular(tx.id, 'conta_pagar', e.target.value)}
                        >
                          <option value="">Vincular conta...</option>
                          {contasPagar.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.descricao} - {formatCurrency(c.valor)}
                            </option>
                          ))}
                        </select>
                      )}
                      {tx.conciliado && (
                        <button
                          className="btn-link"
                          onClick={() => handleDesvincular(tx.id)}
                          disabled={loading}
                        >
                          Desvincular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default ConciliacaoBancaria;
