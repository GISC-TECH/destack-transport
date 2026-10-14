import { useState, useEffect } from 'react';
import { alertasAPI } from '../../services/api';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import styles from './Alertas.module.css';

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
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    loadAlertas();
  }, []);

  const loadAlertas = async () => {
    try {
      setLoading(true);
      const result = await alertasAPI.sistema.list();
      setAlertas(result.results || result);
    } catch (err) {
      console.error('Erro ao carregar alertas:', err);
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
      alta: { status: 'danger', text: 'Alta' },
      media: { status: 'warning', text: 'Média' },
      baixa: { status: 'info', text: 'Baixa' }
    };
    const p = map[prioridade] || { status: 'default', text: prioridade };
    return <StatusPill status={p.status}>{p.text}</StatusPill>;
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
    <div className={styles.page}>
      <PageHeader
        title="Alertas do Sistema"
        subtitle="Acompanhe notificações importantes"
        icon={alertaIcon}
        breadcrumbs={[{ label: 'Sistema' }, { label: 'Alertas' }]}
        actions={
          contagens.total > 0 && (
            <Button variant="secondary" onClick={handleLimparTodos}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Limpar Todos
            </Button>
          )
        }
      />

      {/* Cards de resumo */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryTotal}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.total}</span>
            <span className={styles.summaryLabel}>Total</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryUrgentes}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.urgentes}</span>
            <span className={styles.summaryLabel}>Urgentes</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className={styles.filtrosSection}>
        <div className={styles.filtrosTabs}>
          <button
            className={`${styles.tabBtn} ${filtro === 'todos' ? styles.tabActive : ''}`}
            onClick={() => setFiltro('todos')}
          >
            Todos ({contagens.total})
          </button>
          <button
            className={`${styles.tabBtn} ${filtro === 'urgentes' ? styles.tabActive : ''}`}
            onClick={() => setFiltro('urgentes')}
          >
            Urgentes ({contagens.urgentes})
          </button>
          <button
            className={`${styles.tabBtn} ${filtro === 'vencimento' ? styles.tabActive : ''}`}
            onClick={() => setFiltro('vencimento')}
          >
            Vencimentos
          </button>
          <button
            className={`${styles.tabBtn} ${filtro === 'pagamento' ? styles.tabActive : ''}`}
            onClick={() => setFiltro('pagamento')}
          >
            Pagamentos
          </button>
          <button
            className={`${styles.tabBtn} ${filtro === 'manutencao' ? styles.tabActive : ''}`}
            onClick={() => setFiltro('manutencao')}
          >
            Manutenção
          </button>
        </div>
      </div>

      {/* Lista de Alertas */}
      <div className={styles.list}>
        {alertasFiltrados.length === 0 ? (
          <div className={styles.emptyState}>
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
              className={`${styles.card} ${styles[`prioridade${alerta.prioridade.charAt(0).toUpperCase() + alerta.prioridade.slice(1)}`]}`}
            >
              <div className={`${styles.icon} ${styles[`tipo${alerta.tipo.charAt(0).toUpperCase() + alerta.tipo.slice(1)}`]}`}>
                {getTipoIcon(alerta.tipo)}
              </div>
              <div className={styles.content}>
                <div className={styles.header}>
                  <h3>{getTituloFromTipo(alerta.tipo)}</h3>
                  {getPrioridadeBadge(alerta.prioridade)}
                </div>
                <p>{alerta.mensagem}</p>
                <span className={styles.time}>{formatDate(alerta.data_hora)}</span>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.markReadButton}
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
