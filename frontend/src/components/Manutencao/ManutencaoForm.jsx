import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { manutencaoAPI, veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import styles from './Manutencao.module.css';

function ManutencaoForm() {
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
    data_agendada: '',
    data_realizada: '',
    km_atual: '',
    custo: '',
    status: 'agendada',
    observacoes: '',
    fornecedor: '',
    numero_nota: ''
  });
  const [arquivoNota, setArquivoNota] = useState(null);

  const loadVeiculos = useCallback(async () => {
    try {
      // Filtra apenas veículos próprios (tipo_proprietario='00') para manutenção
      const result = await veiculosAPI.list({ tipo_proprietario: '00', ativo: true });
      setVeiculos(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
      setVeiculos([]);
    }
  }, []);

  const loadManutencao = useCallback(async () => {
    try {
      setLoading(true);
      const result = await manutencaoAPI.get(id);

      // Obtém o ID do veículo e converte para string para compatibilidade com select
      const veiculoId = result.veiculo_info?.id || result.veiculo;

      setFormData({
        veiculo: veiculoId ? String(veiculoId) : '',
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
  }, [id]);

  useEffect(() => {
    loadVeiculos();
    if (isEditing) {
      loadManutencao();
    }
  }, [isEditing, loadVeiculos, loadManutencao]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let dataToSend;

      if (arquivoNota) {
        // Se tiver arquivo, usa FormData
        dataToSend = new FormData();
        dataToSend.append('veiculo', parseInt(formData.veiculo));
        dataToSend.append('tipo', formData.tipo);
        dataToSend.append('descricao', formData.descricao);
        dataToSend.append('data_agendada', formData.data_agendada);
        if (formData.data_realizada) dataToSend.append('data_realizada', formData.data_realizada);
        if (formData.km_atual) dataToSend.append('quilometragem', parseInt(formData.km_atual));
        dataToSend.append('custo', formData.custo ? parseFloat(formData.custo) : 0);
        dataToSend.append('status', formData.status);
        dataToSend.append('observacoes', formData.observacoes || '');
        dataToSend.append('fornecedor', formData.fornecedor || '');
        dataToSend.append('nota_fiscal', formData.numero_nota || '');
        dataToSend.append('arquivo_nota', arquivoNota);
      } else {
        // Sem arquivo, envia JSON
        dataToSend = {
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
      }

      if (isEditing) {
        await manutencaoAPI.update(id, dataToSend);
        toast.success('Manutenção atualizada com sucesso!');
      } else {
        await manutencaoAPI.create(dataToSend);
        toast.success('Manutenção agendada com sucesso!');
      }
      setTimeout(() => navigate('/manutencoes'), 500);
    } catch (err) {
      console.error('Erro ao salvar manutenção:', err);
      toast.error('Erro ao salvar manutenção. Verifique os dados.');
      setError('Erro ao salvar manutenção. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando..." />;

  return (
    <div className={styles.formPage}>
      <PageHeader
        title={isEditing ? 'Editar Manutenção' : 'Nova Manutenção'}
        subtitle={isEditing ? 'Atualize os dados da manutenção' : 'Agende uma nova manutenção para o veículo'}
      />

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`} role="alert" aria-live="polite">
          {error}
          <button className={styles.alertClose} onClick={() => setError(null)} aria-label="Fechar mensagem de erro">&times;</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.formSection}>
          <h3>Informações Básicas</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="veiculo">Veículo *</label>
              <select
                id="veiculo"
                name="veiculo"
                value={formData.veiculo}
                onChange={handleChange}
                required
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
              <label htmlFor="tipo">Tipo de Manutenção *</label>
              <select
                id="tipo"
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

          <div className={styles.formGroup}>
            <label htmlFor="descricao">Descrição *</label>
            <textarea
              id="descricao"
              name="descricao"
              value={formData.descricao}
              onChange={handleChange}
              required
              rows="3"
              placeholder="Descreva o serviço a ser realizado..."
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3>Agendamento</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="data_agendada">Data Agendada *</label>
              <input
                id="data_agendada"
                type="date"
                name="data_agendada"
                value={formData.data_agendada}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="data_realizada">Data Realizada</label>
              <input
                id="data_realizada"
                type="date"
                name="data_realizada"
                value={formData.data_realizada}
                onChange={handleChange}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="status">Status *</label>
              <select
                id="status"
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

        <div className={styles.formSection}>
          <h3>Custos e Detalhes</h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="km_atual">KM Atual</label>
              <input
                id="km_atual"
                type="number"
                name="km_atual"
                value={formData.km_atual}
                onChange={handleChange}
                placeholder="Ex: 150000"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="custo">Custo (R$)</label>
              <input
                id="custo"
                type="number"
                step="0.01"
                name="custo"
                value={formData.custo}
                onChange={handleChange}
                placeholder="Ex: 1500.00"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="fornecedor">Fornecedor/Oficina</label>
              <input
                id="fornecedor"
                type="text"
                name="fornecedor"
                value={formData.fornecedor}
                onChange={handleChange}
                placeholder="Nome do fornecedor ou oficina"
                maxLength={120}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="numero_nota">Número da Nota Fiscal</label>
              <input
                id="numero_nota"
                type="text"
                name="numero_nota"
                value={formData.numero_nota}
                onChange={handleChange}
                placeholder="Ex: 12345"
                maxLength={44}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="arquivo_nota">Arquivo da Nota Fiscal (opcional)</label>
            <input
              id="arquivo_nota"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setArquivoNota(e.target.files[0] || null)}
              className={styles.fileInput}
            />
            {arquivoNota && (
              <small className={styles.fileHint}>
                Arquivo selecionado: {arquivoNota.name}
              </small>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="observacoes">Observações</label>
            <textarea
              id="observacoes"
              name="observacoes"
              value={formData.observacoes}
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
            onClick={() => navigate('/manutencoes')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving}
          >
            {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Manutenção')}
          </Button>
        </div>
      </form>

    </div>
  );
}

export default ManutencaoForm;
