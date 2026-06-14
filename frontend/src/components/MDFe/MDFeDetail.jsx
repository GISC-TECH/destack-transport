import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { mdfeAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import '../CTe/CTe.css';

function MDFeDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [mdfe, setMdfe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadMDFe();
  }, [id]);

  const loadMDFe = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await mdfeAPI.get(id);
      setMdfe(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setActionLoading('pdf');
      const blob = await mdfeAPI.downloadPDF(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DAMDFE_${mdfe.chave}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Erro ao baixar DAMDFE: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadXML = async () => {
    try {
      setActionLoading('xml');
      const blob = await mdfeAPI.downloadXML(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MDFe_${mdfe.chave}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Erro ao baixar XML: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReprocessar = async () => {
    if (!confirm('Deseja reprocessar este MDF-e?')) return;
    try {
      setActionLoading('reprocessar');
      await mdfeAPI.reprocessar(id);
      toast.success('MDF-e reprocessado com sucesso!');
      loadMDFe();
    } catch (err) {
      toast.error('Erro ao reprocessar: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) return <Loading message="Carregando MDF-e..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadMDFe} />;
  if (!mdfe) return <ErrorMessage message="MDF-e não encontrado" />;

  const getStatusInfo = () => {
    if (mdfe.cancelamento) {
      return { class: 'danger', text: 'Cancelado', icon: '✕' };
    }
    if (mdfe.encerrado) {
      return { class: 'info', text: 'Encerrado', icon: '✓' };
    }
    if (mdfe.processado && mdfe.protocolo?.codigo_status === 100) {
      return { class: 'success', text: 'Autorizado', icon: '✓' };
    }
    if (mdfe.protocolo && mdfe.protocolo.codigo_status !== 100) {
      return { class: 'warning', text: 'Rejeitado', icon: '!' };
    }
    return { class: 'secondary', text: 'Pendente', icon: '?' };
  };

  const status = getStatusInfo();

  return (
    <div className="mdfe-detail">
      <div className="page-header">
        <div>
          <Link to="/mdfes" className="back-link">← Voltar para lista</Link>
          <h1>MDF-e #{mdfe.identificacao?.n_mdf}</h1>
          <p className="chave-cte">{mdfe.chave}</p>
        </div>
        <div className="header-actions">
          <div className={`status-badge status-${status.class}`}>
            <span className="status-icon">{status.icon}</span>
            {status.text}
          </div>
          <div className="action-buttons">
            <button
              className="btn-action btn-pdf"
              onClick={handleDownloadPDF}
              disabled={actionLoading === 'pdf'}
            >
              {actionLoading === 'pdf' ? 'Baixando...' : 'DAMDFE (PDF)'}
            </button>
            <button
              className="btn-action btn-xml"
              onClick={handleDownloadXML}
              disabled={actionLoading === 'xml'}
            >
              {actionLoading === 'xml' ? 'Baixando...' : 'XML'}
            </button>
            <button
              className="btn-action btn-reprocessar"
              onClick={handleReprocessar}
              disabled={actionLoading === 'reprocessar'}
            >
              {actionLoading === 'reprocessar' ? 'Processando...' : 'Reprocessar'}
            </button>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        {/* Identificação */}
        <div className="detail-card">
          <h3>Identificação</h3>
          <div className="detail-content">
            <div className="detail-row">
              <span className="label">Número:</span>
              <span className="value">{mdfe.identificacao?.n_mdf}</span>
            </div>
            <div className="detail-row">
              <span className="label">Série:</span>
              <span className="value">{mdfe.identificacao?.serie}</span>
            </div>
            <div className="detail-row">
              <span className="label">Data Emissão:</span>
              <span className="value">{formatDate(mdfe.identificacao?.dh_emi)}</span>
            </div>
            <div className="detail-row">
              <span className="label">Tipo Emitente:</span>
              <span className="value">{mdfe.identificacao?.tp_emit}</span>
            </div>
            <div className="detail-row">
              <span className="label">Modelo:</span>
              <span className="value">{mdfe.identificacao?.mod || '58'}</span>
            </div>
          </div>
        </div>

        {/* Rota */}
        <div className="detail-card">
          <h3>Rota</h3>
          <div className="detail-content">
            <div className="detail-row">
              <span className="label">UF Início:</span>
              <span className="value">
                <span className="badge badge-info">{mdfe.identificacao?.uf_ini}</span>
              </span>
            </div>
            <div className="detail-row">
              <span className="label">UF Fim:</span>
              <span className="value">
                <span className="badge badge-success">{mdfe.identificacao?.uf_fim}</span>
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Percurso:</span>
              <span className="value">{mdfe.percurso?.join(' → ') || '-'}</span>
            </div>
          </div>
        </div>

        {/* Veículo de Tração */}
        <div className="detail-card highlight">
          <h3>Veículo de Tração</h3>
          <div className="detail-content">
            <div className="detail-row">
              <span className="label">Placa:</span>
              <span className="value valor-destaque" style={{fontSize: '20px'}}>
                {mdfe.modal_rodoviario?.veiculo_tracao?.placa || '-'}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">RENAVAM:</span>
              <span className="value">{mdfe.modal_rodoviario?.veiculo_tracao?.renavam || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Tara:</span>
              <span className="value">{mdfe.modal_rodoviario?.veiculo_tracao?.tara || 0} kg</span>
            </div>
            <div className="detail-row">
              <span className="label">Capacidade KG:</span>
              <span className="value">{mdfe.modal_rodoviario?.veiculo_tracao?.cap_kg || 0} kg</span>
            </div>
            <div className="detail-row">
              <span className="label">Tipo Rodado:</span>
              <span className="value">{mdfe.modal_rodoviario?.veiculo_tracao?.tp_rod || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Tipo Carroceria:</span>
              <span className="value">{mdfe.modal_rodoviario?.veiculo_tracao?.tp_car || '-'}</span>
            </div>
          </div>
        </div>

        {/* Condutor */}
        {mdfe.modal_rodoviario?.condutores && mdfe.modal_rodoviario.condutores.length > 0 && (
          <div className="detail-card">
            <h3>Condutor</h3>
            <div className="detail-content">
              {mdfe.modal_rodoviario.condutores.map((condutor, index) => (
                <div key={index}>
                  <div className="detail-row">
                    <span className="label">Nome:</span>
                    <span className="value">{condutor.nome}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">CPF:</span>
                    <span className="value">{condutor.cpf}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Protocolo */}
        {mdfe.protocolo && (
          <div className="detail-card">
            <h3>Protocolo de Autorização</h3>
            <div className="detail-content">
              <div className="detail-row">
                <span className="label">Número Protocolo:</span>
                <span className="value">{mdfe.protocolo.n_prot}</span>
              </div>
              <div className="detail-row">
                <span className="label">Data Autorização:</span>
                <span className="value">{formatDate(mdfe.protocolo.dh_recbto)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Código Status:</span>
                <span className="value">{mdfe.protocolo.codigo_status}</span>
              </div>
              <div className="detail-row">
                <span className="label">Descrição:</span>
                <span className="value">{mdfe.protocolo.x_motivo}</span>
              </div>
            </div>
          </div>
        )}

        {/* Documentos Vinculados */}
        <div className="detail-card" style={{gridColumn: '1 / -1'}}>
          <h3>Documentos Vinculados ({mdfe.docs_vinculados_mdfe?.length || 0})</h3>
          {mdfe.docs_vinculados_mdfe && mdfe.docs_vinculados_mdfe.length > 0 ? (
            <div className="table-container" style={{boxShadow: 'none'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Chave CT-e</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {mdfe.docs_vinculados_mdfe.map((doc, index) => (
                    <tr key={index}>
                      <td style={{fontFamily: 'monospace', fontSize: '12px'}}>
                        {doc.chave_cte || doc.chave}
                      </td>
                      <td>
                        <span className="badge badge-info">CT-e</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{color: '#7f8c8d', textAlign: 'center', padding: '20px'}}>
              Nenhum documento vinculado
            </p>
          )}
        </div>

        {/* Modais não-rodoviários */}
        {mdfe.modal_aereo && (
          <div className="detail-card">
            <h3>Modal Aéreo</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Matrícula:</span><span className="value">{mdfe.modal_aereo.matricula || '-'}</span></div>
              <div className="detail-row"><span className="label">Voo:</span><span className="value">{mdfe.modal_aereo.numero_voo || '-'}</span></div>
              <div className="detail-row"><span className="label">Emb./Dest.:</span><span className="value">{mdfe.modal_aereo.aerodromo_embarque || '-'} → {mdfe.modal_aereo.aerodromo_destino || '-'}</span></div>
            </div>
          </div>
        )}
        {mdfe.modal_aquaviario && (
          <div className="detail-card">
            <h3>Modal Aquaviário</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Embarcação:</span><span className="value">{mdfe.modal_aquaviario.nome_embarcacao || '-'}</span></div>
              <div className="detail-row"><span className="label">Viagem:</span><span className="value">{mdfe.modal_aquaviario.numero_viagem || '-'}</span></div>
              <div className="detail-row"><span className="label">Porto Emb./Dest.:</span><span className="value">{mdfe.modal_aquaviario.porto_embarque || '-'} → {mdfe.modal_aquaviario.porto_destino || '-'}</span></div>
            </div>
          </div>
        )}
        {mdfe.modal_ferroviario && (
          <div className="detail-card">
            <h3>Modal Ferroviário</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Prefixo Trem:</span><span className="value">{mdfe.modal_ferroviario.prefixo_trem || '-'}</span></div>
              <div className="detail-row"><span className="label">Origem/Destino:</span><span className="value">{mdfe.modal_ferroviario.origem_trem || '-'} → {mdfe.modal_ferroviario.destino_trem || '-'}</span></div>
              {mdfe.modal_ferroviario.qtd_vagoes != null && <div className="detail-row"><span className="label">Vagões:</span><span className="value">{mdfe.modal_ferroviario.qtd_vagoes}</span></div>}
            </div>
          </div>
        )}

        {/* Linha do tempo de eventos */}
        {mdfe.eventos?.length > 0 && (
          <div className="detail-card" style={{gridColumn: '1 / -1'}}>
            <h3>Eventos</h3>
            <div className="detail-content">
              {mdfe.eventos.map((e, i) => (
                <div className="detail-row" key={i}>
                  <span className="label">{e.descricao_evento || e.tipo_evento} {e.sequencia_evento ? `#${e.sequencia_evento}` : ''}:</span>
                  <span className="value">
                    {formatDate(e.data_evento)} · {e.confirmado ? '✓ confirmado' : 'pendente'}
                    {e.protocolo ? ` · prot. ${e.protocolo}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documentos Anexos */}
        <div className="detail-card" style={{gridColumn: '1 / -1'}}>
          <DocumentosAnexos
            entidadeTipo="mdfe"
            entidadeId={id}
          />
        </div>
      </div>
    </div>
  );
}

export default MDFeDetail;
