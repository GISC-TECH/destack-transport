import './Loading.css';

function Loading({ message = 'Carregando...', size = 'medium', fullScreen = false }) {
  const containerClass = `loading-container ${fullScreen ? 'loading-fullscreen' : ''} loading-${size}`;

  return (
    <div
      className={containerClass}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={message}
    >
      <div className="loading-content">
        <div className="loading-spinner" aria-hidden="true">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
        </div>
        <p className="loading-message">{message}</p>
        <div className="loading-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default Loading;
