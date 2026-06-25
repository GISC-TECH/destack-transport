import './Skeleton.css';

export function SkeletonText({ lines = 1, width, className = '' }) {
  return (
    <div className={`skeleton-text-group ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{ width: Array.isArray(width) ? width[i] : width }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ count = 1, className = '' }) {
  return (
    <div className={`skeleton-card-list ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPI({ count = 4, className = '' }) {
  return (
    <div className={`skeleton-kpi-grid ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-kpi">
          <div className="skeleton skeleton-icon" />
          <div>
            <div className="skeleton skeleton-value" />
            <div className="skeleton skeleton-label" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }) {
  return (
    <div className={`skeleton-table ${className}`}>
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton skeleton-th" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, c) => (
            <div key={c} className="skeleton skeleton-td" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMobileCards({ count = 4, className = '' }) {
  return (
    <div className={`skeleton-mobile-cards ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-mobile-card">
          <div className="skeleton-mobile-card-header">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-badge" />
          </div>
          <div className="skeleton-mobile-card-body">
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
          <div className="skeleton-mobile-card-footer">
            <div className="skeleton skeleton-button" />
            <div className="skeleton skeleton-button" />
          </div>
        </div>
      ))}
    </div>
  );
}
