import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { cteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import './CTe.css';

function CTeDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [cte, setCte] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadCTe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await cteAPI.get(id);
      setCte(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCTe();
  }, [loadCTe]);

  const handleDownloadPDF = async () => {
    try {
      setActionLoading('pdf');
      const blob = await cteAPI.downloadPDF(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DACTE_${cte.chave}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Erro ao baixar DACTE: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadXML = async () => {
    try {
      setActionLoading('xml');
      const blob = await cteAPI.downloadXML(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CTe_${cte.chave}.xml`;
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
    if (!confirm('Deseja reprocessar este CT-e?')) return;
    try {
      setActionLoading('reprocessar');
      await cteAPI.reprocessar(id);
      toast.success('CT-e reprocessado com sucesso!');
      loadCTe();
    } catch (err) {
      toast.error('Erro ao reprocessar: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatCNPJ = (cnpj) => {
    if (!cnpj) return '-';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  if (loading) return <Loading message="Carregando CT-e..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadCTe} />;
  if (!cte) return <ErrorMessage message="CT-e não encontrado" />;

  const getStatusInfo = () => {
    if (cte.cancelamento) {
      return { class: 'danger', text: 'Cancelado', icon: '✕' };
    }
    if (cte.processado && cte.protocolo?.codigo_status === 100) {
      return { class: 'success', text: 'Autorizado', icon: '✓' };
    }
    if (cte.protocolo && cte.protocolo.codigo_status !== 100) {
      return { class: 'warning', text: 'Rejeitado', icon: '!' };
    }
    return { class: 'secondary', text: 'Pendente', icon: '?' };
  };

  const status = getStatusInfo();

  return (
    <div className="cte-detail">
      <div className="page-header">
        <div>
          <Link to="/ctes" className="back-link">← Voltar para lista</Link>
          <h1>CT-e #{cte.identificacao?.numero}</h1>
          <p className="chave-cte">{cte.chave}</p>
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
              {actionLoading === 'pdf' ? 'Baixando...' : 'DACTE (PDF)'}
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
              <span className="value">{cte.identificacao?.numero}</span>
            </div>
            <div className="detail-row">
              <span className="label">Série:</span>
              <span className="value">{cte.identificacao?.serie}</span>
            </div>
            <div className="detail-row">
              <span className="label">Data Emissão:</span>
              <span className="value">{formatDate(cte.identificacao?.data_emissao)}</span>
            </div>
            <div className="detail-row">
              <span className="label">CFOP:</span>
              <span className="value">{cte.identificacao?.cfop}</span>
            </div>
            <div className="detail-row">
              <span className="label">Natureza Operação:</span>
              <span className="value">{cte.identificacao?.natureza_operacao}</span>
            </div>
            <div className="detail-row">
              <span className="label">Modalidade:</span>
              <span className={`badge badge-${cte.modalidade === 'CIF' ? 'info' : 'warning'}`}>
                {cte.modalidade}
              </span>
            </div>
          </div>
        </div>

        {/* Remetente */}
        <div className="detail-card">
          <h3>Remetente</h3>
          <div className="detail-content">
            <div className="detail-row">
              <span className="label">Razão Social:</span>
              <span className="value">{cte.remetente?.razao_social || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">CNPJ:</span>
              <span className="value">{formatCNPJ(cte.remetente?.cnpj)}</span>
            </div>
            <div className="detail-row">
              <span className="label">Endereço:</span>
              <span className="value">
                {cte.remetente?.logradouro}, {cte.remetente?.numero}
                <br />
                {cte.remetente?.municipio} - {cte.remetente?.uf}
              </span>
            </div>
          </div>
        </div>

        {/* Destinatário */}
        <div className="detail-card">
          <h3>Destinatário</h3>
          <div className="detail-content">
            <div className="detail-row">
              <span className="label">Razão Social:</span>
              <span className="value">{cte.destinatario?.razao_social || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="label">CNPJ:</span>
              <span className="value">{formatCNPJ(cte.destinatario?.cnpj)}</span>
            </div>
            <div className="detail-row">
              <span className="label">Endereço:</span>
              <span className="value">
                {cte.destinatario?.logradouro}, {cte.destinatario?.numero}
                <br />
                {cte.destinatario?.municipio} - {cte.destinatario?.uf}
              </span>
            </div>
          </div>
        </div>

        {/* Valores */}
        <div className="detail-card highlight">
          <h3>Valores da Prestação</h3>
          <div className="detail-content">
            <div className="detail-row">
              <span className="label">Valor Total:</span>
              <span className="value valor-destaque">
                {formatCurrency(cte.prestacao?.valor_total_prestado)}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Valor Receber:</span>
              <span className="value">{formatCurrency(cte.prestacao?.valor_receber)}</span>
            </div>
            <div className="detail-row">
              <span className="label">Base Cálculo ICMS:</span>
              <span className="value">{formatCurrency(cte.imposto?.icms_base_calculo)}</span>
            </div>
            <div className="detail-row">
              <span className="label">Valor ICMS:</span>
              <span className="value">{formatCurrency(cte.imposto?.icms_valor)}</span>
            </div>
          </div>
        </div>

        {/* Protocolo */}
        {cte.protocolo && (
          <div className="detail-card">
            <h3>Protocolo de Autorização</h3>
            <div className="detail-content">
              <div className="detail-row">
                <span className="label">Número Protocolo:</span>
                <span className="value">{cte.protocolo.numero_protocolo}</span>
              </div>
              <div className="detail-row">
                <span className="label">Data Autorização:</span>
                <span className="value">{formatDate(cte.protocolo.data_recebimento)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Código Status:</span>
                <span className="value">{cte.protocolo.codigo_status}</span>
              </div>
              <div className="detail-row">
                <span className="label">Descrição:</span>
                <span className="value">{cte.protocolo.motivo}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cancelamento */}
        {cte.cancelamento && (
          <div className="detail-card cancelamento-card">
            <h3>Cancelamento</h3>
            <div className="detail-content">
              <div className="detail-row">
                <span className="label">Justificativa:</span>
                <span className="value">{cte.cancelamento.x_just || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Data do Evento:</span>
                <span className="value">{cte.cancelamento.dh_evento_formatada || formatDate(cte.cancelamento.dh_evento)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Data do Registro:</span>
                <span className="value">{cte.cancelamento.dh_reg_evento_formatada || formatDate(cte.cancelamento.dh_reg_evento)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Código Status:</span>
                <span className="value">{cte.cancelamento.c_stat}</span>
              </div>
              <div className="detail-row">
                <span className="label">Motivo:</span>
                <span className="value">{cte.cancelamento.x_motivo || '-'}</span>
              </div>
              {cte.cancelamento.n_prot_retorno && (
                <div className="detail-row">
                  <span className="label">Protocolo Cancelamento:</span>
                  <span className="value">{cte.cancelamento.n_prot_retorno}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rota */}
        <div className="detail-card">
          <h3>Rota</h3>
          <div className="detail-content">
            <div className="detail-row">
              <span className="label">Origem:</span>
              <span className="value">
                {cte.identificacao?.nome_mun_ini} - {cte.identificacao?.uf_ini}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Destino:</span>
              <span className="value">
                {cte.identificacao?.nome_mun_fim} - {cte.identificacao?.uf_fim}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Distância:</span>
              <span className="value">{cte.identificacao?.dist_km || 0} km</span>
            </div>
          </div>
        </div>

        {/* Documentos Anexos */}
        <div className="detail-card" style={{gridColumn: '1 / -1'}}>
          <DocumentosAnexos
            entidadeTipo="cte"
            entidadeId={id}
          />
        </div>
      </div>
    </div>
  );
}

export default CTeDetail;
