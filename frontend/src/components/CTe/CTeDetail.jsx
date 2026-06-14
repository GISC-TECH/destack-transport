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

        {/* ICMS detalhado */}
        {cte.tributos?.icms_cst && (
          <div className="detail-card">
            <h3>ICMS</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">CST:</span><span className="value">{cte.tributos.icms_cst}</span></div>
              {cte.tributos.icms_vbc != null && <div className="detail-row"><span className="label">Base de Cálculo:</span><span className="value">{formatCurrency(cte.tributos.icms_vbc)}</span></div>}
              {cte.tributos.icms_picms != null && <div className="detail-row"><span className="label">Alíquota:</span><span className="value">{cte.tributos.icms_picms}%</span></div>}
              {cte.tributos.icms_vicms != null && <div className="detail-row"><span className="label">Valor ICMS:</span><span className="value">{formatCurrency(cte.tributos.icms_vicms)}</span></div>}
              {cte.tributos.valor_total_tributos != null && <div className="detail-row"><span className="label">Total Tributos:</span><span className="value">{formatCurrency(cte.tributos.valor_total_tributos)}</span></div>}
            </div>
          </div>
        )}

        {/* CT-e OS (mod 67) */}
        {cte.os_info && (
          <div className="detail-card">
            <h3>CT-e OS (Outros Serviços)</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Serviço:</span><span className="value">{cte.os_info.descricao_servico || '-'}</span></div>
              {cte.os_info.quantidade_carga != null && <div className="detail-row"><span className="label">Qtd. Carga:</span><span className="value">{cte.os_info.quantidade_carga}</span></div>}
              {cte.os_info.seguradora && <div className="detail-row"><span className="label">Seguradora:</span><span className="value">{cte.os_info.seguradora}</span></div>}
            </div>
          </div>
        )}

        {/* Modais não-rodoviários */}
        {cte.modal_aereo && (
          <div className="detail-card">
            <h3>Modal Aéreo</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Minuta:</span><span className="value">{cte.modal_aereo.numero_minuta || '-'}</span></div>
              <div className="detail-row"><span className="label">Nº OCA:</span><span className="value">{cte.modal_aereo.numero_oca || '-'}</span></div>
              {cte.modal_aereo.valor_tarifa != null && <div className="detail-row"><span className="label">Tarifa:</span><span className="value">{formatCurrency(cte.modal_aereo.valor_tarifa)}</span></div>}
            </div>
          </div>
        )}
        {cte.modal_aquaviario && (
          <div className="detail-card">
            <h3>Modal Aquaviário</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Navio:</span><span className="value">{cte.modal_aquaviario.nome_navio || '-'}</span></div>
              <div className="detail-row"><span className="label">Viagem:</span><span className="value">{cte.modal_aquaviario.numero_viagem || '-'}</span></div>
              <div className="detail-row"><span className="label">Porto Emb./Dest.:</span><span className="value">{cte.modal_aquaviario.porto_embarque || '-'} → {cte.modal_aquaviario.porto_destino || '-'}</span></div>
            </div>
          </div>
        )}
        {cte.modal_ferroviario && (
          <div className="detail-card">
            <h3>Modal Ferroviário</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">Trem:</span><span className="value">{cte.modal_ferroviario.id_trem || '-'}</span></div>
              <div className="detail-row"><span className="label">Fluxo:</span><span className="value">{cte.modal_ferroviario.fluxo || '-'}</span></div>
              {cte.modal_ferroviario.valor_frete != null && <div className="detail-row"><span className="label">Frete:</span><span className="value">{formatCurrency(cte.modal_ferroviario.valor_frete)}</span></div>}
            </div>
          </div>
        )}
        {cte.modal_dutoviario && (
          <div className="detail-card">
            <h3>Modal Dutoviário</h3>
            <div className="detail-content">
              {cte.modal_dutoviario.valor_tarifa != null && <div className="detail-row"><span className="label">Tarifa:</span><span className="value">{formatCurrency(cte.modal_dutoviario.valor_tarifa)}</span></div>}
              <div className="detail-row"><span className="label">Período:</span><span className="value">{formatDate(cte.modal_dutoviario.data_inicio)} → {formatDate(cte.modal_dutoviario.data_fim)}</span></div>
            </div>
          </div>
        )}
        {cte.modal_multimodal && (
          <div className="detail-card">
            <h3>Modal Multimodal</h3>
            <div className="detail-content">
              <div className="detail-row"><span className="label">COTM:</span><span className="value">{cte.modal_multimodal.numero_cotm || '-'}</span></div>
              {cte.modal_multimodal.numero_apolice && <div className="detail-row"><span className="label">Apólice:</span><span className="value">{cte.modal_multimodal.numero_apolice}</span></div>}
            </div>
          </div>
        )}

        {/* Cobrança / Duplicatas */}
        {cte.cobranca && (
          <div className="detail-card">
            <h3>Cobrança</h3>
            <div className="detail-content">
              {cte.cobranca.numero_fatura && <div className="detail-row"><span className="label">Fatura:</span><span className="value">{cte.cobranca.numero_fatura}</span></div>}
              {cte.cobranca.valor_liquido != null && <div className="detail-row"><span className="label">Valor Líquido:</span><span className="value">{formatCurrency(cte.cobranca.valor_liquido)}</span></div>}
              {(cte.cobranca.duplicatas || []).map((d, i) => (
                <div className="detail-row" key={i}>
                  <span className="label">Dup. {d.numero || i + 1}:</span>
                  <span className="value">{formatCurrency(d.valor)} {d.data_vencimento ? `(venc. ${formatDate(d.data_vencimento)})` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vale-Pedágio */}
        {cte.vales_pedagio?.length > 0 && (
          <div className="detail-card">
            <h3>Vale-Pedágio</h3>
            <div className="detail-content">
              {cte.vales_pedagio.map((v, i) => (
                <div className="detail-row" key={i}>
                  <span className="label">Comprovante {v.numero_comprovante || i + 1}:</span>
                  <span className="value">{formatCurrency(v.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cartas de Correção */}
        {cte.cartas_correcao?.length > 0 && (
          <div className="detail-card">
            <h3>Cartas de Correção</h3>
            <div className="detail-content">
              {cte.cartas_correcao.map((c, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div className="detail-row"><span className="label">Seq. {c.sequencia_evento}:</span><span className="value">{formatDate(c.data_evento)} · prot. {c.protocolo || '-'}</span></div>
                  {(c.correcoes || []).map((cor, j) => (
                    <div className="detail-row" key={j}><span className="label">{cor.grupo}/{cor.campo}:</span><span className="value">{cor.valor}</span></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linha do tempo de eventos */}
        {cte.eventos?.length > 0 && (
          <div className="detail-card" style={{gridColumn: '1 / -1'}}>
            <h3>Eventos</h3>
            <div className="detail-content">
              {cte.eventos.map((e, i) => (
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
            entidadeTipo="cte"
            entidadeId={id}
          />
        </div>
      </div>
    </div>
  );
}

export default CTeDetail;
