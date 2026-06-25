import { useState, useEffect } from 'react';
import { multaAPI, sinistroAPI, veiculosAPI, motoristasAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './Frota.css';

function MultasSinistros() {
  const toast = useToast();
  const [abaAtiva, setAbaAtiva] = useState('multas');
  const [multas, setMultas] = useState([]);
  const [sinistros, setSinistros] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    loadDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDados = async () => {
    try {
      setLoading(true);
      setError(null);
      const [mRes, sRes, vRes, mtRes] = await Promise.all([
        multaAPI.list(),
        sinistroAPI.list(),
        veiculosAPI.list({ ativo: true }),
        motoristasAPI.list({ ativo: true })
      ]);
      setMultas(mRes.results || mRes);
      setSinistros(sRes.results || sRes);
      setVeiculos(vRes.results || vRes);
      setMotoristas(mtRes.results || mtRes);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tipo, id) => {
    const label = tipo === 'multa' ? 'multa' : 'sinistro';
    if (!window.confirm(`Tem certeza que deseja excluir este ${label}?`)) return;
    try {
      if (tipo === 'multa') {
        await multaAPI.delete(id);
      } else {
        await sinistroAPI.delete(id);
      }
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} excluído com sucesso!`);
      loadDados();
    } catch (err) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status, tipo) => {
    const map = tipo === 'multa' ? {
      'pendente': 'warning',
      'paga': 'success',
      'impugnada': 'info',
      'cancelada': 'secondary'
    } : {
      'aberto': 'warning',
      'em_andamento': 'info',
      'resolvido': 'success',
      'cancelado': 'secondary'
    };
    return <span className={`badge badge-${map[status] || 'secondary'}`}>{status.replace('_', ' ')}</span>;
  };

  if (loading && multas.length === 0 && sinistros.length === 0) return <Loading message="Carregando..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadDados} />;

  return (
    <div className="frota-page">
      <PageHeader
        title="Multas e Sinistros"
        subtitle="Gestão de infrações e ocorrências da frota"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Multas e Sinistros' }]}
      />

      <div className="frota-tabs">
        <button
          className={`frota-tab ${abaAtiva === 'multas' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('multas')}
        >
          Multas ({multas.length})
        </button>
        <button
          className={`frota-tab ${abaAtiva === 'sinistros' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('sinistros')}
        >
          Sinistros ({sinistros.length})
        </button>
      </div>

      {abaAtiva === 'multas' && (
        <div className="frota-section">
          <div className="frota-section-header">
            <h3>Multas</h3>
            <button className="btn-primary" onClick={() => setModal({ tipo: 'multa' })}>
              + Nova Multa
            </button>
          </div>
          <div className="frota-list-card">
            <table className="frota-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Veículo</th>
                  <th>Auto</th>
                  <th>Infração</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {multas.length === 0 ? (
                  <tr><td colSpan="7" className="text-center">Nenhuma multa registrada.</td></tr>
                ) : multas.map(m => (
                  <tr key={m.id}>
                    <td>{formatDate(m.data_infracao)}</td>
                    <td>{m.veiculo_placa}</td>
                    <td>{m.auto_infracao || '-'}</td>
                    <td>{m.descricao || '-'}</td>
                    <td>{formatCurrency(m.valor)}</td>
                    <td>{getStatusBadge(m.status, 'multa')}</td>
                    <td>
                      <div className="os-actions">
                        <button className="btn-icon" onClick={() => setModal({ tipo: 'multa', id: m.id })}>✏️</button>
                        <button className="btn-icon" onClick={() => handleDelete('multa', m.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === 'sinistros' && (
        <div className="frota-section">
          <div className="frota-section-header">
            <h3>Sinistros</h3>
            <button className="btn-primary" onClick={() => setModal({ tipo: 'sinistro' })}>
              + Novo Sinistro
            </button>
          </div>
          <div className="frota-list-card">
            <table className="frota-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Veículo</th>
                  <th>Tipo</th>
                  <th>Local</th>
                  <th>Custo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sinistros.length === 0 ? (
                  <tr><td colSpan="7" className="text-center">Nenhum sinistro registrado.</td></tr>
                ) : sinistros.map(s => (
                  <tr key={s.id}>
                    <td>{formatDate(s.data)}</td>
                    <td>{s.veiculo_placa}</td>
                    <td>{s.tipo_display || s.tipo}</td>
                    <td>{s.local || '-'}</td>
                    <td>{formatCurrency(s.custo_total)}</td>
                    <td>{getStatusBadge(s.status, 'sinistro')}</td>
                    <td>
                      <div className="os-actions">
                        <button className="btn-icon" onClick={() => setModal({ tipo: 'sinistro', id: s.id })}>✏️</button>
                        <button className="btn-icon" onClick={() => handleDelete('sinistro', s.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <RegistroModal
          tipo={modal.tipo}
          id={modal.id}
          veiculos={veiculos}
          motoristas={motoristas}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadDados(); }}
        />
      )}
    </div>
  );
}

function RegistroModal({ tipo, id, veiculos, motoristas, onClose, onSave }) {
  const toast = useToast();
  const isEditing = !!id;
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(tipo === 'multa' ? {
    veiculo: '', motorista: '', data_infracao: '', local: '', descricao: '',
    auto_infracao: '', gravidade: 'media', pontos: '', valor: '',
    data_vencimento: '', data_pagamento: '', status: 'pendente', observacao: ''
  } : {
    veiculo: '', motorista: '', data: '', local: '', tipo: 'colisao', descricao: '',
    envolvidos_terceiros: '', custo_total: '', status: 'aberto',
    numero_sinistro: '', seguradora: '', observacao: ''
  });

  useEffect(() => {
    if (isEditing) {
      const api = tipo === 'multa' ? multaAPI : sinistroAPI;
      api.get(id).then(result => {
        const base = tipo === 'multa' ? {
          veiculo: result.veiculo ? String(result.veiculo) : '',
          motorista: result.motorista ? String(result.motorista) : '',
          data_infracao: result.data_infracao || '',
          local: result.local || '',
          descricao: result.descricao || '',
          auto_infracao: result.auto_infracao || '',
          gravidade: result.gravidade || 'media',
          pontos: result.pontos || '',
          valor: result.valor || '',
          data_vencimento: result.data_vencimento || '',
          data_pagamento: result.data_pagamento || '',
          status: result.status || 'pendente',
          observacao: result.observacao || ''
        } : {
          veiculo: result.veiculo ? String(result.veiculo) : '',
          motorista: result.motorista ? String(result.motorista) : '',
          data: result.data || '',
          local: result.local || '',
          tipo: result.tipo || 'colisao',
          descricao: result.descricao || '',
          envolvidos_terceiros: result.envolvidos_terceiros || '',
          custo_total: result.custo_total || '',
          status: result.status || 'aberto',
          numero_sinistro: result.numero_sinistro || '',
          seguradora: result.seguradora || '',
          observacao: result.observacao || ''
        };
        setFormData(base);
      });
    }
  }, [id, tipo, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null;
      });
      if (tipo === 'multa') {
        payload.valor = parseFloat(payload.valor) || 0;
        payload.pontos = payload.pontos ? parseInt(payload.pontos, 10) : null;
      } else {
        payload.custo_total = payload.custo_total ? parseFloat(payload.custo_total) : null;
      }
      if (isEditing) {
        await (tipo === 'multa' ? multaAPI.update(id, payload) : sinistroAPI.update(id, payload));
        toast.success('Registro atualizado com sucesso!');
      } else {
        await (tipo === 'multa' ? multaAPI.create(payload) : sinistroAPI.create(payload));
        toast.success('Registro criado com sucesso!');
      }
      onSave();
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditing ? 'Editar' : 'Novo'} {tipo === 'multa' ? 'Multa' : 'Sinistro'}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="frota-form-row">
            <div className="frota-form-group">
              <label>Veículo *</label>
              <select name="veiculo" value={formData.veiculo} onChange={handleChange} required>
                <option value="">Selecione</option>
                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
              </select>
            </div>
            <div className="frota-form-group">
              <label>Motorista</label>
              <select name="motorista" value={formData.motorista} onChange={handleChange}>
                <option value="">Selecione</option>
                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          </div>

          {tipo === 'multa' ? (
            <>
              <div className="frota-form-row">
                <div className="frota-form-group">
                  <label>Data Infração *</label>
                  <input type="date" name="data_infracao" value={formData.data_infracao} onChange={handleChange} required />
                </div>
                <div className="frota-form-group">
                  <label>Auto de Infração</label>
                  <input type="text" name="auto_infracao" value={formData.auto_infracao} onChange={handleChange} />
                </div>
                <div className="frota-form-group">
                  <label>Gravidade</label>
                  <select name="gravidade" value={formData.gravidade} onChange={handleChange}>
                    <option value="leve">Leve</option>
                    <option value="media">Média</option>
                    <option value="grave">Grave</option>
                    <option value="gravissima">Gravíssima</option>
                  </select>
                </div>
              </div>
              <div className="frota-form-row">
                <div className="frota-form-group">
                  <label>Valor (R$) *</label>
                  <input type="number" step="0.01" name="valor" value={formData.valor} onChange={handleChange} required />
                </div>
                <div className="frota-form-group">
                  <label>Pontos</label>
                  <input type="number" name="pontos" value={formData.pontos} onChange={handleChange} />
                </div>
                <div className="frota-form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="pendente">Pendente</option>
                    <option value="paga">Paga</option>
                    <option value="impugnada">Impugnada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="frota-form-row">
                <div className="frota-form-group">
                  <label>Data *</label>
                  <input type="date" name="data" value={formData.data} onChange={handleChange} required />
                </div>
                <div className="frota-form-group">
                  <label>Tipo</label>
                  <select name="tipo" value={formData.tipo} onChange={handleChange}>
                    <option value="colisao">Colisão</option>
                    <option value="incendio">Incêndio</option>
                    <option value="furto_roubo">Furto/Roubo</option>
                    <option value="avaria_carga">Avaria de Carga</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div className="frota-form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="resolvido">Resolvido</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div className="frota-form-row">
                <div className="frota-form-group">
                  <label>Custo Total (R$)</label>
                  <input type="number" step="0.01" name="custo_total" value={formData.custo_total} onChange={handleChange} />
                </div>
                <div className="frota-form-group">
                  <label>Número Sinistro</label>
                  <input type="text" name="numero_sinistro" value={formData.numero_sinistro} onChange={handleChange} />
                </div>
                <div className="frota-form-group">
                  <label>Seguradora</label>
                  <input type="text" name="seguradora" value={formData.seguradora} onChange={handleChange} />
                </div>
              </div>
            </>
          )}

          <div className="frota-form-row-2">
            <div className="frota-form-group">
              <label>Local</label>
              <input type="text" name="local" value={formData.local} onChange={handleChange} />
            </div>
            <div className="frota-form-group">
              <label>Descrição</label>
              <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} />
            </div>
          </div>

          <div className="frota-form-row-2">
            <div className="frota-form-group">
              <label>Observação</label>
              <textarea name="observacao" value={formData.observacao} onChange={handleChange} />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Salvar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MultasSinistros;
