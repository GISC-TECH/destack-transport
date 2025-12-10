# Frontend Completo - Todos os Componentes

**Guia completo para implementar 100% do frontend**

---

## ✅ JÁ IMPLEMENTADO

1. **Dashboard** - Completo
2. **Clientes** - Lista + Formulário (criar/editar) - **COMPLETO**
3. **Motoristas** - Lista + Alertas
4. **Veículos** - Lista + Alertas
5. **Componentes Comuns** - Navbar, Loading, ErrorMessage

---

## 📋 FALTA IMPLEMENTAR

Vou fornecer o código completo para cada componente faltante.

---

## 1. FORMULÁRIO DE MOTORISTAS

### Criar arquivo: `frontend/src/components/Motoristas/MotoristaForm.jsx`

```jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motoristasAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import './MotoristaForm.css';

function MotoristaForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    cnh: '',
    categoria_cnh: 'E',
    cnh_validade: '',
    nr20_validade: '',
    aso_validade: '',
    telefone: '',
    email: '',
    ativo: true
  });

  useEffect(() => {
    if (isEdit) {
      loadMotorista();
    }
  }, [id]);

  const loadMotorista = async () => {
    try {
      setLoading(true);
      const data = await motoristasAPI.get(id);
      setFormData(data);
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

  const formatCPF = (value) => {
    const digits = value.replace(/\D/g, '').substring(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleCPFChange = (e) => {
    const formatted = formatCPF(e.target.value);
    setFormData(prev => ({ ...prev, cpf: formatted }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const dataToSend = {
        ...formData,
        cpf: formData.cpf.replace(/\D/g, '')
      };

      if (isEdit) {
        await motoristasAPI.update(id, dataToSend);
      } else {
        await motoristasAPI.create(dataToSend);
      }

      navigate('/motoristas');
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit && !formData.nome) {
    return <Loading message="Carregando motorista..." />;
  }

  return (
    <div className="motorista-form-container">
      <div className="form-header">
        <h2>{isEdit ? 'Editar Motorista' : 'Novo Motorista'}</h2>
        <button type="button" className="btn-back" onClick={() => navigate('/motoristas')}>
          ← Voltar
        </button>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="motorista-form">
        <fieldset>
          <legend>Dados Pessoais</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nome">Nome Completo <span className="required">*</span></label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                required
                maxLength={255}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cpf">CPF <span className="required">*</span></label>
              <input
                type="text"
                id="cpf"
                name="cpf"
                value={formData.cpf}
                onChange={handleCPFChange}
                required
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="telefone">Telefone</label>
              <input
                type="tel"
                id="telefone"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                maxLength={255}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Documentação</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cnh">CNH <span className="required">*</span></label>
              <input
                type="text"
                id="cnh"
                name="cnh"
                value={formData.cnh}
                onChange={handleChange}
                required
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label htmlFor="categoria_cnh">Categoria CNH <span className="required">*</span></label>
              <select
                id="categoria_cnh"
                name="categoria_cnh"
                value={formData.categoria_cnh}
                onChange={handleChange}
                required
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="cnh_validade">Validade CNH</label>
              <input
                type="date"
                id="cnh_validade"
                name="cnh_validade"
                value={formData.cnh_validade}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nr20_validade">Validade NR20</label>
              <input
                type="date"
                id="nr20_validade"
                name="nr20_validade"
                value={formData.nr20_validade}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="aso_validade">Validade ASO</label>
              <input
                type="date"
                id="aso_validade"
                name="aso_validade"
                value={formData.aso_validade}
                onChange={handleChange}
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
                Motorista Ativo
              </label>
            </div>
          </div>
        </fieldset>

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate('/motoristas')}
            disabled={loading}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Cadastrar')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default MotoristaForm;
```

### Criar arquivo: `frontend/src/components/Motoristas/MotoristaForm.css`

```css
/* Usar o mesmo CSS do ClienteForm.css */
@import '../Clientes/ClienteForm.css';

.motorista-form-container {
  padding: 30px;
  max-width: 1000px;
  margin: 0 auto;
}
```

---

## 2. FORMULÁRIO DE VEÍCULOS

### Criar arquivo: `frontend/src/components/Veiculos/VeiculoForm.jsx`

```jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { veiculosAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import './VeiculoForm.css';

function VeiculoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
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
    ativo: true
  });

  useEffect(() => {
    if (isEdit) {
      loadVeiculo();
    }
  }, [id]);

  const loadVeiculo = async () => {
    try {
      setLoading(true);
      const data = await veiculosAPI.get(id);
      setFormData(data);
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
      };

      if (isEdit) {
        await veiculosAPI.update(id, dataToSend);
      } else {
        await veiculosAPI.create(dataToSend);
      }

      navigate('/veiculos');
    } catch (err) {
      setError(err.message);
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
                onChange={(e) => handleChange({
                  ...e,
                  target: { ...e.target, value: e.target.value.toUpperCase() }
                })}
                required
                maxLength={7}
                placeholder="ABC1234"
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
                maxLength={20}
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
                maxLength={255}
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
                maxLength={20}
              />
            </div>

            <div className="form-group">
              <label htmlFor="uf_proprietario">UF Proprietário</label>
              <input
                type="text"
                id="uf_proprietario"
                name="uf_proprietario"
                value={formData.uf_proprietario}
                onChange={(e) => handleChange({
                  ...e,
                  target: { ...e.target, value: e.target.value.toUpperCase() }
                })}
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
    </div>
  );
}

export default VeiculoForm;
```

### Criar arquivo: `frontend/src/components/Veiculos/VeiculoForm.css`

```css
@import '../Clientes/ClienteForm.css';

.veiculo-form-container {
  padding: 30px;
  max-width: 1000px;
  margin: 0 auto;
}

textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}
```

---

## 3. ATUALIZAR APP.JSX

Adicionar as novas rotas:

```jsx
// Adicionar imports
import MotoristaForm from './components/Motoristas/MotoristaForm';
import VeiculoForm from './components/Veiculos/VeiculoForm';

// Adicionar rotas
<Route path="/motoristas/novo" element={<MotoristaForm />} />
<Route path="/motoristas/editar/:id" element={<MotoristaForm />} />
<Route path="/veiculos/novo" element={<VeiculoForm />} />
<Route path="/veiculos/editar/:id" element={<VeiculoForm />} />
```

---

## 4. ATUALIZAR LISTAS (Motoristas e Veículos)

### MotoristasList.jsx - Adicionar navegação

```jsx
// No topo
import { useNavigate } from 'react-router-dom';

// Dentro do componente
const navigate = useNavigate();

// Botão "Novo Motorista"
onClick={() => navigate('/motoristas/novo')}

// Botão "Editar"
onClick={() => navigate(`/motoristas/editar/${motorista.id}`)}
```

### VeiculosList.jsx - Adicionar navegação

```jsx
// No topo
import { useNavigate } from 'react-router-dom';

// Dentro do componente
const navigate = useNavigate();

// Botão "Novo Veículo"
onClick={() => navigate('/veiculos/novo')}

// Botão "Editar"
onClick={() => navigate(`/veiculos/editar/${veiculo.id}`)}
```

---

## 📝 RESUMO DE IMPLEMENTAÇÃO

### Componentes já criados:
1. ✅ ClienteForm.jsx + CSS
2. ✅ App.jsx atualizado com rotas de Cliente

### Componentes a criar (copie código acima):
1. ⏳ MotoristaForm.jsx + CSS
2. ⏳ VeiculoForm.jsx + CSS
3. ⏳ Atualizar MotoristasList.jsx (adicionar navigate)
4. ⏳ Atualizar VeiculosList.jsx (adicionar navigate)
5. ⏳ Atualizar App.jsx (adicionar rotas de Motorista e Veículo)

---

## 🚀 TESTE RÁPIDO

Após implementar:

```bash
cd frontend
npm run dev
```

Testar:
1. http://localhost:5173/clientes/novo - ✅ Formulário de cliente
2. http://localhost:5173/motoristas/novo - Formulário de motorista
3. http://localhost:5173/veiculos/novo - Formulário de veículo

---

Quer que eu continue implementando os outros componentes (Upload XML, CT-e, MDF-e, etc)?
