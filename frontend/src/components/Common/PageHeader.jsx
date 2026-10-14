import { Link } from 'react-router-dom';
import styles from './PageHeader.module.css';

/**
 * PageHeader - Componente reutilizavel para cabecalho de paginas
 *
 * Props:
 * - title: Titulo principal da pagina
 * - subtitle: Subtitulo opcional
 * - icon: Elemento SVG para o icone
 * - breadcrumbs: Array de { label, path } para navegacao
 * - actions: Elemento React com botoes de acao
 */
function PageHeader({ title, subtitle, icon, breadcrumbs = [], actions }) {
  return (
    <div className={styles.pageHeaderComponent}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link to="/">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Inicio
              </Link>
            </li>
            {breadcrumbs.map((crumb, index) => (
              <li key={index}>
                <svg className={styles.breadcrumbSeparator} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                {crumb.path && index < breadcrumbs.length - 1 ? (
                  <Link to={crumb.path}>{crumb.label}</Link>
                ) : (
                  <span className={styles.current}>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Header Content */}
      <div className={styles.headerContent}>
        <div className={styles.headerInfo}>
          {icon && <div className={styles.headerIcon}>{icon}</div>}
          <div className={styles.headerText}>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>

        {actions && <div className={styles.headerActions}>{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
