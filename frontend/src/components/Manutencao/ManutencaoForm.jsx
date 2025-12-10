import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { manutencaoAPI, veiculosAPI } from '../../services/api';
import Loading from '../Common/Loading';
import './Manutencao.css';

// Mock veículos
const mockVeiculos = [
  { id: 1, placa: 'ABC-1234', modelo: 'Volvo FH 540' },
  { id: 2, placa: 'DEF-5678', modelo: 'Scania R450' },
  { id: 3, placa: 'GHI-9012', modelo: 'Mercedes Actros' },
  { id: 4, placa: 'MNO-7890', modelo: 'DAF XF 530' },
  { id: 5, placa: 'PQR-1234', modelo: 'Iveco Stralis' }
];

function ManutencaoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [usingMockData, setUsingMockData] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    veiculo: '',
    tipo: 'preventiva',
    descricao: '',
    data_agendada: '',
    data_realizada: '',
    km_atual: '',
    custo: '',
    status: 'agendada',
    observacoes: '',
    fornecedor: '',
    numero_nota: ''
  });

  useEffect(() => {
    loadVeiculos();
    if (isEditing) {
      loadManutencao();
    }
  }, [id]);

  const loadVeiculos = async () => {
    try {
      const result = await veiculosAPI.list();
      setVeiculos(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
      setVeiculos(mockVeiculos);
      setUsingMockData(true);
    }
  };

  const loadManutencao = async () => {
    try {
      setLoading(true);
      const result = await manutencaoAPI.get(id);
      setFormData({
        veiculo: result.veiculo_info?.id || result.veiculo || '',
        tipo: result.tipo || 'preventiva',
        descricao: result.descricao || result.servico_realizado || '',
        data_agendada: result.data_agendada || result.data_servico || '',
        data_realizada: result.data_realizada || '',
        km_atual: result.quilometragem || '',
        custo: result.custo || result.valor_total || '',
        status: result.status || 'agendada',
        observacoes: result.observacoes || '',
        fornecedor: result.fornecedor || result.oficina || '',
        numero_nota: result.nota_fiscal || ''
      });
    } catch (err) {
      console.error('Erro ao carregar manutenção:', err);
      setError('Erro ao carregar dados da manutenção.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Mapear campos do formulário para a API
      const data = {
        veiculo: parseInt(formData.veiculo),
        tipo: formData.tipo,
        descricao: formData.descricao,
        data_agendada: formData.data_agendada,
        data_realizada: formData.data_realizada || null,
        quilometragem: formData.km_atual ? parseInt(formData.km_atual) : null,
        custo: formData.custo ? parseFloat(formData.custo) : 0,
        status: formData.status,
        observacoes: formData.observacoes || '',
        fornecedor: formData.fornecedor || '',
        nota_fiscal: formData.numero_nota || ''
      };

      if (usingMockData) {
        // Simular salvamento
        await new Promise(resolve => setTimeout(resolve, 500));
        navigate('/manutencoes');
        return;
      }

      if (isEditing) {
        await manutencaoAPI.update(id, data);
      } else {
        await manutencaoAPI.create(data);
      }
      navigate('/manutencoes');
    } catch (err) {
      console.error('Erro ao salvar manutenção:', err);
      setError('Erro ao salvar manutenção. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className="manutencao-form-page">
      <div className="page-header">
        <div className="header-title">
          <h1>{isEditing ? 'Editar Manutenção' : 'Nova Manutenção'}</h1>
          <p>{isEditing ? 'Atualize os dados da manutenção' : 'Agende uma nova manutenção para o veículo'}</p>
          {usingMockData && (
            <span className="demo-badge">Modo Demonstração</span>
          )}
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
          <h3>Informações Básicas</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Veículo *</label>
              <select
                name="veiculo"
                value={formData.veiculo}
                onChange={handleChange}
                required
              >
                <option value="">Selecione o veículo</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.placa} - {v.modelo}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Tipo de Manutenção *</label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                required
              >
                <option value="preventiva">Preventiva</option>
                <option value="corretiva">Corretiva</option>
                <option value="preditiva">Preditiva</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Descrição *</label>
            <textarea
              name="descricao"
              value={formData.descricao}
              onChange={handleChange}
              required
              rows="3"
              placeholder="Descreva o serviço a ser realizado..."
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Agendamento</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Data Agendada *</label>
              <input
                type="date"
                name="data_agendada"
                value={formData.data_agendada}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Data Realizada</label>
              <input
                type="date"
                name="data_realizada"
                value={formData.data_realizada}
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
                <option value="agendada">Agendada</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Custos e Detalhes</h3>

          <div className="form-row">
            <div className="form-group">
              <label>KM Atual</label>
              <input
                type="number"
                name="km_atual"
                value={formData.km_atual}
                onChange={handleChange}
                placeholder="Ex: 150000"
              />
            </div>

            <div className="form-group">
              <label>Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                name="custo"
                value={formData.custo}
                onChange={handleChange}
                placeholder="Ex: 1500.00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fornecedor/Oficina</label>
              <input
                type="text"
                name="fornecedor"
                value={formData.fornecedor}
                onChange={handleChange}
                placeholder="Nome do fornecedor ou oficina"
              />
            </div>

            <div className="form-group">
              <label>Número da Nota Fiscal</label>
              <input
                type="text"
                name="numero_nota"
                value={formData.numero_nota}
                onChange={handleChange}
                placeholder="Ex: 12345"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Observações</label>
            <textarea
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows="3"
              placeholder="Observações adicionais..."
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/manutencoes')}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Manutenção')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ManutencaoForm;
