import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pagamentosAPI, cteAPI, veiculosAPI, motoristasAPI, faixasKmAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import './Pagamentos.css';

function PagamentoProprioForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Busca de Veiculo por placa
  const [buscaVeiculo, setBuscaVeiculo] = useState('');
  const [resultadosVeiculo, setResultadosVeiculo] = useState([]);
  const [loadingVeiculo, setLoadingVeiculo] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [mostrarResultadosVeiculo, setMostrarResultadosVeiculo] = useState(false);

  // Busca de CT-e por numero
  const [buscaCte, setBuscaCte] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [cteSelecionado, setCteSelecionado] = useState(null);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  // Busca de Condutor (motorista)
  const [buscaCondutor, setBuscaCondutor] = useState('');
  const [resultadosCondutor, setResultadosCondutor] = useState([]);
  const [loadingCondutor, setLoadingCondutor] = useState(false);
  const [condutorSelecionado, setCondutorSelecionado] = useState(null);
  const [mostrarResultadosCondutor, setMostrarResultadosCondutor] = useState(false);

  const [formData, setFormData] = useState({
    veiculo: '',
    cte: '',
    cte_numero: '',
    motorista_nome: '',
    motorista_cpf: '',
    periodo: new Date().toISOString().slice(0, 7), // AAAA-MM
    data_prevista: new Date().toISOString().split('T')[0],
    km_total_periodo: '',
    valor_base_faixa: '',
    ajustes: '0',
    status: 'pendente',
    data_pagamento: '',
    obs: ''
  });
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [faixaKmInfo, setFaixaKmInfo] = useState(null);
  const [calculandoFaixa, setCalculandoFaixa] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isEditing) {
      loadPagamento();
    }
  }, [id]);

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
        // Busca veiculos proprios (tipo_proprietario = '00')
        const result = await veiculosAPI.list({ q: buscaVeiculo, tipo_proprietario: '00', ativo: true, page_size: 10 });
        const veiculos = result.results || result || [];
        setResultadosVeiculo(veiculos);
        setMostrarResultadosVeiculo(true);
      } catch (err) {
        console.error('Erro ao buscar veiculos:', err);
        setResultadosVeiculo([]);
      } finally {
        setLoadingVeiculo(false);
      }
    };

    const timeoutId = setTimeout(buscarVeiculo, 300);
    return () => clearTimeout(timeoutId);
  }, [buscaVeiculo]);

  const handleSelecionarVeiculo = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setFormData(prev => ({
      ...prev,
      veiculo: veiculo.id
    }));
    setBuscaVeiculo('');
    setMostrarResultadosVeiculo(false);
    setResultadosVeiculo([]);
  };

  const handleRemoverVeiculo = () => {
    setVeiculoSelecionado(null);
    setFormData(prev => ({
      ...prev,
      veiculo: ''
    }));
  };

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

  const handleSelecionarCte = async (cte) => {
    setCteSelecionado(cte);

    // Busca o valor baseado na faixa de KM se houver dist_km
    let valorFaixa = '';
    if (cte.dist_km && cte.dist_km > 0) {
      try {
        const resultado = await faixasKmAPI.buscarPorKm(cte.dist_km);
        valorFaixa = resultado.faixa.valor_pago;
        toast.info(`Faixa KM aplicada: ${resultado.faixa.min_km}-${resultado.faixa.max_km || '+'} km = R$ ${valorFaixa}`);
      } catch (err) {
        console.warn('Faixa KM não encontrada:', err.message);
        // Se não encontrar faixa, usa o valor do frete como fallback
        valorFaixa = cte.valor_total || cte.valor_prestacao || '';
        toast.warning('Faixa KM não encontrada. Usando valor do frete.');
      }
    } else {
      // Sem distância, usa o valor do frete
      valorFaixa = cte.valor_total || cte.valor_prestacao || '';
    }

    setFormData(prev => ({
      ...prev,
      cte: cte.id,
      cte_numero: cte.numero_cte || cte.numero || '',
      valor_base_faixa: valorFaixa
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
      valor_base_faixa: ''
    }));
  };

  // Busca Condutor por nome ou CPF quando usuario digita
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
        const motoristas = (result.results || result || []).map(m => ({
          ...m,
          displayName: m.nome,
          displayCpf: m.cpf
        }));
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

  const handleSelecionarCondutor = (motorista) => {
    setCondutorSelecionado(motorista);
    setFormData(prev => ({
      ...prev,
      motorista_nome: motorista.nome || '',
      motorista_cpf: motorista.cpf || ''
    }));
    setBuscaCondutor('');
    setMostrarResultadosCondutor(false);
    setResultadosCondutor([]);
  };

  const handleRemoverCondutor = () => {
    setCondutorSelecionado(null);
    setFormData(prev => ({
      ...prev,
      motorista_nome: '',
      motorista_cpf: ''
    }));
  };

  const loadPagamento = async () => {
    try {
      setLoading(true);
      const result = await pagamentosAPI.proprios.get(id);
      setFormData({
        veiculo: result.veiculo || '',
        cte: result.cte || '',
        cte_numero: result.cte_numero || '',
        motorista_nome: result.motorista_nome || result.condutor_nome || '',
        motorista_cpf: result.motorista_cpf || result.condutor_cpf || '',
        periodo: result.periodo || '',
        data_prevista: result.data_prevista || '',
        km_total_periodo: result.km_total_periodo || '',
        valor_base_faixa: result.valor_base_faixa || result.valor_repassado || '',
        ajustes: result.ajustes || '0',
        status: result.status || 'pendente',
        data_pagamento: result.data_pagamento || '',
        obs: result.obs || ''
      });
    } catch (err) {
      console.error('Erro ao carregar pagamento:', err);
      setError('Erro ao carregar dados do pagamento.');
    } finally {
      setLoading(false);
    }
  };

  // Busca o valor da faixa de KM quando o usuário digita a quilometragem
  const handleKmChange = async (e) => {
    const km = e.target.value;
    setFormData(prev => ({ ...prev, km_total_periodo: km }));
    setFaixaKmInfo(null);

    if (!km || parseInt(km) <= 0) {
      return;
    }

    try {
      setCalculandoFaixa(true);
      const resultado = await faixasKmAPI.buscarPorKm(parseInt(km));
      if (resultado && resultado.faixa) {
        setFaixaKmInfo(resultado.faixa);
        setFormData(prev => ({
          ...prev,
          valor_base_faixa: resultado.faixa.valor_pago
        }));
        toast.info(`Faixa KM: ${resultado.faixa.min_km}-${resultado.faixa.max_km || '+'} km = R$ ${resultado.faixa.valor_pago}`);
      }
    } catch (err) {
      console.warn('Faixa KM não encontrada:', err.message);
      setFaixaKmInfo(null);
    } finally {
      setCalculandoFaixa(false);
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
    setFormData(prev => ({ ...prev, motorista_cpf: formatted }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (formData.status === 'pago' && !formData.data_pagamento) {
      toast.warning('Data de pagamento é obrigatória quando o status é "Pago"');
      setSaving(false);
      return;
    }

    try {
      let dataToSend;

      if (comprovanteFile) {
        // Se tiver arquivo, usa FormData
        dataToSend = new FormData();
        dataToSend.append('motorista_nome', formData.motorista_nome);
        if (formData.motorista_cpf) dataToSend.append('motorista_cpf', formData.motorista_cpf);
        if (formData.data_prevista) dataToSend.append('data_prevista', formData.data_prevista);
        if (formData.km_total_periodo) dataToSend.append('km_total_periodo', parseInt(formData.km_total_periodo) || 0);
        dataToSend.append('valor_base_faixa', parseFloat(formData.valor_base_faixa) || 0);
        dataToSend.append('ajustes', parseFloat(formData.ajustes) || 0);
        dataToSend.append('status', formData.status);
        if (formData.data_pagamento) dataToSend.append('data_pagamento', formData.data_pagamento);
        dataToSend.append('obs', formData.obs || '');
        dataToSend.append('comprovante', comprovanteFile);
        if (!isEditing) {
          if (formData.veiculo) dataToSend.append('veiculo', formData.veiculo);
          if (formData.cte) dataToSend.append('cte', formData.cte);
          if (formData.cte_numero) dataToSend.append('cte_numero', formData.cte_numero);
          dataToSend.append('periodo', formData.periodo);
        }
      } else {
        // Sem arquivo, envia JSON
        dataToSend = {
          motorista_nome: formData.motorista_nome,
          motorista_cpf: formData.motorista_cpf || null,
          data_prevista: formData.data_prevista || null,
          km_total_periodo: formData.km_total_periodo ? parseInt(formData.km_total_periodo) : 0,
          valor_base_faixa: parseFloat(formData.valor_base_faixa) || 0,
          ajustes: parseFloat(formData.ajustes) || 0,
          status: formData.status,
          data_pagamento: formData.data_pagamento || null,
          obs: formData.obs || ''
        };
        if (!isEditing) {
          dataToSend.veiculo = formData.veiculo || null;
          dataToSend.cte = formData.cte || null;
          dataToSend.cte_numero = formData.cte_numero || null;
          dataToSend.periodo = formData.periodo;
        }
      }

      if (isEditing) {
        // Na edição, NÃO enviamos veiculo, cte, periodo (não podem mudar)
        await pagamentosAPI.proprios.update(id, dataToSend);
        toast.success('Pagamento atualizado com sucesso!');
      } else {
        // Na criação, incluímos todos os campos
        await pagamentosAPI.proprios.create(dataToSend);
        toast.success('Pagamento registrado com sucesso!');
      }
      setTimeout(() => navigate('/pagamentos'), 500);
    } catch (err) {
      console.error('Erro ao salvar pagamento:', err);
      toast.error('Erro ao salvar pagamento. Verifique os dados.');
      setError('Erro ao salvar pagamento. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Calcular valor total a pagar
  const valorTotal = (parseFloat(formData.valor_base_faixa) || 0) + (parseFloat(formData.ajustes) || 0);

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className="pagamento-form-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Pagamento Proprio' : 'Novo Pagamento Proprio'}</h1>
          <p>{isEditing ? 'Atualize os dados do pagamento' : 'Cadastre um novo pagamento para veiculo proprio'}</p>
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
                      onClick={() => handleSelecionarCte(cte)}
                      style={{
                        padding: '12px 15px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.target.style.background = '#fff'}
                    >
                      <div style={{ fontWeight: '600', color: '#333' }}>
                        CT-e #{cte.numero_cte || cte.numero}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                        {cte.remetente_nome || 'N/I'} → {cte.destinatario_nome || 'N/I'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#27ae60', fontWeight: '500', marginTop: '2px' }}>
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
              {condutorSelecionado.categoria_cnh && (
                <div style={{ color: 'var(--primary-color)', marginTop: '4px', fontSize: '14px' }}>
                  CNH: {condutorSelecionado.categoria_cnh}
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
                  Nenhum veiculo proprio encontrado com essa placa
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
              name="motorista_cpf"
              value={formData.motorista_cpf}
              onChange={handleCPFChange}
              maxLength="11"
              placeholder="00000000000"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Quilometragem e Valores</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Quilometragem (KM)</label>
              <input
                type="number"
                name="km_total_periodo"
                value={formData.km_total_periodo}
                onChange={handleKmChange}
                min="0"
                placeholder="Digite a KM para calcular o valor"
              />
              {calculandoFaixa && (
                <small className="form-hint" style={{ color: 'var(--primary-color)' }}>Buscando faixa...</small>
              )}
              {faixaKmInfo && (
                <small className="form-hint" style={{ color: '#27ae60' }}>
                  Faixa: {faixaKmInfo.min_km} - {faixaKmInfo.max_km || '+'} km = R$ {faixaKmInfo.valor_pago}
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Valor Base / Repasse (R$) *</label>
              <input
                type="number"
                step="0.01"
                name="valor_base_faixa"
                value={formData.valor_base_faixa}
                onChange={handleChange}
                required
                min="0"
                placeholder="0.00"
              />
              <small className="form-hint">Calculado pela faixa de KM ou manual</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Ajustes (R$)</label>
              <input
                type="number"
                step="0.01"
                name="ajustes"
                value={formData.ajustes}
                onChange={handleChange}
                placeholder="0.00"
              />
              <small className="form-hint">Adicional ou desconto</small>
            </div>

            <div className="form-group">
              <label>Valor Total a Pagar (R$)</label>
              <input
                type="text"
                value={`R$ ${valorTotal.toFixed(2)}`}
                disabled
                className="input-calculated"
              />
              <small className="form-hint">Calculado automaticamente</small>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Datas e Status</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Periodo (AAAA-MM) *</label>
              <input
                type="month"
                name="periodo"
                value={formData.periodo}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Data Prevista</label>
              <input
                type="date"
                name="data_prevista"
                value={formData.data_prevista}
                onChange={handleChange}
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
          </div>

          <div className="form-row">
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

export default PagamentoProprioForm;
