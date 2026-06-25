import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { planoManutencaoAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import './PlanosManutencao.css';

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
    <div className="planos-manutencao-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Plano de Manutenção' : 'Novo Plano de Manutenção'}</h1>
          <p>{isEditing ? 'Atualize os dados do plano' : 'Cadastre um plano preventivo, preditivo ou corretivo'}</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="alert-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="planos-form-container">
        <div className="planos-form-section">
          <h3>Informações Básicas</h3>
          <div className="planos-form-row">
            <div className="planos-form-group">
              <label>Veículo *</label>
              <select name="veiculo" value={formData.veiculo} onChange={handleChange} required>
                <option value="">Selecione</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>{v.placa}</option>
                ))}
              </select>
            </div>
            <div className="planos-form-group">
              <label>Tipo *</label>
              <select name="tipo" value={formData.tipo} onChange={handleChange} required>
                <option value="preventiva">Preventiva</option>
                <option value="corretiva">Corretiva</option>
                <option value="preditiva">Preditiva</option>
              </select>
            </div>
            <div className="planos-form-group">
              <label>Ativo</label>
              <input
                type="checkbox"
                name="ativo"
                checked={formData.ativo}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="planos-form-row-2">
            <div className="planos-form-group">
              <label>Descrição do Serviço *</label>
              <input
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

        <div className="planos-form-section">
          <h3>Intervalos</h3>
          <div className="planos-form-row">
            <div className="planos-form-group">
              <label>Intervalo (KM)</label>
              <input
                type="number"
                name="intervalo_km"
                value={formData.intervalo_km}
                onChange={handleChange}
                min="0"
                placeholder="Ex: 10000"
              />
            </div>
            <div className="planos-form-group">
              <label>Intervalo (Dias)</label>
              <input
                type="number"
                name="intervalo_dias"
                value={formData.intervalo_dias}
                onChange={handleChange}
                min="0"
                placeholder="Ex: 180"
              />
            </div>
            <div className="planos-form-group"></div>
          </div>
        </div>

        <div className="planos-form-section">
          <h3>Última Manutenção</h3>
          <div className="planos-form-row">
            <div className="planos-form-group">
              <label>Última KM</label>
              <input
                type="number"
                name="ultima_km"
                value={formData.ultima_km}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className="planos-form-group">
              <label>Última Data</label>
              <input
                type="date"
                name="ultima_data"
                value={formData.ultima_data}
                onChange={handleChange}
              />
            </div>
            <div className="planos-form-group"></div>
          </div>
        </div>

        <div className="planos-form-section">
          <h3>Próxima Manutenção (ou deixe em branco para calcular)</h3>
          <div className="planos-form-row">
            <div className="planos-form-group">
              <label>Próxima KM</label>
              <input
                type="number"
                name="proxima_km"
                value={formData.proxima_km}
                onChange={handleChange}
                min="0"
              />
            </div>
            <div className="planos-form-group">
              <label>Próxima Data</label>
              <input
                type="date"
                name="proxima_data"
                value={formData.proxima_data}
                onChange={handleChange}
              />
            </div>
            <div className="planos-form-group"></div>
          </div>
        </div>

        <div className="planos-form-section">
          <h3>Observações</h3>
          <div className="planos-form-row-2">
            <div className="planos-form-group">
              <textarea
                name="observacao"
                value={formData.observacao}
                onChange={handleChange}
                placeholder="Informações adicionais sobre o plano"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/planos-manutencao')}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Plano')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PlanoManutencaoForm;
