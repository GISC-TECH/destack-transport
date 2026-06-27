import { useRef } from 'react';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import styles from './ComprovantePagamento.module.css';

function ComprovantePagamento({ pagamento, tipo, onClose }) {
  const comprovanteRef = useRef(null);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handlePrint = () => {
    const printContent = comprovanteRef.current;
    const windowPrint = window.open('', '', 'width=400,height=600');

    windowPrint.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprovante de Pagamento</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 10px;
            width: 80mm;
            background: white;
          }
          .comprovante-cupom {
            width: 100%;
          }
          .cupom-header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .cupom-logo {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .cupom-subtitulo {
            font-size: 10px;
            color: #666;
          }
          .cupom-tipo {
            margin-top: 8px;
            padding: 4px 8px;
            background: #333;
            color: white;
            display: inline-block;
            font-size: 10px;
            border-radius: 3px;
          }
          .cupom-divider {
            border: none;
            border-top: 1px dashed #000;
            margin: 10px 0;
          }
          .cupom-linha {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
          }
          .cupom-label {
            color: #666;
          }
          .cupom-valor {
            font-weight: bold;
            text-align: right;
          }
          .cupom-section-title {
            font-weight: bold;
            text-align: center;
            margin: 10px 0 5px 0;
            font-size: 11px;
            text-transform: uppercase;
          }
          .cupom-total {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            padding: 10px 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            margin: 10px 0;
          }
          .cupom-total-label {
            font-size: 10px;
            color: #666;
          }
          .cupom-status {
            text-align: center;
            padding: 8px;
            margin: 10px 0;
            border-radius: 4px;
          }
          .cupom-status.pago {
            background: #d4edda;
            color: #155724;
          }
          .cupom-status.pendente {
            background: #fff3cd;
            color: #856404;
          }
          .cupom-footer {
            text-align: center;
            font-size: 10px;
            color: #666;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px dashed #000;
          }
          .cupom-corte {
            text-align: center;
            font-size: 8px;
            color: #999;
            margin-top: 15px;
            border-top: 1px dashed #ccc;
            padding-top: 5px;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    windowPrint.document.close();
    windowPrint.focus();

    setTimeout(() => {
      windowPrint.print();
      windowPrint.close();
    }, 250);
  };

  // Determinar valores baseado no tipo
  const isAgregado = tipo === 'agregados';
  const condutor = pagamento.condutor_nome || pagamento.motorista_nome || '-';
  const placa = pagamento.placa || pagamento.veiculo_placa || '-';
  const valorFrete = isAgregado ? pagamento.valor_frete_total : null;
  const percentual = isAgregado ? pagamento.percentual_repasse : null;
  const desconto = isAgregado ? pagamento.desconto : pagamento.ajustes;
  const valorFinal = isAgregado ? pagamento.valor_repassado : (pagamento.valor_total_pagar || pagamento.valor_base_faixa);
  const kmTotal = !isAgregado ? pagamento.km_total_periodo : null;

  return (
    <Modal isOpen={true} onClose={onClose} title="Comprovante de Pagamento" size="sm">
      <div className={styles.comprovanteModalBody}>
        <div className={styles.comprovanteActions}>
          <Button className={styles.btnPrint} onClick={handlePrint}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Imprimir
          </Button>
          <button className={styles.btnCloseComprovante} onClick={onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.comprovanteCupom} ref={comprovanteRef}>
          {/* Cabecalho */}
          <div className={styles.cupomHeader}>
            <div className={styles.cupomLogo}>DESTACK TRANSPORT</div>
            <div className={styles.cupomSubtitulo}>Sistema de Gestao de Transporte</div>
            <div className={`${styles.cupomTipo} ${isAgregado ? styles.agregado : styles.proprio}`}>
              {isAgregado ? 'AGREGADO' : 'PROPRIO'}
            </div>
          </div>

          <hr className={styles.cupomDivider} />

          {/* Informações do Documento */}
          <div className={styles.cupomSectionTitle}>Dados do Pagamento</div>

          <div className={styles.cupomLinha}>
            <span className={styles.cupomLabel}>CT-e:</span>
            <span className={styles.cupomValor}>#{pagamento.cte_numero || '-'}</span>
          </div>

          <div className={styles.cupomLinha}>
            <span className={styles.cupomLabel}>Condutor:</span>
            <span className={styles.cupomValor}>{condutor}</span>
          </div>

          <div className={styles.cupomLinha}>
            <span className={styles.cupomLabel}>Placa:</span>
            <span className={styles.cupomValor}>{placa}</span>
          </div>

          {!isAgregado && kmTotal && (
            <div className={styles.cupomLinha}>
              <span className={styles.cupomLabel}>KM Total:</span>
              <span className={styles.cupomValor}>{kmTotal} km</span>
            </div>
          )}

          <hr className={styles.cupomDivider} />

          {/* Datas */}
          <div className={styles.cupomSectionTitle}>Datas</div>

          <div className={styles.cupomLinha}>
            <span className={styles.cupomLabel}>Data Prevista:</span>
            <span className={styles.cupomValor}>{formatDate(pagamento.data_prevista)}</span>
          </div>

          {pagamento.data_pagamento && (
            <div className={styles.cupomLinha}>
              <span className={styles.cupomLabel}>Data Pagamento:</span>
              <span className={styles.cupomValor}>{formatDate(pagamento.data_pagamento)}</span>
            </div>
          )}

          <hr className={styles.cupomDivider} />

          {/* Valores */}
          <div className={styles.cupomSectionTitle}>Valores</div>

          {isAgregado && valorFrete && (
            <div className={styles.cupomLinha}>
              <span className={styles.cupomLabel}>Valor Frete:</span>
              <span className={styles.cupomValor}>{formatCurrency(valorFrete)}</span>
            </div>
          )}

          {isAgregado && percentual && (
            <div className={styles.cupomLinha}>
              <span className={styles.cupomLabel}>Percentual:</span>
              <span className={styles.cupomValor}>{percentual}%</span>
            </div>
          )}

          {!isAgregado && pagamento.valor_base_faixa && (
            <div className={styles.cupomLinha}>
              <span className={styles.cupomLabel}>Valor Base:</span>
              <span className={styles.cupomValor}>{formatCurrency(pagamento.valor_base_faixa)}</span>
            </div>
          )}

          {desconto > 0 && (
            <div className={styles.cupomLinha} style={{ color: '#dc3545' }}>
              <span className={styles.cupomLabel}>{isAgregado ? 'Desconto:' : 'Ajustes:'}</span>
              <span className={styles.cupomValor}>-{formatCurrency(Math.abs(desconto))}</span>
            </div>
          )}

          {desconto < 0 && (
            <div className={styles.cupomLinha} style={{ color: '#28a745' }}>
              <span className={styles.cupomLabel}>Ajustes:</span>
              <span className={styles.cupomValor}>+{formatCurrency(Math.abs(desconto))}</span>
            </div>
          )}

          {/* Total */}
          <div className={styles.cupomTotal}>
            <div className={styles.cupomTotalLabel}>VALOR A RECEBER</div>
            <div>{formatCurrency(valorFinal)}</div>
          </div>

          {/* Status */}
          <div className={`${styles.cupomStatus} ${styles[pagamento.status] || ''}`}>
            {pagamento.status === 'pago' ? 'PAGO' :
             pagamento.status === 'pendente' ? 'PENDENTE' :
             pagamento.status === 'atrasado' ? 'ATRASADO' : pagamento.status?.toUpperCase()}
          </div>

          {/* Observações */}
          {pagamento.obs && (
            <>
              <hr className={styles.cupomDivider} />
              <div className={styles.cupomSectionTitle}>Observações</div>
              <div className={styles.cupomObs}>{pagamento.obs}</div>
            </>
          )}

          {/* Rodape */}
          <div className={styles.cupomFooter}>
            <div>Emitido em: {new Date().toLocaleString('pt-BR')}</div>
            <div style={{ marginTop: '5px' }}>ID: {pagamento.id}</div>
          </div>

          <div className={styles.cupomCorte}>
            ✂ - - - - - - - - - - - - - - - - - - - - - - - - ✂
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ComprovantePagamento;
