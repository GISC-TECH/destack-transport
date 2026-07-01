import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { pagamentosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import { SkeletonTable, SkeletonMobileCards } from '../Common/Skeleton';
import EmptyState from '../Common/EmptyState';
import PageHeader from '../Common/PageHeader';
import DateFilter from '../Common/DateFilter';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import PermissionGuard from '../Common/PermissionGuard';
import ComprovantePagamento from './ComprovantePagamento';
import styles from './PagamentosList.module.css';

function PagamentosList() {
  const navigate = useNavigate();
  const toast = useToast();
  const isMountedRef = useRef(true);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('agregados');
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [processandoBaixa, setProcessandoBaixa] = useState(false);

  // Modal de conversão entre agregado e próprio
  const [modalConverter, setModalConverter] = useState({ show: false, id: null, tipo: '', info: '' });
  const [convertendoPagamento, setConvertendoPagamento] = useState(false);

  // Modal de exclusão
  const [modalExcluir, setModalExcluir] = useState({ show: false, id: null, info: '' });
  const [excluindoPagamento, setExcluindoPagamento] = useState(false);

  // Modal de comprovante
  const [modalComprovante, setModalComprovante] = useState({ show: false, pagamento: null });

  const [dadosConversao, setDadosConversao] = useState({
    periodo: '',
    condutor_nome: '',
    condutor_cpf: '',
    cte_id: '',
    percentual_repasse: '25',
    data_prevista: new Date().toISOString().split('T')[0]
  });

  // Funcao para calcular datas baseadas no periodo
  const getDateRange = (periodo) => {
    const hoje = new Date();
    let dataInicio, dataFim;

    switch (periodo) {
      case 'hoje':
        dataInicio = new Date(hoje);
        dataFim = new Date(hoje);
        break;
      case 'mes':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case 'ano':
        dataInicio = new Date(hoje.getFullYear(), 0, 1);
        dataFim = new Date(hoje.getFullYear(), 11, 31);
        break;
      default:
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    }

    return {
      periodo: periodo,
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: dataFim.toISOString().split('T')[0]
    };
  };

  // Filtros com datas - inicializa com mes atual
  const [filtros, setFiltros] = useState(() => {
    const defaultDates = getDateRange('mes');
    return {
      status: '',
      busca: '',
      data_inicio: defaultDates.data_inicio,
      data_fim: defaultDates.data_fim
    };
  });

  const handleDateFilterChange = (newFiltros) => {
    setFiltros(prev => ({
      ...prev,
      data_inicio: newFiltros.data_inicio,
      data_fim: newFiltros.data_fim
    }));
    setPaginacao(prev => ({ ...prev, page: 1 }));
    loadPagamentos({
      ...filtros,
      data_inicio: newFiltros.data_inicio,
      data_fim: newFiltros.data_fim
    }, 1);
  };

  // Paginação
  const [paginacao, setPaginacao] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });

  const loadPagamentos = useCallback(async (customFiltros = null, customPage = null) => {
    const filtrosAtivos = customFiltros || filtros;
    const pageAtual = customPage || paginacao.page;
    try {
      setLoading(true);
      const params = {
        ...filtrosAtivos,
        page: pageAtual,
        page_size: paginacao.pageSize
      };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

      let result;
      if (activeTab === 'agregados') {
        result = await pagamentosAPI.agregados.list(params);
      } else {
        result = await pagamentosAPI.proprios.list(params);
      }
      // Check if component is still mounted before setting state
      if (!isMountedRef.current) return;

      // Atualiza pagamentos e informações de paginação
      const items = result.results || result;
      const total = result.count || items.length;
      setPagamentos(items);
      setPaginacao(prev => ({
        ...prev,
        page: pageAtual,
        total: total,
        totalPages: Math.ceil(total / prev.pageSize)
      }));
    } catch (err) {
      // Check if component is still mounted before setting state
      if (!isMountedRef.current) return;
      console.error('Erro ao carregar pagamentos:', err);
      setPagamentos([]);
    } finally {
      // Check if component is still mounted before setting state
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filtros, paginacao.pageSize]);

  // Carrega na montagem inicial
  useEffect(() => {
    loadPagamentos();
  }, [loadPagamentos]);

  // Cleanup on unmount to prevent race conditions.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Carrega quando muda a tab - reseta a página
  useEffect(() => {
    setPaginacao(prev => ({ ...prev, page: 1 }));
    loadPagamentos(null, 1);
  }, [activeTab, loadPagamentos]);

  // Muda de página
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > paginacao.totalPages) return;
    setPaginacao(prev => ({ ...prev, page: newPage }));
    loadPagamentos(null, newPage);
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
      'pendente': 'Pendente',
      'pago': 'Pago',
      'atrasado': 'Atrasado',
      'cancelado': 'Cancelado'
    };
    return <StatusPill status={status}>{statusMap[status] || status}</StatusPill>;
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
    setComprovanteFile(null);
    setModalBaixa({ show: true, id: pagamento.id, info });
  };

  // Confirma a baixa com data selecionada
  const handleConfirmarBaixa = async () => {
    setProcessandoBaixa(true);
    try {
      // Se tiver comprovante, usa FormData
      let dataToSend;
      if (comprovanteFile) {
        dataToSend = new FormData();
        dataToSend.append('status', 'pago');
        dataToSend.append('data_pagamento', dataBaixa);
        dataToSend.append('comprovante', comprovanteFile);
      } else {
        dataToSend = {
          status: 'pago',
          data_pagamento: dataBaixa
        };
      }

      if (activeTab === 'agregados') {
        await pagamentosAPI.agregados.update(modalBaixa.id, dataToSend);
      } else {
        await pagamentosAPI.proprios.update(modalBaixa.id, dataToSend);
      }
      setModalBaixa({ show: false, id: null, info: '' });
      setComprovanteFile(null);
      toast.success('Pagamento baixado com sucesso!');
      loadPagamentos(); // Recarrega a lista
    } catch (err) {
      console.error('Erro ao baixar pagamento:', err);
      toast.error('Erro ao baixar pagamento. Tente novamente.');
    } finally {
      setProcessandoBaixa(false);
    }
  };

  // Modal de reverter baixa
  const [modalReverterBaixa, setModalReverterBaixa] = useState({ show: false, id: null, info: '' });
  const [revertendoBaixa, setRevertendoBaixa] = useState(false);

  // Abre modal de reverter baixa
  const handleAbrirReverterBaixa = (pagamento) => {
    const condutor = pagamento.condutor_nome || pagamento.motorista_nome || '';
    const placa = pagamento.placa || pagamento.veiculo_placa || '';
    const info = `CT-e #${pagamento.cte_numero || '-'} - ${condutor || placa}`;
    setModalReverterBaixa({ show: true, id: pagamento.id, info });
  };

  // Confirma reversão da baixa
  const handleConfirmarReverterBaixa = async () => {
    setRevertendoBaixa(true);
    try {
      if (activeTab === 'agregados') {
        await pagamentosAPI.agregados.reverterBaixa(modalReverterBaixa.id);
      } else {
        await pagamentosAPI.proprios.reverterBaixa(modalReverterBaixa.id);
      }
      setModalReverterBaixa({ show: false, id: null, info: '' });
      toast.success('Baixa revertida com sucesso!');
      loadPagamentos();
    } catch (err) {
      console.error('Erro ao reverter baixa:', err);
      toast.error(err.message || 'Erro ao reverter baixa. Tente novamente.');
    } finally {
      setRevertendoBaixa(false);
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
      toast.success('Pagamento excluído com sucesso!');
      setModalExcluir({ show: false, id: null, info: '' });
      loadPagamentos();
    } catch (err) {
      console.error('Erro ao excluir pagamento:', err);
      toast.error('Erro ao excluir pagamento: ' + err.message);
    } finally {
      setExcluindoPagamento(false);
    }
  };

  // Abre modal de comprovante
  const handleAbrirComprovante = (pagamento) => {
    setModalComprovante({ show: true, pagamento });
  };

  // Reenvia notificação WhatsApp para o gestor
  const [notificando, setNotificando] = useState({});

  const handleNotificarGestor = async (pagamento) => {
    try {
      setNotificando(prev => ({ ...prev, [pagamento.id]: true }));
      if (activeTab === 'agregados') {
        await pagamentosAPI.agregados.notificarGestor(pagamento.id);
      } else {
        await pagamentosAPI.proprios.notificarGestor(pagamento.id);
      }
      toast.success('Notificação enviada para o gestor!');
    } catch (err) {
      toast.error('Erro ao notificar: ' + err.message);
    } finally {
      setNotificando(prev => ({ ...prev, [pagamento.id]: false }));
    }
  };

  // Botoes de acao desktop (todos visiveis)
  const renderActionButtons = (pagamento) => (
    <div className={styles.actionButtons}>
      <Button
        variant="outline"
        size="sm"
        iconOnly
        onClick={() => handleAbrirComprovante(pagamento)}
        title="Gerar Comprovante"
        aria-label="Gerar Comprovante"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
      </Button>
      {pagamento.status !== 'pago' ? (
        <Button
          variant="success"
          size="sm"
          iconOnly
          onClick={() => handleAbrirBaixa(pagamento)}
          title="Baixar Pagamento"
          aria-label="Baixar Pagamento"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          iconOnly
          onClick={() => handleAbrirReverterBaixa(pagamento)}
          title="Reverter Baixa"
          aria-label="Reverter Baixa"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
        </Button>
      )}
      <PermissionGuard modulo="pagamentos" acao="change">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => handleEditarPagamento(pagamento.id)}
          title="Editar"
          aria-label="Editar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </Button>
      </PermissionGuard>
      {pagamento.status !== 'pago' && (
        <Button
          variant="success"
          size="sm"
          iconOnly
          onClick={() => handleNotificarGestor(pagamento)}
          disabled={notificando[pagamento.id]}
          title="Notificar gestor via WhatsApp"
          aria-label="Notificar gestor via WhatsApp"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        iconOnly
        onClick={() => handleAbrirConverter(pagamento)}
        title={activeTab === 'agregados' ? 'Converter para Próprio' : 'Converter para Agregado'}
        aria-label={activeTab === 'agregados' ? 'Converter para Próprio' : 'Converter para Agregado'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
      </Button>
      <PermissionGuard modulo="pagamentos" acao="delete">
        <Button
          variant="danger"
          size="sm"
          iconOnly
          onClick={() => handleAbrirExcluir(pagamento)}
          title="Excluir"
          aria-label="Excluir"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </Button>
      </PermissionGuard>
    </div>
  );

  // Botoes de acao mobile compactos (icones com label reduzido)
  const renderMobileActions = (pagamento) => (
    <div className={styles.mobileCardActions}>
      <button
        className={`${styles.mobileActionBtn} ${styles.view}`}
        onClick={() => handleAbrirComprovante(pagamento)}
        title="Gerar Comprovante"
        aria-label="Gerar comprovante"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <span>Comp.</span>
      </button>
      {pagamento.status !== 'pago' ? (
        <button
          className={`${styles.mobileActionBtn} ${styles.download}`}
          onClick={() => handleAbrirBaixa(pagamento)}
          title="Baixar Pagamento"
          aria-label="Baixar pagamento"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>Baixar</span>
        </button>
      ) : (
        <button
          className={`${styles.mobileActionBtn} ${styles.reverter}`}
          onClick={() => handleAbrirReverterBaixa(pagamento)}
          title="Reverter Baixa"
          aria-label="Reverter baixa"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
          <span>Reverter</span>
        </button>
      )}
      <PermissionGuard modulo="pagamentos" acao="change">
        <button
          className={`${styles.mobileActionBtn} ${styles.edit}`}
          onClick={() => handleEditarPagamento(pagamento.id)}
          title="Editar"
          aria-label="Editar pagamento"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>Editar</span>
        </button>
      </PermissionGuard>
      {pagamento.status !== 'pago' && (
        <button
          className={`${styles.mobileActionBtn} ${styles.whatsapp}`}
          onClick={() => handleNotificarGestor(pagamento)}
          disabled={notificando[pagamento.id]}
          title="Notificar gestor via WhatsApp"
          aria-label="Notificar gestor via WhatsApp"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span>Whats</span>
        </button>
      )}
      <button
        className={`${styles.mobileActionBtn} ${styles.convert}`}
        onClick={() => handleAbrirConverter(pagamento)}
        title={activeTab === 'agregados' ? 'Converter' : 'Converter'}
        aria-label="Converter pagamento"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
        <span>Conv.</span>
      </button>
      <PermissionGuard modulo="pagamentos" acao="delete">
        <button
          className={`${styles.mobileActionBtn} ${styles.delete}`}
          onClick={() => handleAbrirExcluir(pagamento)}
          title="Excluir"
          aria-label="Excluir pagamento"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span>Excl.</span>
        </button>
      </PermissionGuard>
    </div>
  );

  const headerActions = (
    <div className={styles.headerActions}>
      <Button variant="outline" onClick={handleExport}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Exportar</span>
      </Button>
      <Button variant="secondary" onClick={() => setShowGerarLote(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>Gerar Lote</span>
      </Button>
      <PermissionGuard modulo="pagamentos" acao="add">
        <Button variant="primary" onClick={handleNovoPagamento}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Novo Pagamento</span>
        </Button>
      </PermissionGuard>
    </div>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Pagamentos"
        subtitle="Gerencie pagamentos de agregados e próprios"
        icon={pagamentosIcon}
        breadcrumbs={[{ label: 'Financeiro' }, { label: 'Pagamentos' }]}
        actions={headerActions}
      />

      {/* Modal de Geração em Lote */}
      <Modal
        isOpen={showGerarLote}
        onClose={() => setShowGerarLote(false)}
        title="Gerar Pagamentos em Lote"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowGerarLote(false)} disabled={gerandoLote}>
              Cancelar
            </Button>
            <Button onClick={handleGerarLote} disabled={gerandoLote}>
              {gerandoLote ? 'Gerando...' : 'Gerar Pagamentos'}
            </Button>
          </>
        }
      >
        <p className={styles.modalDescription}>
          Gere pagamentos automaticamente para todos os CT-es do período selecionado.
        </p>

        <div className={styles.modalBodyGroup}>
          <label htmlFor="lote_tipo">Tipo de Pagamento</label>
          <select
            id="lote_tipo"
            value={loteConfig.tipo}
            onChange={(e) => setLoteConfig({...loteConfig, tipo: e.target.value})}
            className={styles.modalSelect}
          >
            <option value="agregados">Agregados</option>
            <option value="proprios">Próprios</option>
          </select>
        </div>

        <div className={styles.modalBodyRow}>
          <div className={styles.modalBodyGroup}>
            <label htmlFor="lote_data_inicio">Data Início</label>
            <input
              id="lote_data_inicio"
              type="date"
              value={loteConfig.data_inicio}
              onChange={(e) => setLoteConfig({...loteConfig, data_inicio: e.target.value})}
              className={styles.modalInput}
            />
          </div>
          <div className={styles.modalBodyGroup}>
            <label htmlFor="lote_data_fim">Data Fim</label>
            <input
              id="lote_data_fim"
              type="date"
              value={loteConfig.data_fim}
              onChange={(e) => setLoteConfig({...loteConfig, data_fim: e.target.value})}
              className={styles.modalInput}
            />
          </div>
        </div>

        {loteConfig.tipo === 'agregados' && (
          <div className={styles.modalBodyGroup}>
            <label htmlFor="lote_percentual">Percentual de Repasse (%) *</label>
            <input
              id="lote_percentual"
              type="number"
              value={loteConfig.percentual}
              onChange={(e) => setLoteConfig({...loteConfig, percentual: e.target.value})}
              className={styles.modalInput}
              min="0.01"
              max="100"
              step="0.01"
              placeholder="Ex: 25, 30, 35..."
              required
            />
            <small className={`${styles.formHint} ${styles.muted}`}>Informe o percentual a ser aplicado sobre o valor do frete (0-100%)</small>
          </div>
        )}
      </Modal>

      {/* Modal de Baixa Rápida */}
      <Modal
        isOpen={modalBaixa.show}
        onClose={() => setModalBaixa({ show: false, id: null, info: '' })}
        title="Baixar Pagamento"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalBaixa({ show: false, id: null, info: '' })}
              disabled={processandoBaixa}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarBaixa}
              disabled={processandoBaixa || !dataBaixa}
            >
              {processandoBaixa ? 'Processando...' : 'Confirmar Baixa'}
            </Button>
          </>
        }
      >
        <p className={styles.modalDescription}>
          Confirmar baixa do pagamento:
        </p>
        <p className={styles.modalInfo}>
          {modalBaixa.info}
        </p>

        <div className={styles.modalBodyGroup}>
          <label htmlFor="data_baixa">Data do Pagamento</label>
          <input
            id="data_baixa"
            type="date"
            value={dataBaixa}
            onChange={(e) => setDataBaixa(e.target.value)}
            className={styles.modalInput}
          />
        </div>

        <div className={`${styles.modalBodyGroup} ${styles.mt20}`}>
          <label htmlFor="comprovante_baixa">Comprovante (opcional)</label>
          <input
            id="comprovante_baixa"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setComprovanteFile(e.target.files[0] || null)}
            className={`${styles.modalInput} ${styles.fileInput}`}
          />
          {comprovanteFile && (
            <small className={`${styles.formHint} ${styles.muted}`}>
              Arquivo selecionado: {comprovanteFile.name}
            </small>
          )}
        </div>
      </Modal>

      {/* Modal de Reverter Baixa */}
      <Modal
        isOpen={modalReverterBaixa.show}
        onClose={() => setModalReverterBaixa({ show: false, id: null, info: '' })}
        title="Reverter Baixa"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalReverterBaixa({ show: false, id: null, info: '' })}
              disabled={revertendoBaixa}
            >
              Cancelar
            </Button>
            <Button
              variant="warning"
              onClick={handleConfirmarReverterBaixa}
              disabled={revertendoBaixa}
            >
              {revertendoBaixa ? 'Revertendo...' : 'Confirmar Reversão'}
            </Button>
          </>
        }
      >
        <p className={styles.modalDescription}>
          Deseja reverter a baixa deste pagamento?
        </p>
        <p className={styles.modalInfo}>
          {modalReverterBaixa.info}
        </p>
        <p className={styles.modalAlert}>
          O status voltará para <strong>Pendente</strong>, a data de pagamento será removida e o comprovante (se houver) será excluído.
        </p>
      </Modal>

      {/* Modal de Conversão */}
      <Modal
        isOpen={modalConverter.show}
        onClose={() => setModalConverter({ show: false, id: null, tipo: '', info: '' })}
        title={modalConverter.tipo === 'agregado_para_proprio' ? 'Converter para Próprio' : 'Converter para Agregado'}
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalConverter({ show: false, id: null, tipo: '', info: '' })}
              disabled={convertendoPagamento}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarConversao}
              disabled={convertendoPagamento}
            >
              {convertendoPagamento ? 'Convertendo...' : 'Confirmar Conversão'}
            </Button>
          </>
        }
      >
        <p className={styles.modalDescription}>
          {modalConverter.tipo === 'agregado_para_proprio'
            ? 'Converter este pagamento de Agregado para Próprio. O registro será movido para a lista de pagamentos próprios.'
            : 'Converter este pagamento de Próprio para Agregado. É necessário informar um CT-e para associar.'}
        </p>
        <p className={styles.modalInfo}>
          {modalConverter.info}
        </p>

        {modalConverter.tipo === 'agregado_para_proprio' ? (
          <div className={styles.modalBodyGroup}>
            <label htmlFor="conv_periodo">Período (AAAA-MM)</label>
            <input
              id="conv_periodo"
              type="text"
              value={dadosConversao.periodo}
              onChange={(e) => setDadosConversao({...dadosConversao, periodo: e.target.value})}
              className={styles.modalInput}
              placeholder="2025-01"
            />
            <small className={`${styles.formHint} ${styles.muted}`}>
              Período para agrupar no pagamento próprio
            </small>
          </div>
        ) : (
          <>
            <div className={styles.modalBodyGroup}>
              <label htmlFor="conv_cte_id">ID do CT-e *</label>
              <input
                id="conv_cte_id"
                type="text"
                value={dadosConversao.cte_id}
                onChange={(e) => setDadosConversao({...dadosConversao, cte_id: e.target.value})}
                className={styles.modalInput}
                placeholder="ID do CT-e (obrigatório)"
              />
            </div>
            <div className={styles.modalBodyRow}>
              <div className={styles.modalBodyGroup}>
                <label htmlFor="conv_condutor_nome">Nome do Condutor *</label>
                <input
                  id="conv_condutor_nome"
                  type="text"
                  value={dadosConversao.condutor_nome}
                  onChange={(e) => setDadosConversao({...dadosConversao, condutor_nome: e.target.value})}
                  className={styles.modalInput}
                  placeholder="Nome do condutor"
                />
              </div>
              <div className={styles.modalBodyGroup}>
                <label htmlFor="conv_condutor_cpf">CPF do Condutor</label>
                <input
                  id="conv_condutor_cpf"
                  type="text"
                  value={dadosConversao.condutor_cpf}
                  onChange={(e) => setDadosConversao({...dadosConversao, condutor_cpf: e.target.value})}
                  className={styles.modalInput}
                  placeholder="Apenas números"
                />
              </div>
            </div>
            <div className={styles.modalBodyRow}>
              <div className={styles.modalBodyGroup}>
                <label htmlFor="conv_percentual_repasse">Percentual Repasse (%)</label>
                <input
                  id="conv_percentual_repasse"
                  type="number"
                  value={dadosConversao.percentual_repasse}
                  onChange={(e) => setDadosConversao({...dadosConversao, percentual_repasse: e.target.value})}
                  className={styles.modalInput}
                  min="0"
                  max="100"
                />
              </div>
              <div className={styles.modalBodyGroup}>
                <label htmlFor="conv_data_prevista">Data Prevista</label>
                <input
                  id="conv_data_prevista"
                  type="date"
                  value={dadosConversao.data_prevista}
                  onChange={(e) => setDadosConversao({...dadosConversao, data_prevista: e.target.value})}
                  className={styles.modalInput}
                />
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Modal de Exclusao */}
      <Modal
        isOpen={modalExcluir.show}
        onClose={() => setModalExcluir({ show: false, id: null, info: '' })}
        title="Excluir Pagamento"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalExcluir({ show: false, id: null, info: '' })}
              disabled={excluindoPagamento}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmarExcluir}
              disabled={excluindoPagamento}
            >
              {excluindoPagamento ? 'Excluindo...' : 'Confirmar Exclusao'}
            </Button>
          </>
        }
      >
        <p className={`${styles.modalDescription} ${styles.danger}`}>
          Tem certeza que deseja excluir este pagamento? Esta acao nao pode ser desfeita.
        </p>
        <p className={styles.modalInfo}>
          {modalExcluir.info}
        </p>
      </Modal>

      {/* Cards de resumo */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total</span>
          <span className={styles.summaryValue}>{formatCurrency(totais.total)}</span>
        </div>
        <div className={`${styles.summaryCard} ${styles.pendente}`}>
          <span className={styles.summaryLabel}>Pendente</span>
          <span className={styles.summaryValue}>{formatCurrency(totais.pendente)}</span>
        </div>
        <div className={`${styles.summaryCard} ${styles.pago}`}>
          <span className={styles.summaryLabel}>Pago</span>
          <span className={styles.summaryValue}>{formatCurrency(totais.pago)}</span>
        </div>
      </div>

      {/* Filtro de Data - abaixo dos cards */}
      <DateFilter
        onFilterChange={handleDateFilterChange}
        defaultPeriodo="mes"
        initialDataInicio={filtros.data_inicio}
        initialDataFim={filtros.data_fim}
      />

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabButton} ${activeTab === 'agregados' ? styles.active : ''}`}
          onClick={() => setActiveTab('agregados')}
        >
          Agregados
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'proprios' ? styles.active : ''}`}
          onClick={() => setActiveTab('proprios')}
        >
          Próprios
        </button>
      </div>

      {/* Filtros */}
      <div className={styles.filtrosSection}>
        <div className={styles.filtrosForm}>
          <input
            type="text"
            placeholder="Buscar por CT-e, placa ou condutor..."
            value={filtros.busca}
            onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPaginacao(prev => ({ ...prev, page: 1 }));
                loadPagamentos(null, 1);
              }
            }}
            className={styles.inputFilter}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPaginacao(prev => ({ ...prev, page: 1 }));
              loadPagamentos(null, 1);
            }}
          >
            Buscar
          </Button>
          <select
            value={filtros.status}
            onChange={(e) => {
              setFiltros({...filtros, status: e.target.value});
              setPaginacao(prev => ({ ...prev, page: 1 }));
              setTimeout(() => loadPagamentos(null, 1), 100);
            }}
            className={styles.selectFilter}
          >
            <option value="">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </div>
      </div>

      <div className={styles.resultsInfo}>
        <p>
          {paginacao.total > 0 ? (
            <>Mostrando {((paginacao.page - 1) * paginacao.pageSize) + 1} - {Math.min(paginacao.page * paginacao.pageSize, paginacao.total)} de {paginacao.total} pagamento{paginacao.total !== 1 ? 's' : ''}</>
          ) : (
            <>Nenhum pagamento encontrado</>
          )}
        </p>
      </div>

      {/* Loading skeletons */}
      {loading && pagamentos.length === 0 && (
        <div className={styles.skeleton}>
          {isMobile ? (
            <SkeletonMobileCards count={4} />
          ) : (
            <SkeletonTable rows={5} columns={9} />
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && pagamentos.length === 0 && (
        <EmptyState
          title="Nenhum pagamento encontrado"
          description="Tente ajustar os filtros de data ou o termo de busca."
        />
      )}

      {/* Tabela desktop */}
      {!loading && pagamentos.length > 0 && !isMobile && (
        <TableContainer className={styles.desktopTable}>
          <table>
            <thead>
              <tr>
                {activeTab === 'agregados' ? (
                  <>
                    <th>CT-e</th>
                    <th>Condutor</th>
                    <th>Placa</th>
                    <th>Data Prevista</th>
                    <th>Desconto</th>
                    <th>Valor Repasse</th>
                    <th>Comprovante</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </>
                ) : (
                  <>
                    <th>CT-e</th>
                    <th>Condutor</th>
                    <th>Placa</th>
                    <th>Data Prevista</th>
                    <th>KM</th>
                    <th>Valor Repasse</th>
                    <th>Comprovante</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((pagamento) => (
                <tr key={pagamento.id}>
                  {activeTab === 'agregados' ? (
                    <>
                      <td>
                        <strong>#{pagamento.cte_numero || '-'}</strong>
                      </td>
                      <td>{pagamento.condutor_nome || '-'}</td>
                      <td>{pagamento.placa || '-'}</td>
                      <td>{formatDate(pagamento.data_prevista)}</td>
                      <td className={`${styles.textRight} ${pagamento.desconto > 0 ? styles.textDanger : styles.textMuted}`}>
                        {pagamento.desconto > 0 ? `-${formatCurrency(pagamento.desconto)}` : '-'}
                      </td>
                      <td className={styles.textRight}>
                        <strong>{formatCurrency(pagamento.valor_repassado)}</strong>
                      </td>
                      <td className={styles.textCenter}>
                        {pagamento.comprovante ? (
                          <a
                            href={pagamento.comprovante}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.comprovanteLink}
                            title="Ver Comprovante"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                          </a>
                        ) : (
                          <span className={styles.textMuted}>-</span>
                        )}
                      </td>
                      <td>{getStatusBadge(pagamento.status)}</td>
                      <td>{renderActionButtons(pagamento)}</td>
                    </>
                  ) : (
                    <>
                      <td>
                        <strong>#{pagamento.cte_numero || '-'}</strong>
                      </td>
                      <td>{pagamento.condutor_nome || pagamento.motorista_nome || '-'}</td>
                      <td>{pagamento.placa || pagamento.veiculo_placa || '-'}</td>
                      <td>{formatDate(pagamento.data_prevista)}</td>
                      <td className={styles.textCenter}>{pagamento.km_total_periodo || '-'}</td>
                      <td className={styles.textRight}>
                        <strong>{formatCurrency(pagamento.valor_repassado || pagamento.valor_base_faixa)}</strong>
                      </td>
                      <td className={styles.textCenter}>
                        {pagamento.comprovante ? (
                          <a
                            href={pagamento.comprovante}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.comprovanteLink}
                            title="Ver Comprovante"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                          </a>
                        ) : (
                          <span className={styles.textMuted}>-</span>
                        )}
                      </td>
                      <td>{getStatusBadge(pagamento.status)}</td>
                      <td>{renderActionButtons(pagamento)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}

      {/* Cards mobile */}
      {!loading && pagamentos.length > 0 && isMobile && (
        <div className={styles.mobileCards}>
          {pagamentos.map((pagamento) => (
            <div key={pagamento.id} className={styles.mobileCard}>
              <div className={styles.mobileCardHeader}>
                <div className={styles.mobileCardTitle}>
                  <strong>#{pagamento.cte_numero || '-'}</strong>
                  <span>{getStatusBadge(pagamento.status)}</span>
                </div>
                <div className={styles.mobileCardSubtitle}>
                  {pagamento.condutor_nome || pagamento.motorista_nome || '-'} · {pagamento.placa || pagamento.veiculo_placa || '-'}
                </div>
              </div>
              <div className={styles.mobileCardBody}>
                <div className={styles.mobileCardRow}>
                  <span className={styles.mobileCardLabel}>Data Prevista</span>
                  <span className={styles.mobileCardValue}>{formatDate(pagamento.data_prevista)}</span>
                </div>
                {activeTab === 'agregados' ? (
                  <>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>Desconto</span>
                      <span className={`${styles.mobileCardValue} ${pagamento.desconto > 0 ? styles.textDanger : styles.textMuted}`}>
                        {pagamento.desconto > 0 ? `-${formatCurrency(pagamento.desconto)}` : '-'}
                      </span>
                    </div>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>Valor Repasse</span>
                      <span className={`${styles.mobileCardValue} ${styles.mobileCardHighlight}`}>{formatCurrency(pagamento.valor_repassado)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>KM</span>
                      <span className={styles.mobileCardValue}>{pagamento.km_total_periodo || '-'}</span>
                    </div>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>Valor Repasse</span>
                      <span className={`${styles.mobileCardValue} ${styles.mobileCardHighlight}`}>{formatCurrency(pagamento.valor_repassado || pagamento.valor_base_faixa)}</span>
                    </div>
                  </>
                )}
                <div className={styles.mobileCardRow}>
                  <span className={styles.mobileCardLabel}>Comprovante</span>
                  {pagamento.comprovante ? (
                    <a
                      href={pagamento.comprovante}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.comprovanteLink}
                      title="Ver Comprovante"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    </a>
                  ) : (
                    <span className={styles.textMuted}>-</span>
                  )}
                </div>
              </div>
              <div className={styles.mobileCardFooter}>
                {renderMobileActions(pagamento)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Comprovante */}
      {modalComprovante.show && modalComprovante.pagamento && (
        <ComprovantePagamento
          pagamento={modalComprovante.pagamento}
          tipo={activeTab}
          onClose={() => setModalComprovante({ show: false, pagamento: null })}
        />
      )}

      {/* Paginação */}
      {paginacao.totalPages > 1 && (
        <div className={styles.paginationContainer}>
          <button
            className={styles.paginationBtn}
            onClick={() => handlePageChange(1)}
            disabled={paginacao.page === 1}
            title="Primeira página"
            aria-label="Primeira página"
          >
            &laquo;
          </button>
          <button
            className={styles.paginationBtn}
            onClick={() => handlePageChange(paginacao.page - 1)}
            disabled={paginacao.page === 1}
            title="Página anterior"
            aria-label="Página anterior"
          >
            &lsaquo;
          </button>

          {/* Números das páginas */}
          {(() => {
            const pages = [];
            const maxVisible = 5;
            let start = Math.max(1, paginacao.page - Math.floor(maxVisible / 2));
            let end = Math.min(paginacao.totalPages, start + maxVisible - 1);

            if (end - start + 1 < maxVisible) {
              start = Math.max(1, end - maxVisible + 1);
            }

            for (let i = start; i <= end; i++) {
              pages.push(
                <button
                  key={i}
                  className={`${styles.paginationBtn} ${paginacao.page === i ? styles.active : ''}`}
                  onClick={() => handlePageChange(i)}
                >
                  {i}
                </button>
              );
            }
            return pages;
          })()}

          <button
            className={styles.paginationBtn}
            onClick={() => handlePageChange(paginacao.page + 1)}
            disabled={paginacao.page === paginacao.totalPages}
            title="Próxima página"
            aria-label="Próxima página"
          >
            &rsaquo;
          </button>
          <button
            className={styles.paginationBtn}
            onClick={() => handlePageChange(paginacao.totalPages)}
            disabled={paginacao.page === paginacao.totalPages}
            title="Última página"
            aria-label="Última página"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}

export default PagamentosList;
