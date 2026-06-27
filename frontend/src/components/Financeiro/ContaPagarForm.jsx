import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { contasPagarAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import styles from './Financeiro.module.css';

function ContaPagarForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [error, setError] = useState(null);
  const [comprovante, setComprovante] = useState(null);

  const [formData, setFormData] = useState({
    descricao: '',
    categoria: 'outras',
    fornecedor: '',
    valor: '',
    data_vencimento: '',
    data_pagamento: '',
    status: 'pendente',
    veiculo: '',
    observacao: ''
  });

  useEffect(() => {
    loadVeiculos();
    if (isEditing) {
      loadConta();
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

  const loadConta = async () => {
    try {
      setLoading(true);
      const result = await contasPagarAPI.get(id);
      setFormData({
        descricao: result.descricao || '',
        categoria: result.categoria || 'outras',
        fornecedor: result.fornecedor || '',
        valor: result.valor || '',
        data_vencimento: result.data_vencimento || '',
        data_pagamento: result.data_pagamento || '',
        status: result.status || 'pendente',
        veiculo: result.veiculo ? String(result.veiculo) : '',
        observacao: result.observacao || ''
      });
    } catch (err) {
      console.error('Erro ao carregar conta a pagar:', err);
      setError('Erro ao carregar dados da conta a pagar.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const buildPayload = () => {
    const data = new FormData();
    data.append('descricao', formData.descricao);
    data.append('categoria', formData.categoria);
    data.append('fornecedor', formData.fornecedor || '');
    data.append('valor', formData.valor);
    data.append('data_vencimento', formData.data_vencimento);
    if (formData.data_pagamento) data.append('data_pagamento', formData.data_pagamento);
    data.append('status', formData.status);
    if (formData.veiculo) data.append('veiculo', formData.veiculo);
    data.append('observacao', formData.observacao || '');
    if (comprovante) data.append('comprovante', comprovante);
    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const dataToSend = buildPayload();

      if (isEditing) {
        await contasPagarAPI.update(id, dataToSend);
        toast.success('Conta a pagar atualizada com sucesso!');
      } else {
        await contasPagarAPI.create(dataToSend);
        toast.success('Conta a pagar criada com sucesso!');
      }
      setTimeout(() => navigate('/financeiro/contas-a-pagar'), 500);
    } catch (err) {
      console.error('Erro ao salvar conta a pagar:', err);
      setError('Erro ao salvar conta a pagar. Verifique os dados e tente novamente.');
      toast.error('Erro ao salvar conta a pagar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className={styles.financeiroPage}>
      <div className={styles.pageHeader}>
        <div className={styles.headerTitle}>
          <h1>{isEditing ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</h1>
          <p>{isEditing ? 'Atualize os dados da despesa' : 'Cadastre uma nova despesa a pagar'}</p>
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
          <h3>Informações Básicas</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Descrição *</label>
              <input
                type="text"
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                required
                maxLength={255}
                placeholder="Ex: Combustível posto X"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Categoria *</label>
              <select
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                required
              >
                <option value="combustivel">Combustível</option>
                <option value="pedagio">Pedágio</option>
                <option value="seguro">Seguro</option>
                <option value="oficina">Oficina</option>
                <option value="outras">Outras</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Fornecedor</label>
              <input
                type="text"
                name="fornecedor"
                value={formData.fornecedor}
                onChange={handleChange}
                maxLength={120}
                placeholder="Nome do fornecedor"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                name="valor"
                value={formData.valor}
                onChange={handleChange}
                required
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Vencimento e Pagamento</h3>

          <div className={styles.formRow}>
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
              <label>Data de Pagamento</label>
              <input
                type="date"
                name="data_pagamento"
                value={formData.data_pagamento}
                onChange={handleChange}
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
                <option value="pendente">Pendente</option>
                <option value="paga">Paga</option>
                <option value="atrasada">Atrasada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Vínculos</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Veículo (opcional)</label>
              <select
                name="veiculo"
                value={formData.veiculo}
                onChange={handleChange}
              >
                <option value="">Selecione o veículo</option>
                {veiculos.map(v => (
                  <option key={v.id} value={String(v.id)}>
                    {v.placa} {v.proprietario_nome ? `- ${v.proprietario_nome}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Comprovante (opcional)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setComprovante(e.target.files[0] || null)}
                style={{ padding: '8px' }}
              />
              {comprovante && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Arquivo selecionado: {comprovante.name}
                </small>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Observação</label>
            <textarea
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              rows="3"
              placeholder="Observações adicionais..."
            />
          </div>
        </div>

        <div className={styles.formActions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/financeiro/contas-a-pagar')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
          >
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Conta')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ContaPagarForm;
