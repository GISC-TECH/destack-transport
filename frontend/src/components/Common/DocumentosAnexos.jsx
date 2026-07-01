import { useState, useEffect, useRef, useCallback } from 'react';
import { documentosAPI } from '../../services/api';
import Button from './Button';
import Modal from './Modal';
import StatusPill from './StatusPill';
import TableContainer from './TableContainer';
import styles from './DocumentosAnexos.module.css';

// Tipos de documentos por entidade - Transportadora de Cargas
const TIPOS_DOCUMENTO = {
  cliente: [
    { value: 'contrato', label: 'Contrato de Transporte' },
    { value: 'proposta', label: 'Proposta Comercial' },
    { value: 'cnpj', label: 'Cartao CNPJ' },
    { value: 'contrato_social', label: 'Contrato Social' },
    { value: 'inscricao_estadual', label: 'Inscrição Estadual' },
    { value: 'procuracao', label: 'Procuração' },
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
  motorista: [
    // Documentos com validade (atualizam automaticamente)
    { value: 'cnh', label: 'CNH' },
    { value: 'curso_mopp', label: 'MOPP (Produtos Perigosos)' },
    { value: 'certificado_nr20', label: 'NR20 (Inflamáveis)' },
    { value: 'certificado_nr35', label: 'NR35 (Trabalho em Altura)' },
    { value: 'exame_toxicologico', label: 'Exame Toxicologico' },
    { value: 'aso', label: 'ASO (Atestado Saúde Ocupacional)' },
    // Cursos e treinamentos
    { value: 'curso_direcao_defensiva', label: 'Curso Direção Defensiva' },
    { value: 'curso_primeiros_socorros', label: 'Curso Primeiros Socorros' },
    { value: 'curso_cargas_perigosas', label: 'Curso Cargas Perigosas' },
    { value: 'integracao', label: 'Ficha de Integração' },
    // Documentos pessoais
    { value: 'rg', label: 'RG' },
    { value: 'cpf', label: 'CPF' },
    { value: 'titulo_eleitor', label: 'Título de Eleitor' },
    { value: 'reservista', label: 'Certificado de Reservista' },
    { value: 'comprovante_endereco', label: 'Comprovante de Endereço' },
    { value: 'certidao_nascimento', label: 'Certidão de Nascimento' },
    { value: 'certidao_casamento', label: 'Certidão de Casamento' },
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
    { value: 'laudo_inspecao', label: 'CIV (Inspeção Veicular)' },
    { value: 'certificado_ibama', label: 'CIPP (Produtos Perigosos - IBAMA)' },
    { value: 'afericao', label: 'Aferição Tacógrafo (IBAMETRO/INMETRO)' },
    { value: 'laudo_cronotacografo', label: 'Cronotacógrafo (Disco/Digital)' },
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

  // Tipos de entidade suportados pelo backend
  const TIPOS_ENTIDADE_VALIDOS = ['cliente', 'motorista', 'veiculo', 'cte'];

  // API baseada no tipo de entidade
  const getAPI = useCallback(() => {
    switch (entidadeTipo) {
      case 'cliente':
        return documentosAPI.clientes;
      case 'motorista':
        return documentosAPI.motoristas;
      case 'veiculo':
        return documentosAPI.veiculos;
      case 'cte':
        return documentosAPI.ctes;
      default:
        throw new Error('Tipo de entidade invalido');
    }
  }, [entidadeTipo]);

  const tipoValido = TIPOS_ENTIDADE_VALIDOS.includes(entidadeTipo);

  // Carrega documentos
  const loadDocumentos = useCallback(async () => {
    if (!entidadeId || !tipoValido) return;

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
  }, [entidadeId, getAPI, tipoValido]);

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

  const getValidadeStatus = (validade) => {
    if (isExpired(validade)) return 'danger';
    if (isExpiringSoon(validade)) return 'warning';
    return null;
  };

  const tiposDisponiveis = TIPOS_DOCUMENTO[entidadeTipo] || [];

  const handleCancelUpload = () => {
    setShowUploadForm(false);
    setSelectedFile(null);
    setUploadData({ tipo: 'outro', nome: '', validade: '', observacoes: '' });
  };

  return (
    <div className={styles.documentosAnexos}>
      <div className={styles.documentosHeader}>
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Documentos Anexos
        </h3>
        {tipoValido && !readOnly && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowUploadForm(!showUploadForm)}
          >
            {showUploadForm ? 'Cancelar' : '+ Novo Documento'}
          </Button>
        )}
      </div>

      {!tipoValido && (
        <div className={styles.noDocs} style={{ padding: '20px', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <p>Documentos anexos não estão disponíveis para este tipo de registro.</p>
        </div>
      )}

      {tipoValido && error && (
        <div className={styles.errorMessage} role="alert" aria-live="polite">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
          <button onClick={() => setError(null)} className={styles.closeBtn} aria-label="Fechar mensagem de erro">&times;</button>
        </div>
      )}

      {/* Formulario de Upload */}
      {tipoValido && showUploadForm && !readOnly && (
        <div className={styles.uploadForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="upload_tipo">Tipo de Documento</label>
              <select
                id="upload_tipo"
                value={uploadData.tipo}
                onChange={(e) => setUploadData(prev => ({ ...prev, tipo: e.target.value }))}
              >
                {tiposDisponiveis.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="upload_nome">Nome do Documento</label>
              <input
                id="upload_nome"
                type="text"
                value={uploadData.nome}
                onChange={(e) => setUploadData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do documento"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="upload_validade">Data de Validade (opcional)</label>
              <input
                id="upload_validade"
                type="date"
                value={uploadData.validade}
                onChange={(e) => setUploadData(prev => ({ ...prev, validade: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="upload_observacoes">Observações</label>
              <input
                id="upload_observacoes"
                type="text"
                value={uploadData.observacoes}
                onChange={(e) => setUploadData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Observações (opcional)"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={`${styles.formGroup} ${styles.fileInputGroup}`}>
              <label htmlFor="upload_arquivo">Arquivo</label>
              <div className={styles.fileInputWrapper}>
                <input
                  id="upload_arquivo"
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.txt"
                />
                {selectedFile && (
                  <span className={styles.selectedFile}>
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <Button
              variant="success"
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              loading={uploading}
            >
              {uploading ? 'Enviando...' : 'Enviar Documento'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCancelUpload}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Edicao */}
      <Modal
        isOpen={!!editingDoc}
        onClose={handleCancelEdit}
        title="Editar Documento"
        size="md"
        footer={
          <>
            <Button
              variant="success"
              onClick={handleSaveEdit}
              disabled={saving}
              loading={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleCancelEdit}
              disabled={saving}
            >
              Cancelar
            </Button>
          </>
        }
      >
        <div className={styles.formGroup}>
          <label htmlFor="edit_tipo">Tipo de Documento</label>
          <select
            id="edit_tipo"
            value={editData.tipo}
            onChange={(e) => setEditData(prev => ({ ...prev, tipo: e.target.value }))}
          >
            {tiposDisponiveis.map(tipo => (
              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="edit_nome">Nome do Documento</label>
          <input
            id="edit_nome"
            type="text"
            value={editData.nome}
            onChange={(e) => setEditData(prev => ({ ...prev, nome: e.target.value }))}
            placeholder="Nome do documento"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="edit_validade">Data de Validade</label>
          <input
            id="edit_validade"
            type="date"
            value={editData.validade}
            onChange={(e) => setEditData(prev => ({ ...prev, validade: e.target.value }))}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="edit_observacoes">Observações</label>
          <input
            id="edit_observacoes"
            type="text"
            value={editData.observacoes}
            onChange={(e) => setEditData(prev => ({ ...prev, observacoes: e.target.value }))}
            placeholder="Observações (opcional)"
          />
        </div>
      </Modal>

      {/* Lista de Documentos */}
      {tipoValido && (
        <div className={styles.documentosList}>
          {loading ? (
            <div className={styles.loadingDocs}>Carregando documentos...</div>
          ) : documentos.length === 0 ? (
            <div className={styles.noDocs}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <p>Nenhum documento anexado</p>
            </div>
          ) : (
            <TableContainer mobileCards>
              <table className={styles.documentosTable}>
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
                  {documentos.map((doc) => {
                    const validadeStatus = getValidadeStatus(doc.validade);
                    return (
                      <tr
                        key={doc.id}
                        className={
                          isExpired(doc.validade)
                            ? styles.expired
                            : isExpiringSoon(doc.validade)
                              ? styles.expiringSoon
                              : ''
                        }
                      >
                        <td data-label="Tipo">
                          <span className={styles.docTipo}>{doc.tipo_display || doc.tipo}</span>
                        </td>
                        <td data-label="Nome" className={styles.docNome}>{doc.nome}</td>
                        <td data-label="Tamanho">{doc.tamanho_formatado || '-'}</td>
                        <td data-label="Validade">
                          {doc.validade ? (
                            <span className={styles.validade}>
                              {formatDate(doc.validade)}
                              {validadeStatus && (
                                <StatusPill status={validadeStatus}>
                                  {isExpired(doc.validade) ? 'Vencido' : 'Vencendo'}
                                </StatusPill>
                              )}
                            </span>
                          ) : '-'}
                        </td>
                        <td data-label="Data Upload">{formatDate(doc.criado_em)}</td>
                        <td data-label="Ações" className={styles.docAcoes}>
                          <Button
                            variant="primary"
                            size="sm"
                            iconOnly
                            onClick={() => handleView(doc)}
                            aria-label="Visualizar"
                            title="Visualizar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </Button>
                          <Button
                            variant="success"
                            size="sm"
                            iconOnly
                            onClick={() => handleDownload(doc)}
                            aria-label="Baixar"
                            title="Baixar"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </Button>
                          {!readOnly && (
                            <>
                              <Button
                                variant="warning"
                                size="sm"
                                iconOnly
                                onClick={() => handleEdit(doc)}
                                aria-label="Editar"
                                title="Editar"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                iconOnly
                                onClick={() => handleDelete(doc.id)}
                                aria-label="Excluir"
                                title="Excluir"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableContainer>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentosAnexos;
