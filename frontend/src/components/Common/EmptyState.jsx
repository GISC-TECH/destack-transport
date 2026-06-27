import styles from './EmptyState.module.css';

export default function EmptyState({
  icon,
  title = 'Nenhum dado encontrado',
  description = 'Nao ha itens para exibir no momento.',
  action = null,
}) {
  return (
    <div className={styles.container} role="status">
      <div className={styles.icon} aria-hidden="true">
        {icon || (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
