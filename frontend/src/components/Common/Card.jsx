import styles from './Card.module.css';

/**
 * Card — container visual padronizado.
 *
 * Props:
 * - children: conteúdo
 * - title: título opcional
 * - headerActions: ações no header (opcional)
 * - className: classe extra
 * - noPadding: boolean — remove padding interno
 */
function Card({ children, title, headerActions, className = '', noPadding = false }) {
  const classes = [styles.card, noPadding && styles.noPadding, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {(title || headerActions) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {headerActions && <div className={styles.actions}>{headerActions}</div>}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
}

export default Card;
