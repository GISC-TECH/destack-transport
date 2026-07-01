import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pagamentosAPI, cteAPI, veiculosAPI, motoristasAPI, faixasKmAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import styles from './PagamentoForm.module.css';

function PagamentoProprioForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Busca de Veículo por placa
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

  const loadPagamento = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    if (isEditing) {
      loadPagamento();
    }
  }, [isEditing, loadPagamento]);

  // Busca Veículo por placa quando usuario digita
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
        const result = await veiculosAPI.list({ q: buscaVeiculo, tipo_proprietario: '00', ativo: true, page_size: 20 });
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
        const result = await cteAPI.list({ q: buscaCte, page_size: 20 });
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
        const result = await motoristasAPI.list({ q: buscaCondutor, page_size: 20 });
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
    <div className={styles.page}>
      <PageHeader
        title={isEditing ? 'Editar Pagamento Proprio' : 'Novo Pagamento Proprio'}
        subtitle={isEditing ? 'Atualize os dados do pagamento' : 'Cadastre um novo pagamento para veiculo proprio'}
      />

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert" aria-live="polite">
          {error}
          <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar mensagem de erro">&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.formSection}>
          <h3>Vincular CT-e (Opcional)</h3>
          <p className={`${styles.formHint} ${styles.mb15} ${styles.textMuted}`}>
            Digite o numero do CT-e para buscar e vincular automaticamente
          </p>

          {!cteSelecionado ? (
            <div className={`${styles.formGroup} ${styles.searchFieldWrapper}`}>
              <label htmlFor="busca_cte">Buscar CT-e</label>
              <input
                id="busca_cte"
                type="text"
                value={buscaCte}
                onChange={(e) => setBuscaCte(e.target.value)}
                placeholder="Digite o número do CT-e..."
                autoComplete="off"
              />
              {loadingBusca && (
                <small className={styles.formHint}>Buscando...</small>
              )}

              {/* Lista de resultados da busca */}
              {mostrarResultados && resultadosBusca.length > 0 && (
                <div className={styles.searchResultsDropdown}>
                  {resultadosBusca.map(cte => (
                    <div
                      key={cte.id}
                      className={styles.searchResultCard}
                      onClick={() => handleSelecionarCte(cte)}
                    >
                      <div className={styles.resultTitle}>
                        CT-e #{cte.numero_cte || cte.numero}
                      </div>
                      <div className={styles.resultSubtitle}>
                        {cte.remetente_nome || 'N/I'} → {cte.destinatario_nome || 'N/I'}
                      </div>
                      <div className={styles.resultValue}>
                        R$ {(cte.valor_total || cte.valor_prestacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {mostrarResultados && resultadosBusca.length === 0 && buscaCte.length >= 2 && !loadingBusca && (
                <small className={`${styles.formHint} ${styles.textDanger}`}>
                  Nenhum CT-e encontrado com esse numero
                </small>
              )}
            </div>
          ) : (
            /* CT-e selecionado - exibe card com detalhes */
            <div className={`${styles.selectedCard} ${styles.cteSelected}`}>
              <button
                type="button"
                onClick={handleRemoverCte}
                className={`${styles.btnRemoveCircle} ${styles.btnSm}`}
                title="Remover CT-e"
              >
                ×
              </button>
              <span className={styles.selectedBadge}>
                CT-e VINCULADO
              </span>
              <div className={styles.selectedTitle}>
                CT-e #{cteSelecionado.numero_cte || cteSelecionado.numero}
              </div>
              <div className={styles.selectedSubtitle}>
                <div><strong>Remetente:</strong> {cteSelecionado.remetente_nome || 'N/I'}</div>
                <div><strong>Destinatario:</strong> {cteSelecionado.destinatario_nome || 'N/I'}</div>
              </div>
              <div className={styles.selectedValue}>
                Valor: R$ {(cteSelecionado.valor_total || cteSelecionado.valor_prestacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>

        <div className={styles.formSection}>
          <h3>Dados do Condutor</h3>

          {/* Busca de Condutor por Nome */}
          {!condutorSelecionado ? (
            <div className={`${styles.formGroup} ${styles.searchFieldWrapper}`}>
              <label htmlFor="busca_condutor">Buscar Nome do Condutor</label>
              <small className={`${styles.formHint} ${styles.mb10} ${styles.textMuted}`}>
                Digite o nome do motorista para buscar e vincular automaticamente
              </small>
              <input
                id="busca_condutor"
                type="text"
                value={buscaCondutor}
                onChange={(e) => setBuscaCondutor(e.target.value)}
                placeholder="Digite o nome do motorista..."
                autoComplete="off"
              />
              {loadingCondutor && (
                <small className={styles.formHint}>Buscando...</small>
              )}

              {/* Lista de resultados da busca de condutor */}
              {mostrarResultadosCondutor && resultadosCondutor.length > 0 && (
                <div className={styles.searchResultsDropdown}>
                  {resultadosCondutor.map((motorista, index) => (
                    <div
                      key={`motorista-${motorista.id}-${index}`}
                      className={styles.searchResultCard}
                      onClick={() => handleSelecionarCondutor(motorista)}
                    >
                      <div className={styles.resultTitle}>
                        {motorista.nome}
                      </div>
                      {motorista.cpf && (
                        <div className={styles.resultSubtitle}>
                          CPF: {motorista.cpf_formatado || motorista.cpf}
                        </div>
                      )}
                      {motorista.categoria_cnh && (
                        <div className={`${styles.resultMeta} ${styles.textSuccess}`}>
                          CNH: {motorista.categoria_cnh}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mostrarResultadosCondutor && resultadosCondutor.length === 0 && buscaCondutor.length >= 2 && !loadingCondutor && (
                <small className={`${styles.formHint} ${styles.textDanger}`}>
                  Nenhum motorista encontrado
                </small>
              )}
            </div>
          ) : (
            /* Condutor selecionado - exibe card com detalhes */
            <div className={`${styles.selectedCard} ${styles.condutorSelected}`}>
              <button
                type="button"
                onClick={handleRemoverCondutor}
                className={`${styles.btnRemoveCircle} ${styles.btnSm}`}
                title="Remover condutor"
              >
                ×
              </button>
              <span className={styles.selectedBadge}>
                MOTORISTA VINCULADO
              </span>
              <div className={styles.selectedTitle}>
                {condutorSelecionado.nome}
              </div>
              {condutorSelecionado.cpf && (
                <div className={styles.selectedSubtitle}>
                  CPF: {condutorSelecionado.cpf_formatado || condutorSelecionado.cpf}
                </div>
              )}
              {condutorSelecionado.categoria_cnh && (
                <div className={`${styles.selectedMeta} ${styles.textSuccess}`}>
                  CNH: {condutorSelecionado.categoria_cnh}
                </div>
              )}
            </div>
          )}

          {/* Busca de Veículo por Placa */}
          {!veiculoSelecionado ? (
            <div className={`${styles.formGroup} ${styles.searchFieldWrapper}`}>
              <label htmlFor="busca_veiculo">Placa do Veículo *</label>
              <small className={`${styles.formHint} ${styles.mb10} ${styles.textMuted}`}>
                Digite a placa do veiculo para buscar e vincular automaticamente
              </small>
              <input
                id="busca_veiculo"
                type="text"
                value={buscaVeiculo}
                onChange={(e) => setBuscaVeiculo(e.target.value.toUpperCase())}
                placeholder="Digite a placa do veículo..."
                autoComplete="off"
                className={styles.inputUppercase}
              />
              {loadingVeiculo && (
                <small className={styles.formHint}>Buscando...</small>
              )}

              {/* Lista de resultados da busca de veiculo */}
              {mostrarResultadosVeiculo && resultadosVeiculo.length > 0 && (
                <div className={styles.searchResultsDropdown}>
                  {resultadosVeiculo.map((veiculo, index) => (
                    <div
                      key={`veiculo-${veiculo.id}-${index}`}
                      className={styles.searchResultCard}
                      onClick={() => handleSelecionarVeiculo(veiculo)}
                    >
                      <div className={styles.resultTitle}>
                        {veiculo.placa}
                      </div>
                      <div className={styles.resultSubtitle}>
                        {veiculo.tipo_carroceria || veiculo.tipo_rodado || 'Tipo N/I'}
                      </div>
                      {veiculo.proprietario_nome && (
                        <div className={styles.resultMeta}>
                          Proprietario: {veiculo.proprietario_nome}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mostrarResultadosVeiculo && resultadosVeiculo.length === 0 && buscaVeiculo.length >= 2 && !loadingVeiculo && (
                <small className={`${styles.formHint} ${styles.textDanger}`}>
                  Nenhum veiculo proprio encontrado com essa placa
                </small>
              )}
            </div>
          ) : (
            /* Veículo selecionado - exibe card com detalhes */
            <div className={`${styles.selectedCard} ${styles.veiculoSelected}`}>
              <button
                type="button"
                onClick={handleRemoverVeiculo}
                className={`${styles.btnRemoveCircle} ${styles.btnSm}`}
                title="Remover veículo"
              >
                ×
              </button>
              <span className={styles.selectedBadge}>
                VEICULO VINCULADO
              </span>
              <div className={styles.selectedTitle}>
                {veiculoSelecionado.placa}
              </div>
              <div className={styles.selectedSubtitle}>
                {veiculoSelecionado.modelo || 'Modelo N/I'} {veiculoSelecionado.marca ? `- ${veiculoSelecionado.marca}` : ''}
              </div>
              {veiculoSelecionado.proprietario_nome && (
                <div className={styles.selectedMeta}>
                  Proprietario: {veiculoSelecionado.proprietario_nome}
                </div>
              )}
            </div>
          )}

          {/* Campo CPF oculto mas editavel se necessario */}
          <div className={styles.formGroup}>
            <label htmlFor="motorista_cpf">CPF do Condutor</label>
            <input
              id="motorista_cpf"
              type="text"
              name="motorista_cpf"
              value={formData.motorista_cpf}
              onChange={handleCPFChange}
              maxLength="11"
              placeholder="00000000000"
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Quilometragem e Valores</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="km_total_periodo">Quilometragem (KM)</label>
              <input
                id="km_total_periodo"
                type="number"
                name="km_total_periodo"
                value={formData.km_total_periodo}
                onChange={handleKmChange}
                min="0"
                placeholder="Digite a KM para calcular o valor"
              />
              {calculandoFaixa && (
                <small className={`${styles.formHint} ${styles.textSuccess}`}>Buscando faixa...</small>
              )}
              {faixaKmInfo && (
                <small className={`${styles.formHint} ${styles.textSuccess}`}>
                  Faixa: {faixaKmInfo.min_km} - {faixaKmInfo.max_km || '+'} km = R$ {faixaKmInfo.valor_pago}
                </small>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="valor_base_faixa">Valor Base / Repasse (R$) *</label>
              <input
                id="valor_base_faixa"
                type="number"
                step="0.01"
                name="valor_base_faixa"
                value={formData.valor_base_faixa}
                onChange={handleChange}
                required
                min="0"
                placeholder="0.00"
              />
              <small className={styles.formHint}>Calculado pela faixa de KM ou manual</small>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="ajustes">Ajustes (R$)</label>
              <input
                id="ajustes"
                type="number"
                step="0.01"
                name="ajustes"
                value={formData.ajustes}
                onChange={handleChange}
                placeholder="0.00"
              />
              <small className={styles.formHint}>Adicional ou desconto</small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="valor_total">Valor Total a Pagar (R$)</label>
              <input
                id="valor_total"
                type="text"
                value={`R$ ${valorTotal.toFixed(2)}`}
                disabled
                className={styles.inputCalculated}
              />
              <small className={styles.formHint}>Calculado automaticamente</small>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Datas e Status</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="periodo">Período (AAAA-MM) *</label>
              <input
                id="periodo"
                type="month"
                name="periodo"
                value={formData.periodo}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="data_prevista">Data Prevista</label>
              <input
                id="data_prevista"
                type="date"
                name="data_prevista"
                value={formData.data_prevista}
                onChange={handleChange}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="data_pagamento">Data Pagamento</label>
              <input
                id="data_pagamento"
                type="date"
                name="data_pagamento"
                value={formData.data_pagamento || ''}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="status">Status *</label>
              <select
                id="status"
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

          <div className={styles.formGroup}>
            <label htmlFor="obs">Observações</label>
            <textarea
              id="obs"
              name="obs"
              value={formData.obs}
              onChange={handleChange}
              rows="3"
              placeholder="Observações adicionais..."
            />
          </div>

          {/* Campo de comprovante apenas na criacao */}
          {!isEditing && (
            <div className={styles.formGroup}>
              <label htmlFor="comprovante">Comprovante de Pagamento (opcional)</label>
              <input
                id="comprovante"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setComprovanteFile(e.target.files[0] || null)}
                className={styles.fileInput}
              />
              {comprovanteFile && (
                <small className={`${styles.formHint} ${styles.textMuted}`}>
                  Arquivo selecionado: {comprovanteFile.name}
                </small>
              )}
            </div>
          )}
        </div>

        <div className={styles.formActions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/pagamentos')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
          >
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Pagamento')}
          </Button>
        </div>
      </form>

    </div>
  );
}

export default PagamentoProprioForm;
