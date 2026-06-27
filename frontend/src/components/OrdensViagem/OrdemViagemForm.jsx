import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ordemViagemAPI, veiculosAPI, motoristasAPI, clientesAPI, cteAPI, ciotAPI
} from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import TableContainer from '../Common/TableContainer';
import PageHeader from '../Common/PageHeader';
import styles from './OrdemViagemForm.module.css';

function OrdemViagemForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ctesDisponiveis, setCtesDisponiveis] = useState([]);
  const [ciotsDisponiveis, setCiotsDisponiveis] = useState([]);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    numero: '',
    tipo: 'carga',
    status: 'rascunho',
    cliente: '',
    veiculo: '',
    motorista: '',
    data_saida: '',
    data_retorno: '',
    data_previsao_chegada: '',
    km_inicial: '',
    km_final: '',
    origem_uf: '',
    origem_cidade: '',
    origem_latitude: '',
    origem_longitude: '',
    destino_uf: '',
    destino_cidade: '',
    destino_latitude: '',
    destino_longitude: '',
    ciot: '',
    observacoes: '',
    ctes: [],
    paradas: []
  });

  useEffect(() => {
    loadOptions();
    if (isEditing) {
      loadOrdem();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadOptions = async () => {
    try {
      const [vRes, mRes, cRes, cteRes, ciotRes] = await Promise.all([
        veiculosAPI.list({ ativo: true }),
        motoristasAPI.list({ ativo: true }),
        clientesAPI.list({ ativo: true }),
        cteAPI.list({ limit: 100 }),
        ciotAPI.list({ disponiveis: 'true' })
      ]);
      setVeiculos(vRes.results || vRes);
      setMotoristas(mRes.results || mRes);
      setClientes(cRes.results || cRes);
      setCtesDisponiveis(cteRes.results || cteRes);
      setCiotsDisponiveis(ciotRes.results || ciotRes);
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
      toast.error('Erro ao carregar opções do formulário.');
    }
  };

  const loadOrdem = async () => {
    try {
      setLoading(true);
      const result = await ordemViagemAPI.get(id);
      setFormData({
        numero: result.numero || '',
        tipo: result.tipo || 'carga',
        status: result.status || 'rascunho',
        cliente: result.cliente ? String(result.cliente) : '',
        veiculo: result.veiculo ? String(result.veiculo) : '',
        motorista: result.motorista ? String(result.motorista) : '',
        data_saida: result.data_saida ? formatDateTimeLocal(result.data_saida) : '',
        data_retorno: result.data_retorno ? formatDateTimeLocal(result.data_retorno) : '',
        data_previsao_chegada: result.data_previsao_chegada ? formatDateTimeLocal(result.data_previsao_chegada) : '',
        km_inicial: result.km_inicial || '',
        km_final: result.km_final || '',
        origem_uf: result.origem_uf || '',
        origem_cidade: result.origem_cidade || '',
        origem_latitude: result.origem_latitude || '',
        origem_longitude: result.origem_longitude || '',
        destino_uf: result.destino_uf || '',
        destino_cidade: result.destino_cidade || '',
        destino_latitude: result.destino_latitude || '',
        destino_longitude: result.destino_longitude || '',
        ciot: result.ciot || '',
        observacoes: result.observacoes || '',
        ctes: (result.ctes || []).map(c => ({
          cte: c.cte_id,
          ordem_entrega: c.ordem_entrega || 1
        })),
        paradas: (result.paradas || []).map(p => ({
          tipo: p.tipo,
          sequencia: p.sequencia,
          cidade: p.cidade || '',
          uf: p.uf || '',
          latitude: p.latitude || '',
          longitude: p.longitude || '',
          data_previsao: p.data_previsao ? formatDateTimeLocal(p.data_previsao) : '',
          data_realizada: p.data_realizada ? formatDateTimeLocal(p.data_realizada) : '',
          observacao: p.observacao || ''
        }))
      });
    } catch (err) {
      console.error('Erro ao carregar ordem de viagem:', err);
      setError('Erro ao carregar ordem de viagem.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCte = () => {
    setFormData(prev => ({
      ...prev,
      ctes: [...prev.ctes, { cte: '', ordem_entrega: prev.ctes.length + 1 }]
    }));
  };

  const handleRemoveCte = (index) => {
    setFormData(prev => ({
      ...prev,
      ctes: prev.ctes.filter((_, i) => i !== index)
    }));
  };

  const handleCteChange = (index, field, value) => {
    setFormData(prev => {
      const ctes = [...prev.ctes];
      ctes[index] = { ...ctes[index], [field]: value };
      return { ...prev, ctes };
    });
  };

  const handleAddParada = () => {
    setFormData(prev => ({
      ...prev,
      paradas: [...prev.paradas, {
        tipo: 'parada',
        sequencia: prev.paradas.length + 1,
        cidade: '',
        uf: '',
        latitude: '',
        longitude: '',
        data_previsao: '',
        data_realizada: '',
        observacao: ''
      }]
    }));
  };

  const handleRemoveParada = (index) => {
    setFormData(prev => ({
      ...prev,
      paradas: prev.paradas.filter((_, i) => i !== index)
    }));
  };

  const handleParadaChange = (index, field, value) => {
    setFormData(prev => {
      const paradas = [...prev.paradas];
      paradas[index] = { ...paradas[index], [field]: value };
      return { ...prev, paradas };
    });
  };

  const buildPayload = () => {
    return {
      ...formData,
      cliente: formData.cliente || null,
      motorista: formData.motorista || null,
      veiculo: formData.veiculo,
      data_saida: formData.data_saida || null,
      data_retorno: formData.data_retorno || null,
      data_previsao_chegada: formData.data_previsao_chegada || null,
      km_inicial: formData.km_inicial ? parseInt(formData.km_inicial, 10) : null,
      km_final: formData.km_final ? parseInt(formData.km_final, 10) : null,
      ctes: formData.ctes.filter(c => c.cte).map(c => ({
        cte: c.cte,
        ordem_entrega: parseInt(c.ordem_entrega, 10) || 1
      })),
      paradas: formData.paradas.map(p => ({
        ...p,
        sequencia: parseInt(p.sequencia, 10) || 1,
        data_previsao: p.data_previsao || null,
        data_realizada: p.data_realizada || null
      }))
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const dataToSend = buildPayload();

      if (isEditing) {
        await ordemViagemAPI.update(id, dataToSend);
        toast.success('Ordem de viagem atualizada com sucesso!');
      } else {
        await ordemViagemAPI.create(dataToSend);
        toast.success('Ordem de viagem criada com sucesso!');
      }
      setTimeout(() => navigate('/ordens-viagem'), 500);
    } catch (err) {
      console.error('Erro ao salvar ordem de viagem:', err);
      setError('Erro ao salvar ordem de viagem. ' + err.message);
      toast.error('Erro ao salvar ordem de viagem.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className={styles.page}>
      <PageHeader
        title={isEditing ? 'Editar Ordem de Viagem' : 'Nova Ordem de Viagem'}
        subtitle={isEditing ? 'Atualize os dados da viagem' : 'Cadastre uma nova ordem de serviço'}
      />

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          {error}
          <button className={styles.alertClose} onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.formSection}>
          <h3>Informações Básicas</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Número</label>
              <input
                type="text"
                name="numero"
                value={formData.numero}
                onChange={handleChange}
                placeholder="Gerado automaticamente se vazio"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Tipo</label>
              <select name="tipo" value={formData.tipo} onChange={handleChange}>
                <option value="carga">Carga</option>
                <option value="descarga">Descarga</option>
                <option value="transferencia">Transferência</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="rascunho">Rascunho</option>
                <option value="agendada">Agendada</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Veículo *</label>
              <select name="veiculo" value={formData.veiculo} onChange={handleChange} required>
                <option value="">Selecione</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>{v.placa}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Motorista</label>
              <select name="motorista" value={formData.motorista} onChange={handleChange}>
                <option value="">Selecione</option>
                {motoristas.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Cliente</label>
              <select name="cliente" value={formData.cliente} onChange={handleChange}>
                <option value="">Selecione</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.razao_social}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Datas e Quilometragem</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Data/Hora Saída</label>
              <input
                type="datetime-local"
                name="data_saida"
                value={formData.data_saida}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Previsão Chegada</label>
              <input
                type="datetime-local"
                name="data_previsao_chegada"
                value={formData.data_previsao_chegada}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Data/Hora Retorno</label>
              <input
                type="datetime-local"
                name="data_retorno"
                value={formData.data_retorno}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>KM Inicial</label>
              <input
                type="number"
                name="km_inicial"
                value={formData.km_inicial}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label>KM Final</label>
              <input
                type="number"
                name="km_final"
                value={formData.km_final}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Distância (KM)</label>
              <input
                type="text"
                value={formData.km_inicial && formData.km_final
                  ? formData.km_final - formData.km_inicial
                  : '-'}
                readOnly
                disabled
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Rota</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Origem - Cidade</label>
              <input
                type="text"
                name="origem_cidade"
                value={formData.origem_cidade}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Origem - UF</label>
              <input
                type="text"
                name="origem_uf"
                value={formData.origem_uf}
                onChange={handleChange}
                maxLength="2"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Origem - Latitude</label>
              <input
                type="number"
                step="any"
                name="origem_latitude"
                value={formData.origem_latitude}
                onChange={handleChange}
                placeholder="-23.5505"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Origem - Longitude</label>
              <input
                type="number"
                step="any"
                name="origem_longitude"
                value={formData.origem_longitude}
                onChange={handleChange}
                placeholder="-46.6333"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Destino - Cidade</label>
              <input
                type="text"
                name="destino_cidade"
                value={formData.destino_cidade}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Destino - UF</label>
              <input
                type="text"
                name="destino_uf"
                value={formData.destino_uf}
                onChange={handleChange}
                maxLength="2"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Destino - Latitude</label>
              <input
                type="number"
                step="any"
                name="destino_latitude"
                value={formData.destino_latitude}
                onChange={handleChange}
                placeholder="-23.5505"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Destino - Longitude</label>
              <input
                type="number"
                step="any"
                name="destino_longitude"
                value={formData.destino_longitude}
                onChange={handleChange}
                placeholder="-46.6333"
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>CT-es Vinculados</h3>
          <div className={styles.itemsSection}>
            {formData.ctes.length === 0 && (
              <p className={styles.emptyText}>Nenhum CT-e vinculado.</p>
            )}
            {formData.ctes.map((cte, index) => (
              <div key={index} className={styles.itemRow}>
                <select
                  value={cte.cte}
                  onChange={(e) => handleCteChange(index, 'cte', e.target.value)}
                >
                  <option value="">Selecione um CT-e</option>
                  {ctesDisponiveis.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.numero_cte || c.chave} - {c.remetente_nome}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Ordem"
                  value={cte.ordem_entrega}
                  onChange={(e) => handleCteChange(index, 'ordem_entrega', e.target.value)}
                  min="1"
                />
                <button
                  type="button"
                  className={styles.btnIcon}
                  onClick={() => handleRemoveCte(index)}
                  title="Remover"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={handleAddCte}>
              + Vincular CT-e
            </Button>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Paradas</h3>
          <div className={styles.itemsSection}>
            {formData.paradas.length === 0 && (
              <p className={styles.emptyText}>Nenhuma parada cadastrada.</p>
            )}
            {formData.paradas.map((parada, index) => (
              <div key={index} className={`${styles.itemRow} ${styles.paradaRow}`}>
                <select
                  value={parada.tipo}
                  onChange={(e) => handleParadaChange(index, 'tipo', e.target.value)}
                >
                  <option value="coleta">Coleta</option>
                  <option value="entrega">Entrega</option>
                  <option value="parada">Parada</option>
                  <option value="outros">Outros</option>
                </select>
                <input
                  type="text"
                  placeholder="Cidade"
                  value={parada.cidade}
                  onChange={(e) => handleParadaChange(index, 'cidade', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="UF"
                  value={parada.uf}
                  onChange={(e) => handleParadaChange(index, 'uf', e.target.value)}
                  maxLength="2"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={parada.latitude}
                  onChange={(e) => handleParadaChange(index, 'latitude', e.target.value)}
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={parada.longitude}
                  onChange={(e) => handleParadaChange(index, 'longitude', e.target.value)}
                />
                <input
                  type="datetime-local"
                  value={parada.data_previsao}
                  onChange={(e) => handleParadaChange(index, 'data_previsao', e.target.value)}
                />
                <button
                  type="button"
                  className={styles.btnIcon}
                  onClick={() => handleRemoveParada(index)}
                  title="Remover"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={handleAddParada}>
              + Adicionar Parada
            </Button>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>CIOT</h3>
          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label>Código CIOT Vinculado</label>
              <select
                name="ciot"
                value={formData.ciot}
                onChange={handleChange}
              >
                <option value="">Selecione um CIOT disponível</option>
                {ciotsDisponiveis.map(ciot => (
                  <option key={ciot.id} value={ciot.id}>
                    {ciot.codigo} {ciot.descricao ? `- ${ciot.descricao}` : ''}
                    {ciot.origem_cidade ? ` (${ciot.origem_cidade} → ${ciot.destino_cidade})` : ''}
                  </option>
                ))}
                {isEditing && formData.ciot && !ciotsDisponiveis.find(c => c.id === formData.ciot) && (
                  <option value={formData.ciot} disabled>CIOT atual (já usado)</option>
                )}
              </select>
              <p className={styles.fieldHelp}>O CIOT vinculado será automaticamente marcado como usado ao salvar.</p>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Observações</h3>
          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                placeholder="Informações adicionais sobre a viagem"
              />
            </div>
          </div>
        </div>

        {isEditing && <RastreamentoPanel ordemId={id} />}
        {isEditing && <RoteirizacaoPanel ordemId={id} />}

        <div className={styles.formActions}>
          <Button type="button" variant="secondary" onClick={() => navigate('/ordens-viagem')}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar OS')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function RoteirizacaoPanel({ ordemId }) {
  const toast = useToast();
  const [rotas, setRotas] = useState([]);
  const [rotaAtual, setRotaAtual] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadRotas = async () => {
    try {
      const result = await ordemViagemAPI.listarRotas(ordemId);
      setRotas(result);
    } catch (err) {
      console.error('Erro ao carregar rotas:', err);
    }
  };

  const handleCalcularRota = async (otimizar = true) => {
    try {
      setLoading(true);
      const result = await ordemViagemAPI.calcularRota(ordemId, { otimizar });
      setRotaAtual(result);
      toast.success('Rota calculada com sucesso!');
      loadRotas();
    } catch (err) {
      toast.error('Erro ao calcular rota: ' + (err.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRotas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordemId]);

  const waypoints = rotaAtual?.waypoints || [];
  const temCoordenadas = waypoints.length >= 2;

  let mapUrl = null;
  if (temCoordenadas) {
    const lats = waypoints.map(w => w.latitude);
    const lons = waypoints.map(w => w.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const bbox = `${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}`;
    const markers = waypoints.map(w => `marker=${w.latitude}%2C${w.longitude}`).join('&');
    mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&${markers}`;
  }

  return (
    <div className={styles.formSection}>
      <h3>Roteirização e Otimização de Rotas</h3>

      <div className={styles.kpiGrid}>
        <Button
          type="button"
          variant="primary"
          onClick={() => handleCalcularRota(true)}
          disabled={loading}
        >
          {loading ? 'Calculando...' : 'Calcular Rota Otimizada'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleCalcularRota(false)}
          disabled={loading}
        >
          Calcular Rota Original
        </Button>
      </div>

      {rotaAtual && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCardCompact}>
            <div className={styles.kpiLabel}>Distância</div>
            <div className={styles.kpiValue}>{rotaAtual.distancia_km} km</div>
          </div>
          <div className={styles.kpiCardCompact}>
            <div className={styles.kpiLabel}>Duração Estimada</div>
            <div className={styles.kpiValue}>{rotaAtual.duracao_min} min</div>
          </div>
          <div className={styles.kpiCardCompact}>
            <div className={styles.kpiLabel}>Provedor</div>
            <div className={`${styles.kpiValue} ${styles.kpiValueUppercase}`}>{rotaAtual.provedor}</div>
          </div>
        </div>
      )}

      {mapUrl && (
        <div className={styles.mapContainer}>
          <iframe
            title="Rota"
            width="100%"
            height="350"
            frameBorder="0"
            scrolling="no"
            src={mapUrl}
          />
        </div>
      )}

      {waypoints.length > 0 && (
        <div className={styles.tableWrapper}>
          <TableContainer mobileCards={false}>
            <table>
              <thead>
              <tr>
                <th>Ordem</th>
                <th>Descrição</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Próxima (km)</th>
                <th>Próxima (min)</th>
              </tr>
            </thead>
            <tbody>
              {waypoints.map((w, idx) => (
                <tr key={idx}>
                  <td>{w.ordem + 1}</td>
                  <td>{w.descricao}</td>
                  <td>{w.latitude.toFixed(6)}</td>
                  <td>{w.longitude.toFixed(6)}</td>
                  <td>{w.distancia_proximo_km ?? '-'}</td>
                  <td>{w.duracao_proximo_min ?? '-'}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </TableContainer>
        </div>
      )}

      {rotas.length > 0 && (
        <div className={styles.sectionMarginTop}>
          <h4>Rotas Calculadas Anteriormente</h4>
          <div className={styles.tableWrapper}>
            <TableContainer mobileCards={false}>
              <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Distância</th>
                  <th>Duração</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rotas.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.criado_em).toLocaleString('pt-BR')}</td>
                    <td>{r.distancia_km} km</td>
                    <td>{r.duracao_min} min</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </TableContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function RastreamentoPanel({ ordemId }) {
  const toast = useToast();
  const [eta, setEta] = useState(null);
  const [posicao, setPosicao] = useState({ latitude: '', longitude: '', velocidade: '' });
  const [loading, setLoading] = useState(false);

  const loadETA = async () => {
    try {
      setLoading(true);
      const result = await ordemViagemAPI.getETA(ordemId);
      setEta(result);
    } catch (err) {
      console.error('Erro ao carregar ETA:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarPosicao = async (e) => {
    e.preventDefault();
    try {
      await ordemViagemAPI.registrarPosicao(ordemId, {
        latitude: parseFloat(posicao.latitude),
        longitude: parseFloat(posicao.longitude),
        velocidade: posicao.velocidade ? parseFloat(posicao.velocidade) : null
      });
      toast.success('Posição registrada com sucesso!');
      setPosicao({ latitude: '', longitude: '', velocidade: '' });
      loadETA();
    } catch (err) {
      toast.error('Erro ao registrar posição: ' + err.message);
    }
  };

  useEffect(() => {
    loadETA();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordemId]);

  const mapUrl = eta?.ultima_posicao
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${eta.ultima_posicao.longitude - 0.05}%2C${eta.ultima_posicao.latitude - 0.05}%2C${eta.ultima_posicao.longitude + 0.05}%2C${eta.ultima_posicao.latitude + 0.05}&layer=mapnik&marker=${eta.ultima_posicao.latitude}%2C${eta.ultima_posicao.longitude}`
    : null;

  return (
    <div className={styles.formSection}>
      <h3>Rastreamento e ETA</h3>

      {eta && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Status</div>
            <div className={styles.kpiValue}>{eta.status.replace('_', ' ')}</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Distância Restante</div>
            <div className={styles.kpiValue}>{eta.distancia_restante_km ? `${eta.distancia_restante_km} km` : '-'}</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Previsão Chegada</div>
            <div className={styles.kpiValue}>{eta.eta_texto}</div>
          </div>
        </div>
      )}

      {mapUrl && (
        <div className={styles.mapContainer}>
          <iframe
            title="Mapa"
            width="100%"
            height="300"
            frameBorder="0"
            scrolling="no"
            src={mapUrl}
          />
        </div>
      )}

      <div className={styles.itemsSection}>
        <h4>Registrar Posição</h4>
        <form onSubmit={handleRegistrarPosicao}>
          <div className={`${styles.itemRow} ${styles.posicaoRow}`}>
            <input
              type="text"
              placeholder="Latitude"
              value={posicao.latitude}
              onChange={e => setPosicao({ ...posicao, latitude: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Longitude"
              value={posicao.longitude}
              onChange={e => setPosicao({ ...posicao, longitude: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Velocidade (km/h)"
              value={posicao.velocidade}
              onChange={e => setPosicao({ ...posicao, velocidade: e.target.value })}
            />
            <Button type="submit" variant="primary" disabled={loading}>Registrar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OrdemViagemForm;
