import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pagamentosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import './Pagamentos.css';

function PagamentosList() {
  const navigate = useNavigate();
  const toast = useToast();
  const isMountedRef = useRef(true);
  const [activeTab, setActiveTab] = useState('agregados');
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null);
  const [showGerarLote, setShowGerarLote] = useState(false);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [loteConfig, setLoteConfig] = useState({
    data_inicio: '',
    data_fim: '',
    tipo: 'agregados',
    percentual: ''
  });
  // Modal de baixa rápida
  const [modalBaixa, setModalBaixa] = useState({ show: false, id: null, info: '' });
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().split('T')[0]);
  const [processandoBaixa, setProcessandoBaixa] = useState(false);

  // Modal de conversão entre agregado e próprio
  const [modalConverter, setModalConverter] = useState({ show: false, id: null, tipo: '', info: '' });
  const [convertendoPagamento, setConvertendoPagamento] = useState(false);

  // Modal de exclusão
  const [modalExcluir, setModalExcluir] = useState({ show: false, id: null, info: '' });
  const [excluindoPagamento, setExcluindoPagamento] = useState(false);
  const [dadosConversao, setDadosConversao] = useState({
    periodo: '',
    condutor_nome: '',
    condutor_cpf: '',
    cte_id: '',
    percentual_repasse: '25',
    data_prevista: new Date().toISOString().split('T')[0]
  });
  // Função para calcular datas do mês atual
  const getDefaultPagDates = () => {
    const hoje = new Date();
    const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return {
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: dataFim.toISOString().split('T')[0]
    };
  };

  const defaultDates = getDefaultPagDates();
  const [filtros, setFiltros] = useState({
    status: '',
    data_inicio: defaultDates.data_inicio,
    data_fim: defaultDates.data_fim,
    busca: ''  // Busca por número CT-e, placa ou condutor
  });

  const handleDateFilterChange = (newFiltros) => {
    setFiltros(prev => {
      const newState = {
        ...prev,
        data_inicio: newFiltros.data_inicio,
        data_fim: newFiltros.data_fim
      };
      // Carrega pagamentos com o novo estado
      loadPagamentos(newState);
      return newState;
    });
  };

  // Carrega na montagem inicial
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadPagamentos();
  }, []);

  // Cleanup on unmount to prevent race conditions
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Carrega quando muda a tab
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (filtros.data_inicio && filtros.data_fim) {
      loadPagamentos();
    }
  }, [activeTab]);

  const loadPagamentos = async (customFiltros = null) => {
    const filtrosAtivos = customFiltros || filtros;
    try {
      setLoading(true);
      setError(null);
      const params = { ...filtrosAtivos, page_size: 1000 };  // Trazer mais resultados
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

      let result;
      if (activeTab === 'agregados') {
        result = await pagamentosAPI.agregados.list(params);
      } else {
        result = await pagamentosAPI.proprios.list(params);
      }
      // Check if component is still mounted before setting state
      if (!isMountedRef.current) return;
      setPagamentos(result.results || result);
    } catch (err) {
      // Check if component is still mounted before setting state
      if (!isMountedRef.current) return;
      console.error('Erro ao carregar pagamentos:', err);
      setError('Erro ao carregar pagamentos. Tente novamente.');
      setPagamentos([]);
    } finally {
      // Check if component is still mounted before setting state
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleExport = async () => {
    try {
      const params = { ...filtros };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      if (activeTab === 'agregados') {
        await pagamentosAPI.agregados.export(params);
      } else {
        await pagamentosAPI.proprios.export(params);
      }
    } catch (err) {
      toast.error('Erro ao exportar: ' + err.message);
    }
  };

  const handleGerarLote = async () => {
    if (!loteConfig.data_inicio || !loteConfig.data_fim) {
      toast.warning('Por favor, selecione o período para geração');
      return;
    }

    if (loteConfig.tipo === 'agregados' && !loteConfig.percentual) {
      toast.warning('Por favor, informe o percentual de repasse');
      return;
    }

    const percentual = parseFloat(loteConfig.percentual);
    if (loteConfig.tipo === 'agregados' && (isNaN(percentual) || percentual <= 0 || percentual > 100)) {
      toast.warning('O percentual deve ser um número válido entre 0 e 100');
      return;
    }

    try {
      setGerandoLote(true);
      if (loteConfig.tipo === 'agregados') {
        await pagamentosAPI.agregados.gerar({
          data_inicio: loteConfig.data_inicio,
          data_fim: loteConfig.data_fim,
          percentual: percentual
        });
      } else {
        await pagamentosAPI.proprios.gerar({
          data_inicio: loteConfig.data_inicio,
          data_fim: loteConfig.data_fim
        });
      }
      toast.success('Pagamentos gerados com sucesso!');
      setShowGerarLote(false);
      loadPagamentos();
    } catch (err) {
      toast.error('Erro ao gerar pagamentos: ' + err.message);
    } finally {
      setGerandoLote(false);
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

  const getStatusBadge = (status) => {
    const statusMap = {
      'pendente': { class: 'warning', text: 'Pendente' },
      'pago': { class: 'success', text: 'Pago' },
      'atrasado': { class: 'danger', text: 'Atrasado' },
      'cancelado': { class: 'secondary', text: 'Cancelado' }
    };
    const s = statusMap[status] || { class: 'secondary', text: status };
    return <span className={`badge badge-${s.class}`}>{s.text}</span>;
  };

  const calcularTotais = () => {
    // Para agregados: valor_repassado; Para próprios: valor_total_pagar
    const getValor = (p) => {
      if (activeTab === 'agregados') {
        return parseFloat(p.valor_repassado) || 0;
      }
      return parseFloat(p.valor_total_pagar) || 0;
    };

    const total = pagamentos.reduce((acc, p) => acc + getValor(p), 0);
    const pendente = pagamentos
      .filter(p => p.status === 'pendente' || p.status === 'atrasado')
      .reduce((acc, p) => acc + getValor(p), 0);
    const pago = pagamentos
      .filter(p => p.status === 'pago')
      .reduce((acc, p) => acc + getValor(p), 0);
    return { total, pendente, pago };
  };

  const totais = calcularTotais();

  const pagamentosIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23"></line>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
  );

  const handleNovoPagamento = () => {
    if (activeTab === 'agregados') {
      navigate('/pagamentos/agregados/novo');
    } else {
      navigate('/pagamentos/proprios/novo');
    }
  };

  const handleEditarPagamento = (id) => {
    if (activeTab === 'agregados') {
      navigate(`/pagamentos/agregados/${id}/editar`);
    } else {
      navigate(`/pagamentos/proprios/${id}/editar`);
    }
  };

  // Abre modal de baixa rápida
  const handleAbrirBaixa = (pagamento) => {
    // Usa os mesmos campos para ambos (compatibilidade via serializer)
    const condutor = pagamento.condutor_nome || pagamento.motorista_nome || '';
    const placa = pagamento.placa || pagamento.veiculo_placa || '';
    const info = `CT-e #${pagamento.cte_numero || '-'} - ${condutor || placa}`;
    setDataBaixa(new Date().toISOString().split('T')[0]);
    setModalBaixa({ show: true, id: pagamento.id, info });
  };

  // Confirma a baixa com data selecionada
  const handleConfirmarBaixa = async () => {
    setProcessandoBaixa(true);
    try {
      const data = {
        status: 'pago',
        data_pagamento: dataBaixa
      };
      if (activeTab === 'agregados') {
        await pagamentosAPI.agregados.update(modalBaixa.id, data);
      } else {
        await pagamentosAPI.proprios.update(modalBaixa.id, data);
      }
      setModalBaixa({ show: false, id: null, info: '' });
      loadPagamentos(); // Recarrega a lista
    } catch (err) {
      console.error('Erro ao baixar pagamento:', err);
      toast.error('Erro ao baixar pagamento. Tente novamente.');
    } finally {
      setProcessandoBaixa(false);
    }
  };

  // Abre modal de conversão
  const handleAbrirConverter = (pagamento) => {
    const tipo = activeTab === 'agregados' ? 'agregado_para_proprio' : 'proprio_para_agregado';
    // Usa os mesmos campos para ambos (compatibilidade via serializer)
    const condutor = pagamento.condutor_nome || pagamento.motorista_nome || '';
    const placa = pagamento.placa || pagamento.veiculo_placa || '';
    const valor = pagamento.valor_repassado || pagamento.valor_base_faixa || pagamento.valor_total_pagar;
    const info = `CT-e #${pagamento.cte_numero || '-'} - ${condutor || placa} - ${formatCurrency(valor)}`;

    // Define período padrão baseado na data atual
    const hoje = new Date();
    const periodoDefault = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    setDadosConversao({
      periodo: periodoDefault,
      condutor_nome: pagamento.condutor_nome || '',
      condutor_cpf: pagamento.condutor_cpf || '',
      cte_id: '',
      percentual_repasse: '25',
      data_prevista: new Date().toISOString().split('T')[0]
    });
    setModalConverter({ show: true, id: pagamento.id, tipo, info });
  };

  // Confirma a conversão
  const handleConfirmarConversao = async () => {
    setConvertendoPagamento(true);
    try {
      if (modalConverter.tipo === 'agregado_para_proprio') {
        // Converter de agregado para próprio
        await pagamentosAPI.agregados.converterParaProprio(modalConverter.id, {
          periodo: dadosConversao.periodo
        });
        toast.success('Pagamento convertido para Próprio com sucesso!');
        setActiveTab('proprios'); // Muda para a tab de próprios
      } else {
        // Converter de próprio para agregado
        if (!dadosConversao.condutor_nome) {
          toast.warning('Nome do condutor é obrigatório.');
          setConvertendoPagamento(false);
          return;
        }
        if (!dadosConversao.cte_id) {
          toast.warning('ID do CT-e é obrigatório para converter para Agregado.');
          setConvertendoPagamento(false);
          return;
        }
        const percentualRepasse = parseFloat(dadosConversao.percentual_repasse);
        if (isNaN(percentualRepasse) || percentualRepasse <= 0 || percentualRepasse > 100) {
          toast.warning('O percentual de repasse deve ser um número válido entre 0 e 100');
          setConvertendoPagamento(false);
          return;
        }
        await pagamentosAPI.proprios.converterParaAgregado(modalConverter.id, {
          condutor_nome: dadosConversao.condutor_nome,
          condutor_cpf: dadosConversao.condutor_cpf,
          cte_id: dadosConversao.cte_id,
          percentual_repasse: percentualRepasse,
          data_prevista: dadosConversao.data_prevista
        });
        toast.success('Pagamento convertido para Agregado com sucesso!');
        setActiveTab('agregados'); // Muda para a tab de agregados
      }
      setModalConverter({ show: false, id: null, tipo: '', info: '' });
      loadPagamentos();
    } catch (err) {
      console.error('Erro ao converter pagamento:', err);
      toast.error('Erro ao converter: ' + err.message);
    } finally {
      setConvertendoPagamento(false);
    }
  };

  // Abre modal de exclusão
  const handleAbrirExcluir = (pagamento) => {
    const condutor = pagamento.condutor_nome || pagamento.motorista_nome || '';
    const placa = pagamento.placa || pagamento.veiculo_placa || '';
    const valor = pagamento.valor_repassado || pagamento.valor_base_faixa || pagamento.valor_total_pagar;
    const info = `CT-e #${pagamento.cte_numero || '-'} - ${condutor || placa} - ${formatCurrency(valor)}`;
    setModalExcluir({ show: true, id: pagamento.id, info });
  };

  // Confirma a exclusão
  const handleConfirmarExcluir = async () => {
    setExcluindoPagamento(true);
    try {
      if (activeTab === 'agregados') {
        await pagamentosAPI.agregados.delete(modalExcluir.id);
      } else {
        await pagamentosAPI.proprios.delete(modalExcluir.id);
      }
      toast.success('Pagamento excluido com sucesso!');
      setModalExcluir({ show: false, id: null, info: '' });
      loadPagamentos();
    } catch (err) {
      console.error('Erro ao excluir pagamento:', err);
      toast.error('Erro ao excluir pagamento: ' + err.message);
    } finally {
      setExcluindoPagamento(false);
    }
  };

  const headerActions = (
    <div className="header-buttons">
      <button
        className="btn btn-outline"
        onClick={handleExport}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exportar
      </button>
      <button
        className="btn btn-secondary"
        onClick={() => setShowGerarLote(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        Gerar Lote
      </button>
      <button
        className="btn btn-primary"
        onClick={handleNovoPagamento}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Novo Pagamento
      </button>
    </div>
  );

  if (loading && pagamentos.length === 0) return <Loading message="Carregando pagamentos..." />;

  return (
    <div className="pagamentos-page">
      <PageHeader
        title="Pagamentos"
        subtitle="Gerencie pagamentos de agregados e proprios"
        icon={pagamentosIcon}
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Pagamentos' }]}
        actions={headerActions}
      />

      {/* Modal de Geração em Lote */}
      {showGerarLote && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Gerar Pagamentos em Lote</h3>
              <button className="modal-close" onClick={() => setShowGerarLote(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Gere pagamentos automaticamente para todos os CT-es do período selecionado.
              </p>

              <div className="form-group">
                <label>Tipo de Pagamento</label>
                <select
                  value={loteConfig.tipo}
                  onChange={(e) => setLoteConfig({...loteConfig, tipo: e.target.value})}
                  className="select-filter"
                >
                  <option value="agregados">Agregados</option>
                  <option value="proprios">Próprios</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Data Início</label>
                  <input
                    type="date"
                    value={loteConfig.data_inicio}
                    onChange={(e) => setLoteConfig({...loteConfig, data_inicio: e.target.value})}
                    className="input-filter"
                  />
                </div>
                <div className="form-group">
                  <label>Data Fim</label>
                  <input
                    type="date"
                    value={loteConfig.data_fim}
                    onChange={(e) => setLoteConfig({...loteConfig, data_fim: e.target.value})}
                    className="input-filter"
                  />
                </div>
              </div>

              {loteConfig.tipo === 'agregados' && (
                <div className="form-group">
                  <label>Percentual de Repasse (%) *</label>
                  <input
                    type="number"
                    value={loteConfig.percentual}
                    onChange={(e) => setLoteConfig({...loteConfig, percentual: e.target.value})}
                    className="input-filter"
                    min="0.01"
                    max="100"
                    step="0.01"
                    placeholder="Ex: 25, 30, 35..."
                    required
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>Informe o percentual a ser aplicado sobre o valor do frete (0-100%)</small>
                </div>
              )}

            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowGerarLote(false)}
                disabled={gerandoLote}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleGerarLote}
                disabled={gerandoLote}
              >
                {gerandoLote ? 'Gerando...' : 'Gerar Pagamentos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Baixa Rápida */}
      {modalBaixa.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Baixar Pagamento</h3>
              <button className="modal-close" onClick={() => setModalBaixa({ show: false, id: null, info: '' })}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Confirmar baixa do pagamento:
              </p>
              <p style={{ fontWeight: '600', marginBottom: '1rem', color: '#333' }}>
                {modalBaixa.info}
              </p>

              <div className="form-group">
                <label>Data do Pagamento</label>
                <input
                  type="date"
                  value={dataBaixa}
                  onChange={(e) => setDataBaixa(e.target.value)}
                  className="input-filter"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setModalBaixa({ show: false, id: null, info: '' })}
                disabled={processandoBaixa}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmarBaixa}
                disabled={processandoBaixa || !dataBaixa}
              >
                {processandoBaixa ? 'Processando...' : 'Confirmar Baixa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conversão */}
      {modalConverter.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>
                {modalConverter.tipo === 'agregado_para_proprio'
                  ? 'Converter para Próprio'
                  : 'Converter para Agregado'}
              </h3>
              <button className="modal-close" onClick={() => setModalConverter({ show: false, id: null, tipo: '', info: '' })}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                {modalConverter.tipo === 'agregado_para_proprio'
                  ? 'Converter este pagamento de Agregado para Próprio. O registro será movido para a lista de pagamentos próprios.'
                  : 'Converter este pagamento de Próprio para Agregado. É necessário informar um CT-e para associar.'}
              </p>
              <p style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '0.9rem' }}>
                {modalConverter.info}
              </p>

              {modalConverter.tipo === 'agregado_para_proprio' ? (
                <div className="form-group">
                  <label>Período (AAAA-MM)</label>
                  <input
                    type="text"
                    value={dadosConversao.periodo}
                    onChange={(e) => setDadosConversao({...dadosConversao, periodo: e.target.value})}
                    className="input-filter"
                    placeholder="2025-01"
                    style={{ width: '100%' }}
                  />
                  <small style={{ color: '#666', fontSize: '0.8rem' }}>
                    Período para agrupar no pagamento próprio
                  </small>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>ID do CT-e *</label>
                    <input
                      type="text"
                      value={dadosConversao.cte_id}
                      onChange={(e) => setDadosConversao({...dadosConversao, cte_id: e.target.value})}
                      className="input-filter"
                      placeholder="ID do CT-e (obrigatório)"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Nome do Condutor *</label>
                      <input
                        type="text"
                        value={dadosConversao.condutor_nome}
                        onChange={(e) => setDadosConversao({...dadosConversao, condutor_nome: e.target.value})}
                        className="input-filter"
                        placeholder="Nome do condutor"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>CPF do Condutor</label>
                      <input
                        type="text"
                        value={dadosConversao.condutor_cpf}
                        onChange={(e) => setDadosConversao({...dadosConversao, condutor_cpf: e.target.value})}
                        className="input-filter"
                        placeholder="Apenas números"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Percentual Repasse (%)</label>
                      <input
                        type="number"
                        value={dadosConversao.percentual_repasse}
                        onChange={(e) => setDadosConversao({...dadosConversao, percentual_repasse: e.target.value})}
                        className="input-filter"
                        min="0"
                        max="100"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Data Prevista</label>
                      <input
                        type="date"
                        value={dadosConversao.data_prevista}
                        onChange={(e) => setDadosConversao({...dadosConversao, data_prevista: e.target.value})}
                        className="input-filter"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setModalConverter({ show: false, id: null, tipo: '', info: '' })}
                disabled={convertendoPagamento}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmarConversao}
                disabled={convertendoPagamento}
              >
                {convertendoPagamento ? 'Convertendo...' : 'Confirmar Conversão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusao */}
      {modalExcluir.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Excluir Pagamento</h3>
              <button className="modal-close" onClick={() => setModalExcluir({ show: false, id: null, info: '' })}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description" style={{ color: '#dc3545' }}>
                Tem certeza que deseja excluir este pagamento? Esta acao nao pode ser desfeita.
              </p>
              <p style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '0.9rem' }}>
                {modalExcluir.info}
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setModalExcluir({ show: false, id: null, info: '' })}
                disabled={excluindoPagamento}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmarExcluir}
                disabled={excluindoPagamento}
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              >
                {excluindoPagamento ? 'Excluindo...' : 'Confirmar Exclusao'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Total</span>
          <span className="summary-value">{formatCurrency(totais.total)}</span>
        </div>
        <div className="summary-card pendente">
          <span className="summary-label">Pendente</span>
          <span className="summary-value">{formatCurrency(totais.pendente)}</span>
        </div>
        <div className="summary-card pago">
          <span className="summary-label">Pago</span>
          <span className="summary-value">{formatCurrency(totais.pago)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'agregados' ? 'active' : ''}`}
          onClick={() => setActiveTab('agregados')}
        >
          Agregados
        </button>
        <button
          className={`tab-button ${activeTab === 'proprios' ? 'active' : ''}`}
          onClick={() => setActiveTab('proprios')}
        >
          Próprios
        </button>
      </div>

      {/* Filtros */}
      <div className="filtros-section">
        <div className="filtros-form">
          <input
            type="text"
            placeholder="Buscar por CT-e, placa ou condutor..."
            value={filtros.busca}
            onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
            onKeyDown={(e) => e.key === 'Enter' && loadPagamentos()}
            className="input-filter"
            style={{ minWidth: '250px' }}
          />
          <button
            type="button"
            onClick={() => loadPagamentos()}
            className="btn-secondary"
            style={{ padding: '8px 16px' }}
          >
            Buscar
          </button>
          <select
            value={filtros.status}
            onChange={(e) => {
              setFiltros({...filtros, status: e.target.value});
              setTimeout(loadPagamentos, 100);
            }}
            className="select-filter"
          >
            <option value="">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>
          <DateFilter
            onFilterChange={handleDateFilterChange}
            defaultPeriodo="mes"
          />
        </div>
      </div>

      <div className="results-info">
        <p>Total de {pagamentos.length} pagamento{pagamentos.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabela */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {activeTab === 'agregados' ? (
                <>
                  <th>CT-e</th>
                  <th>Condutor</th>
                  <th>Placa</th>
                  <th>Data Prevista</th>
                  <th>Valor Repasse</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </>
              ) : (
                <>
                  <th>CT-e</th>
                  <th>Condutor</th>
                  <th>Placa</th>
                  <th>Data Prevista</th>
                  <th>Valor Repasse</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {pagamentos.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center">
                  Nenhum pagamento encontrado
                </td>
              </tr>
            ) : (
              pagamentos.map((pagamento) => (
                <tr key={pagamento.id}>
                  {activeTab === 'agregados' ? (
                    <>
                      <td>
                        <strong>#{pagamento.cte_numero || '-'}</strong>
                      </td>
                      <td>{pagamento.condutor_nome || '-'}</td>
                      <td>{pagamento.placa || '-'}</td>
                      <td>{formatDate(pagamento.data_prevista)}</td>
                      <td className="text-right">
                        <strong>{formatCurrency(pagamento.valor_repassado)}</strong>
                      </td>
                      <td>{getStatusBadge(pagamento.status)}</td>
                      <td>
                        <div className="action-buttons">
                          {pagamento.status !== 'pago' && (
                            <button
                              className="btn-action btn-download"
                              onClick={() => handleAbrirBaixa(pagamento)}
                              title="Baixar Pagamento"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                              </svg>
                            </button>
                          )}
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEditarPagamento(pagamento.id)}
                            title="Editar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            className="btn-action"
                            onClick={() => handleAbrirConverter(pagamento)}
                            title="Converter para Próprio"
                            style={{ color: '#6366f1' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="17 1 21 5 17 9"></polyline>
                              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                              <polyline points="7 23 3 19 7 15"></polyline>
                              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                            </svg>
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleAbrirExcluir(pagamento)}
                            title="Excluir"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <strong>#{pagamento.cte_numero || '-'}</strong>
                      </td>
                      <td>{pagamento.condutor_nome || pagamento.motorista_nome || '-'}</td>
                      <td>{pagamento.placa || pagamento.veiculo_placa || '-'}</td>
                      <td>{formatDate(pagamento.data_prevista)}</td>
                      <td className="text-right">
                        <strong>{formatCurrency(pagamento.valor_repassado || pagamento.valor_base_faixa)}</strong>
                      </td>
                      <td>{getStatusBadge(pagamento.status)}</td>
                      <td>
                        <div className="action-buttons">
                          {pagamento.status !== 'pago' && (
                            <button
                              className="btn-action btn-download"
                              onClick={() => handleAbrirBaixa(pagamento)}
                              title="Baixar Pagamento"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                              </svg>
                            </button>
                          )}
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEditarPagamento(pagamento.id)}
                            title="Editar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            className="btn-action"
                            onClick={() => handleAbrirConverter(pagamento)}
                            title="Converter para Agregado"
                            style={{ color: '#6366f1' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="17 1 21 5 17 9"></polyline>
                              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                              <polyline points="7 23 3 19 7 15"></polyline>
                              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                            </svg>
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleAbrirExcluir(pagamento)}
                            title="Excluir"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PagamentosList;
