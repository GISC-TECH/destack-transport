import { useState, useEffect, useRef, useCallback } from 'react';
import { documentosAPI } from '../../services/api';
import './DocumentosAnexos.css';

// Tipos de documentos por entidade - Transportadora de Cargas
const TIPOS_DOCUMENTO = {
  cliente: [
    { value: 'contrato', label: 'Contrato de Transporte' },
    { value: 'proposta', label: 'Proposta Comercial' },
    { value: 'cnpj', label: 'Cartao CNPJ' },
    { value: 'contrato_social', label: 'Contrato Social' },
    { value: 'inscricao_estadual', label: 'Inscrição Estadual' },
    { value: 'procuracao', label: 'Procuracao' },
    { value: 'outro', label: 'Outro' },
  ],
  manutencao: [
    { value: 'nota_fiscal', label: 'Nota Fiscal' },
    { value: 'orcamento', label: 'Orcamento' },
    { value: 'ordem_servico', label: 'Ordem de Servico' },
    { value: 'laudo_tecnico', label: 'Laudo Tecnico' },
    { value: 'garantia', label: 'Termo de Garantia' },
    { value: 'foto_antes', label: 'Foto Antes' },
    { value: 'foto_depois', label: 'Foto Depois' },
    { value: 'outro', label: 'Outro' },
  ],
  cte: [
    { value: 'xml_cte', label: 'XML CT-e' },
    { value: 'dacte', label: 'DACTE (PDF)' },
    { value: 'comprovante_entrega', label: 'Comprovante de Entrega' },
    { value: 'canhoto', label: 'Canhoto Assinado' },
    { value: 'nota_fiscal_mercadoria', label: 'NF-e Mercadoria' },
    { value: 'romaneio', label: 'Romaneio de Carga' },
    { value: 'seguro_carga', label: 'Apolice Seguro Carga' },
    { value: 'outro', label: 'Outro' },
  ],
  mdfe: [
    { value: 'xml_mdfe', label: 'XML MDF-e' },
    { value: 'damdfe', label: 'DAMDFE (PDF)' },
    { value: 'encerramento', label: 'Comprovante Encerramento' },
    { value: 'termo_carga', label: 'Termo de Carga' },
    { value: 'checklist', label: 'Checklist Viagem' },
    { value: 'outro', label: 'Outro' },
  ],
  pagamento: [
    { value: 'comprovante_pix', label: 'Comprovante PIX' },
    { value: 'comprovante_ted', label: 'Comprovante TED/DOC' },
    { value: 'comprovante_deposito', label: 'Comprovante Deposito' },
    { value: 'recibo', label: 'Recibo Assinado' },
    { value: 'boleto', label: 'Boleto Pago' },
    { value: 'nota_fiscal_servico', label: 'NFS-e' },
    { value: 'outro', label: 'Outro' },
  ],
  motorista: [
    // Documentos com validade (atualizam automaticamente)
    { value: 'cnh', label: 'CNH' },
    { value: 'curso_mopp', label: 'MOPP (Produtos Perigosos)' },
    { value: 'certificado_nr20', label: 'NR20 (Inflamaveis)' },
    { value: 'certificado_nr35', label: 'NR35 (Trabalho em Altura)' },
    { value: 'exame_toxicologico', label: 'Exame Toxicologico' },
    { value: 'aso', label: 'ASO (Atestado Saude Ocupacional)' },
    // Cursos e treinamentos
    { value: 'curso_direcao_defensiva', label: 'Curso Direcao Defensiva' },
    { value: 'curso_primeiros_socorros', label: 'Curso Primeiros Socorros' },
    { value: 'curso_cargas_perigosas', label: 'Curso Cargas Perigosas' },
    { value: 'integracao', label: 'Ficha de Integracao' },
    // Documentos pessoais
    { value: 'rg', label: 'RG' },
    { value: 'cpf', label: 'CPF' },
    { value: 'titulo_eleitor', label: 'Titulo de Eleitor' },
    { value: 'reservista', label: 'Certificado de Reservista' },
    { value: 'comprovante_endereco', label: 'Comprovante de Endereço' },
    { value: 'certidao_nascimento', label: 'Certidao de Nascimento' },
    { value: 'certidao_casamento', label: 'Certidao de Casamento' },
    // Trabalhista
    { value: 'ctps', label: 'CTPS (Carteira de Trabalho)' },
    { value: 'pis', label: 'PIS/PASEP' },
    { value: 'contrato_trabalho', label: 'Contrato de Trabalho' },
    { value: 'ficha_registro', label: 'Ficha de Registro' },
    // Outros
    { value: 'foto', label: 'Foto 3x4' },
    { value: 'outro', label: 'Outro' },
  ],
  veiculo: [
    // Documentos obrigatorios com validade (atualizam automaticamente)
    { value: 'crlv', label: 'CRLV (Licenciamento)' },
    { value: 'laudo_inspecao', label: 'CIV (Inspecao Veicular)' },
    { value: 'certificado_ibama', label: 'CIPP (Produtos Perigosos - IBAMA)' },
    { value: 'afericao', label: 'Afericao Tacografo (IBAMETRO/INMETRO)' },
    { value: 'laudo_cronotacografo', label: 'Cronotacografo (Disco/Digital)' },
    // Seguros
    { value: 'seguro', label: 'Seguro do Veículo' },
    { value: 'seguro_carga', label: 'Seguro de Carga (RCT-C)' },
    { value: 'seguro_ambiental', label: 'Seguro Ambiental' },
    // ANTT e Licencas
    { value: 'certificado_antt', label: 'RNTRC (ANTT)' },
    { value: 'licenca_ambiental', label: 'Licenca Ambiental' },
    { value: 'aut_transporte_especial', label: 'AET (Transporte Especial)' },
    // Laudos e Vistorias
    { value: 'laudo_opacidade', label: 'Laudo de Opacidade' },
    { value: 'vistoria_semestral', label: 'Vistoria Semestral' },
    { value: 'laudo_gas', label: 'Laudo de Gas (GNV)' },
    // Documentos do proprietario
    { value: 'contrato_agregado', label: 'Contrato de Agregado' },
    { value: 'contrato_arrendamento', label: 'Contrato de Arrendamento' },
    // Outros
    { value: 'nota_fiscal', label: 'Nota Fiscal do Veículo' },
    { value: 'manual', label: 'Manual do Veículo' },
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
  const [editingDoc, setEditingDoc] = useState(null);
  const [editData, setEditData] = useState({
    tipo: '',
    nome: '',
    validade: '',
    observacoes: '',
  });
  const [saving, setSaving] = useState(false);

  // API baseada no tipo de entidade
  const getAPI = useCallback(() => {
    switch (entidadeTipo) {
      case 'cliente':
        return documentosAPI.clientes;
      case 'motorista':
        return documentosAPI.motoristas;
      case 'veiculo':
        return documentosAPI.veiculos;
      case 'manutencao':
        return documentosAPI.manutencoes;
      case 'cte':
        return documentosAPI.ctes;
      case 'mdfe':
        return documentosAPI.mdfes;
      case 'pagamento':
        return documentosAPI.pagamentos;
      default:
        throw new Error('Tipo de entidade invalido');
    }
  }, [entidadeTipo]);

  // Carrega documentos
  const loadDocumentos = useCallback(async () => {
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
  }, [entidadeId, getAPI]);

  useEffect(() => {
    loadDocumentos();
  }, [loadDocumentos]);

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

  // Handler para iniciar edicao
  const handleEdit = (doc) => {
    setEditingDoc(doc);
    setEditData({
      tipo: doc.tipo || 'outro',
      nome: doc.nome || '',
      validade: doc.validade || '',
      observacoes: doc.observacoes || '',
    });
  };

  // Handler para cancelar edicao
  const handleCancelEdit = () => {
    setEditingDoc(null);
    setEditData({ tipo: '', nome: '', validade: '', observacoes: '' });
  };

  // Handler para salvar edicao
  const handleSaveEdit = async () => {
    if (!editingDoc) return;

    try {
      setSaving(true);
      setError(null);
      const api = getAPI();
      await api.update(entidadeId, editingDoc.id, editData);
      setEditingDoc(null);
      setEditData({ tipo: '', nome: '', validade: '', observacoes: '' });
      await loadDocumentos();
    } catch (err) {
      console.error('Erro ao atualizar documento:', err);
      setError(err.message || 'Erro ao atualizar documento');
    } finally {
      setSaving(false);
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
              <label>Observações</label>
              <input
                type="text"
                value={uploadData.observacoes}
                onChange={(e) => setUploadData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações (opcional)"
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

      {/* Modal de Edicao */}
      {editingDoc && (
        <div className="edit-modal-overlay" onClick={handleCancelEdit}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h4>Editar Documento</h4>
              <button className="close-btn" onClick={handleCancelEdit}>&times;</button>
            </div>
            <div className="edit-modal-body">
              <div className="form-group">
                <label>Tipo de Documento</label>
                <select
                  value={editData.tipo}
                  onChange={(e) => setEditData(prev => ({ ...prev, tipo: e.target.value }))}
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
                  value={editData.nome}
                  onChange={(e) => setEditData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do documento"
                />
              </div>
              <div className="form-group">
                <label>Data de Validade</label>
                <input
                  type="date"
                  value={editData.validade}
                  onChange={(e) => setEditData(prev => ({ ...prev, validade: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Observações</label>
                <input
                  type="text"
                  value={editData.observacoes}
                  onChange={(e) => setEditData(prev => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Observações (opcional)"
                />
              </div>
            </div>
            <div className="edit-modal-footer">
              <button
                className="btn btn-success"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancelar
              </button>
            </div>
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
                <th>Ações</th>
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
                      <>
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => handleEdit(doc)}
                          title="Editar"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
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
                      </>
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
