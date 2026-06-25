import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pedagioAPI, veiculosAPI, ordemViagemAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import './Pedagio.css';

function PedagioForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    veiculo: '',
    ordem: '',
    data: '',
    praca: '',
    rodovia: '',
    km: '',
    categoria: '',
    tag: '',
    valor: '',
    observacao: ''
  });

  useEffect(() => {
    loadOptions();
    if (isEditing) {
      loadPedagio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadOptions = async () => {
    try {
      const [vRes, oRes] = await Promise.all([
        veiculosAPI.list({ ativo: true }),
        ordemViagemAPI.list()
      ]);
      setVeiculos(vRes.results || vRes);
      setOrdens(oRes.results || oRes);
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
      toast.error('Erro ao carregar opções do formulário.');
    }
  };

  const loadPedagio = async () => {
    try {
      setLoading(true);
      const result = await pedagioAPI.get(id);
      setFormData({
        veiculo: result.veiculo ? String(result.veiculo) : '',
        ordem: result.ordem ? String(result.ordem) : '',
        data: result.data || '',
        praca: result.praca || '',
        rodovia: result.rodovia || '',
        km: result.km || '',
        categoria: result.categoria || '',
        tag: result.tag || '',
        valor: result.valor || '',
        observacao: result.observacao || ''
      });
    } catch (err) {
      console.error('Erro ao carregar pedágio:', err);
      setError('Erro ao carregar pedágio.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const buildPayload = () => {
    return {
      ...formData,
      veiculo: formData.veiculo,
      ordem: formData.ordem || null,
      km: formData.km ? parseInt(formData.km, 10) : null,
      valor: formData.valor ? parseFloat(formData.valor) : null
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const dataToSend = buildPayload();

      if (isEditing) {
        await pedagioAPI.update(id, dataToSend);
        toast.success('Pedágio atualizado com sucesso!');
      } else {
        await pedagioAPI.create(dataToSend);
        toast.success('Pedágio registrado com sucesso!');
      }
      setTimeout(() => navigate('/pedagios'), 500);
    } catch (err) {
      console.error('Erro ao salvar pedágio:', err);
      setError('Erro ao salvar pedágio. ' + err.message);
      toast.error('Erro ao salvar pedágio.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className="pedagio-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Pedágio' : 'Novo Pedágio'}</h1>
          <p>{isEditing ? 'Atualize os dados do pedágio' : 'Registre um novo pedágio'}</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="alert-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pedagio-form-container">
        <div className="pedagio-form-section">
          <h3>Informações Básicas</h3>
          <div className="pedagio-form-row">
            <div className="pedagio-form-group">
              <label>Veículo *</label>
              <select name="veiculo" value={formData.veiculo} onChange={handleChange} required>
                <option value="">Selecione</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>{v.placa}</option>
                ))}
              </select>
            </div>
            <div className="pedagio-form-group">
              <label>Ordem de Viagem</label>
              <select name="ordem" value={formData.ordem} onChange={handleChange}>
                <option value="">Selecione</option>
                {ordens.map(o => (
                  <option key={o.id} value={o.id}>{o.numero}</option>
                ))}
              </select>
            </div>
            <div className="pedagio-form-group">
              <label>Data *</label>
              <input type="date" name="data" value={formData.data} onChange={handleChange} required />
            </div>
          </div>

          <div className="pedagio-form-row">
            <div className="pedagio-form-group">
              <label>Praça/Pedágio *</label>
              <input type="text" name="praca" value={formData.praca} onChange={handleChange} required maxLength={120} />
            </div>
            <div className="pedagio-form-group">
              <label>Rodovia/BR</label>
              <input type="text" name="rodovia" value={formData.rodovia} onChange={handleChange} maxLength={20} />
            </div>
            <div className="pedagio-form-group">
              <label>KM</label>
              <input type="number" name="km" value={formData.km} onChange={handleChange} min="0" />
            </div>
          </div>

          <div className="pedagio-form-row">
            <div className="pedagio-form-group">
              <label>Categoria</label>
              <input type="text" name="categoria" value={formData.categoria} onChange={handleChange} maxLength={10} />
            </div>
            <div className="pedagio-form-group">
              <label>Tag/Passagem</label>
              <input type="text" name="tag" value={formData.tag} onChange={handleChange} maxLength={30} />
            </div>
            <div className="pedagio-form-group">
              <label>Valor (R$) *</label>
              <input type="number" step="0.01" name="valor" value={formData.valor} onChange={handleChange} required min="0" />
            </div>
          </div>
        </div>

        <div className="pedagio-form-section">
          <h3>Observações</h3>
          <div className="pedagio-form-row-2">
            <div className="pedagio-form-group">
              <textarea name="observacao" value={formData.observacao} onChange={handleChange} placeholder="Informações adicionais" />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/pedagios')}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Registrar')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PedagioForm;
