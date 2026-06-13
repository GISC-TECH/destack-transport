import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pagamentosAPI, cteAPI, motoristasAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import './Pagamentos.css';

function PagamentoAgregadoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Busca de CT-e por numero
  const [buscaCte, setBuscaCte] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [cteSelecionado, setCteSelecionado] = useState(null);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  // Busca de Condutor (motorista por nome)
  const [buscaCondutor, setBuscaCondutor] = useState('');
  const [resultadosCondutor, setResultadosCondutor] = useState([]);
  const [loadingCondutor, setLoadingCondutor] = useState(false);
  const [condutorSelecionado, setCondutorSelecionado] = useState(null);
  const [mostrarResultadosCondutor, setMostrarResultadosCondutor] = useState(false);

  // Busca de Veiculo (por placa)
  const [buscaVeiculo, setBuscaVeiculo] = useState('');
  const [resultadosVeiculo, setResultadosVeiculo] = useState([]);
  const [loadingVeiculo, setLoadingVeiculo] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [mostrarResultadosVeiculo, setMostrarResultadosVeiculo] = useState(false);

  const [formData, setFormData] = useState({
    cte: '',
    cte_numero: '',
    placa: '',
    condutor_nome: '',
    condutor_cpf: '',
    valor_frete_total: '',
    percentual_repasse: '25.00',
    desconto: '0.00',
    data_prevista: new Date().toISOString().split('T')[0],
    status: 'pendente',
    obs: ''
  });
  const [comprovanteFile, setComprovanteFile] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isEditing) {
      loadPagamento();
    }
  }, [id]);

  // Busca CT-e por numero quando usuario digita
  useEffect(() => {
    const buscarCte = async () => {
      if (!buscaCte || buscaCte.length < 2) {
        setResultadosBusca([]);
        setMostrarResultados(false);
        return;
      }

      try {
        setLoadingBusca(true);
        const result = await cteAPI.list({ q: buscaCte, page_size: 10 });
        const ctes = result.results || result || [];
        setResultadosBusca(ctes);
        setMostrarResultados(true);
      } catch (err) {
        console.error('Erro ao buscar CT-es:', err);
        setResultadosBusca([]);
      } finally {
        setLoadingBusca(false);
      }
    };

    const timeoutId = setTimeout(buscarCte, 300);
    return () => clearTimeout(timeoutId);
  }, [buscaCte]);

  const handleSelecionarCte = (cte) => {
    setCteSelecionado(cte);
    setFormData(prev => ({
      ...prev,
      cte: cte.id,
      cte_numero: cte.numero_cte || cte.numero || '',
      valor_frete_total: cte.valor_total || cte.valor_prestacao || ''
    }));
    setBuscaCte('');
    setMostrarResultados(false);
    setResultadosBusca([]);
  };

  const handleRemoverCte = () => {
    setCteSelecionado(null);
    setFormData(prev => ({
      ...prev,
      cte: '',
      cte_numero: '',
      valor_frete_total: ''
    }));
  };

  // Busca Condutor por nome quando usuario digita
  useEffect(() => {
    const buscarCondutor = async () => {
      if (!buscaCondutor || buscaCondutor.length < 2) {
        setResultadosCondutor([]);
        setMostrarResultadosCondutor(false);
        return;
      }

      try {
        setLoadingCondutor(true);
        const result = await motoristasAPI.list({ q: buscaCondutor, page_size: 10 });
        const motoristas = result.results || result || [];
        setResultadosCondutor(motoristas);
        setMostrarResultadosCondutor(true);
      } catch (err) {
        console.error('Erro ao buscar condutor:', err);
        setResultadosCondutor([]);
      } finally {
        setLoadingCondutor(false);
      }
    };

    const timeoutId = setTimeout(buscarCondutor, 300);
    return () => clearTimeout(timeoutId);
  }, [buscaCondutor]);

  // Busca Veiculo por placa quando usuario digita
  useEffect(() => {
    const buscarVeiculo = async () => {
      if (!buscaVeiculo || buscaVeiculo.length < 2) {
        setResultadosVeiculo([]);
        setMostrarResultadosVeiculo(false);
        return;
      }

      try {
        setLoadingVeiculo(true);
        const result = await veiculosAPI.list({ q: buscaVeiculo, page_size: 10 });
        const veiculos = result.results || result || [];
        setResultadosVeiculo(veiculos);
        setMostrarResultadosVeiculo(true);
      } catch (err) {
        console.error('Erro ao buscar veiculo:', err);
        setResultadosVeiculo([]);
      } finally {
        setLoadingVeiculo(false);
      }
    };

    const timeoutId = setTimeout(buscarVeiculo, 300);
    return () => clearTimeout(timeoutId);
  }, [buscaVeiculo]);

  const handleSelecionarCondutor = (motorista) => {
    setCondutorSelecionado(motorista);
    setFormData(prev => ({
      ...prev,
      condutor_nome: motorista.nome || '',
      condutor_cpf: motorista.cpf || ''
    }));
    setBuscaCondutor('');
    setMostrarResultadosCondutor(false);
    setResultadosCondutor([]);
  };

  const handleRemoverCondutor = () => {
    setCondutorSelecionado(null);
    setFormData(prev => ({
      ...prev,
      condutor_nome: '',
      condutor_cpf: ''
    }));
  };

  const handleSelecionarVeiculo = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setFormData(prev => ({
      ...prev,
      placa: veiculo.placa || ''
    }));
    setBuscaVeiculo('');
    setMostrarResultadosVeiculo(false);
    setResultadosVeiculo([]);
  };

  const handleRemoverVeiculo = () => {
    setVeiculoSelecionado(null);
    setFormData(prev => ({
      ...prev,
      placa: ''
    }));
  };

  const loadPagamento = async () => {
    try {
      setLoading(true);
      const result = await pagamentosAPI.agregados.get(id);
      setFormData({
        cte: result.cte_id || '',  // Use cte_id (read-only) since cte is write-only
        cte_numero: result.cte_numero || '',
        placa: result.placa || '',
        condutor_nome: result.condutor_nome || '',
        condutor_cpf: result.condutor_cpf || '',
        valor_frete_total: result.valor_frete_total || '',
        percentual_repasse: result.percentual_repasse || '25.00',
        desconto: result.desconto || '0.00',
        data_prevista: result.data_prevista || '',
        data_pagamento: result.data_pagamento || '',
        status: result.status || 'pendente',
        obs: result.obs || ''
      });

      // Populate the "selected" states so the UI displays the already-selected values
      // instead of showing empty search boxes
      if (result.cte_numero || result.cte_id) {
        setCteSelecionado({
          id: result.cte_id,  // Use cte_id (read-only) since cte is write-only
          numero_cte: result.cte_numero,
          numero: result.cte_numero,
          cte_chave: result.cte_chave,
          // These may not be available from the payment API, but we show what we have
          remetente_nome: null,
          destinatario_nome: null,
          valor_total: result.valor_frete_total
        });
      }

      if (result.condutor_nome) {
        setCondutorSelecionado({
          nome: result.condutor_nome,
          cpf: result.condutor_cpf
        });
      }

      if (result.placa) {
        setVeiculoSelecionado({
          placa: result.placa
        });
      }
    } catch (err) {
      console.error('Erro ao carregar pagamento:', err);
      setError('Erro ao carregar dados do pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatCPF = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.slice(0, 11);
  };

  const handleCPFChange = (e) => {
    const formatted = formatCPF(e.target.value);
    setFormData(prev => ({ ...prev, condutor_cpf: formatted }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validações
    const valorFrete = parseFloat(formData.valor_frete_total);
    const percentual = parseFloat(formData.percentual_repasse);

    if (isNaN(valorFrete) || valorFrete <= 0) {
      toast.warning('Valor do frete deve ser um número válido maior que zero');
      setSaving(false);
      return;
    }

    if (isNaN(percentual) || percentual <= 0 || percentual > 100) {
      toast.warning('Percentual de repasse deve ser um número válido entre 0 e 100');
      setSaving(false);
      return;
    }

    if (!isEditing && !formData.cte) {
      toast.warning('Selecione um CT-e para vincular ao pagamento');
      setSaving(false);
      return;
    }

    if (formData.status === 'pago' && !formData.data_pagamento) {
      toast.warning('Data de pagamento é obrigatória quando o status é "Pago"');
      setSaving(false);
      return;
    }

    try {
      const desconto = parseFloat(formData.desconto) || 0;
      let dataToSend;

      if (comprovanteFile) {
        // Se tiver arquivo, usa FormData
        dataToSend = new FormData();
        dataToSend.append('placa', formData.placa.toUpperCase());
        dataToSend.append('condutor_nome', formData.condutor_nome);
        if (formData.condutor_cpf) dataToSend.append('condutor_cpf', formData.condutor_cpf);
        dataToSend.append('valor_frete_total', valorFrete);
        dataToSend.append('percentual_repasse', percentual);
        dataToSend.append('desconto', desconto);
        dataToSend.append('data_prevista', formData.data_prevista);
        if (formData.data_pagamento) dataToSend.append('data_pagamento', formData.data_pagamento);
        dataToSend.append('status', formData.status);
        dataToSend.append('obs', formData.obs || '');
        dataToSend.append('comprovante', comprovanteFile);
        if (!isEditing && formData.cte) dataToSend.append('cte', formData.cte);
      } else {
        // Sem arquivo, envia JSON
        dataToSend = {
          placa: formData.placa.toUpperCase(),
          condutor_nome: formData.condutor_nome,
          condutor_cpf: formData.condutor_cpf || null,
          valor_frete_total: valorFrete,
          percentual_repasse: percentual,
          desconto: desconto,
          data_prevista: formData.data_prevista,
          data_pagamento: formData.data_pagamento || null,
          status: formData.status,
          obs: formData.obs || ''
        };
        if (!isEditing) dataToSend.cte = formData.cte;
      }

      if (isEditing) {
        // Na edição, NÃO enviamos o campo cte (não pode mudar o CT-e vinculado)
        await pagamentosAPI.agregados.update(id, dataToSend);
        toast.success('Pagamento atualizado com sucesso!');
      } else {
        // Na criação, incluímos o cte
        await pagamentosAPI.agregados.create(dataToSend);
        toast.success('Pagamento registrado com sucesso!');
      }
      setTimeout(() => navigate('/pagamentos'), 500);
    } catch (err) {
      console.error('Erro ao salvar pagamento:', err);
      // Mostrar mensagem específica do erro
      const errorMsg = err.message || 'Erro ao salvar pagamento';
      if (errorMsg.includes('já existe') || errorMsg.includes('cte')) {
        toast.error('Este CT-e já possui um pagamento cadastrado. Edite o pagamento existente.');
        setError('Este CT-e já possui um pagamento cadastrado. Para modificar, edite o pagamento existente na lista.');
      } else {
        toast.error(errorMsg);
        setError(errorMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  // Calcular valor repassado: (frete * percentual / 100) - desconto
  const valorBruto = formData.valor_frete_total && formData.percentual_repasse
    ? parseFloat(formData.valor_frete_total) * parseFloat(formData.percentual_repasse) / 100
    : 0;
  const descontoValor = parseFloat(formData.desconto) || 0;
  const valorRepassado = Math.max(valorBruto - descontoValor, 0).toFixed(2);

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className="pagamento-form-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Pagamento Agregado' : 'Novo Pagamento Agregado'}</h1>
          <p>{isEditing ? 'Atualize os dados do pagamento' : 'Cadastre um novo pagamento para motorista agregado'}</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="alert-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-section">
          <h3>Vincular CT-e (Opcional)</h3>
          <p className="form-hint" style={{ marginBottom: '15px', color: '#666' }}>
            Digite o numero do CT-e para buscar e vincular automaticamente
          </p>

          {!cteSelecionado ? (
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Buscar CT-e</label>
              <input
                type="text"
                value={buscaCte}
                onChange={(e) => setBuscaCte(e.target.value)}
                placeholder="Digite o numero do CT-e..."
                autoComplete="off"
              />
              {loadingBusca && (
                <small className="form-hint">Buscando...</small>
              )}

              {/* Lista de resultados da busca */}
              {mostrarResultados && resultadosBusca.length > 0 && (
                <div className="cte-search-results" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {resultadosBusca.map(cte => (
                    <div
                      key={cte.id}
                      className="cte-search-item"
                      onClick={() => !cte.tem_pagamento_agregado && handleSelecionarCte(cte)}
                      style={{
                        padding: '12px 15px',
                        cursor: cte.tem_pagamento_agregado ? 'not-allowed' : 'pointer',
                        borderBottom: '1px solid #eee',
                        transition: 'background 0.2s',
                        opacity: cte.tem_pagamento_agregado ? 0.6 : 1,
                        background: cte.tem_pagamento_agregado ? '#fff5f5' : '#fff'
                      }}
                      onMouseEnter={(e) => !cte.tem_pagamento_agregado && (e.currentTarget.style.background = '#f5f5f5')}
                      onMouseLeave={(e) => e.currentTarget.style.background = cte.tem_pagamento_agregado ? '#fff5f5' : '#fff'}
                    >
                      <div style={{ fontWeight: '600', color: cte.tem_pagamento_agregado ? '#999' : '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        CT-e #{cte.numero_cte || cte.numero}
                        {cte.tem_pagamento_agregado && (
                          <span style={{ fontSize: '11px', background: '#e74c3c', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                            Já tem pagamento
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                        {cte.remetente_nome || 'N/I'} → {cte.destinatario_nome || 'N/I'}
                      </div>
                      <div style={{ fontSize: '13px', color: cte.tem_pagamento_agregado ? '#999' : '#27ae60', fontWeight: '500', marginTop: '2px' }}>
                        R$ {(cte.valor_total || cte.valor_prestacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mostrarResultados && resultadosBusca.length === 0 && buscaCte.length >= 2 && !loadingBusca && (
                <small className="form-hint" style={{ color: '#e74c3c' }}>
                  Nenhum CT-e encontrado com esse numero
                </small>
              )}
            </div>
          ) : (
            /* CT-e selecionado - exibe card com detalhes */
            <div className="cte-selecionado" style={{
              background: '#f8f9fa',
              border: '1px solid #27ae60',
              borderRadius: '8px',
              padding: '15px',
              position: 'relative'
            }}>
              <button
                type="button"
                onClick={handleRemoverCte}
                className="btn-remove-circle btn-sm"
                title="Remover CT-e"
              >
                ×
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{
                  background: '#27ae60',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  CT-e VINCULADO
                </span>
              </div>
              <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                CT-e #{cteSelecionado.numero_cte || cteSelecionado.numero}
              </div>
              <div style={{ color: '#666', marginTop: '8px', fontSize: '14px' }}>
                <div><strong>Remetente:</strong> {cteSelecionado.remetente_nome || 'N/I'}</div>
                <div><strong>Destinatario:</strong> {cteSelecionado.destinatario_nome || 'N/I'}</div>
                <div style={{ marginTop: '8px', color: '#27ae60', fontWeight: '600', fontSize: '16px' }}>
                  Valor: R$ {(cteSelecionado.valor_total || cteSelecionado.valor_prestacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Dados do Condutor</h3>

          {/* Busca de Condutor por Nome */}
          {!condutorSelecionado ? (
            <div className="form-group" style={{ position: 'relative', marginBottom: '20px' }}>
              <label>Buscar Nome do Condutor</label>
              <small className="form-hint" style={{ display: 'block', marginBottom: '8px', color: '#666' }}>
                Digite o nome do motorista para buscar e vincular automaticamente
              </small>
              <input
                type="text"
                value={buscaCondutor}
                onChange={(e) => setBuscaCondutor(e.target.value)}
                placeholder="Digite o nome do motorista..."
                autoComplete="off"
              />
              {loadingCondutor && (
                <small className="form-hint">Buscando...</small>
              )}

              {/* Lista de resultados da busca de condutor */}
              {mostrarResultadosCondutor && resultadosCondutor.length > 0 && (
                <div className="condutor-search-results" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {resultadosCondutor.map((motorista, index) => (
                    <div
                      key={`motorista-${motorista.id}-${index}`}
                      className="condutor-search-item"
                      onClick={() => handleSelecionarCondutor(motorista)}
                      style={{
                        padding: '12px 15px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <div style={{ fontWeight: '600', color: '#333' }}>
                        {motorista.nome}
                      </div>
                      {motorista.cpf && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                          CPF: {motorista.cpf_formatado || motorista.cpf}
                        </div>
                      )}
                      {motorista.categoria_cnh && (
                        <div style={{ fontSize: '12px', color: 'var(--primary-color)', marginTop: '2px' }}>
                          CNH: {motorista.categoria_cnh}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mostrarResultadosCondutor && resultadosCondutor.length === 0 && buscaCondutor.length >= 2 && !loadingCondutor && (
                <small className="form-hint" style={{ color: '#e74c3c' }}>
                  Nenhum motorista encontrado
                </small>
              )}
            </div>
          ) : (
            /* Condutor selecionado - exibe card com detalhes */
            <div className="condutor-selecionado" style={{
              background: '#f8f9fa',
              border: '1px solid var(--primary-color)',
              borderRadius: '8px',
              padding: '15px',
              position: 'relative',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={handleRemoverCondutor}
                className="btn-remove-circle btn-sm"
                title="Remover condutor"
              >
                ×
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{
                  background: 'var(--primary-color)',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  MOTORISTA VINCULADO
                </span>
              </div>
              <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                {condutorSelecionado.nome}
              </div>
              {condutorSelecionado.cpf && (
                <div style={{ color: '#666', marginTop: '4px', fontSize: '14px' }}>
                  CPF: {condutorSelecionado.cpf_formatado || condutorSelecionado.cpf}
                </div>
              )}
            </div>
          )}

          {/* Busca de Veiculo por Placa */}
          {!veiculoSelecionado ? (
            <div className="form-group" style={{ position: 'relative', marginBottom: '20px' }}>
              <label>Placa do Veiculo *</label>
              <small className="form-hint" style={{ display: 'block', marginBottom: '8px', color: '#666' }}>
                Digite a placa do veiculo para buscar e vincular automaticamente
              </small>
              <input
                type="text"
                value={buscaVeiculo}
                onChange={(e) => setBuscaVeiculo(e.target.value.toUpperCase())}
                placeholder="Digite a placa do veiculo..."
                autoComplete="off"
                style={{ textTransform: 'uppercase' }}
              />
              {loadingVeiculo && (
                <small className="form-hint">Buscando...</small>
              )}

              {/* Lista de resultados da busca de veiculo */}
              {mostrarResultadosVeiculo && resultadosVeiculo.length > 0 && (
                <div className="veiculo-search-results" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {resultadosVeiculo.map((veiculo, index) => (
                    <div
                      key={`veiculo-${veiculo.id}-${index}`}
                      className="veiculo-search-item"
                      onClick={() => handleSelecionarVeiculo(veiculo)}
                      style={{
                        padding: '12px 15px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <div style={{ fontWeight: '700', fontSize: '16px', color: '#333' }}>
                        {veiculo.placa}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                        {veiculo.tipo_carroceria || veiculo.tipo_rodado || 'Tipo N/I'}
                      </div>
                      {veiculo.proprietario_nome && (
                        <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                          Proprietario: {veiculo.proprietario_nome}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mostrarResultadosVeiculo && resultadosVeiculo.length === 0 && buscaVeiculo.length >= 2 && !loadingVeiculo && (
                <small className="form-hint" style={{ color: '#e74c3c' }}>
                  Nenhum veiculo encontrado com essa placa
                </small>
              )}
            </div>
          ) : (
            /* Veiculo selecionado - exibe card com detalhes */
            <div className="veiculo-selecionado" style={{
              background: '#f8f9fa',
              border: '1px solid #e67e22',
              borderRadius: '8px',
              padding: '15px',
              position: 'relative',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={handleRemoverVeiculo}
                className="btn-remove-circle btn-sm"
                title="Remover veiculo"
              >
                ×
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{
                  background: '#e67e22',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  VEICULO VINCULADO
                </span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '20px', color: '#333' }}>
                {veiculoSelecionado.placa}
              </div>
              <div style={{ color: '#666', marginTop: '6px', fontSize: '14px' }}>
                {veiculoSelecionado.modelo || 'Modelo N/I'} {veiculoSelecionado.marca ? `- ${veiculoSelecionado.marca}` : ''}
              </div>
              {veiculoSelecionado.proprietario_nome && (
                <div style={{ color: '#888', marginTop: '4px', fontSize: '13px' }}>
                  Proprietario: {veiculoSelecionado.proprietario_nome}
                </div>
              )}
            </div>
          )}

          {/* Campo CPF oculto mas editavel se necessario */}
          <div className="form-group">
            <label>CPF do Condutor</label>
            <input
              type="text"
              name="condutor_cpf"
              value={formData.condutor_cpf}
              onChange={handleCPFChange}
              maxLength="11"
              placeholder="00000000000"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Valores</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Valor do Frete Total (R$) *</label>
              <input
                type="number"
                step="0.01"
                name="valor_frete_total"
                value={formData.valor_frete_total}
                onChange={handleChange}
                required
                min="0"
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label>Percentual de Repasse (%) *</label>
              <input
                type="number"
                step="0.01"
                name="percentual_repasse"
                value={formData.percentual_repasse}
                onChange={handleChange}
                required
                min="0"
                max="100"
                placeholder="25.00"
              />
            </div>

            <div className="form-group">
              <label>Desconto (R$)</label>
              <input
                type="number"
                step="0.01"
                name="desconto"
                value={formData.desconto}
                onChange={handleChange}
                min="0"
                placeholder="0.00"
              />
              <small className="form-hint">Desconto sobre o valor a repassar</small>
            </div>

            <div className="form-group">
              <label>Valor a Repassar (R$)</label>
              <input
                type="text"
                value={`R$ ${valorRepassado}`}
                disabled
                className="input-calculated"
              />
              <small className="form-hint">Calculado: (Frete × %) − Desconto</small>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Datas e Status</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Data Prevista *</label>
              <input
                type="date"
                name="data_prevista"
                value={formData.data_prevista}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Data Pagamento</label>
              <input
                type="date"
                name="data_pagamento"
                value={formData.data_pagamento || ''}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Status *</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Observacoes</label>
            <textarea
              name="obs"
              value={formData.obs}
              onChange={handleChange}
              rows="3"
              placeholder="Observacoes adicionais..."
            />
          </div>

          {/* Campo de comprovante apenas na criacao - na edicao usar DocumentosAnexos */}
          {!isEditing && (
            <div className="form-group">
              <label>Comprovante de Pagamento (opcional)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setComprovanteFile(e.target.files[0] || null)}
                style={{ padding: '8px' }}
              />
              {comprovanteFile && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Arquivo selecionado: {comprovanteFile.name}
                </small>
              )}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/pagamentos')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Pagamento')}
          </button>
        </div>
      </form>

      {/* Documentos Anexos - apenas na edicao */}
      {isEditing && id && (
        <div style={{ marginTop: '24px' }}>
          <DocumentosAnexos
            entidadeTipo="pagamento"
            entidadeId={id}
          />
        </div>
      )}
    </div>
  );
}

export default PagamentoAgregadoForm;
