import styles from './TableContainer.module.css';

/**
 * TableContainer — wrapper para tabelas com scroll horizontal e card-view mobile.
 *
 * Props:
 * - children: elemento <table>
 * - mobileCards: boolean — ativa transformação em cards em telas <=640px (default true)
 * - className: classe extra
 */
function TableContainer({ children, mobileCards = true, className = '' }) {
  const classes = [
    styles.container,
    mobileCards && styles.mobileCards,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}

export default TableContainer;
