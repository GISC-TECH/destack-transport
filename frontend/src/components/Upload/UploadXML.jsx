import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import styles from './Upload.module.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function UploadXML() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  const isXMLContentType = (type) => {
    if (!type) return false;
    const t = type.toLowerCase();
    return t === 'text/xml' || t === 'application/xml' || t === 'application/xhtml+xml';
  };

  const startsWithXMLDeclaration = async (file) => {
    const slice = file.slice(0, 100);
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(slice);
    });
    const trimmed = text.trimStart().toLowerCase();
    return trimmed.startsWith('<?xml');
  };

  const validateXMLFile = async (file) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Arquivo "${file.name}" excede o tamanho máximo de 10MB`);
    }
    if (isXMLContentType(file.type)) {
      return true;
    }
    const hasXmlDecl = await startsWithXMLDeclaration(file);
    if (!hasXmlDecl) {
      throw new Error(`Arquivo "${file.name}" não é um XML válido`);
    }
    return true;
  };

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    await addFiles(selectedFiles);
  };

  const addFiles = async (newFiles) => {
    const xmlFiles = newFiles.filter(file =>
      file.name.toLowerCase().endsWith('.xml')
    );

    if (xmlFiles.length !== newFiles.length) {
      toast.warning('Apenas arquivos .xml são permitidos');
    }

    const validFiles = [];
    for (const file of xmlFiles) {
      try {
        await validateXMLFile(file);
        validFiles.push(file);
      } catch (error) {
        toast.error(error.message);
      }
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    await addFiles(droppedFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setResults([]);

    const uploadResults = [];

    for (const file of files) {
      try {
        const result = await uploadAPI.processar(file);
        uploadResults.push({
          file: file.name,
          success: true,
          message: result.message || 'Processado com sucesso',
          tipo: result.tipo,
          numero: result.numero
        });
      } catch (error) {
        uploadResults.push({
          file: file.name,
          success: false,
          message: error.message || 'Erro ao processar arquivo'
        });
      }
    }

    setResults(uploadResults);
    setUploading(false);
    setFiles([]);

    const successCount = uploadResults.filter(r => r.success).length;
    const errorCount = uploadResults.filter(r => !r.success).length;
    if (errorCount === 0) {
      toast.success(`${successCount} arquivo(s) processado(s) com sucesso!`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} sucesso, ${errorCount} erro(s)`);
    } else {
      toast.error(`Erro ao processar ${errorCount} arquivo(s)`);
    }
  };

  const handleBatchUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setResults([]);
    let uploadResults;

    try {
      const result = await uploadAPI.batch(files);

      // Mapear resultados_detalhados do backend para o formato esperado
      if (result.resultados_detalhados && result.resultados_detalhados.length > 0) {
        uploadResults = result.resultados_detalhados.map(item => ({
          file: item.arquivo_principal_nome || 'N/A',
          success: item.status === 'sucesso',
          message: item.message || item.erro || item.status,
          tipo: item.chave ? (item.chave.length === 44 ? 'Documento' : '') : '',
          numero: item.chave || ''
        }));
        setResults(uploadResults);
      } else {
        uploadResults = [{
          file: 'Lote',
          success: true,
          message: `${result.sucesso || 0} sucesso, ${result.erros || 0} erros, ${result.ignorados || 0} ignorados`
        }];
        setResults(uploadResults);
      }
    } catch (error) {
      uploadResults = [{
        file: 'Lote',
        success: false,
        message: error.message || 'Erro ao processar lote'
      }];
      setResults(uploadResults);
    }

    setUploading(false);
    setFiles([]);

    const hasSuccess = uploadResults.some(r => r.success);
    const hasError = uploadResults.some(r => !r.success);
    if (!hasError && hasSuccess) {
      toast.success('Lote processado com sucesso!');
    } else if (hasError && hasSuccess) {
      toast.warning('Lote processado com alguns erros');
    } else if (hasError) {
      toast.error('Erro ao processar lote');
    }
  };

  const uploadIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Upload de XML"
        subtitle="Importe arquivos CT-e e MDF-e para o sistema"
        icon={uploadIcon}
        breadcrumbs={[{ label: 'Documentos' }, { label: 'Upload XML' }]}
      />

      <div className={styles.container}>
        <div
          className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
          data-testid="upload-dropzone"
          role="button"
          tabIndex={0}
          aria-label="Selecionar arquivos XML"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <div className={styles.dropzoneContent}>
            <div className={styles.dropzoneIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className={styles.dropzoneText}>
              Arraste arquivos XML aqui ou clique para selecionar
            </p>
            <p className={styles.dropzoneHint}>
              Suporta CT-e e MDF-e (arquivos .xml)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {files.length > 0 && (
          <div className={styles.filesList}>
            <h3>Arquivos selecionados ({files.length})</h3>
            <div className={styles.filesGrid}>
              {files.map((file, index) => (
                <div key={index} className={styles.fileItem}>
                  <div className={styles.fileIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileSize}>
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    className={styles.fileRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    aria-label={`Remover ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.uploadActions}>
              <Button
                variant="secondary"
                onClick={() => setFiles([])}
                disabled={uploading}
              >
                Limpar
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                loading={uploading}
                disabled={uploading}
              >
                {uploading ? 'Enviando...' : 'Enviar Arquivos'}
              </Button>
              {files.length > 1 && (
                <Button
                  variant="success"
                  onClick={handleBatchUpload}
                  loading={uploading}
                  disabled={uploading}
                >
                  Enviar em Lote
                </Button>
              )}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className={styles.resultsSection} data-testid="upload-results" aria-live="polite">
            <h3>Resultados do Upload</h3>
            <div className={styles.resultsList}>
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`${styles.resultItem} ${result.success ? styles.success : styles.error}`}
                >
                  <div className={styles.resultIcon}>
                    {result.success ? '✓' : '✕'}
                  </div>
                  <div className={styles.resultInfo}>
                    <span className={styles.resultFile}>{result.file}</span>
                    <span className={styles.resultMessage}>{result.message}</span>
                    {result.tipo && (
                      <span className={styles.resultTipo}>
                        Tipo: {result.tipo} | Número: {result.numero}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.resultsActions}>
              <Button
                variant="primary"
                onClick={() => navigate('/ctes')}
              >
                Ver CT-es
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/mdfes')}
              >
                Ver MDF-es
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadXML;
