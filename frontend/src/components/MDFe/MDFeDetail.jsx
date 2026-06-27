import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { mdfeAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import styles from './MDFe.module.css';

function MDFeDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [mdfe, setMdfe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadMDFe = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    loadMDFe();
  }, [loadMDFe]);

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

  const handleEncerrar = async () => {
    if (!confirm('Deseja encerrar este MDF-e?\n\nA integração com a SEFAZ deve ser realizada externamente.')) return;
    try {
      setActionLoading('encerrar');
      await mdfeAPI.encerrar(id, {
        data_encerramento: new Date().toISOString().split('T')[0],
        municipio_encerramento_cod: mdfe.municipio_encerramento_cod || mdfe.identificacao?.municipio_fim || '',
        uf_encerramento: mdfe.uf_encerramento || mdfe.identificacao?.uf_fim || ''
      });
      toast.success('MDF-e encerrado com sucesso!');
      loadMDFe();
    } catch (err) {
      toast.error('Erro ao encerrar: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelar = async () => {
    const justificativa = prompt('Informe o motivo do cancelamento do MDF-e:');
    if (!justificativa) return;
    try {
      setActionLoading('cancelar');
      await mdfeAPI.cancelar(id, justificativa);
      toast.success('MDF-e cancelado com sucesso!');
      loadMDFe();
    } catch (err) {
      toast.error('Erro ao cancelar: ' + err.message);
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
      return { variant: 'danger', text: 'Cancelado', icon: '✕' };
    }
    if (mdfe.encerrado) {
      return { variant: 'info', text: 'Encerrado', icon: '✓' };
    }
    if (mdfe.processado && mdfe.protocolo?.codigo_status === 100) {
      return { variant: 'success', text: 'Autorizado', icon: '✓' };
    }
    if (mdfe.protocolo && mdfe.protocolo.codigo_status !== 100) {
      return { variant: 'warning', text: 'Rejeitado', icon: '!' };
    }
    return { variant: 'muted', text: 'Pendente', icon: '?' };
  };

  const status = getStatusInfo();

  const mdfeIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="9" y1="15" x2="15" y2="15"></line>
    </svg>
  );

  const headerActions = (
    <>
      <StatusPill status={status.variant}>
        {status.icon} {status.text}
      </StatusPill>
      <Button
        variant="danger"
        onClick={handleDownloadPDF}
        disabled={actionLoading === 'pdf'}
      >
        {actionLoading === 'pdf' ? 'Baixando...' : 'DAMDFE (PDF)'}
      </Button>
      <Button
        variant="primary"
        onClick={handleDownloadXML}
        disabled={actionLoading === 'xml'}
      >
        {actionLoading === 'xml' ? 'Baixando...' : 'XML'}
      </Button>
      <Button
        variant="outline"
        onClick={handleReprocessar}
        disabled={actionLoading === 'reprocessar'}
      >
        {actionLoading === 'reprocessar' ? 'Processando...' : 'Reprocessar'}
      </Button>
      {!mdfe.encerrado && !mdfe.cancelamento && (
        <Button
          variant="success"
          onClick={handleEncerrar}
          disabled={actionLoading === 'encerrar'}
        >
          {actionLoading === 'encerrar' ? 'Encerrando...' : 'Encerrar'}
        </Button>
      )}
      {!mdfe.cancelamento && (
        <Button
          variant="danger"
          onClick={handleCancelar}
          disabled={actionLoading === 'cancelar'}
        >
          {actionLoading === 'cancelar' ? 'Cancelando...' : 'Cancelar'}
        </Button>
      )}
    </>
  );

  return (
    <div className={styles.mdfeDetail}>
      <PageHeader
        title={`MDF-e #${mdfe.identificacao?.n_mdf}`}
        subtitle={mdfe.chave}
        icon={mdfeIcon}
        breadcrumbs={[{ label: 'MDF-e', path: '/mdfes' }, { label: `MDF-e #${mdfe.identificacao?.n_mdf}` }]}
        actions={headerActions}
      />

      <div className={styles.detailGrid}>
        {/* Identificação */}
        <div className={styles.detailCard}>
          <h3>Identificação</h3>
          <div className={styles.detailContent}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Número:</span>
              <span className={styles.value}>{mdfe.identificacao?.n_mdf}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Série:</span>
              <span className={styles.value}>{mdfe.identificacao?.serie}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Data Emissão:</span>
              <span className={styles.value}>{formatDate(mdfe.identificacao?.dh_emi)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Tipo Emitente:</span>
              <span className={styles.value}>{mdfe.identificacao?.tp_emit}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Modelo:</span>
              <span className={styles.value}>{mdfe.identificacao?.mod || '58'}</span>
            </div>
          </div>
        </div>

        {/* Rota */}
        <div className={styles.detailCard}>
          <h3>Rota</h3>
          <div className={styles.detailContent}>
            <div className={styles.detailRow}>
              <span className={styles.label}>UF Início:</span>
              <span className={styles.value}>
                <span className={styles.badgeInfo}>{mdfe.identificacao?.uf_ini}</span>
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>UF Fim:</span>
              <span className={styles.value}>
                <span className={styles.badgeSuccess}>{mdfe.identificacao?.uf_fim}</span>
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Percurso:</span>
              <span className={styles.value}>{mdfe.identificacao?.percurso?.map(p => p.uf_per).join(' → ') || '-'}</span>
            </div>
          </div>
        </div>

        {/* Veículo de Tração */}
        <div className={`${styles.detailCard} ${styles.detailCardHighlight}`}>
          <h3>Veículo de Tração</h3>
          <div className={styles.detailContent}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Placa:</span>
              <span className={`${styles.value} ${styles.valorDestaqueSm}`}>
                {mdfe.modal_rodoviario?.veiculo_tracao?.placa || '-'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>RENAVAM:</span>
              <span className={styles.value}>{mdfe.modal_rodoviario?.veiculo_tracao?.renavam || '-'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Tara:</span>
              <span className={styles.value}>{mdfe.modal_rodoviario?.veiculo_tracao?.tara || 0} kg</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Capacidade KG:</span>
              <span className={styles.value}>{mdfe.modal_rodoviario?.veiculo_tracao?.cap_kg || 0} kg</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Tipo Rodado:</span>
              <span className={styles.value}>{mdfe.modal_rodoviario?.veiculo_tracao?.tp_rod || '-'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Tipo Carroceria:</span>
              <span className={styles.value}>{mdfe.modal_rodoviario?.veiculo_tracao?.tp_car || '-'}</span>
            </div>
          </div>
        </div>

        {/* Condutor */}
        {mdfe.condutores && mdfe.condutores.length > 0 && (
          <div className={styles.detailCard}>
            <h3>Condutor</h3>
            <div className={styles.detailContent}>
              {mdfe.condutores.map((condutor, index) => (
                <div key={index}>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>Nome:</span>
                    <span className={styles.value}>{condutor.nome}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.label}>CPF:</span>
                    <span className={styles.value}>{condutor.cpf}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Protocolo */}
        {mdfe.protocolo && (
          <div className={styles.detailCard}>
            <h3>Protocolo de Autorização</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}>
                <span className={styles.label}>Número Protocolo:</span>
                <span className={styles.value}>{mdfe.protocolo.numero_protocolo}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Data Autorização:</span>
                <span className={styles.value}>{formatDate(mdfe.protocolo.data_recebimento)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Código Status:</span>
                <span className={styles.value}>{mdfe.protocolo.codigo_status}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Descrição:</span>
                <span className={styles.value}>{mdfe.protocolo.motivo_status}</span>
              </div>
            </div>
          </div>
        )}

        {/* Documentos Vinculados */}
        {(() => {
          const docsVinculados = mdfe.municipios_descarga?.flatMap(m => m.docs_vinculados || []) || [];
          return (
            <div className={`${styles.detailCard} ${styles.detailCardFull}`}>
              <h3>Documentos Vinculados ({docsVinculados.length})</h3>
              {docsVinculados.length > 0 ? (
                <TableContainer mobileCards={false} className={styles.tableClean}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Chave</th>
                        <th>Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docsVinculados.map((doc, index) => (
                        <tr key={index}>
                          <td className={styles.chaveDoc}>
                            {doc.chave_documento || doc.cte_info?.chave || '-'}
                          </td>
                          <td>
                            <span className={styles.badgeInfo}>{doc.tipo_doc || 'CT-e'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableContainer>
              ) : (
                <p className={styles.emptyStateMuted}>
                  Nenhum documento vinculado
                </p>
              )}
            </div>
          );
        })()}

        {/* Modais não-rodoviários */}
        {mdfe.modal_aereo && (
          <div className={styles.detailCard}>
            <h3>Modal Aéreo</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>Matrícula:</span><span className={styles.value}>{mdfe.modal_aereo.matricula || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Voo:</span><span className={styles.value}>{mdfe.modal_aereo.numero_voo || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Emb./Dest.:</span><span className={styles.value}>{mdfe.modal_aereo.aerodromo_embarque || '-'} → {mdfe.modal_aereo.aerodromo_destino || '-'}</span></div>
            </div>
          </div>
        )}
        {mdfe.modal_aquaviario && (
          <div className={styles.detailCard}>
            <h3>Modal Aquaviário</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>Embarcação:</span><span className={styles.value}>{mdfe.modal_aquaviario.nome_embarcacao || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Viagem:</span><span className={styles.value}>{mdfe.modal_aquaviario.numero_viagem || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Porto Emb./Dest.:</span><span className={styles.value}>{mdfe.modal_aquaviario.porto_embarque || '-'} → {mdfe.modal_aquaviario.porto_destino || '-'}</span></div>
            </div>
          </div>
        )}
        {mdfe.modal_ferroviario && (
          <div className={styles.detailCard}>
            <h3>Modal Ferroviário</h3>
            <div className={styles.detailContent}>
              <div className={styles.detailRow}><span className={styles.label}>Prefixo Trem:</span><span className={styles.value}>{mdfe.modal_ferroviario.prefixo_trem || '-'}</span></div>
              <div className={styles.detailRow}><span className={styles.label}>Origem/Destino:</span><span className={styles.value}>{mdfe.modal_ferroviario.origem_trem || '-'} → {mdfe.modal_ferroviario.destino_trem || '-'}</span></div>
              {mdfe.modal_ferroviario.qtd_vagoes != null && <div className={styles.detailRow}><span className={styles.label}>Vagões:</span><span className={styles.value}>{mdfe.modal_ferroviario.qtd_vagoes}</span></div>}
            </div>
          </div>
        )}

        {/* Linha do tempo de eventos */}
        {mdfe.eventos?.length > 0 && (
          <div className={`${styles.detailCard} ${styles.detailCardFull}`}>
            <h3>Eventos</h3>
            <div className={styles.detailContent}>
              {mdfe.eventos.map((e, i) => (
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

      </div>
    </div>
  );
}

export default MDFeDetail;
