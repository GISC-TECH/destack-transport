import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import './VeiculoForm.css';

function VeiculoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    placa: '',
    renavam: '',
    tipo_rodado: '',
    tipo_carroceria: '',
    tara: '',
    capacidade_kg: '',
    capacidade_m3: '',
    tipo_proprietario: '00',
    proprietario_nome: '',
    proprietario_cnpj: '',
    proprietario_cpf: '',
    rntrc_proprietario: '',
    uf_proprietario: '',
    civ_validade: '',
    cipp_validade: '',
    afericao_validade: '',
    crlv_validade: '',
    cronotacografo_validade: '',
    observacoes: '',
    ativo: true,
    compartimentos: []
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isEdit) {
      loadVeiculo();
    }
  }, [id]);

  const loadVeiculo = async () => {
    try {
      setLoading(true);
      const data = await veiculosAPI.get(id);
      // Converter valores null para string vazia nos campos de data
      setFormData({
        ...data,
        civ_validade: data.civ_validade || '',
        cipp_validade: data.cipp_validade || '',
        afericao_validade: data.afericao_validade || '',
        crlv_validade: data.crlv_validade || '',
        cronotacografo_validade: data.cronotacografo_validade || '',
        observacoes: data.observacoes || '',
        compartimentos: data.compartimentos || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Funções para gerenciar compartimentos
  const handleAddCompartimento = () => {
    const novoNumero = formData.compartimentos.length + 1;
    setFormData(prev => ({
      ...prev,
      compartimentos: [
        ...prev.compartimentos,
        { numero_boca: novoNumero, capacidade_m3: '' }
      ]
    }));
  };

  const handleRemoveCompartimento = (index) => {
    setFormData(prev => ({
      ...prev,
      compartimentos: prev.compartimentos
        .filter((_, i) => i !== index)
        .map((c, i) => ({ ...c, numero_boca: i + 1 }))
    }));
  };

  const handleCompartimentoChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      compartimentos: prev.compartimentos.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const dataToSend = {
        ...formData,
        tara: formData.tara ? parseFloat(formData.tara) : null,
        capacidade_kg: formData.capacidade_kg ? parseFloat(formData.capacidade_kg) : null,
        capacidade_m3: formData.capacidade_m3 ? parseFloat(formData.capacidade_m3) : null,
        compartimentos: formData.compartimentos.map(c => ({
          numero_boca: c.numero_boca,
          capacidade_m3: c.capacidade_m3 ? parseFloat(c.capacidade_m3) : 0
        }))
      };

      if (isEdit) {
        await veiculosAPI.update(id, dataToSend);
        toast.success('Veículo atualizado com sucesso!');
      } else {
        await veiculosAPI.create(dataToSend);
        toast.success('Veículo cadastrado com sucesso!');
      }

      setTimeout(() => navigate('/veiculos'), 500);
    } catch (err) {
      setError(err.message);
      toast.error('Erro ao salvar veículo. Verifique os dados.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit && !formData.placa) {
    return <Loading message="Carregando veículo..." />;
  }

  return (
    <div className="veiculo-form-container">
      <div className="form-header">
        <h2>{isEdit ? 'Editar Veículo' : 'Novo Veículo'}</h2>
        <button type="button" className="btn-back" onClick={() => navigate('/veiculos')}>
          ← Voltar
        </button>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="veiculo-form">
        <fieldset>
          <legend>Identificação</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="placa">Placa <span className="required">*</span></label>
              <input
                type="text"
                id="placa"
                name="placa"
                value={formData.placa}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setFormData(prev => ({ ...prev, placa: value }));
                }}
                required
                maxLength={8}
                placeholder="ABC1234 ou ABC-1234"
              />
            </div>

            <div className="form-group">
              <label htmlFor="renavam">RENAVAM</label>
              <input
                type="text"
                id="renavam"
                name="renavam"
                value={formData.renavam}
                onChange={handleChange}
                maxLength={11}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tipo_rodado">Tipo de Rodado</label>
              <input
                type="text"
                id="tipo_rodado"
                name="tipo_rodado"
                value={formData.tipo_rodado}
                onChange={handleChange}
                maxLength={5}
              />
            </div>

            <div className="form-group">
              <label htmlFor="tipo_carroceria">Tipo de Carroceria</label>
              <input
                type="text"
                id="tipo_carroceria"
                name="tipo_carroceria"
                value={formData.tipo_carroceria}
                onChange={handleChange}
                maxLength={5}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Capacidades</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tara">Tara (kg)</label>
              <input
                type="number"
                id="tara"
                name="tara"
                value={formData.tara}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="capacidade_kg">Capacidade (kg)</label>
              <input
                type="number"
                id="capacidade_kg"
                name="capacidade_kg"
                value={formData.capacidade_kg}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="capacidade_m3">Capacidade (m³)</label>
              <input
                type="number"
                id="capacidade_m3"
                name="capacidade_m3"
                value={formData.capacidade_m3}
                onChange={handleChange}
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Proprietário</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tipo_proprietario">Tipo de Proprietário</label>
              <select
                id="tipo_proprietario"
                name="tipo_proprietario"
                value={formData.tipo_proprietario}
                onChange={handleChange}
              >
                <option value="00">Próprio</option>
                <option value="01">Arrendado</option>
                <option value="02">Agregado</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="proprietario_nome">Nome do Proprietário</label>
              <input
                type="text"
                id="proprietario_nome"
                name="proprietario_nome"
                value={formData.proprietario_nome}
                onChange={handleChange}
                maxLength={60}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rntrc_proprietario">RNTRC</label>
              <input
                type="text"
                id="rntrc_proprietario"
                name="rntrc_proprietario"
                value={formData.rntrc_proprietario}
                onChange={handleChange}
                maxLength={8}
                placeholder="00000000"
              />
            </div>

            <div className="form-group">
              <label htmlFor="uf_proprietario">UF Proprietário</label>
              <input
                type="text"
                id="uf_proprietario"
                name="uf_proprietario"
                value={formData.uf_proprietario}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setFormData(prev => ({ ...prev, uf_proprietario: value }));
                }}
                maxLength={2}
                placeholder="SP"
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Documentação</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="civ_validade">Validade CIV</label>
              <input
                type="date"
                id="civ_validade"
                name="civ_validade"
                value={formData.civ_validade}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cipp_validade">Validade CIPP</label>
              <input
                type="date"
                id="cipp_validade"
                name="cipp_validade"
                value={formData.cipp_validade}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="afericao_validade">Validade Aferição</label>
              <input
                type="date"
                id="afericao_validade"
                name="afericao_validade"
                value={formData.afericao_validade}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="crlv_validade">Validade CRLV</label>
              <input
                type="date"
                id="crlv_validade"
                name="crlv_validade"
                value={formData.crlv_validade}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cronotacografo_validade">Validade Cronotacógrafo</label>
              <input
                type="date"
                id="cronotacografo_validade"
                name="cronotacografo_validade"
                value={formData.cronotacografo_validade}
                onChange={handleChange}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Compartimentos (Bocas)</legend>
          <p className="field-help">Cadastre os compartimentos do tanque para veículos que transportam líquidos</p>

          <div className="compartimentos-list">
            {formData.compartimentos.length === 0 ? (
              <div className="empty-compartimentos">
                <p>Nenhum compartimento cadastrado</p>
              </div>
            ) : (
              formData.compartimentos.map((comp, index) => (
                <div key={index} className="compartimento-item">
                  <div className="compartimento-numero">
                    <span className="numero-label">Boca</span>
                    <span className="numero-value">{comp.numero_boca}</span>
                  </div>
                  <div className="form-group">
                    <label>Capacidade (m³)</label>
                    <input
                      type="number"
                      value={comp.capacidade_m3}
                      onChange={(e) => handleCompartimentoChange(index, 'capacidade_m3', e.target.value)}
                      placeholder="Ex: 15.50"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-remove-compartimento"
                    onClick={() => handleRemoveCompartimento(index)}
                    title="Remover compartimento"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            className="btn-add-compartimento"
            onClick={handleAddCompartimento}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Adicionar Compartimento
          </button>

          {formData.compartimentos.length > 0 && (
            <div className="compartimentos-resumo">
              <strong>Total:</strong> {formData.compartimentos.length} compartimento{formData.compartimentos.length !== 1 ? 's' : ''} |
              <strong> Capacidade Total:</strong> {formData.compartimentos.reduce((acc, c) => acc + (parseFloat(c.capacidade_m3) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>Observações</legend>

          <div className="form-row">
            <div className="form-group" style={{ flex: 3 }}>
              <label htmlFor="observacoes">Observações</label>
              <textarea
                id="observacoes"
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                rows={4}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="ativo"
                  checked={formData.ativo}
                  onChange={handleChange}
                />
                Veículo Ativo
              </label>
            </div>
          </div>
        </fieldset>

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate('/veiculos')}
            disabled={loading}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Cadastrar')}
          </button>
        </div>
      </form>

      {/* Documentos Anexos - apenas na edicao */}
      {isEdit && (
        <DocumentosAnexos
          entidadeTipo="veiculo"
          entidadeId={id}
        />
      )}
    </div>
  );
}

export default VeiculoForm;
