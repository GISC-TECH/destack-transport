import { useEffect, useMemo, useState } from 'react';
import { ciotAPI, clientesAPI, motoristasAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import styles from './CIOTManager.module.css';

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
      case 'ativo': return styles.statusSuccess;
      case 'usado': return styles.statusInfo;
      case 'vencido': return styles.statusWarning;
      case 'cancelado': return styles.statusDanger;
      default: return '';
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'ativo': return 'success';
      case 'usado': return 'info';
      case 'vencido': return 'warning';
      case 'cancelado': return 'danger';
      default: return 'default';
    }
  };

  if (loading && ciots.length === 0) return <Loading message="Carregando CIOTs..." />;

  return (
    <div className={styles.page}>
      <PageHeader
        title="CIOT - Operações de Transporte"
        subtitle="Gerencie os Códigos de Identificação da Operação de Transporte"
        actions={
          <Button
            variant="primary"
            onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
          >
            {showForm ? 'Fechar Formulário' : 'Novo CIOT'}
          </Button>
        }
      />

      {error && <ErrorMessage message={error} onRetry={loadData} />}

      <div className={styles.resumo}>
        {STATUS_OPTIONS.filter(s => s.value).map(opt => (
          <div key={opt.value} className={`${styles.resumoCard} ${getStatusClass(opt.value)}`}>
            <span className={styles.resumoValue}>{resumo[opt.value] || 0}</span>
            <span className={styles.resumoLabel}>{opt.label}</span>
          </div>
        ))}
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h3>{editingId ? 'Editar CIOT' : 'Novo CIOT'}</h3>
          <form onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
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
              <div className={styles.formGroup} style={{ flex: 2 }}>
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

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
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
              <div className={styles.formGroup}>
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
              <div className={styles.formGroup}>
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

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Contratante (Cliente)</label>
                <select name="cliente" value={form.cliente} onChange={handleChange}>
                  <option value="">Selecione</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razao_social}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Contratado (Motorista)</label>
                <select name="motorista" value={form.motorista} onChange={handleChange}>
                  <option value="">Selecione</option>
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Origem - Cidade</label>
                <input type="text" name="origem_cidade" value={form.origem_cidade} onChange={handleChange} />
              </div>
              <div className={styles.formGroup}>
                <label>Origem - UF</label>
                <input type="text" name="origem_uf" value={form.origem_uf} onChange={handleChange} maxLength={2} />
              </div>
              <div className={styles.formGroup}>
                <label>Destino - Cidade</label>
                <input type="text" name="destino_cidade" value={form.destino_cidade} onChange={handleChange} />
              </div>
              <div className={styles.formGroup}>
                <label>Destino - UF</label>
                <input type="text" name="destino_uf" value={form.destino_uf} onChange={handleChange} maxLength={2} />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Data de Emissão</label>
                <input type="date" name="data_emissao" value={form.data_emissao} onChange={handleChange} />
              </div>
              <div className={styles.formGroup}>
                <label>Data de Validade</label>
                <input type="date" name="data_validade" value={form.data_validade} onChange={handleChange} />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label>Observação</label>
                <textarea name="observacao" value={form.observacao} onChange={handleChange} rows={3} />
              </div>
            </div>

            <div className={styles.formActions}>
              <Button type="submit" variant="primary">{editingId ? 'Salvar Alterações' : 'Cadastrar CIOT'}</Button>
              <Button type="button" variant="secondary" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.formGroup}>
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className={`${styles.formGroup} ${styles.filterSearch}`}>
          <label>Buscar</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Código, descrição, cidade..."
          />
        </div>
      </div>

      <div className={styles.listCard}>
        <h3>Lista de CIOTs</h3>
        {filteredCiots.length === 0 ? (
          <p className={styles.emptyText}>Nenhum CIOT encontrado.</p>
        ) : (
          <>
            <div className={styles.desktopOnly}>
              <TableContainer>
                <table className={styles.table}>
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
                        <td>
                          <StatusPill status={getStatusVariant(item.status)}>
                            {item.status_display || item.status}
                          </StatusPill>
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <Button variant="ghost" size="sm" iconOnly onClick={() => handleEdit(item)} title="Editar" aria-label="Editar">✏️</Button>
                            {item.status === 'ativo' && (
                              <Button variant="ghost" size="sm" iconOnly onClick={() => handleUsar(item.id)} title="Marcar como usado" aria-label="Marcar como usado">✓</Button>
                            )}
                            {item.status !== 'cancelado' && (
                              <Button variant="warning" size="sm" iconOnly onClick={() => handleCancelar(item.id)} title="Cancelar" aria-label="Cancelar">🚫</Button>
                            )}
                            <Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(item.id)} title="Excluir" aria-label="Excluir">🗑️</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableContainer>
            </div>

            <div className={`${styles.mobileCards} ${styles.mobileOnly}`}>
              {filteredCiots.map(item => (
                <div key={item.id} className={styles.mobileCard}>
                  <div className={styles.mobileCardHeader}>
                    <div className={styles.mobileCardTitle}>
                      <span className={styles.mobileCardPrimary}>{item.codigo}</span>
                      <span className={styles.mobileCardSecondary}>{item.descricao || 'Sem descrição'}</span>
                    </div>
                    <StatusPill status={getStatusVariant(item.status)}>
                      {item.status_display || item.status}
                    </StatusPill>
                  </div>
                  <div className={styles.mobileCardBody}>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>Contratante</span>
                      <span className={styles.mobileCardValue}>{item.cliente_nome || '-'}</span>
                    </div>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>Contratado</span>
                      <span className={styles.mobileCardValue}>{item.motorista_nome || '-'}</span>
                    </div>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>Origem</span>
                      <span className={styles.mobileCardValue}>{item.origem_cidade ? `${item.origem_cidade}/${item.origem_uf}` : '-'}</span>
                    </div>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>Destino</span>
                      <span className={styles.mobileCardValue}>{item.destino_cidade ? `${item.destino_cidade}/${item.destino_uf}` : '-'}</span>
                    </div>
                    <div className={styles.mobileCardRow}>
                      <span className={styles.mobileCardLabel}>Validade</span>
                      <span className={styles.mobileCardValue}>{item.data_validade ? new Date(item.data_validade).toLocaleDateString('pt-BR') : '-'}</span>
                    </div>
                  </div>
                  <div className={styles.mobileCardFooter}>
                    <Button variant="ghost" size="sm" iconOnly onClick={() => handleEdit(item)} title="Editar" aria-label="Editar">✏️</Button>
                    {item.status === 'ativo' && (
                      <Button variant="ghost" size="sm" iconOnly onClick={() => handleUsar(item.id)} title="Marcar como usado" aria-label="Marcar como usado">✓</Button>
                    )}
                    {item.status !== 'cancelado' && (
                      <Button variant="warning" size="sm" iconOnly onClick={() => handleCancelar(item.id)} title="Cancelar" aria-label="Cancelar">🚫</Button>
                    )}
                    <Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(item.id)} title="Excluir" aria-label="Excluir">🗑️</Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CIOTManager;
