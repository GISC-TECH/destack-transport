import styles from './StatusPill.module.css';

/**
 * StatusPill — badge de status padronizado.
 *
 * Props:
 * - status: string — chave do status (success, pendente, danger, warning, info, etc.)
 * - children: texto do badge
 * - className: classe extra
 */
const STATUS_MAP = {
  success: 'success',
  ok: 'success',
  autorizado: 'success',
  pago: 'success',
  ativo: 'success',
  pendente: 'warning',
  pend: 'warning',
  warning: 'warning',
  cancelado: 'danger',
  canc: 'danger',
  danger: 'danger',
  erro: 'danger',
  error: 'danger',
  info: 'info',
  rota: 'info',
  transito: 'info',
  encerrado: 'info',
  inativo: 'muted',
  atrasado: 'danger',
};

function StatusPill({ status, children, className = '' }) {
  const variant = STATUS_MAP[status?.toLowerCase()] || 'default';
  const classes = [styles.pill, styles[variant], className]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
}

export default StatusPill;
