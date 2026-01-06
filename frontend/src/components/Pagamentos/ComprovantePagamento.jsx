import { useRef } from 'react';
import './ComprovantePagamento.css';

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

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="comprovante-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comprovante-actions">
          <button className="btn-print" onClick={handlePrint}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Imprimir
          </button>
          <button className="btn-close-comprovante" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="comprovante-cupom" ref={comprovanteRef}>
          {/* Cabecalho */}
          <div className="cupom-header">
            <div className="cupom-logo">DESTACK TRANSPORT</div>
            <div className="cupom-subtitulo">Sistema de Gestao de Transporte</div>
            <div className={`cupom-tipo ${isAgregado ? 'agregado' : 'proprio'}`}>
              {isAgregado ? 'AGREGADO' : 'PROPRIO'}
            </div>
          </div>

          <hr className="cupom-divider" />

          {/* Informacoes do Documento */}
          <div className="cupom-section-title">Dados do Pagamento</div>

          <div className="cupom-linha">
            <span className="cupom-label">CT-e:</span>
            <span className="cupom-valor">#{pagamento.cte_numero || '-'}</span>
          </div>

          <div className="cupom-linha">
            <span className="cupom-label">Condutor:</span>
            <span className="cupom-valor">{condutor}</span>
          </div>

          <div className="cupom-linha">
            <span className="cupom-label">Placa:</span>
            <span className="cupom-valor">{placa}</span>
          </div>

          {!isAgregado && kmTotal && (
            <div className="cupom-linha">
              <span className="cupom-label">KM Total:</span>
              <span className="cupom-valor">{kmTotal} km</span>
            </div>
          )}

          <hr className="cupom-divider" />

          {/* Datas */}
          <div className="cupom-section-title">Datas</div>

          <div className="cupom-linha">
            <span className="cupom-label">Data Prevista:</span>
            <span className="cupom-valor">{formatDate(pagamento.data_prevista)}</span>
          </div>

          {pagamento.data_pagamento && (
            <div className="cupom-linha">
              <span className="cupom-label">Data Pagamento:</span>
              <span className="cupom-valor">{formatDate(pagamento.data_pagamento)}</span>
            </div>
          )}

          <hr className="cupom-divider" />

          {/* Valores */}
          <div className="cupom-section-title">Valores</div>

          {isAgregado && valorFrete && (
            <div className="cupom-linha">
              <span className="cupom-label">Valor Frete:</span>
              <span className="cupom-valor">{formatCurrency(valorFrete)}</span>
            </div>
          )}

          {isAgregado && percentual && (
            <div className="cupom-linha">
              <span className="cupom-label">Percentual:</span>
              <span className="cupom-valor">{percentual}%</span>
            </div>
          )}

          {!isAgregado && pagamento.valor_base_faixa && (
            <div className="cupom-linha">
              <span className="cupom-label">Valor Base:</span>
              <span className="cupom-valor">{formatCurrency(pagamento.valor_base_faixa)}</span>
            </div>
          )}

          {desconto > 0 && (
            <div className="cupom-linha" style={{ color: '#dc3545' }}>
              <span className="cupom-label">{isAgregado ? 'Desconto:' : 'Ajustes:'}</span>
              <span className="cupom-valor">-{formatCurrency(Math.abs(desconto))}</span>
            </div>
          )}

          {desconto < 0 && (
            <div className="cupom-linha" style={{ color: '#28a745' }}>
              <span className="cupom-label">Ajustes:</span>
              <span className="cupom-valor">+{formatCurrency(Math.abs(desconto))}</span>
            </div>
          )}

          {/* Total */}
          <div className="cupom-total">
            <div className="cupom-total-label">VALOR A RECEBER</div>
            <div>{formatCurrency(valorFinal)}</div>
          </div>

          {/* Status */}
          <div className={`cupom-status ${pagamento.status}`}>
            {pagamento.status === 'pago' ? 'PAGO' :
             pagamento.status === 'pendente' ? 'PENDENTE' :
             pagamento.status === 'atrasado' ? 'ATRASADO' : pagamento.status?.toUpperCase()}
          </div>

          {/* Observacoes */}
          {pagamento.obs && (
            <>
              <hr className="cupom-divider" />
              <div className="cupom-section-title">Observacoes</div>
              <div className="cupom-obs">{pagamento.obs}</div>
            </>
          )}

          {/* Rodape */}
          <div className="cupom-footer">
            <div>Emitido em: {new Date().toLocaleString('pt-BR')}</div>
            <div style={{ marginTop: '5px' }}>ID: {pagamento.id}</div>
          </div>

          <div className="cupom-corte">
            ✂ - - - - - - - - - - - - - - - - - - - - - - - - ✂
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComprovantePagamento;
