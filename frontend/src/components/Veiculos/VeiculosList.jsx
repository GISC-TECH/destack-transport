import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import { SkeletonTable, SkeletonMobileCards } from '../Common/Skeleton';
import EmptyState from '../Common/EmptyState';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import styles from './VeiculosList.module.css';

const veiculosIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="3" width="15" height="13"></rect>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
    <circle cx="5.5" cy="18.5" r="2.5"></circle>
    <circle cx="18.5" cy="18.5" r="2.5"></circle>
  </svg>
);

function VeiculosList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    ativo: 'true',
    tipo_proprietario: '',
    placa: ''
  });
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null
  });
  const [showAlerts, setShowAlerts] = useState(false);
  const [vencimentos, setVencimentos] = useState([]);

  const loadVeiculos = useCallback(async () => {
    try {
      setLoading(true);

      const params = Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== '')
      );

      const data = await veiculosAPI.list(params);

      if (data.results) {
        setVeiculos(data.results);
        setPagination({
          count: data.count,
          next: data.next,
          previous: data.previous
        });
      } else if (Array.isArray(data)) {
        setVeiculos(data);
        setPagination({ count: data.length, next: null, previous: null });
      } else {
        setVeiculos([]);
      }
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
      setVeiculos([]);
      setPagination({ count: 0, next: null, previous: null });
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    loadVeiculos();
  }, [loadVeiculos]);

  const fetchPage = async (url) => {
    try {
      setLoading(true);

      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Erro ao carregar veículos');
      const data = await response.json();

      if (data.results) {
        setVeiculos(data.results);
        setPagination({
          count: data.count,
          next: data.next,
          previous: data.previous
        });
      } else if (Array.isArray(data)) {
        setVeiculos(data);
        setPagination({ count: data.length, next: null, previous: null });
      } else {
        setVeiculos([]);
      }
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
      setVeiculos([]);
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

  const loadVencimentos = async () => {
    try {
      setLoading(true);
      const data = await veiculosAPI.vencimentos(30);
      setVencimentos(data.results || data);
      setShowAlerts(true);
    } catch (err) {
      console.error('Erro ao carregar vencimentos:', err);
      setVencimentos([]);
      setShowAlerts(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (field, value) => {
    setFiltros(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination({ count: 0, next: null, previous: null });
  };

  const handleExport = async () => {
    try {
      const params = Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== '')
      );
      await veiculosAPI.export(params);
    } catch (err) {
      toast.error('Erro ao exportar: ' + err.message);
    }
  };

  const getTipoProprietario = (tipo) => {
    const tipos = {
      '00': 'Próprio',
      '01': 'Arrendado',
      '02': 'Agregado'
    };
    return tipos[tipo] || tipo;
  };

  const getTipoStatus = (tipo) => {
    switch (tipo) {
      case '00': return 'success';
      case '01': return 'info';
      case '02': return 'warning';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className={styles.veiculosList}>
        <PageHeader
          title="Veículos"
          subtitle="Carregando..."
          icon={veiculosIcon}
          breadcrumbs={[{ label: 'Cadastros' }, { label: 'Veículos' }]}
        />
        <div className={styles.desktopOnly}>
          <TableContainer mobileCards={false}>
            <SkeletonTable rows={5} columns={9} />
          </TableContainer>
        </div>
        <div className={styles.mobileOnly}>
          <SkeletonMobileCards count={4} />
        </div>
      </div>
    );
  }

  // Se mostrando alertas
  if (showAlerts) {
    return (
      <div className={styles.veiculosList}>
        <div className={styles.veiculosHeader}>
          <h2>Alertas de Vencimento - Documentos de Veículos (30 dias)</h2>
          <Button variant="secondary" onClick={() => setShowAlerts(false)}>
            Voltar para Lista
          </Button>
        </div>

        {vencimentos.length > 0 ? (
          <div className={styles.alertasContainer}>
            {vencimentos.map((veiculo) => (
              <div key={veiculo.id} className={styles.alertaCard}>
                <h3>{veiculo.placa}</h3>
                <p><strong>Proprietário:</strong> {veiculo.proprietario_nome || '-'}</p>
                <p><strong>Tipo:</strong> {getTipoProprietario(veiculo.tipo_proprietario)}</p>

                <div className={styles.documentosVencendo}>
                  <h4>Documentos:</h4>
                  {veiculo.documentos_vencendo?.map((doc, idx) => (
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
            description="Não há documentos de veículos vencendo nos próximos 30 dias."
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
      <Button variant="outline" onClick={handleExport}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exportar
      </Button>
      <Button variant="primary" onClick={() => navigate('/veiculos/novo')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Novo Veículo
      </Button>
    </div>
  );

  // Lista normal
  return (
    <div className={styles.veiculosList}>
      <PageHeader
        title="Veículos"
        subtitle={`${pagination.count} registros`}
        icon={veiculosIcon}
        breadcrumbs={[{ label: 'Cadastros' }, { label: 'Veículos' }]}
        actions={headerActions}
      />

      {/* Filtros */}
      <div className={styles.filtrosContainer}>
        <input
          type="text"
          className={styles.inputFilter}
          placeholder="Buscar por placa..."
          value={filtros.placa}
          onChange={(e) => handleFiltroChange('placa', e.target.value.toUpperCase())}
        />

        <select
          className={styles.selectFilter}
          value={filtros.tipo_proprietario}
          onChange={(e) => handleFiltroChange('tipo_proprietario', e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="00">Próprio</option>
          <option value="01">Arrendado</option>
          <option value="02">Agregado</option>
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
      </div>

      {/* Tabela */}
      {veiculos.length > 0 ? (
        <TableContainer>
          <table className={styles.veiculosTable}>
            <thead>
              <tr>
                <th>Placa</th>
                <th>RENAVAM</th>
                <th>Tipo</th>
                <th>Proprietário</th>
                <th>Capacidade (kg)</th>
                <th>Capacidade (m3)</th>
                <th>Compartimentos</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {veiculos.map((veiculo) => (
                <tr key={veiculo.id}>
                  <td data-label="Placa"><strong>{veiculo.placa}</strong></td>
                  <td data-label="RENAVAM">{veiculo.renavam || '-'}</td>
                  <td data-label="Tipo">
                    <StatusPill status={getTipoStatus(veiculo.tipo_proprietario)}>
                      {getTipoProprietario(veiculo.tipo_proprietario)}
                    </StatusPill>
                  </td>
                  <td data-label="Proprietário">{veiculo.proprietario_nome || '-'}</td>
                  <td data-label="Capacidade (kg)">{veiculo.capacidade_kg ? `${veiculo.capacidade_kg.toLocaleString()} kg` : '-'}</td>
                  <td data-label="Capacidade (m3)">{veiculo.capacidade_m3 ? `${veiculo.capacidade_m3} m3` : '-'}</td>
                  <td data-label="Compartimentos">
                    {veiculo.compartimentos && veiculo.compartimentos.length > 0 ? (
                      <StatusPill status="info">
                        {veiculo.compartimentos.length} boca{veiculo.compartimentos.length !== 1 ? 's' : ''}
                      </StatusPill>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td data-label="Status">
                    <StatusPill status={veiculo.ativo ? 'ativo' : 'inativo'}>
                      {veiculo.ativo ? 'Ativo' : 'Inativo'}
                    </StatusPill>
                  </td>
                  <td className={styles.actionsCell}>
                    <Button
                      variant="primary"
                      size="sm"
                      iconOnly
                      onClick={() => navigate(`/veiculos/editar/${veiculo.id}`)}
                      title="Editar"
                      aria-label={`Editar veículo ${veiculo.placa}`}
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
      ) : (
        <EmptyState
          title="Nenhum veículo encontrado"
          description="Não há veículos com os filtros selecionados."
          action={
            <Button variant="primary" onClick={() => navigate('/veiculos/novo')}>
              Novo Veículo
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

export default VeiculosList;
