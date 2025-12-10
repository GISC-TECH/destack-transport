import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadAPI } from '../../services/api';
import PageHeader from '../Common/PageHeader';
import './Upload.css';

function UploadXML() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    const xmlFiles = newFiles.filter(file =>
      file.name.toLowerCase().endsWith('.xml')
    );
    setFiles(prev => [...prev, ...xmlFiles]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
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
  };

  const handleBatchUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setResults([]);

    try {
      const result = await uploadAPI.batch(files);

      // Mapear resultados_detalhados do backend para o formato esperado
      if (result.resultados_detalhados && result.resultados_detalhados.length > 0) {
        const mappedResults = result.resultados_detalhados.map(item => ({
          file: item.arquivo_principal_nome || 'N/A',
          success: item.status === 'sucesso',
          message: item.message || item.erro || item.status,
          tipo: item.chave ? (item.chave.length === 44 ? 'Documento' : '') : '',
          numero: item.chave || ''
        }));
        setResults(mappedResults);
      } else {
        setResults([{
          file: 'Lote',
          success: true,
          message: `${result.sucesso || 0} sucesso, ${result.erros || 0} erros, ${result.ignorados || 0} ignorados`
        }]);
      }
    } catch (error) {
      setResults([{
        file: 'Lote',
        success: false,
        message: error.message || 'Erro ao processar lote'
      }]);
    }

    setUploading(false);
    setFiles([]);
  };

  const uploadIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  );

  return (
    <div className="upload-page">
      <PageHeader
        title="Upload de XML"
        subtitle="Importe arquivos CT-e e MDF-e para o sistema"
        icon={uploadIcon}
        breadcrumbs={[{ label: 'Documentos' }, { label: 'Upload XML' }]}
      />

      <div className="upload-container">
        <div
          className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-content">
            <div className="dropzone-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="dropzone-text">
              Arraste arquivos XML aqui ou clique para selecionar
            </p>
            <p className="dropzone-hint">
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
          <div className="files-list">
            <h3>Arquivos selecionados ({files.length})</h3>
            <div className="files-grid">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    className="file-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="upload-actions">
              <button
                className="btn-secondary"
                onClick={() => setFiles([])}
                disabled={uploading}
              >
                Limpar
              </button>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Enviando...' : 'Enviar Arquivos'}
              </button>
              {files.length > 1 && (
                <button
                  className="btn-success"
                  onClick={handleBatchUpload}
                  disabled={uploading}
                >
                  Enviar em Lote
                </button>
              )}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="results-section">
            <h3>Resultados do Upload</h3>
            <div className="results-list">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`result-item ${result.success ? 'success' : 'error'}`}
                >
                  <div className="result-icon">
                    {result.success ? '✓' : '✕'}
                  </div>
                  <div className="result-info">
                    <span className="result-file">{result.file}</span>
                    <span className="result-message">{result.message}</span>
                    {result.tipo && (
                      <span className="result-tipo">
                        Tipo: {result.tipo} | Número: {result.numero}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="results-actions">
              <button
                className="btn-primary"
                onClick={() => navigate('/ctes')}
              >
                Ver CT-es
              </button>
              <button
                className="btn-secondary"
                onClick={() => navigate('/mdfes')}
              >
                Ver MDF-es
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadXML;
