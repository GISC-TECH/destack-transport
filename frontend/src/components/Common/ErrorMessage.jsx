import './ErrorMessage.css';

function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-message">
      <div className="error-icon">⚠️</div>
      <p className="error-text">{message}</p>
      {onRetry && (
        <button className="error-retry-btn" onClick={onRetry}>
          Tentar Novamente
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
