import { useState, useEffect } from 'react';
import { alertasAPI } from '../../services/api';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import './Alertas.css';

// Função para gerar título baseado no tipo
const getTituloFromTipo = (tipo) => {
  const titulos = {
    'vencimento': 'Documento Vencendo',
    'manutencao': 'Manutenção Necessária',
    'pagamento': 'Alerta de Pagamento',
    'documento': 'Documento Pendente',
    'sistema': 'Notificação do Sistema'
  };
  return titulos[tipo] || 'Alerta';
};

function AlertasSistema() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    loadAlertas();
  }, []);

  const loadAlertas = async () => {
    try {
      setLoading(true);
      const result = await alertasAPI.sistema.list();
      setAlertas(result.results || result);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar alertas:', err);
      setError('Erro ao carregar alertas. Tente novamente.');
      setAlertas([]);
    } finally {
      setLoading(false);
    }
  };

  // Como o backend não suporta "marcar como lido", usamos delete para remover alertas
  const handleRemoverAlerta = async (id) => {
    try {
      await alertasAPI.sistema.delete(id);
      loadAlertas();
    } catch (err) {
      console.error('Erro ao remover alerta:', err);
    }
  };

  const handleLimparTodos = async () => {
    try {
      await alertasAPI.sistema.limparTodos();
      loadAlertas();
    } catch (err) {
      console.error('Erro ao limpar alertas:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Agora mesmo';
    if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    return date.toLocaleDateString('pt-BR');
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      vencimento: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
      manutencao: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
      ),
      pagamento: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      ),
      documento: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      ),
      sistema: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      )
    };
    return icons[tipo] || icons.sistema;
  };

  const getPrioridadeBadge = (prioridade) => {
    const map = {
      alta: { class: 'danger', text: 'Alta' },
      media: { class: 'warning', text: 'Média' },
      baixa: { class: 'info', text: 'Baixa' }
    };
    const p = map[prioridade] || { class: 'secondary', text: prioridade };
    return <span className={`badge badge-${p.class}`}>{p.text}</span>;
  };

  // Filtrar alertas
  const alertasFiltrados = alertas.filter(a => {
    if (filtro === 'todos') return true;
    if (filtro === 'urgentes') return a.prioridade === 'alta';
    return a.tipo === filtro;
  });

  // Contagens
  const contagens = {
    total: alertas.length,
    urgentes: alertas.filter(a => a.prioridade === 'alta').length,
    alta: alertas.filter(a => a.prioridade === 'alta').length
  };

  if (loading) return <Loading message="Carregando alertas..." />;

  const alertaIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  );

  return (
    <div className="alertas-page">
      <PageHeader
        title="Alertas do Sistema"
        subtitle="Acompanhe notificações importantes"
        icon={alertaIcon}
        breadcrumbs={[{ label: 'Sistema' }, { label: 'Alertas' }]}
        actions={
          contagens.total > 0 && (
            <button className="btn-secondary" onClick={handleLimparTodos}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Limpar Todos
            </button>
          )
        }
      />

      {/* Cards de resumo */}
      <div className="alertas-summary">
        <div className="summary-card">
          <div className="summary-icon total">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div className="summary-info">
            <span className="summary-number">{contagens.total}</span>
            <span className="summary-label">Total</span>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon urgentes">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className="summary-info">
            <span className="summary-number">{contagens.urgentes}</span>
            <span className="summary-label">Urgentes</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filtros-section">
        <div className="filtros-tabs">
          <button
            className={`tab-btn ${filtro === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltro('todos')}
          >
            Todos ({contagens.total})
          </button>
          <button
            className={`tab-btn ${filtro === 'urgentes' ? 'active' : ''}`}
            onClick={() => setFiltro('urgentes')}
          >
            Urgentes ({contagens.urgentes})
          </button>
          <button
            className={`tab-btn ${filtro === 'vencimento' ? 'active' : ''}`}
            onClick={() => setFiltro('vencimento')}
          >
            Vencimentos
          </button>
          <button
            className={`tab-btn ${filtro === 'pagamento' ? 'active' : ''}`}
            onClick={() => setFiltro('pagamento')}
          >
            Pagamentos
          </button>
          <button
            className={`tab-btn ${filtro === 'manutencao' ? 'active' : ''}`}
            onClick={() => setFiltro('manutencao')}
          >
            Manutenção
          </button>
        </div>
      </div>

      {/* Lista de Alertas */}
      <div className="alertas-list">
        {alertasFiltrados.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <p>Nenhum alerta encontrado</p>
          </div>
        ) : (
          alertasFiltrados.map(alerta => (
            <div
              key={alerta.id}
              className={`alerta-card prioridade-${alerta.prioridade}`}
            >
              <div className={`alerta-icon tipo-${alerta.tipo}`}>
                {getTipoIcon(alerta.tipo)}
              </div>
              <div className="alerta-content">
                <div className="alerta-header">
                  <h3>{getTituloFromTipo(alerta.tipo)}</h3>
                  {getPrioridadeBadge(alerta.prioridade)}
                </div>
                <p>{alerta.mensagem}</p>
                <span className="alerta-time">{formatDate(alerta.data_hora)}</span>
              </div>
              <div className="alerta-actions">
                <button
                  className="btn-mark-read"
                  onClick={() => handleRemoverAlerta(alerta.id)}
                  title="Remover alerta"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AlertasSistema;
