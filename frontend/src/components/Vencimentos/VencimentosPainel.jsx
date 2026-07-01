import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motoristasAPI, veiculosAPI } from '../../services/api';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import styles from './Vencimentos.module.css';

// Mock data para motoristas
const mockMotoristasVencendo = [
  {
    id: 1,
    nome: 'João da Silva',
    cpf_formatado: '123.456.789-01',
    documentos_vencendo: [
      { documento: 'CNH', validade: '2024-12-15', dias_restantes: 17, vencido: false }
    ]
  },
  {
    id: 2,
    nome: 'Carlos Pereira',
    cpf_formatado: '987.654.321-09',
    documentos_vencendo: [
      { documento: 'CNH', validade: '2024-11-25', dias_restantes: -3, vencido: true }
    ]
  },
  {
    id: 3,
    nome: 'Ricardo Alves',
    cpf_formatado: '333.444.555-66',
    documentos_vencendo: [
      { documento: 'CNH', validade: '2024-12-01', dias_restantes: 3, vencido: false }
    ]
  }
];

// Mock data para veículos
const mockVeiculosVencendo = [
  {
    id: 1,
    placa: 'DEF-5678',
    proprietario_nome: 'João da Silva - Agregado',
    documentos_vencendo: [
      { documento: 'CRLV', validade: '2024-12-15', dias_restantes: 17, vencido: false }
    ]
  },
  {
    id: 2,
    placa: 'MNO-7890',
    proprietario_nome: 'Carlos Pereira - Agregado',
    documentos_vencendo: [
      { documento: 'Seguro', validade: '2024-12-01', dias_restantes: 3, vencido: false },
      { documento: 'CRLV', validade: '2024-11-20', dias_restantes: -8, vencido: true }
    ]
  },
  {
    id: 3,
    placa: 'ABC-1234',
    proprietario_nome: 'Transportadora Alpha LTDA',
    documentos_vencendo: [
      { documento: 'Tacógrafo', validade: '2024-12-10', dias_restantes: 12, vencido: false }
    ]
  }
];

// Helper para garantir array
const ensureArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};

function VencimentosPainel() {
  const [activeTab, setActiveTab] = useState('todos');
  const [diasFiltro, setDiasFiltro] = useState(30);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  const loadVencimentos = useCallback(async () => {
    try {
      setLoading(true);

      const [motoristasData, veiculosData] = await Promise.all([
        motoristasAPI.vencimentos(diasFiltro, mostrarTodos),
        veiculosAPI.vencimentos(diasFiltro, mostrarTodos)
      ]);

      // Backend retorna {dias_alerta, total, motoristas/veiculos}
      setMotoristas(motoristasData.motoristas || motoristasData.results || []);
      setVeiculos(veiculosData.veiculos || veiculosData.results || []);
      setUsingMockData(false);
    } catch (err) {
      console.error('Erro ao carregar vencimentos:', err);
      setMotoristas(mockMotoristasVencendo);
      setVeiculos(mockVeiculosVencendo);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [diasFiltro, mostrarTodos]);

  useEffect(() => {
    loadVencimentos();
  }, [loadVencimentos]);

  // Combinar todos os documentos vencendo
  const getAllDocumentos = () => {
    const docs = [];

    ensureArray(motoristas).forEach(m => {
      (m.documentos_vencendo || []).forEach(doc => {
        docs.push({
          ...doc,
          tipo: 'motorista',
          entidade: m.nome,
          entidadeId: m.id,
          detalhe: m.cpf_formatado
        });
      });
    });

    ensureArray(veiculos).forEach(v => {
      (v.documentos_vencendo || []).forEach(doc => {
        docs.push({
          ...doc,
          tipo: 'veiculo',
          entidade: v.placa,
          entidadeId: v.id,
          detalhe: v.proprietario_nome
        });
      });
    });

    // Ordenar por dias restantes (vencidos primeiro, depois os mais próximos)
    return docs.sort((a, b) => a.dias_restantes - b.dias_restantes);
  };

  const documentos = getAllDocumentos();

  // Filtrar por tab
  const documentosFiltrados = documentos.filter(d => {
    if (activeTab === 'todos') return true;
    if (activeTab === 'vencidos') return d.vencido;
    if (activeTab === 'motoristas') return d.tipo === 'motorista';
    if (activeTab === 'veiculos') return d.tipo === 'veiculo';
    return true;
  });

  // Contagens
  const contagens = {
    total: documentos.length,
    vencidos: documentos.filter(d => d.vencido).length,
    motoristas: documentos.filter(d => d.tipo === 'motorista').length,
    veiculos: documentos.filter(d => d.tipo === 'veiculo').length,
    urgentes: documentos.filter(d => !d.vencido && d.dias_restantes <= 7).length
  };

  const getStatusClass = (doc) => {
    if (doc.vencido) return 'vencido';
    if (doc.dias_restantes <= 7) return 'urgente';
    if (doc.dias_restantes <= 15) return 'atencao';
    return 'normal';
  };

  const getStatusVariant = (doc) => {
    const statusClass = getStatusClass(doc);
    const map = {
      vencido: 'danger',
      urgente: 'warning',
      atencao: 'info',
      normal: 'success'
    };
    return map[statusClass] || 'default';
  };

  const getStatusText = (doc) => {
    if (doc.vencido) return `Vencido há ${Math.abs(doc.dias_restantes)} dia${Math.abs(doc.dias_restantes) !== 1 ? 's' : ''}`;
    if (doc.dias_restantes === 0) return 'Vence hoje';
    if (doc.dias_restantes === 1) return 'Vence amanhã';
    return `${doc.dias_restantes} dias restantes`;
  };

  if (loading) return <Loading message="Carregando vencimentos..." />;

  const vencimentoIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Painel de Vencimentos"
        subtitle={usingMockData ? "Acompanhe documentos de motoristas e veículos (Modo Demonstração)" : "Acompanhe documentos de motoristas e veículos"}
        icon={vencimentoIcon}
        breadcrumbs={[{ label: 'Sistema' }, { label: 'Vencimentos' }]}
        actions={
          <div className={styles.headerFilters}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={mostrarTodos}
                onChange={(e) => setMostrarTodos(e.target.checked)}
              />
              <span>Mostrar todos</span>
            </label>
            <label htmlFor="dias_filtro" className={styles.visuallyHidden}>Prazo de vencimento</label>
            <select
              id="dias_filtro"
              className={styles.selectFilter}
              value={diasFiltro}
              onChange={(e) => setDiasFiltro(Number(e.target.value))}
            >
              <option value={7}>Proximos 7 dias</option>
              <option value={15}>Proximos 15 dias</option>
              <option value={30}>Proximos 30 dias</option>
              <option value={60}>Proximos 60 dias</option>
              <option value={90}>Proximos 90 dias</option>
            </select>
          </div>
        }
      />

      {/* Cards de resumo */}
      <div className={styles.summary}>
        <div className={`${styles.summaryCard} ${contagens.vencidos > 0 ? styles.summaryAlerta : ''}`}>
          <div className={`${styles.summaryIcon} ${styles.summaryVencidos}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.vencidos}</span>
            <span className={styles.summaryLabel}>Vencidos</span>
          </div>
        </div>

        <div className={`${styles.summaryCard} ${contagens.urgentes > 0 ? styles.summaryWarning : ''}`}>
          <div className={`${styles.summaryIcon} ${styles.summaryUrgentes}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.urgentes}</span>
            <span className={styles.summaryLabel}>Urgentes (7 dias)</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryMotoristas}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.motoristas}</span>
            <span className={styles.summaryLabel}>Motoristas</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.summaryVeiculos}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.veiculos}</span>
            <span className={styles.summaryLabel}>Veículos</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabButton} ${activeTab === 'todos' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('todos')}
        >
          Todos ({contagens.total})
        </button>
        <button
          className={`${styles.tabButton} ${styles.tabButtonDanger} ${activeTab === 'vencidos' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('vencidos')}
        >
          Vencidos ({contagens.vencidos})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'motoristas' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('motoristas')}
        >
          Motoristas ({contagens.motoristas})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'veiculos' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('veiculos')}
        >
          Veículos ({contagens.veiculos})
        </button>
      </div>

      {/* Lista de vencimentos */}
      <div className={styles.list}>
        {documentosFiltrados.length === 0 ? (
          <div className={`${styles.emptyState} ${styles.emptyStateSuccess}`}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h3>Tudo em dia!</h3>
            <p>Nenhum documento vencendo no período selecionado.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {documentosFiltrados.map((doc, index) => {
              const statusClass = getStatusClass(doc);
              return (
                <div key={`${doc.tipo}-${doc.entidadeId}-${doc.documento}-${index}`} className={`${styles.card} ${styles[`card${statusClass.charAt(0).toUpperCase() + statusClass.slice(1)}`]}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTipo}>
                      {doc.tipo === 'motorista' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="3" width="15" height="13"></rect>
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                          <circle cx="5.5" cy="18.5" r="2.5"></circle>
                          <circle cx="18.5" cy="18.5" r="2.5"></circle>
                        </svg>
                      )}
                      <span>{doc.tipo === 'motorista' ? 'Motorista' : 'Veículo'}</span>
                    </div>
                    <StatusPill status={getStatusVariant(doc)}>{getStatusText(doc)}</StatusPill>
                  </div>

                  <div className={styles.cardContent}>
                    <h3>{doc.entidade}</h3>
                    <p className={styles.detalhe}>{doc.detalhe}</p>
                    <div className={styles.documentoInfo}>
                      <span className={styles.docNome}>{doc.documento}</span>
                      <span className={styles.docValidade}>
                        Validade: {new Date(doc.validade).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <Link
                      className={styles.actionButton}
                      to={doc.tipo === 'motorista' ? `/motoristas/editar/${doc.entidadeId}` : `/veiculos/editar/${doc.entidadeId}`}
                    >
                      Atualizar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default VencimentosPainel;
