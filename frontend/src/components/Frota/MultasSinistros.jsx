import { useState, useEffect } from 'react';
import { multaAPI, sinistroAPI, veiculosAPI, motoristasAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import styles from './Frota.module.css';

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
      'cancelada': 'danger'
    } : {
      'aberto': 'warning',
      'em_andamento': 'info',
      'resolvido': 'success',
      'cancelado': 'danger'
    };
    return <StatusPill status={map[status] || 'default'}>{status.replace('_', ' ')}</StatusPill>;
  };

  if (loading && multas.length === 0 && sinistros.length === 0) return <Loading message="Carregando..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadDados} />;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Multas e Sinistros"
        subtitle="Gestão de infrações e ocorrências da frota"
        breadcrumbs={[{ label: 'Operação' }, { label: 'Multas e Sinistros' }]}
      />

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${abaAtiva === 'multas' ? styles.tabActive : ''}`}
          onClick={() => setAbaAtiva('multas')}
        >
          Multas ({multas.length})
        </button>
        <button
          className={`${styles.tab} ${abaAtiva === 'sinistros' ? styles.tabActive : ''}`}
          onClick={() => setAbaAtiva('sinistros')}
        >
          Sinistros ({sinistros.length})
        </button>
      </div>

      {abaAtiva === 'multas' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Multas</h3>
            <Button onClick={() => setModal({ tipo: 'multa' })}>
              + Nova Multa
            </Button>
          </div>
          <div className={styles.listCard}>
            <TableContainer>
              <table className={styles.table}>
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
                    <td data-label="Data">{formatDate(m.data_infracao)}</td>
                    <td data-label="Veículo">{m.veiculo_placa}</td>
                    <td data-label="Auto">{m.auto_infracao || '-'}</td>
                    <td data-label="Infração">{m.descricao || '-'}</td>
                    <td data-label="Valor">{formatCurrency(m.valor)}</td>
                    <td data-label="Status">{getStatusBadge(m.status, 'multa')}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button variant="outline" size="sm" iconOnly aria-label="Editar" onClick={() => setModal({ tipo: 'multa', id: m.id })}>✏️</Button>
                        <Button variant="outline" size="sm" iconOnly aria-label="Excluir" onClick={() => handleDelete('multa', m.id)}>🗑️</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableContainer>
          </div>
        </div>
      )}

      {abaAtiva === 'sinistros' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Sinistros</h3>
            <Button onClick={() => setModal({ tipo: 'sinistro' })}>
              + Novo Sinistro
            </Button>
          </div>
          <div className={styles.listCard}>
            <TableContainer>
              <table className={styles.table}>
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
                    <td data-label="Data">{formatDate(s.data)}</td>
                    <td data-label="Veículo">{s.veiculo_placa}</td>
                    <td data-label="Tipo">{s.tipo_display || s.tipo}</td>
                    <td data-label="Local">{s.local || '-'}</td>
                    <td data-label="Custo">{formatCurrency(s.custo_total)}</td>
                    <td data-label="Status">{getStatusBadge(s.status, 'sinistro')}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button variant="outline" size="sm" iconOnly aria-label="Editar" onClick={() => setModal({ tipo: 'sinistro', id: s.id })}>✏️</Button>
                        <Button variant="outline" size="sm" iconOnly aria-label="Excluir" onClick={() => handleDelete('sinistro', s.id)}>🗑️</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableContainer>
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
    <Modal
      isOpen={!!tipo}
      onClose={onClose}
      title={`${isEditing ? 'Editar' : 'Novo'} ${tipo === 'multa' ? 'Multa' : 'Sinistro'}`}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
              <label>Veículo *</label>
              <select name="veiculo" value={formData.veiculo} onChange={handleChange} required>
                <option value="">Selecione</option>
                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Motorista</label>
              <select name="motorista" value={formData.motorista} onChange={handleChange}>
                <option value="">Selecione</option>
                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          </div>

          {tipo === 'multa' ? (
            <>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Data Infração *</label>
                  <input type="date" name="data_infracao" value={formData.data_infracao} onChange={handleChange} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Auto de Infração</label>
                  <input type="text" name="auto_infracao" value={formData.auto_infracao} onChange={handleChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Gravidade</label>
                  <select name="gravidade" value={formData.gravidade} onChange={handleChange}>
                    <option value="leve">Leve</option>
                    <option value="media">Média</option>
                    <option value="grave">Grave</option>
                    <option value="gravissima">Gravíssima</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Valor (R$) *</label>
                  <input type="number" step="0.01" name="valor" value={formData.valor} onChange={handleChange} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Pontos</label>
                  <input type="number" name="pontos" value={formData.pontos} onChange={handleChange} />
                </div>
                <div className={styles.formGroup}>
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
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Data *</label>
                  <input type="date" name="data" value={formData.data} onChange={handleChange} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Tipo</label>
                  <select name="tipo" value={formData.tipo} onChange={handleChange}>
                    <option value="colisao">Colisão</option>
                    <option value="incendio">Incêndio</option>
                    <option value="furto_roubo">Furto/Roubo</option>
                    <option value="avaria_carga">Avaria de Carga</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="resolvido">Resolvido</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Custo Total (R$)</label>
                  <input type="number" step="0.01" name="custo_total" value={formData.custo_total} onChange={handleChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Número Sinistro</label>
                  <input type="text" name="numero_sinistro" value={formData.numero_sinistro} onChange={handleChange} />
                </div>
                <div className={styles.formGroup}>
                  <label>Seguradora</label>
                  <input type="text" name="seguradora" value={formData.seguradora} onChange={handleChange} />
                </div>
              </div>
            </>
          )}

          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label>Local</label>
              <input type="text" name="local" value={formData.local} onChange={handleChange} />
            </div>
            <div className={styles.formGroup}>
              <label>Descrição</label>
              <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} />
            </div>
          </div>

          <div className={styles.formRow2}>
            <div className={styles.formGroup}>
              <label>Observação</label>
              <textarea name="observacao" value={formData.observacao} onChange={handleChange} />
            </div>
          </div>

          <div className={styles.formActions}>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={saving} disabled={saving}>
              {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Salvar')}
            </Button>
          </div>
        </form>
      </Modal>
  );
}

export default MultasSinistros;
