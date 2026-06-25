import { useEffect, useMemo, useState } from 'react';
import { ciotAPI, clientesAPI, motoristasAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import './CIOTManager.css';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'usado', label: 'Usado' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
];

function CIOTManager() {
  const toast = useToast();
  const [ciots, setCiots] = useState([]);
  const [resumo, setResumo] = useState({});
  const [clientes, setClientes] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ status: '', search: '' });

  const [form, setForm] = useState({
    codigo: '',
    descricao: '',
    responsavel_cnpj: '',
    responsavel_cpf: '',
    cliente: '',
    motorista: '',
    origem_cidade: '',
    origem_uf: '',
    destino_cidade: '',
    destino_uf: '',
    valor: '',
    data_emissao: '',
    data_validade: '',
    observacao: ''
  });

  useEffect(() => {
    loadData();
    loadOptions();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ciotsRes, resumoRes] = await Promise.all([
        ciotAPI.list(),
        ciotAPI.resumo()
      ]);
      setCiots(ciotsRes.results || ciotsRes);
      setResumo(resumoRes);
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao carregar CIOTs');
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [cRes, mRes] = await Promise.all([
        clientesAPI.list({ ativo: true }),
        motoristasAPI.list({ ativo: true })
      ]);
      setClientes(cRes.results || cRes);
      setMotoristas(mRes.results || mRes);
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
    }
  };

  const filteredCiots = useMemo(() => {
    return ciots.filter(item => {
      const matchStatus = !filters.status || item.status === filters.status;
      const search = filters.search.toLowerCase();
      const matchSearch = !search ||
        (item.codigo && item.codigo.toLowerCase().includes(search)) ||
        (item.descricao && item.descricao.toLowerCase().includes(search)) ||
        (item.origem_cidade && item.origem_cidade.toLowerCase().includes(search)) ||
        (item.destino_cidade && item.destino_cidade.toLowerCase().includes(search));
      return matchStatus && matchSearch;
    });
  }, [ciots, filters]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm({
      codigo: '',
      descricao: '',
      responsavel_cnpj: '',
      responsavel_cpf: '',
      cliente: '',
      motorista: '',
      origem_cidade: '',
      origem_uf: '',
      destino_cidade: '',
      destino_uf: '',
      valor: '',
      data_emissao: '',
      data_validade: '',
      observacao: ''
    });
    setEditingId(null);
  };

  const handleEdit = (item) => {
    setForm({
      codigo: item.codigo || '',
      descricao: item.descricao || '',
      responsavel_cnpj: item.responsavel_cnpj || '',
      responsavel_cpf: item.responsavel_cpf || '',
      cliente: item.cliente || '',
      motorista: item.motorista || '',
      origem_cidade: item.origem_cidade || '',
      origem_uf: item.origem_uf || '',
      destino_cidade: item.destino_cidade || '',
      destino_uf: item.destino_uf || '',
      valor: item.valor || '',
      data_emissao: item.data_emissao || '',
      data_validade: item.data_validade || '',
      observacao: item.observacao || ''
    });
    setEditingId(item.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        cliente: form.cliente || undefined,
        motorista: form.motorista || undefined,
        valor: form.valor ? parseFloat(form.valor) : undefined,
      };
      if (editingId) {
        await ciotAPI.update(editingId, payload);
        toast.success('CIOT atualizado com sucesso!');
      } else {
        await ciotAPI.create(payload);
        toast.success('CIOT criado com sucesso!');
      }
      resetForm();
      setShowForm(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar CIOT');
    }
  };

  const handleCancelar = async (id) => {
    if (!confirm('Deseja cancelar este CIOT?')) return;
    try {
      await ciotAPI.cancelar(id);
      toast.success('CIOT cancelado!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Erro ao cancelar CIOT');
    }
  };

  const handleUsar = async (id) => {
    if (!confirm('Deseja marcar este CIOT como usado?')) return;
    try {
      await ciotAPI.usar(id);
      toast.success('CIOT marcado como usado!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Erro ao usar CIOT');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir este CIOT permanentemente?')) return;
    try {
      await ciotAPI.delete(id);
      toast.success('CIOT excluído!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir CIOT');
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'ativo': return 'status-success';
      case 'usado': return 'status-info';
      case 'vencido': return 'status-warning';
      case 'cancelado': return 'status-danger';
      default: return '';
    }
  };

  if (loading && ciots.length === 0) return <Loading message="Carregando CIOTs..." />;

  return (
    <div className="ciot-page">
      <div className="page-header">
        <div className="header-title">
          <h1>CIOT - Operações de Transporte</h1>
          <p>Gerencie os Códigos de Identificação da Operação de Transporte</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
        >
          {showForm ? 'Fechar Formulário' : 'Novo CIOT'}
        </button>
      </div>

      {error && <ErrorMessage message={error} onRetry={loadData} />}

      <div className="ciot-resumo">
        {STATUS_OPTIONS.filter(s => s.value).map(opt => (
          <div key={opt.value} className={`ciot-resumo-card ${getStatusClass(opt.value)}`}>
            <span className="resumo-value">{resumo[opt.value] || 0}</span>
            <span className="resumo-label">{opt.label}</span>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="ciot-form-card">
          <h3>{editingId ? 'Editar CIOT' : 'Novo CIOT'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Código CIOT *</label>
                <input
                  type="text"
                  name="codigo"
                  value={form.codigo}
                  onChange={handleChange}
                  maxLength={12}
                  placeholder="123456789012"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Descrição</label>
                <input
                  type="text"
                  name="descricao"
                  value={form.descricao}
                  onChange={handleChange}
                  placeholder="Ex: Transporte SP x RJ"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>CNPJ Responsável</label>
                <input
                  type="text"
                  name="responsavel_cnpj"
                  value={form.responsavel_cnpj}
                  onChange={handleChange}
                  maxLength={14}
                  placeholder="Apenas números"
                />
              </div>
              <div className="form-group">
                <label>CPF Responsável</label>
                <input
                  type="text"
                  name="responsavel_cpf"
                  value={form.responsavel_cpf}
                  onChange={handleChange}
                  maxLength={11}
                  placeholder="Apenas números"
                />
              </div>
              <div className="form-group">
                <label>Valor da Operação</label>
                <input
                  type="number"
                  step="0.01"
                  name="valor"
                  value={form.valor}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Contratante (Cliente)</label>
                <select name="cliente" value={form.cliente} onChange={handleChange}>
                  <option value="">Selecione</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razao_social}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Contratado (Motorista)</label>
                <select name="motorista" value={form.motorista} onChange={handleChange}>
                  <option value="">Selecione</option>
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Origem - Cidade</label>
                <input type="text" name="origem_cidade" value={form.origem_cidade} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Origem - UF</label>
                <input type="text" name="origem_uf" value={form.origem_uf} onChange={handleChange} maxLength={2} />
              </div>
              <div className="form-group">
                <label>Destino - Cidade</label>
                <input type="text" name="destino_cidade" value={form.destino_cidade} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Destino - UF</label>
                <input type="text" name="destino_uf" value={form.destino_uf} onChange={handleChange} maxLength={2} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Data de Emissão</label>
                <input type="date" name="data_emissao" value={form.data_emissao} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Data de Validade</label>
                <input type="date" name="data_validade" value={form.data_validade} onChange={handleChange} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Observação</label>
                <textarea name="observacao" value={form.observacao} onChange={handleChange} rows={3} />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">{editingId ? 'Salvar Alterações' : 'Cadastrar CIOT'}</button>
              <button type="button" className="btn-secondary" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="ciot-filters">
        <div className="form-group">
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Buscar</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Código, descrição, cidade..."
          />
        </div>
      </div>

      <div className="ciot-list-card">
        <h3>Lista de CIOTs</h3>
        {filteredCiots.length === 0 ? (
          <p className="empty-text">Nenhum CIOT encontrado.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Contratante</th>
                  <th>Contratado</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCiots.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.codigo}</strong></td>
                    <td>{item.descricao || '-'}</td>
                    <td>{item.cliente_nome || '-'}</td>
                    <td>{item.motorista_nome || '-'}</td>
                    <td>{item.origem_cidade ? `${item.origem_cidade}/${item.origem_uf}` : '-'}</td>
                    <td>{item.destino_cidade ? `${item.destino_cidade}/${item.destino_uf}` : '-'}</td>
                    <td>{item.data_validade ? new Date(item.data_validade).toLocaleDateString('pt-BR') : '-'}</td>
                    <td><span className={`status-badge ${getStatusClass(item.status)}`}>{item.status_display}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon" onClick={() => handleEdit(item)} title="Editar">✏️</button>
                        {item.status === 'ativo' && (
                          <button className="btn-icon" onClick={() => handleUsar(item.id)} title="Marcar como usado">✓</button>
                        )}
                        {item.status !== 'cancelado' && (
                          <button className="btn-icon" onClick={() => handleCancelar(item.id)} title="Cancelar">🚫</button>
                        )}
                        <button className="btn-icon danger" onClick={() => handleDelete(item.id)} title="Excluir">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CIOTManager;
