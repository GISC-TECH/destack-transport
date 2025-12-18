import { useState, useEffect, useRef } from 'react';
import { documentosAPI } from '../../services/api';
import './DocumentosAnexos.css';

// Tipos de documentos por entidade
const TIPOS_DOCUMENTO = {
  cliente: [
    { value: 'contrato', label: 'Contrato' },
    { value: 'proposta', label: 'Proposta Comercial' },
    { value: 'outro', label: 'Outro' },
  ],
  motorista: [
    { value: 'cnh', label: 'CNH' },
    { value: 'rg', label: 'RG' },
    { value: 'cpf', label: 'CPF' },
    { value: 'comprovante_endereco', label: 'Comprovante de Endereco' },
    { value: 'certificado_nr20', label: 'Certificado NR20' },
    { value: 'curso_mopp', label: 'Curso MOPP' },
    { value: 'exame_toxicologico', label: 'Exame Toxicologico' },
    { value: 'aso', label: 'ASO (Atestado Saude)' },
    { value: 'outro', label: 'Outro' },
  ],
  veiculo: [
    { value: 'crlv', label: 'CRLV' },
    { value: 'seguro', label: 'Apolice de Seguro' },
    { value: 'laudo_inspecao', label: 'Laudo de Inspecao' },
    { value: 'certificado_ibama', label: 'Certificado IBAMA' },
    { value: 'certificado_antt', label: 'Certificado ANTT' },
    { value: 'laudo_cronotacografo', label: 'Laudo Cronotacografo' },
    { value: 'outro', label: 'Outro' },
  ],
};

function DocumentosAnexos({ entidadeTipo, entidadeId, readOnly = false }) {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    tipo: 'outro',
    nome: '',
    validade: '',
    observacoes: '',
  });
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // API baseada no tipo de entidade
  const getAPI = () => {
    switch (entidadeTipo) {
      case 'cliente':
        return documentosAPI.clientes;
      case 'motorista':
        return documentosAPI.motoristas;
      case 'veiculo':
        return documentosAPI.veiculos;
      default:
        throw new Error('Tipo de entidade invalido');
    }
  };

  // Carrega documentos
  const loadDocumentos = async () => {
    if (!entidadeId) return;

    try {
      setLoading(true);
      setError(null);
      const api = getAPI();
      const data = await api.list(entidadeId);
      setDocumentos(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
      setError('Erro ao carregar documentos');
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocumentos();
  }, [entidadeId, entidadeTipo]);

  // Handler para selecao de arquivo
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadData.nome) {
        setUploadData(prev => ({ ...prev, nome: file.name }));
      }
    }
  };

  // Handler para upload
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Selecione um arquivo');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const api = getAPI();
      await api.upload(entidadeId, selectedFile, uploadData);

      // Limpar form e recarregar
      setSelectedFile(null);
      setUploadData({ tipo: 'outro', nome: '', validade: '', observacoes: '' });
      setShowUploadForm(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadDocumentos();
    } catch (err) {
      console.error('Erro ao enviar documento:', err);
      setError(err.message || 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  // Handler para deletar
  const handleDelete = async (documentoId) => {
    if (!window.confirm('Deseja realmente excluir este documento?')) return;

    try {
      const api = getAPI();
      await api.delete(entidadeId, documentoId);
      await loadDocumentos();
    } catch (err) {
      console.error('Erro ao excluir documento:', err);
      setError('Erro ao excluir documento');
    }
  };

  // Handler para download
  const handleDownload = async (doc) => {
    try {
      const blob = await documentosAPI.download(doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nome || 'documento';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar documento:', err);
      setError('Erro ao baixar documento');
    }
  };

  // Handler para visualizar
  const handleView = (doc) => {
    if (doc.arquivo_url) {
      window.open(doc.arquivo_url, '_blank');
    }
  };

  // Formatar data
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Verificar se documento esta vencido
  const isExpired = (validade) => {
    if (!validade) return false;
    return new Date(validade) < new Date();
  };

  // Verificar se documento esta proximo de vencer (30 dias)
  const isExpiringSoon = (validade) => {
    if (!validade) return false;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const validadeDate = new Date(validade);
    return validadeDate > new Date() && validadeDate <= thirtyDaysFromNow;
  };

  const tiposDisponiveis = TIPOS_DOCUMENTO[entidadeTipo] || TIPOS_DOCUMENTO.cliente;

  return (
    <div className="documentos-anexos">
      <div className="documentos-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Documentos Anexos
        </h3>
        {!readOnly && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowUploadForm(!showUploadForm)}
          >
            {showUploadForm ? 'Cancelar' : '+ Novo Documento'}
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
          <button onClick={() => setError(null)} className="close-btn">&times;</button>
        </div>
      )}

      {/* Formulario de Upload */}
      {showUploadForm && !readOnly && (
        <div className="upload-form">
          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Documento</label>
              <select
                value={uploadData.tipo}
                onChange={(e) => setUploadData(prev => ({ ...prev, tipo: e.target.value }))}
              >
                {tiposDisponiveis.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nome do Documento</label>
              <input
                type="text"
                value={uploadData.nome}
                onChange={(e) => setUploadData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do documento"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Data de Validade (opcional)</label>
              <input
                type="date"
                value={uploadData.validade}
                onChange={(e) => setUploadData(prev => ({ ...prev, validade: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Observacoes</label>
              <input
                type="text"
                value={uploadData.observacoes}
                onChange={(e) => setUploadData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observacoes (opcional)"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group file-input-group">
              <label>Arquivo</label>
              <div className="file-input-wrapper">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt"
                />
                {selectedFile && (
                  <span className="selected-file">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button
              className="btn btn-success"
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Enviando...' : 'Enviar Documento'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowUploadForm(false);
                setSelectedFile(null);
                setUploadData({ tipo: 'outro', nome: '', validade: '', observacoes: '' });
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de Documentos */}
      <div className="documentos-list">
        {loading ? (
          <div className="loading-docs">Carregando documentos...</div>
        ) : documentos.length === 0 ? (
          <div className="no-docs">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <p>Nenhum documento anexado</p>
          </div>
        ) : (
          <table className="documentos-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nome</th>
                <th>Tamanho</th>
                <th>Validade</th>
                <th>Data Upload</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((doc) => (
                <tr key={doc.id} className={isExpired(doc.validade) ? 'expired' : isExpiringSoon(doc.validade) ? 'expiring-soon' : ''}>
                  <td>
                    <span className="doc-tipo">{doc.tipo_display || doc.tipo}</span>
                  </td>
                  <td className="doc-nome">{doc.nome}</td>
                  <td>{doc.tamanho_formatado || '-'}</td>
                  <td>
                    {doc.validade ? (
                      <span className={`validade ${isExpired(doc.validade) ? 'vencido' : isExpiringSoon(doc.validade) ? 'vencendo' : ''}`}>
                        {formatDate(doc.validade)}
                        {isExpired(doc.validade) && <span className="badge-vencido">Vencido</span>}
                        {isExpiringSoon(doc.validade) && <span className="badge-vencendo">Vencendo</span>}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{formatDate(doc.criado_em)}</td>
                  <td className="doc-acoes">
                    <button
                      className="btn-icon btn-view"
                      onClick={() => handleView(doc)}
                      title="Visualizar"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    <button
                      className="btn-icon btn-download"
                      onClick={() => handleDownload(doc)}
                      title="Baixar"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>
                    {!readOnly && (
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(doc.id)}
                        title="Excluir"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default DocumentosAnexos;
