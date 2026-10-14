import styles from './Loading.module.css';

function Loading({ message = 'Carregando...', size = 'medium', fullScreen = false }) {
  const containerClass = [
    styles.container,
    fullScreen && styles.fullscreen,
    styles[size],
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={message}
    >
      <div className={styles.content}>
        <div className={styles.spinner} aria-hidden="true">
          <div className={styles.ring}></div>
          <div className={styles.ring}></div>
          <div className={styles.ring}></div>
          <div className={styles.icon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
        </div>
        <p className={styles.message}>{message}</p>
        <div className={styles.dots} aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default Loading;
