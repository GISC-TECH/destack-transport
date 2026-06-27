import styles from './Skeleton.module.css';

export function SkeletonText({ lines = 1, width, className = '' }) {
  return (
    <div className={`${styles.textGroup} ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`${styles.skeleton} ${styles.text}`}
          style={{ width: Array.isArray(width) ? width[i] : width }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ count = 1, className = '' }) {
  return (
    <div className={`${styles.cardList} ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.card}>
          <div className={`${styles.skeleton} ${styles.title}`} />
          <div className={`${styles.skeleton} ${styles.text}`} />
          <div className={`${styles.skeleton} ${styles.text}`} style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPI({ count = 4, className = '' }) {
  return (
    <div className={`${styles.kpiGrid} ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.kpi}>
          <div className={`${styles.skeleton} ${styles.icon}`} />
          <div>
            <div className={`${styles.skeleton} ${styles.value}`} />
            <div className={`${styles.skeleton} ${styles.label}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }) {
  return (
    <div className={`${styles.table} ${className}`}>
      <div className={styles.tableHeader}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.th}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={styles.tableRow}>
          {Array.from({ length: columns }).map((_, c) => (
            <div key={c} className={`${styles.skeleton} ${styles.td}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMobileCards({ count = 4, className = '' }) {
  return (
    <div className={`${styles.mobileCards} ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.mobileCard}>
          <div className={styles.mobileCardHeader}>
            <div className={`${styles.skeleton} ${styles.title}`} />
            <div className={`${styles.skeleton} ${styles.badge}`} />
          </div>
          <div className={styles.mobileCardBody}>
            <div className={`${styles.skeleton} ${styles.text}`} />
            <div className={`${styles.skeleton} ${styles.text}`} style={{ width: '60%' }} />
          </div>
          <div className={styles.mobileCardFooter}>
            <div className={`${styles.skeleton} ${styles.button}`} />
            <div className={`${styles.skeleton} ${styles.button}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
