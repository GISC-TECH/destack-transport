import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tabelaFreteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import styles from './TabelaFrete.module.css';

function TabelaFreteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    origem_uf: '',
    origem_cidade: '',
    destino_uf: '',
    destino_cidade: '',
    tipo_veiculo: '',
    valor_por_km: '',
    valor_minimo: '',
    valor_tonelada: '',
    valor_m3: '',
    vigencia_inicio: '',
    vigencia_fim: '',
    ativo: true,
    observacao: ''
  });

  useEffect(() => {
    if (isEditing) {
      loadTabela();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadTabela = async () => {
    try {
      setLoading(true);
      const result = await tabelaFreteAPI.get(id);
      setFormData({
        origem_uf: result.origem_uf || '',
        origem_cidade: result.origem_cidade || '',
        destino_uf: result.destino_uf || '',
        destino_cidade: result.destino_cidade || '',
        tipo_veiculo: result.tipo_veiculo || '',
        valor_por_km: result.valor_por_km || '',
        valor_minimo: result.valor_minimo || '',
        valor_tonelada: result.valor_tonelada || '',
        valor_m3: result.valor_m3 || '',
        vigencia_inicio: result.vigencia_inicio || '',
        vigencia_fim: result.vigencia_fim || '',
        ativo: result.ativo !== undefined ? result.ativo : true,
        observacao: result.observacao || ''
      });
    } catch (err) {
      console.error('Erro ao carregar tabela:', err);
      setError('Erro ao carregar tabela de frete.');
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
      valor_por_km: formData.valor_por_km ? parseFloat(formData.valor_por_km) : 0,
      valor_minimo: formData.valor_minimo ? parseFloat(formData.valor_minimo) : 0,
      valor_tonelada: formData.valor_tonelada ? parseFloat(formData.valor_tonelada) : null,
      valor_m3: formData.valor_m3 ? parseFloat(formData.valor_m3) : null
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const dataToSend = buildPayload();

      if (isEditing) {
        await tabelaFreteAPI.update(id, dataToSend);
        toast.success('Tabela de frete atualizada com sucesso!');
      } else {
        await tabelaFreteAPI.create(dataToSend);
        toast.success('Tabela de frete criada com sucesso!');
      }
      setTimeout(() => navigate('/tabelas-frete'), 500);
    } catch (err) {
      console.error('Erro ao salvar tabela:', err);
      setError('Erro ao salvar tabela de frete. ' + err.message);
      toast.error('Erro ao salvar tabela de frete.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>
          <h1>{isEditing ? 'Editar Tabela de Frete' : 'Nova Tabela de Frete'}</h1>
          <p>{isEditing ? 'Atualize os dados da tabela' : 'Cadastre uma nova rota e valores'}</p>
        </div>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          {error}
          <button className={styles.alertClose} onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.formSection}>
          <h3>Rota</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Origem UF *</label>
              <input type="text" name="origem_uf" value={formData.origem_uf} onChange={handleChange} required maxLength="2" />
            </div>
            <div className={styles.formGroup}>
              <label>Origem Cidade *</label>
              <input type="text" name="origem_cidade" value={formData.origem_cidade} onChange={handleChange} required />
            </div>
            <div className={styles.formGroup}>
              <label>Destino UF *</label>
              <input type="text" name="destino_uf" value={formData.destino_uf} onChange={handleChange} required maxLength="2" />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Destino Cidade *</label>
              <input type="text" name="destino_cidade" value={formData.destino_cidade} onChange={handleChange} required />
            </div>
            <div className={styles.formGroup}>
              <label>Tipo de Veículo</label>
              <input type="text" name="tipo_veiculo" value={formData.tipo_veiculo} onChange={handleChange} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange} />
                Ativo
              </label>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Valores</h3>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Valor por KM (R$) *</label>
              <input type="number" step="0.01" name="valor_por_km" value={formData.valor_por_km} onChange={handleChange} required min="0" />
            </div>
            <div className={styles.formGroup}>
              <label>Valor Mínimo (R$) *</label>
              <input type="number" step="0.01" name="valor_minimo" value={formData.valor_minimo} onChange={handleChange} required min="0" />
            </div>
            <div className={styles.formGroup}>
              <label>Valor por Tonelada (R$)</label>
              <input type="number" step="0.01" name="valor_tonelada" value={formData.valor_tonelada} onChange={handleChange} min="0" />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Valor por M³ (R$)</label>
              <input type="number" step="0.01" name="valor_m3" value={formData.valor_m3} onChange={handleChange} min="0" />
            </div>
            <div className={styles.formGroup}>
              <label>Início Vigência *</label>
              <input type="date" name="vigencia_inicio" value={formData.vigencia_inicio} onChange={handleChange} required />
            </div>
            <div className={styles.formGroup}>
              <label>Fim Vigência</label>
              <input type="date" name="vigencia_fim" value={formData.vigencia_fim} onChange={handleChange} />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Observações</h3>
          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <textarea name="observacao" value={formData.observacao} onChange={handleChange} placeholder="Informações adicionais" />
            </div>
          </div>
        </div>

        <div className={styles.formActions}>
          <Button type="button" variant="secondary" onClick={() => navigate('/tabelas-frete')}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={saving}>
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Tabela')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default TabelaFreteForm;
