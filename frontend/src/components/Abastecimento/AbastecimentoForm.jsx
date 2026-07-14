import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  abastecimentoAPI, veiculosAPI, motoristasAPI, ordemViagemAPI
} from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import styles from './AbastecimentoForm.module.css';

function AbastecimentoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    veiculo: '',
    motorista: '',
    ordem_viagem: '',
    data: '',
    hodometro: '',
    litros: '',
    valor_total: '',
    tipo_combustivel: 'diesel',
    posto: '',
    cnpj_posto: '',
    observacao: ''
  });
  const [comprovanteFile, setComprovanteFile] = useState(null);

  useEffect(() => {
    loadOptions();
    if (isEditing) {
      loadAbastecimento();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadOptions = async () => {
    try {
      const [vRes, mRes, oRes] = await Promise.all([
        veiculosAPI.list({ ativo: true }),
        motoristasAPI.list({ ativo: true }),
        ordemViagemAPI.list({ status: 'em_andamento' })
      ]);
      setVeiculos(vRes.results || vRes);
      setMotoristas(mRes.results || mRes);
      setOrdens(oRes.results || oRes);
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
      toast.error('Erro ao carregar opções do formulário.');
    }
  };

  const loadAbastecimento = async () => {
    try {
      setLoading(true);
      const result = await abastecimentoAPI.get(id);
      setFormData({
        veiculo: result.veiculo ? String(result.veiculo) : '',
        motorista: result.motorista ? String(result.motorista) : '',
        ordem_viagem: result.ordem_viagem ? String(result.ordem_viagem) : '',
        data: result.data || '',
        hodometro: result.hodometro || '',
        litros: result.litros || '',
        valor_total: result.valor_total || '',
        tipo_combustivel: result.tipo_combustivel || 'diesel',
        posto: result.posto || '',
        cnpj_posto: result.cnpj_posto || '',
        observacao: result.observacao || ''
      });
    } catch (err) {
      console.error('Erro ao carregar abastecimento:', err);
      setError('Erro ao carregar abastecimento.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const buildPayload = () => {
    const baseData = {
      veiculo: formData.veiculo,
      motorista: formData.motorista || null,
      ordem_viagem: formData.ordem_viagem || null,
      data: formData.data,
      hodometro: formData.hodometro ? parseInt(formData.hodometro, 10) : null,
      litros: formData.litros ? parseFloat(formData.litros) : null,
      valor_total: formData.valor_total ? parseFloat(formData.valor_total) : null,
      tipo_combustivel: formData.tipo_combustivel,
      posto: formData.posto || '',
      cnpj_posto: formData.cnpj_posto || '',
      observacao: formData.observacao || ''
    };

    if (comprovanteFile) {
      const data = new FormData();
      Object.keys(baseData).forEach(key => {
        if (baseData[key] !== null && baseData[key] !== '') {
          data.append(key, baseData[key]);
        }
      });
      data.append('comprovante', comprovanteFile);
      return data;
    }

    return baseData;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const dataToSend = buildPayload();

      if (isEditing) {
        await abastecimentoAPI.update(id, dataToSend);
        toast.success('Abastecimento atualizado com sucesso!');
      } else {
        await abastecimentoAPI.create(dataToSend);
        toast.success('Abastecimento registrado com sucesso!');
      }
      setTimeout(() => navigate('/abastecimentos'), 500);
    } catch (err) {
      console.error('Erro ao salvar abastecimento:', err);
      setError('Erro ao salvar abastecimento. ' + err.message);
      toast.error('Erro ao salvar abastecimento.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className={styles.page}>
      <PageHeader
        title={isEditing ? 'Editar Abastecimento' : 'Novo Abastecimento'}
        subtitle={isEditing ? 'Atualize os dados do abastecimento' : 'Registre um novo abastecimento da frota'}
      />

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert" aria-live="polite">
          {error}
          <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar mensagem de erro">&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.formSection}>
          <h3>Informações Básicas</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="veiculo">Veículo *</label>
              <select id="veiculo" name="veiculo" value={formData.veiculo} onChange={handleChange} required>
                <option value="">Selecione</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>{v.placa}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="motorista">Motorista</label>
              <select id="motorista" name="motorista" value={formData.motorista} onChange={handleChange}>
                <option value="">Selecione</option>
                {motoristas.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="ordem_viagem">Ordem de Viagem</label>
              <select id="ordem_viagem" name="ordem_viagem" value={formData.ordem_viagem} onChange={handleChange}>
                <option value="">Selecione</option>
                {ordens.map(o => (
                  <option key={o.id} value={o.id}>{o.numero}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="data">Data *</label>
              <input
                id="data"
                type="date"
                name="data"
                value={formData.data}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="tipo_combustivel">Tipo de Combustível *</label>
              <select id="tipo_combustivel" name="tipo_combustivel" value={formData.tipo_combustivel} onChange={handleChange} required>
                <option value="diesel">Diesel</option>
                <option value="diesel_s10">Diesel S10</option>
                <option value="arla">Arla 32</option>
                <option value="gasolina">Gasolina</option>
                <option value="etanol">Etanol</option>
                <option value="gnv">GNV</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="hodometro">Hodômetro (KM) *</label>
              <input
                id="hodometro"
                type="number"
                name="hodometro"
                value={formData.hodometro}
                onChange={handleChange}
                required
                min="0"
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Valores</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="litros">Litros *</label>
              <input
                id="litros"
                type="number"
                step="0.01"
                name="litros"
                value={formData.litros}
                onChange={handleChange}
                required
                min="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="valor_total">Valor Total (R$) *</label>
              <input
                id="valor_total"
                type="number"
                step="0.01"
                name="valor_total"
                value={formData.valor_total}
                onChange={handleChange}
                required
                min="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="preco_litro">Preço/L (calculado)</label>
              <input
                id="preco_litro"
                type="text"
                value={formData.litros && formData.valor_total && formData.litros > 0
                  ? `R$ ${(formData.valor_total / formData.litros).toFixed(3)}`
                  : '-'}
                readOnly
                disabled
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Fornecedor</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="posto">Posto/Fornecedor</label>
              <input
                id="posto"
                type="text"
                name="posto"
                value={formData.posto}
                onChange={handleChange}
                maxLength={120}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="cnpj_posto">CNPJ Posto</label>
              <input
                id="cnpj_posto"
                type="text"
                name="cnpj_posto"
                value={formData.cnpj_posto}
                onChange={handleChange}
                maxLength={18}
              />
            </div>
            <div className={styles.formGroup}></div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Observações e Comprovante</h3>
          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label htmlFor="observacao">Observação</label>
              <textarea
                id="observacao"
                name="observacao"
                value={formData.observacao}
                onChange={handleChange}
                placeholder="Informações adicionais sobre o abastecimento"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="comprovante">Comprovante (opcional)</label>
            <input
              id="comprovante"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setComprovanteFile(e.target.files[0] || null)}
              className={styles.fileInput}
            />
            {comprovanteFile && (
              <small className={styles.fileHint}>
                Arquivo selecionado: {comprovanteFile.name}
              </small>
            )}
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="button" variant="secondary" onClick={() => navigate('/abastecimentos')}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Registrar')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AbastecimentoForm;
