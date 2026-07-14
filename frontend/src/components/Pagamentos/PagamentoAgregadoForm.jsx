import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pagamentosAPI, cteAPI, motoristasAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import styles from './PagamentoForm.module.css';

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

  // Busca de Veículo (por placa)
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

  const loadPagamento = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    if (isEditing) {
      loadPagamento();
    }
  }, [isEditing, loadPagamento]);

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
        const result = await motoristasAPI.list({ q: buscaCondutor, page_size: 20 });
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
        const result = await veiculosAPI.list({ q: buscaVeiculo, page_size: 20 });
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
    <div className={styles.page}>
      <PageHeader
        title={isEditing ? 'Editar Pagamento Agregado' : 'Novo Pagamento Agregado'}
        subtitle={isEditing ? 'Atualize os dados do pagamento' : 'Cadastre um novo pagamento para motorista agregado'}
      />

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert" aria-live="polite">
          {error}
          <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar mensagem de erro">&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.formSection}>
          <h3>Vincular CT-e (Obrigatório)</h3>
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
                      className={`search-result-card ${cte.tem_pagamento_agregado ? 'result-disabled' : ''}`}
                      onClick={() => !cte.tem_pagamento_agregado && handleSelecionarCte(cte)}
                    >
                      <div className={styles.resultTitle}>
                        CT-e #{cte.numero_cte || cte.numero}
                        {cte.tem_pagamento_agregado && (
                          <span className={styles.resultTag}>Já tem pagamento</span>
                        )}
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
                  Nenhum veiculo encontrado com essa placa
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
            <label htmlFor="condutor_cpf">CPF do Condutor</label>
            <input
              id="condutor_cpf"
              type="text"
              name="condutor_cpf"
              value={formData.condutor_cpf}
              onChange={handleCPFChange}
              maxLength="11"
              placeholder="00000000000"
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Valores</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="valor_frete_total">Valor do Frete Total (R$) *</label>
              <input
                id="valor_frete_total"
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

            <div className={styles.formGroup}>
              <label htmlFor="percentual_repasse">Percentual de Repasse (%) *</label>
              <input
                id="percentual_repasse"
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

            <div className={styles.formGroup}>
              <label htmlFor="desconto">Desconto (R$)</label>
              <input
                id="desconto"
                type="number"
                step="0.01"
                name="desconto"
                value={formData.desconto}
                onChange={handleChange}
                min="0"
                placeholder="0.00"
              />
              <small className={styles.formHint}>Desconto sobre o valor a repassar</small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="valor_repassar">Valor a Repassar (R$)</label>
              <input
                id="valor_repassar"
                type="text"
                value={`R$ ${valorRepassado}`}
                disabled
                className={styles.inputCalculated}
              />
              <small className={styles.formHint}>Calculado: (Frete × %) − Desconto</small>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Datas e Status</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="data_prevista">Data Prevista *</label>
              <input
                id="data_prevista"
                type="date"
                name="data_prevista"
                value={formData.data_prevista}
                onChange={handleChange}
                required
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

          {/* Campo de comprovante na criacao e edicao */}
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

export default PagamentoAgregadoForm;
