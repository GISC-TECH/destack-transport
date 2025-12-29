import { useState, useEffect } from 'react';
import { configAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './Configuracoes.css';

function Configuracoes() {
  const [activeTab, setActiveTab] = useState('empresa');
  const [empresa, setEmpresa] = useState(null);
  const [parametros, setParametros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab === 'empresa') {
      loadEmpresa();
    } else {
      loadParametros();
    }
  }, [activeTab]);

  const loadEmpresa = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await configAPI.empresa.get();
      // Se retornou dados válidos
      if (result && !result.detail) {
        setEmpresa(result);
      } else {
        // Se não existe, inicializa com objeto vazio
        setEmpresa(getEmpresaVazia());
      }
    } catch {
      // Se não existe (404), inicializa com objeto vazio sem mostrar erro
      console.info('Configuração de empresa não encontrada, criando nova...');
      setEmpresa(getEmpresaVazia());
    } finally {
      setLoading(false);
    }
  };

  const getEmpresaVazia = () => ({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    ie: '',
    rntrc: '',
    email: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: ''
  });

  const loadParametros = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await configAPI.parametros.list();
      setParametros(result.results || result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmpresaChange = (field, value) => {
    setEmpresa(prev => ({ ...prev, [field]: value }));
  };

  const handleParametroChange = (id, value) => {
    setParametros(prev => prev.map(p =>
      p.id === id ? { ...p, valor: value } : p
    ));
  };

  const saveEmpresa = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await configAPI.empresa.save(empresa);
      setMessage({ type: 'success', text: 'Dados da empresa salvos com sucesso!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const saveParametros = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const valores = {};
      parametros.forEach(p => {
        // Backend usa 'nome' como chave única do parâmetro
        valores[p.nome] = p.valor;
      });
      await configAPI.parametros.atualizarMultiplos(valores);
      setMessage({ type: 'success', text: 'Parâmetros salvos com sucesso!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando configurações..." />;
  if (error) return <ErrorMessage message={error} onRetry={activeTab === 'empresa' ? loadEmpresa : loadParametros} />;

  const configIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );

  return (
    <div className="configuracoes-page">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie os dados da empresa e parâmetros do sistema"
        icon={configIcon}
        breadcrumbs={[{ label: 'Configurações' }]}
      />

      {/* Tabs */}
      <div className="config-tabs">
        <button
          className={`config-tab ${activeTab === 'empresa' ? 'active' : ''}`}
          onClick={() => setActiveTab('empresa')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          Dados da Empresa
        </button>
        <button
          className={`config-tab ${activeTab === 'parametros' ? 'active' : ''}`}
          onClick={() => setActiveTab('parametros')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Parâmetros do Sistema
        </button>
      </div>

      {message && (
        <div className={`message-box ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Conteúdo */}
      <div className="config-content">
        {activeTab === 'empresa' && empresa && (
          <div className="config-section">
            <div className="form-grid">
              <div className="form-group full">
                <label>Razão Social</label>
                <input
                  type="text"
                  value={empresa.razao_social || ''}
                  onChange={(e) => handleEmpresaChange('razao_social', e.target.value)}
                  placeholder="Razão Social da Empresa"
                />
              </div>
              <div className="form-group">
                <label>Nome Fantasia</label>
                <input
                  type="text"
                  value={empresa.nome_fantasia || ''}
                  onChange={(e) => handleEmpresaChange('nome_fantasia', e.target.value)}
                  placeholder="Nome Fantasia"
                />
              </div>
              <div className="form-group">
                <label>CNPJ</label>
                <input
                  type="text"
                  value={empresa.cnpj || ''}
                  onChange={(e) => handleEmpresaChange('cnpj', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="form-group">
                <label>Inscrição Estadual</label>
                <input
                  type="text"
                  value={empresa.ie || ''}
                  onChange={(e) => handleEmpresaChange('ie', e.target.value)}
                  placeholder="IE"
                />
              </div>
              <div className="form-group">
                <label>Telefone</label>
                <input
                  type="text"
                  value={empresa.telefone || ''}
                  onChange={(e) => handleEmpresaChange('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="form-group full">
                <label>E-mail</label>
                <input
                  type="email"
                  value={empresa.email || ''}
                  onChange={(e) => handleEmpresaChange('email', e.target.value)}
                  placeholder="email@empresa.com"
                />
              </div>

              <div className="form-divider">
                <span>Endereço</span>
              </div>

              <div className="form-group" style={{gridColumn: 'span 2'}}>
                <label>Logradouro</label>
                <input
                  type="text"
                  value={empresa.logradouro || ''}
                  onChange={(e) => handleEmpresaChange('logradouro', e.target.value)}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div className="form-group">
                <label>Número</label>
                <input
                  type="text"
                  value={empresa.numero || ''}
                  onChange={(e) => handleEmpresaChange('numero', e.target.value)}
                  placeholder="Nº"
                />
              </div>
              <div className="form-group">
                <label>Bairro</label>
                <input
                  type="text"
                  value={empresa.bairro || ''}
                  onChange={(e) => handleEmpresaChange('bairro', e.target.value)}
                  placeholder="Bairro"
                />
              </div>
              <div className="form-group">
                <label>Cidade/Municipio</label>
                <input
                  type="text"
                  value={empresa.municipio || ''}
                  onChange={(e) => handleEmpresaChange('municipio', e.target.value)}
                  placeholder="Municipio"
                />
              </div>
              <div className="form-group">
                <label>UF</label>
                <input
                  type="text"
                  value={empresa.uf || ''}
                  onChange={(e) => handleEmpresaChange('uf', e.target.value)}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
              <div className="form-group">
                <label>CEP</label>
                <input
                  type="text"
                  value={empresa.cep || ''}
                  onChange={(e) => handleEmpresaChange('cep', e.target.value)}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-primary" onClick={saveEmpresa} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Dados'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'parametros' && (
          <div className="config-section">
            <div className="parametros-list">
              {parametros.length === 0 ? (
                <p className="no-data">Nenhum parâmetro configurado</p>
              ) : (
                parametros.map((param) => (
                  <div key={param.id} className="parametro-item">
                    <div className="parametro-info">
                      <span className="parametro-nome">{param.nome}</span>
                      <span className="parametro-desc">{param.descricao || ''}</span>
                    </div>
                    <div className="parametro-valor">
                      {param.tipo_dado === 'bool' ? (
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={param.valor === 'true' || param.valor === true}
                            onChange={(e) => handleParametroChange(param.id, e.target.checked.toString())}
                          />
                          <span className="slider"></span>
                        </label>
                      ) : (
                        <input
                          type={param.tipo_dado === 'int' || param.tipo_dado === 'float' ? 'number' : 'text'}
                          value={param.valor || ''}
                          onChange={(e) => handleParametroChange(param.id, e.target.value)}
                          disabled={!param.editavel}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {parametros.length > 0 && (
              <div className="form-actions">
                <button className="btn-primary" onClick={saveParametros} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Parâmetros'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Configuracoes;
