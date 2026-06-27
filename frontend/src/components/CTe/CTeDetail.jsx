import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { cteAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import DocumentosAnexos from '../Common/DocumentosAnexos';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import PageHeader from '../Common/PageHeader';
import styles from './CTeDetail.module.css';

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
      return { status: 'danger', class: styles.statusDanger, text: 'Cancelado', icon: '✕' };
    }
    if (cte.processado && cte.protocolo?.codigo_status === 100) {
      return { status: 'success', class: styles.statusSuccess, text: 'Autorizado', icon: '✓' };
    }
    if (cte.protocolo && cte.protocolo.codigo_status !== 100) {
      return { status: 'warning', class: styles.statusWarning, text: 'Rejeitado', icon: '!' };
    }
    return { status: 'muted', class: styles.statusSecondary, text: 'Pendente', icon: '?' };
  };

  const status = getStatusInfo();

  const getModalidadePill = (modalidade) => ({
    status: modalidade === 'CIF' ? 'info' : 'warning',
    text: modalidade || '-'
  });

  const cteIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>
  );

  const headerActions = (
    <>
      <StatusPill status={status.status}>{status.icon} {status.text}</StatusPill>
      <Button
        variant="danger"
        onClick={handleDownloadPDF}
        disabled={actionLoading === 'pdf'}
      >
        {actionLoading === 'pdf' ? 'Baixando...' : 'DACTE (PDF)'}
      </Button>
      <Button
        variant="primary"
        onClick={handleDownloadXML}
        disabled={actionLoading === 'xml'}
      >
        {actionLoading === 'xml' ? 'Baixando...' : 'XML'}
      </Button>
      <Button
        variant="warning"
        onClick={handleReprocessar}
        disabled={actionLoading === 'reprocessar'}
      >
        {actionLoading === 'reprocessar' ? 'Processando...' : 'Reprocessar'}
      </Button>
    </>
  );

  return (
    <div className={styles.cteDetail}>
      <PageHeader
        title={`CT-e #${cte.identificacao?.numero}`}
        subtitle={cte.chave}
        icon={cteIcon}
        breadcrumbs={[{ label: 'CT-e', path: '/ctes' }, { label: `CT-e #${cte.identificacao?.numero}` }]}
        actions={headerActions}
      />

      <div className={styles.detailGrid}>
        {/* Identificação */}
        <div className={styles.detailCard}>
          <h3>Identificação</h3>
          <div className={styles.detailContent}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Número:</span>
              <span className={styles.value}>{cte.identificacao?.numero}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Série:</span>
              <span className={styles.value}>{cte.identificacao?.serie}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Data Emissão:</span>
              <span className={styles.value}>{formatDate(cte.identificacao?.data_emissao)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>CFOP:</span>
              <span className={styles.value}>{cte.identificacao?.cfop}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Natureza Operação:</span>
              <span className={styles.value}>{cte.identificacao?.natureza_operacao}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Modalidade:</span>
              <StatusPill status={getModalidadePill(cte.modalidade).status}>
                {getModalidadePill(cte.modalidade).text}
              </StatusPill>
            </div>
          </div>
        </div>

        {/* Remetente */}
        <div className={styles.detailCard}>
          <h3>Remetente</h3>
          <div className={styles.detailContent}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Razão Social:</span>
              <span className={styles.value}>{cte.remetente?.razao_social || '-'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>CNPJ:</span>
              <span className={styles.value}>{formatCNPJ(cte.remetente?.cnpj)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Endereço:</span>
              <span className={styles.value}>
                {cte.remetente?.logradouro}, {cte.remetente?.numero}
                <br />
                {cte.remetente?.municipio} - {cte.remetente?.uf}
              </span>
            </div>
          </div>
        </div>

        {/* Destinatário */}
        <div className={styles.detailCard}>
          <h3>Destinatário</h3>
          <div className={styles.detailContent}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Razão Social:</span>
              <span className={styles.value}>{cte.destinatario?.razao_social || '-'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>CNPJ:</span>
              <span className={styles.value}>{formatCNPJ(cte.destinatario?.cnpj)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Endereço:</span>
              <span className={styles.value}>
                {cte.destinatario?.logradouro}, {cte.destinatario?.numero}
                <br />
                {cte.destinatario?.municipio} - {cte.destinatario?.uf}
              </span>
            </div>
          </div>
        </div>

        {/* Valores */}
        <div className={`${styles.detailCard} ${styles.highlight}`}>
          <h3>Valores da Prestação</h3>
          <div className={styles.detailContent}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Valor Total:</span>
              <span className={`${styles.value} ${styles.valorDestaque}`}>
                {formatCurrency(cte.prestacao?.valor_total_prestado)}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Valor Receber:</span>
              <span className={styles.value}>{formatCurrency(cte.prestacao?.valor_receber)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Base Cálculo ICMS:</span>
              <span className={styles.value}>{formatCurrency(cte.tributos?.icms_vbc)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Valor ICMS:</span>
              <span className={styles.value}>{formatCurrency(cte.tributos?.icms_vicms)}</span>
            </div>
          </div>
        </div>

        {/* Protocolo */}
        {cte.protocolo && (
          <div className={styles.detailCard}>
            <h3>Protocolo de Autorização</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}>
                <span className={styles.label}>Número Protocolo:</span>
                <span className={styles.value}>{cte.protocolo.numero_protocolo}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Data Autorização:</span>
                <span className={styles.value}>{formatDate(cte.protocolo.data_recebimento)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Código Status:</span>
                <span className={styles.value}>{cte.protocolo.codigo_status}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Descrição:</span>
                <span className={styles.value}>{cte.protocolo.motivo_status}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cancelamento */}
        {cte.cancelamento && (
          <div className={`${styles.detailCard} ${styles.cancelamentoCard}`}>
            <h3>Cancelamento</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}>
                <span className={styles.label}>Justificativa:</span>
                <span className={styles.value}>{cte.cancelamento.x_just || '-'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Data do Evento:</span>
                <span className={styles.value}>{cte.cancelamento.dh_evento_formatada || formatDate(cte.cancelamento.dh_evento)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Data do Registro:</span>
                <span className={styles.value}>{cte.cancelamento.dh_reg_evento_formatada || formatDate(cte.cancelamento.dh_reg_evento)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Código Status:</span>
                <span className={styles.value}>{cte.cancelamento.c_stat}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Motivo:</span>
                <span className={styles.value}>{cte.cancelamento.x_motivo || '-'}</span>
              </div>
              {cte.cancelamento.n_prot_retorno && (
                <div className={styles.detailRow}>
                  <span className={styles.label}>Protocolo Cancelamento:</span>
                  <span className={styles.value}>{cte.cancelamento.n_prot_retorno}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rota */}
        <div className={styles.detailCard}>
          <h3>Rota</h3>
          <div className={styles.detailContent}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Origem:</span>
              <span className={styles.value}>
                {cte.identificacao?.nome_mun_ini} - {cte.identificacao?.uf_ini}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Destino:</span>
              <span className={styles.value}>
                {cte.identificacao?.nome_mun_fim} - {cte.identificacao?.uf_fim}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Distância:</span>
              <span className={styles.value}>{cte.identificacao?.dist_km || 0} km</span>
            </div>
          </div>
        </div>

        {/* ICMS detalhado */}
        {cte.tributos?.icms_cst && (
          <div className={styles.detailCard}>
            <h3>ICMS</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>CST:</span><span className={styles.value}>{cte.tributos.icms_cst}</span></div>
              {cte.tributos.icms_vbc != null && <div className={styles.detailRow}><span className={styles.label}>Base de Cálculo:</span><span className={styles.value}>{formatCurrency(cte.tributos.icms_vbc)}</span></div>}
              {cte.tributos.icms_picms != null && <div className={styles.detailRow}><span className={styles.label}>Alíquota:</span><span className={styles.value}>{cte.tributos.icms_picms}%</span></div>}
              {cte.tributos.icms_vicms != null && <div className={styles.detailRow}><span className={styles.label}>Valor ICMS:</span><span className={styles.value}>{formatCurrency(cte.tributos.icms_vicms)}</span></div>}
              {cte.tributos.valor_total_tributos != null && <div className={styles.detailRow}><span className={styles.label}>Total Tributos:</span><span className={styles.value}>{formatCurrency(cte.tributos.valor_total_tributos)}</span></div>}
            </div>
          </div>
        )}

        {/* CT-e OS (mod 67) */}
        {cte.os_info && (
          <div className={styles.detailCard}>
            <h3>CT-e OS (Outros Serviços)</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>Serviço:</span><span className={styles.value}>{cte.os_info.descricao_servico || '-'}</span></div>
              {cte.os_info.quantidade_carga != null && <div className={styles.detailRow}><span className={styles.label}>Qtd. Carga:</span><span className={styles.value}>{cte.os_info.quantidade_carga}</span></div>}
              {cte.os_info.seguradora && <div className={styles.detailRow}><span className={styles.label}>Seguradora:</span><span className={styles.value}>{cte.os_info.seguradora}</span></div>}
            </div>
          </div>
        )}

        {/* Modais não-rodoviários */}
        {cte.modal_aereo && (
          <div className={styles.detailCard}>
            <h3>Modal Aéreo</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>Minuta:</span><span className={styles.value}>{cte.modal_aereo.numero_minuta || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Nº OCA:</span><span className={styles.value}>{cte.modal_aereo.numero_oca || '-'}</span></div>
              {cte.modal_aereo.valor_tarifa != null && <div className={styles.detailRow}><span className={styles.label}>Tarifa:</span><span className={styles.value}>{formatCurrency(cte.modal_aereo.valor_tarifa)}</span></div>}
            </div>
          </div>
        )}
        {cte.modal_aquaviario && (
          <div className={styles.detailCard}>
            <h3>Modal Aquaviário</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>Navio:</span><span className={styles.value}>{cte.modal_aquaviario.nome_navio || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Viagem:</span><span className={styles.value}>{cte.modal_aquaviario.numero_viagem || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Porto Emb./Dest.:</span><span className={styles.value}>{cte.modal_aquaviario.porto_embarque || '-'} → {cte.modal_aquaviario.porto_destino || '-'}</span></div>
            </div>
          </div>
        )}
        {cte.modal_ferroviario && (
          <div className={styles.detailCard}>
            <h3>Modal Ferroviário</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>Trem:</span><span className={styles.value}>{cte.modal_ferroviario.id_trem || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Fluxo:</span><span className={styles.value}>{cte.modal_ferroviario.fluxo || '-'}</span></div>
              {cte.modal_ferroviario.valor_frete != null && <div className={styles.detailRow}><span className={styles.label}>Frete:</span><span className={styles.value}>{formatCurrency(cte.modal_ferroviario.valor_frete)}</span></div>}
            </div>
          </div>
        )}
        {cte.modal_dutoviario && (
          <div className={styles.detailCard}>
            <h3>Modal Dutoviário</h3>
            <div className={styles.detailContent}>
              {cte.modal_dutoviario.valor_tarifa != null && <div className={styles.detailRow}><span className={styles.label}>Tarifa:</span><span className={styles.value}>{formatCurrency(cte.modal_dutoviario.valor_tarifa)}</span></div>}
              <div className={styles.detailRow}><span className={styles.label}>Período:</span><span className={styles.value}>{formatDate(cte.modal_dutoviario.data_inicio)} → {formatDate(cte.modal_dutoviario.data_fim)}</span></div>
            </div>
          </div>
        )}
        {cte.modal_multimodal && (
          <div className={styles.detailCard}>
            <h3>Modal Multimodal</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>COTM:</span><span className={styles.value}>{cte.modal_multimodal.numero_cotm || '-'}</span></div>
              {cte.modal_multimodal.numero_apolice && <div className={styles.detailRow}><span className={styles.label}>Apólice:</span><span className={styles.value}>{cte.modal_multimodal.numero_apolice}</span></div>}
            </div>
          </div>
        )}

        {/* Cobrança / Duplicatas */}
        {cte.cobranca && (
          <div className={styles.detailCard}>
            <h3>Cobrança</h3>
            <div className={styles.detailContent}>
              {cte.cobranca.numero_fatura && <div className={styles.detailRow}><span className={styles.label}>Fatura:</span><span className={styles.value}>{cte.cobranca.numero_fatura}</span></div>}
              {cte.cobranca.valor_liquido != null && <div className={styles.detailRow}><span className={styles.label}>Valor Líquido:</span><span className={styles.value}>{formatCurrency(cte.cobranca.valor_liquido)}</span></div>}
              {(cte.cobranca.duplicatas || []).map((d, i) => (
                <div className={styles.detailRow} key={i}>
                  <span className={styles.label}>Dup. {d.numero || i + 1}:</span>
                  <span className={styles.value}>{formatCurrency(d.valor)} {d.data_vencimento ? `(venc. ${formatDate(d.data_vencimento)})` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vale-Pedágio */}
        {cte.vales_pedagio?.length > 0 && (
          <div className={styles.detailCard}>
            <h3>Vale-Pedágio</h3>
            <div className={styles.detailContent}>
              {cte.vales_pedagio.map((v, i) => (
                <div className={styles.detailRow} key={i}>
                  <span className={styles.label}>Comprovante {v.numero_comprovante || i + 1}:</span>
                  <span className={styles.value}>{formatCurrency(v.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cartas de Correção */}
        {cte.cartas_correcao?.length > 0 && (
          <div className={styles.detailCard}>
            <h3>Cartas de Correção</h3>
            <div className={styles.detailContent}>
              {cte.cartas_correcao.map((c, i) => (
                <div key={i} className={styles.cartasCorrecaoItem}>
                  <div className={styles.detailRow}><span className={styles.label}>Seq. {c.sequencia_evento}:</span><span className={styles.value}>{formatDate(c.data_evento)} · prot. {c.protocolo || '-'}</span></div>
                  {(c.correcoes || []).map((cor, j) => (
                    <div className={styles.detailRow} key={j}><span className={styles.label}>{cor.grupo}/{cor.campo}:</span><span className={styles.value}>{cor.valor}</span></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linha do tempo de eventos */}
        {cte.eventos?.length > 0 && (
          <div className={`${styles.detailCard} ${styles.detailCardFull}`}>
            <h3>Eventos</h3>
            <div className={styles.detailContent}>
              {cte.eventos.map((e, i) => (
                <div className={styles.detailRow} key={i}>
                  <span className={styles.label}>{e.descricao_evento || e.tipo_evento} {e.sequencia_evento ? `#${e.sequencia_evento}` : ''}:</span>
                  <span className={styles.value}>
                    {formatDate(e.data_evento)} · {e.confirmado ? '✓ confirmado' : 'pendente'}
                    {e.protocolo ? ` · prot. ${e.protocolo}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documentos Anexos */}
        <div className={`${styles.detailCard} ${styles.detailCardFull}`}>
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
