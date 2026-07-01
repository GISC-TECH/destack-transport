import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { planoManutencaoAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import styles from './PlanoManutencaoForm.module.css';

function PlanoManutencaoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    veiculo: '',
    tipo: 'preventiva',
    descricao: '',
    intervalo_km: '',
    intervalo_dias: '',
    ultima_km: '',
    ultima_data: '',
    proxima_km: '',
    proxima_data: '',
    ativo: true,
    observacao: ''
  });

  useEffect(() => {
    loadVeiculos();
    if (isEditing) {
      loadPlano();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadVeiculos = async () => {
    try {
      const result = await veiculosAPI.list({ ativo: true });
      setVeiculos(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
      setVeiculos([]);
    }
  };

  const loadPlano = async () => {
    try {
      setLoading(true);
      const result = await planoManutencaoAPI.get(id);
      setFormData({
        veiculo: result.veiculo ? String(result.veiculo) : '',
        tipo: result.tipo || 'preventiva',
        descricao: result.descricao || '',
        intervalo_km: result.intervalo_km || '',
        intervalo_dias: result.intervalo_dias || '',
        ultima_km: result.ultima_km || '',
        ultima_data: result.ultima_data || '',
        proxima_km: result.proxima_km || '',
        proxima_data: result.proxima_data || '',
        ativo: result.ativo !== undefined ? result.ativo : true,
        observacao: result.observacao || ''
      });
    } catch (err) {
      console.error('Erro ao carregar plano:', err);
      setError('Erro ao carregar plano de manutenção.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const buildPayload = () => {
    return {
      ...formData,
      veiculo: formData.veiculo,
      intervalo_km: formData.intervalo_km ? parseInt(formData.intervalo_km, 10) : null,
      intervalo_dias: formData.intervalo_dias ? parseInt(formData.intervalo_dias, 10) : null,
      ultima_km: formData.ultima_km ? parseInt(formData.ultima_km, 10) : null,
      proxima_km: formData.proxima_km ? parseInt(formData.proxima_km, 10) : null,
      ultima_data: formData.ultima_data || null,
      proxima_data: formData.proxima_data || null
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const dataToSend = buildPayload();

      if (isEditing) {
        await planoManutencaoAPI.update(id, dataToSend);
        toast.success('Plano de manutenção atualizado com sucesso!');
      } else {
        await planoManutencaoAPI.create(dataToSend);
        toast.success('Plano de manutenção criado com sucesso!');
      }
      setTimeout(() => navigate('/planos-manutencao'), 500);
    } catch (err) {
      console.error('Erro ao salvar plano:', err);
      setError('Erro ao salvar plano de manutenção. ' + err.message);
      toast.error('Erro ao salvar plano de manutenção.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className={styles.page}>
      <PageHeader
        title={isEditing ? 'Editar Plano de Manutenção' : 'Novo Plano de Manutenção'}
        subtitle={isEditing ? 'Atualize os dados do plano' : 'Cadastre um plano preventivo, preditivo ou corretivo'}
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
              <label htmlFor="tipo">Tipo *</label>
              <select id="tipo" name="tipo" value={formData.tipo} onChange={handleChange} required>
                <option value="preventiva">Preventiva</option>
                <option value="corretiva">Corretiva</option>
                <option value="preditiva">Preditiva</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel} htmlFor="ativo">Ativo</label>
              <input
                id="ativo"
                type="checkbox"
                name="ativo"
                checked={formData.ativo}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label htmlFor="descricao">Descrição do Serviço *</label>
              <input
                id="descricao"
                type="text"
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                required
                maxLength={255}
                placeholder="Ex: Troca de óleo e filtros"
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Intervalos</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="intervalo_km">Intervalo (KM)</label>
              <input
                id="intervalo_km"
                type="number"
                name="intervalo_km"
                value={formData.intervalo_km}
                onChange={handleChange}
                min="0"
                placeholder="Ex: 10000"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="intervalo_dias">Intervalo (Dias)</label>
              <input
                id="intervalo_dias"
                type="number"
                name="intervalo_dias"
                value={formData.intervalo_dias}
                onChange={handleChange}
                min="0"
                placeholder="Ex: 180"
              />
            </div>
            <div className={styles.formGroup}></div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Última Manutenção</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="ultima_km">Última KM</label>
              <input
                id="ultima_km"
                type="number"
                name="ultima_km"
                value={formData.ultima_km}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="ultima_data">Última Data</label>
              <input
                id="ultima_data"
                type="date"
                name="ultima_data"
                value={formData.ultima_data}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}></div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Próxima Manutenção (ou deixe em branco para calcular)</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="proxima_km">Próxima KM</label>
              <input
                id="proxima_km"
                type="number"
                name="proxima_km"
                value={formData.proxima_km}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="proxima_data">Próxima Data</label>
              <input
                id="proxima_data"
                type="date"
                name="proxima_data"
                value={formData.proxima_data}
                onChange={handleChange}
              />
            </div>
            <div className={styles.formGroup}></div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Observações</h3>
          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label htmlFor="observacao">Observação</label>
              <textarea
                id="observacao"
                name="observacao"
                value={formData.observacao}
                onChange={handleChange}
                placeholder="Informações adicionais sobre o plano"
              />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="button" variant="secondary" onClick={() => navigate('/planos-manutencao')}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Plano')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default PlanoManutencaoForm;
