import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { conciliacaoAPI, clientesAPI, cteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import styles from './Faturas.module.css';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value) || 0);
}

function FaturaForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [ctes, setCtes] = useState([]);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    cliente: '',
    numero: '',
    data_emissao: today,
    data_vencimento: '',
    status: 'rascunho',
    observacao: '',
    itens: []
  });

  const loadClientes = async () => {
    try {
      const result = await clientesAPI.list({ ativo: true });
      setClientes(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  const loadCtes = async () => {
    try {
      const result = await cteAPI.list({ nao_faturado: true, page_size: 100 });
      setCtes(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar CT-es:', err);
    }
  };

  const loadFatura = async () => {
    try {
      setLoading(true);
      const result = await conciliacaoAPI.faturas.get(id);
      setFormData({
        cliente: result.cliente ? String(result.cliente) : '',
        numero: result.numero || '',
        data_emissao: result.data_emissao || today,
        data_vencimento: result.data_vencimento || '',
        status: result.status || 'rascunho',
        observacao: result.observacao || '',
        itens: (result.itens || []).map(item => ({
          cte: item.cte_id || '',
          descricao: item.descricao || '',
          valor: item.valor ? String(item.valor) : ''
        }))
      });
    } catch {
      setError('Erro ao carregar fatura.');
      toast.error('Erro ao carregar fatura.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
    loadCtes();
    if (isEditing) {
      loadFatura();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const itens = [...prev.itens];
      itens[index] = { ...itens[index], [field]: value };
      if (field === 'cte') {
        const cte = ctes.find(c => c.id === value);
        if (cte && !itens[index].descricao) {
          itens[index].descricao = `CT-e ${cte.numero_cte || cte.chave?.slice(-8)}`;
        }
        if (cte && !itens[index].valor) {
          itens[index].valor = cte.valor_total ? String(cte.valor_total) : '';
        }
      }
      return { ...prev, itens };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      itens: [...prev.itens, { cte: '', descricao: '', valor: '' }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index)
    }));
  };

  const valorTotal = formData.itens.reduce((acc, item) => {
    return acc + (parseFloat(item.valor) || 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!formData.cliente || !formData.numero || !formData.data_vencimento) {
      setError('Preencha os campos obrigatórios.');
      setSaving(false);
      return;
    }

    if (formData.itens.length === 0) {
      setError('Adicione pelo menos um item à fatura.');
      setSaving(false);
      return;
    }

    const dataToSend = {
      cliente: formData.cliente,
      numero: formData.numero,
      data_emissao: formData.data_emissao,
      data_vencimento: formData.data_vencimento,
      status: formData.status,
      observacao: formData.observacao,
      itens: formData.itens.map(item => ({
        cte: item.cte || null,
        descricao: item.descricao,
        valor: parseFloat(item.valor) || 0
      }))
    };

    try {
      if (isEditing) {
        await conciliacaoAPI.faturas.update(id, dataToSend);
        toast.success('Fatura atualizada com sucesso!');
      } else {
        await conciliacaoAPI.faturas.create(dataToSend);
        toast.success('Fatura criada com sucesso!');
      }
      setTimeout(() => navigate('/faturas'), 500);
    } catch (err) {
      setError(err.message || 'Erro ao salvar fatura.');
      toast.error(err.message || 'Erro ao salvar fatura.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className={styles.faturaFormPage}>
      <div className={styles.pageHeader}>
        <div className={styles.headerTitle}>
          <h1>{isEditing ? 'Editar Fatura' : 'Nova Fatura'}</h1>
          <p>{isEditing ? 'Atualize os dados da fatura' : 'Crie uma nova fatura de contas a receber'}</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button className="alert-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.formSection}>
          <h3>Informações da Fatura</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Cliente *</label>
              <select
                name="cliente"
                value={formData.cliente}
                onChange={handleChange}
                required
              >
                <option value="">Selecione o cliente</option>
                {clientes.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.razao_social}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Número *</label>
              <input
                type="text"
                name="numero"
                value={formData.numero}
                onChange={handleChange}
                placeholder="Ex: FAT-001"
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Data de Emissão *</label>
              <input
                type="date"
                name="data_emissao"
                value={formData.data_emissao}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Data de Vencimento *</label>
              <input
                type="date"
                name="data_vencimento"
                value={formData.data_vencimento}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Status *</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="rascunho">Rascunho</option>
                <option value="enviada">Enviada</option>
                <option value="paga">Paga</option>
                <option value="atrasada">Atrasada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Observação</label>
            <textarea
              name="observacao"
              rows="3"
              value={formData.observacao}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <h3>Itens da Fatura</h3>
            <span className={styles.valorTotal}>Total: {formatCurrency(valorTotal)}</span>
          </div>

          {formData.itens.length === 0 && (
            <p className={styles.hint}>Nenhum item adicionado. Clique em "Adicionar Item".</p>
          )}

          {formData.itens.map((item, index) => (
            <div key={index} className={styles.itemRow}>
              <div className={`${styles.formGroup} ${styles.itemCte}`}>
                <label>CT-e</label>
                <select
                  value={item.cte}
                  onChange={(e) => handleItemChange(index, 'cte', e.target.value)}
                >
                  <option value="">Selecione (opcional)</option>
                  {ctes.map(cte => (
                    <option key={cte.id} value={String(cte.id)}>
                      {cte.numero_cte || cte.chave?.slice(-8)} - {cte.remetente_nome || '-'} → {cte.destinatario_nome || '-'}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${styles.formGroup} ${styles.itemDescricao}`}>
                <label>Descrição *</label>
                <input
                  type="text"
                  value={item.descricao}
                  onChange={(e) => handleItemChange(index, 'descricao', e.target.value)}
                  required
                />
              </div>

              <div className={`${styles.formGroup} ${styles.itemValor}`}>
                <label>Valor *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.valor}
                  onChange={(e) => handleItemChange(index, 'valor', e.target.value)}
                  required
                />
              </div>

              <Button
                type="button"
                variant="danger"
                className={styles.btnRemove}
                onClick={() => removeItem(index)}
              >
                Remover
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addItem}>
            + Adicionar Item
          </Button>
        </div>

        <div className={styles.formActions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/faturas')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
          >
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar Fatura' : 'Criar Fatura')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default FaturaForm;
