import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motoristasAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import { SkeletonTable, SkeletonMobileCards } from '../Common/Skeleton';
import EmptyState from '../Common/EmptyState';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import styles from './MotoristasList.module.css';

function MotoristasList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    ativo: 'true',
    categoria_cnh: '',
    cadastro: '',
    q: ''
  });
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null
  });
  const [showAlerts, setShowAlerts] = useState(false);
  const [vencimentos, setVencimentos] = useState([]);

  const fetchPage = async (url) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Erro ao carregar motoristas');
      const data = await response.json();

      if (data.results) {
        setMotoristas(data.results);
        setPagination({
          count: data.count,
          next: data.next,
          previous: data.previous
        });
      } else if (Array.isArray(data)) {
        setMotoristas(data);
        setPagination({ count: data.length, next: null, previous: null });
      } else {
        setMotoristas([]);
      }
    } catch (err) {
      console.error('Erro ao carregar motoristas:', err);
      setError('Erro ao carregar motoristas. Tente novamente.');
      setMotoristas([]);
      setPagination({ count: 0, next: null, previous: null });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousPage = () => {
    if (pagination.previous) {
      fetchPage(pagination.previous);
    }
  };

  const handleNextPage = () => {
    if (pagination.next) {
      fetchPage(pagination.next);
    }
  };

  const loadMotoristas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== '')
      );

      // Traduz o filtro de cadastro para os params do backend
      if (params.cadastro === 'incompletos') params.incompletos = 'true';
      else if (params.cadastro === 'automaticos') params.cadastro_automatico = 'true';
      delete params.cadastro;

      const data = await motoristasAPI.list(params);

      if (data.results) {
        setMotoristas(data.results);
        setPagination({
          count: data.count,
          next: data.next,
          previous: data.previous
        });
      } else if (Array.isArray(data)) {
        setMotoristas(data);
        setPagination({ count: data.length, next: null, previous: null });
      } else {
        setMotoristas([]);
      }
    } catch (err) {
      console.error('Erro ao carregar motoristas:', err);
      setError('Erro ao carregar motoristas. Tente novamente.');
      setMotoristas([]);
      setPagination({ count: 0, next: null, previous: null });
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    loadMotoristas();
  }, [loadMotoristas]);

  const loadVencimentos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await motoristasAPI.vencimentos(30);
      setVencimentos(data.results || data);
      setShowAlerts(true);
    } catch (err) {
      console.error('Erro ao carregar vencimentos:', err);
      toast.error('Erro ao carregar vencimentos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== '')
      );
      await motoristasAPI.export(params);
    } catch (err) {
      toast.error('Erro ao exportar: ' + err.message);
    }
  };

  const handleFiltroChange = (field, value) => {
    setFiltros(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination({ count: 0, next: null, previous: null });
  };

  const motoristasIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  if (loading) {
    return (
      <div className={styles.motoristasList}>
        <PageHeader
          title="Motoristas"
          subtitle="Carregando..."
          icon={motoristasIcon}
          breadcrumbs={[{ label: 'Cadastros' }, { label: 'Motoristas' }]}
        />
        <div className={styles.desktopOnly}>
          <TableContainer mobileCards={false}>
            <SkeletonTable rows={5} columns={7} />
          </TableContainer>
        </div>
        <div className={styles.mobileOnly}>
          <SkeletonMobileCards count={4} />
        </div>
      </div>
    );
  }
  if (error) return <ErrorMessage message={error} onRetry={loadMotoristas} />;

  // Se mostrando alertas
  if (showAlerts) {
    return (
      <div className={styles.motoristasList}>
        <div className={styles.motoristasHeader}>
          <h2>Alertas de Vencimento (30 dias)</h2>
          <Button variant="secondary" onClick={() => setShowAlerts(false)}>
            Voltar para Lista
          </Button>
        </div>

        {vencimentos.length > 0 ? (
          <div className={styles.alertasContainer}>
            {vencimentos.map((motorista) => (
              <div key={motorista.id} className={styles.alertaCard}>
                <h3>{motorista.nome}</h3>
                <p><strong>CPF:</strong> {motorista.cpf_formatado || motorista.cpf}</p>
                <p><strong>CNH:</strong> {motorista.cnh}</p>

                <div className={styles.documentosVencendo}>
                  <h4>Documentos:</h4>
                  {motorista.documentos_vencendo?.map((doc, idx) => (
                    <div
                      key={idx}
                      className={`${styles.docItem} ${doc.vencido ? styles.vencido : styles.vencendo}`}
                    >
                      <span className={styles.docNome}>{doc.documento}</span>
                      <span className={styles.docValidade}>{doc.validade}</span>
                      <span className={styles.docDias}>
                        {doc.vencido ? 'VENCIDO' : `${doc.dias_restantes} dias`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhum documento vencendo"
            description="Nenhum documento vencendo nos próximos 30 dias!"
          />
        )}
      </div>
    );
  }

  const headerActions = (
    <div className={styles.headerButtons}>
      <Button variant="warning" onClick={loadVencimentos}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Vencimentos
      </Button>
      <Button variant="primary" onClick={() => navigate('/motoristas/novo')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Novo Motorista
      </Button>
    </div>
  );

  // Lista normal
  return (
    <div className={styles.motoristasList}>
      <PageHeader
        title="Motoristas"
        subtitle={`${pagination.count} registros`}
        icon={motoristasIcon}
        breadcrumbs={[{ label: 'Cadastros' }, { label: 'Motoristas' }]}
        actions={headerActions}
      />

      {/* Filtros */}
      <div className={styles.filtrosContainer}>
        <input
          type="text"
          className={styles.inputFilter}
          placeholder="Buscar por nome, CPF ou CNH..."
          value={filtros.q}
          onChange={(e) => handleFiltroChange('q', e.target.value)}
        />

        <select
          className={styles.selectFilter}
          value={filtros.categoria_cnh}
          onChange={(e) => handleFiltroChange('categoria_cnh', e.target.value)}
        >
          <option value="">Todas as categorias</option>
          <option value="A">Categoria A</option>
          <option value="B">Categoria B</option>
          <option value="C">Categoria C</option>
          <option value="D">Categoria D</option>
          <option value="E">Categoria E</option>
        </select>

        <select
          className={styles.selectFilter}
          value={filtros.ativo}
          onChange={(e) => handleFiltroChange('ativo', e.target.value)}
        >
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="">Todos</option>
        </select>

        <select
          className={styles.selectFilter}
          value={filtros.cadastro || ''}
          onChange={(e) => handleFiltroChange('cadastro', e.target.value)}
        >
          <option value="">Todos os cadastros</option>
          <option value="incompletos">Incompletos</option>
          <option value="automaticos">Automáticos (via XML)</option>
        </select>

        <Button variant="outline" onClick={handleExport}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Exportar
        </Button>
      </div>

      {/* Tabela Desktop + Cards Mobile */}
      {motoristas.length > 0 ? (
        <>
          <div className={styles.desktopOnly}>
            <TableContainer mobileCards={false}>
              <table className={styles.motoristasTable}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>CNH</th>
                    <th>Categoria</th>
                    <th>Validade CNH</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {motoristas.map((motorista) => (
                    <tr key={motorista.id}>
                      <td>
                        {motorista.nome}
                        {motorista.cadastro_completo === false && (
                          <StatusPill
                            status="warning"
                            className={styles.badgeWarning}
                            title="Cadastro incompleto — falta CNH e/ou validade"
                          >
                            {motorista.cadastro_automatico ? 'Auto · incompleto' : 'Incompleto'}
                          </StatusPill>
                        )}
                      </td>
                      <td>{motorista.cpf_formatado || motorista.cpf}</td>
                      <td>{motorista.cnh || '-'}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeCategoria}`}>{motorista.categoria_cnh}</span>
                      </td>
                      <td>{motorista.validade_cnh_formatada || motorista.validade_cnh || '-'}</td>
                      <td>
                        <StatusPill status={motorista.ativo ? 'ativo' : 'inativo'}>
                          {motorista.ativo ? 'Ativo' : 'Inativo'}
                        </StatusPill>
                      </td>
                      <td className={styles.actionsCell}>
                        <Button
                          variant="primary"
                          size="sm"
                          iconOnly
                          onClick={() => navigate(`/motoristas/editar/${motorista.id}`)}
                          title="Editar"
                          aria-label={`Editar ${motorista.nome}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableContainer>
          </div>

          <div className={`${styles.mobileCards} ${styles.mobileOnly}`}>
            {motoristas.map((motorista) => (
              <div
                key={motorista.id}
                className={styles.mobileCard}
                onClick={() => navigate(`/motoristas/editar/${motorista.id}`)}
              >
                <div className={styles.mobileCardHeader}>
                  <h4>{motorista.nome}</h4>
                  <StatusPill status={motorista.ativo ? 'ativo' : 'inativo'}>
                    {motorista.ativo ? 'Ativo' : 'Inativo'}
                  </StatusPill>
                </div>
                <div className={styles.mobileCardBody}>
                  <div className={styles.mobileCardRow}>
                    <span className={styles.mobileCardLabel}>CPF</span>
                    <span className={styles.mobileCardValue}>{motorista.cpf_formatado || motorista.cpf}</span>
                  </div>
                  <div className={styles.mobileCardRow}>
                    <span className={styles.mobileCardLabel}>CNH</span>
                    <span className={styles.mobileCardValue}>{motorista.cnh || '-'}</span>
                  </div>
                  <div className={styles.mobileCardRow}>
                    <span className={styles.mobileCardLabel}>Categoria</span>
                    <span className={`${styles.badge} ${styles.badgeCategoria}`}>{motorista.categoria_cnh}</span>
                  </div>
                  <div className={styles.mobileCardRow}>
                    <span className={styles.mobileCardLabel}>Validade CNH</span>
                    <span className={styles.mobileCardValue}>{motorista.validade_cnh_formatada || motorista.validade_cnh || '-'}</span>
                  </div>
                </div>
                <div className={styles.mobileCardFooter}>
                  <Button
                    variant="primary"
                    size="sm"
                    iconOnly
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/motoristas/editar/${motorista.id}`);
                    }}
                    aria-label={`Editar ${motorista.nome}`}
                    title="Editar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="Nenhum motorista encontrado"
          description="Nao ha motoristas com os filtros selecionados."
          action={
            <Button variant="primary" onClick={() => navigate('/motoristas/novo')}>
              Novo Motorista
            </Button>
          }
        />
      )}

      {/* Botões de paginação */}
      {(pagination.previous || pagination.next) && (
        <div className={styles.paginationButtons}>
          <Button
            variant="outline"
            disabled={!pagination.previous}
            onClick={handlePreviousPage}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            disabled={!pagination.next}
            onClick={handleNextPage}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}

export default MotoristasList;
