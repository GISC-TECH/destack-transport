import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientesAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import { SkeletonTable, SkeletonMobileCards } from '../Common/Skeleton';
import EmptyState from '../Common/EmptyState';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import PermissionGuard from '../Common/PermissionGuard';
import styles from './ClientesList.module.css';

function ClientesList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    ativo: 'true',
    tipo_frete: '',
    estado: '',
    q: ''
  });
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null
  });

  const fetchPage = async (url) => {
    try {
      setLoading(true);
      setError(null);

      // Converte URL absoluta do DRF para caminho relativo (passa pelo proxy)
      const relativeUrl = url.startsWith('http')
        ? new URL(url).pathname + new URL(url).search
        : url;

      const response = await fetch(relativeUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      const data = await response.json();

      if (data.results) {
        setClientes(data.results);
        setPagination({
          count: data.count,
          next: data.next,
          previous: data.previous
        });
      } else if (Array.isArray(data)) {
        setClientes(data);
        setPagination({ count: data.length, next: null, previous: null });
      } else {
        setClientes([]);
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
      setError('Erro ao carregar clientes. Tente novamente.');
      setClientes([]);
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

  const loadClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== '')
      );

      const data = await clientesAPI.list(params);

      if (data.results) {
        setClientes(data.results);
        setPagination({
          count: data.count,
          next: data.next,
          previous: data.previous
        });
      } else if (Array.isArray(data)) {
        setClientes(data);
        setPagination({ count: data.length, next: null, previous: null });
      } else {
        setClientes([]);
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
      setError('Erro ao carregar clientes. Tente novamente.');
      setClientes([]);
      setPagination({ count: 0, next: null, previous: null });
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  const handleExport = async () => {
    try {
      const params = Object.fromEntries(
        Object.entries(filtros).filter(([, v]) => v !== '')
      );
      await clientesAPI.export(params);
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

  const clientesIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );

  if (loading) {
    return (
      <div className={styles.clientesList}>
        <PageHeader
          title="Clientes"
          subtitle="Carregando..."
          icon={clientesIcon}
          breadcrumbs={[{ label: 'Cadastros' }, { label: 'Clientes' }]}
        />
        <div className={styles.desktopOnly}>
          <TableContainer mobileCards={false}>
            <SkeletonTable rows={5} columns={8} />
          </TableContainer>
        </div>
        <div className={styles.mobileOnly}>
          <SkeletonMobileCards count={4} />
        </div>
      </div>
    );
  }
  if (error) return <ErrorMessage message={error} onRetry={loadClientes} />;

  const headerActions = (
    <PermissionGuard modulo="clientes" acao="add">
      <Button variant="primary" onClick={() => navigate('/clientes/novo')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Novo Cliente
      </Button>
    </PermissionGuard>
  );

  return (
    <div className={styles.clientesList}>
      <PageHeader
        title="Clientes"
        subtitle={`${pagination.count} registros`}
        icon={clientesIcon}
        breadcrumbs={[{ label: 'Cadastros' }, { label: 'Clientes' }]}
        actions={headerActions}
      />

      {/* Filtros */}
      <div className={styles.filtrosContainer}>
        <input
          type="text"
          className={styles.inputFilter}
          placeholder="Buscar por razão social, fantasia ou CNPJ..."
          value={filtros.q}
          onChange={(e) => handleFiltroChange('q', e.target.value)}
        />

        <select
          className={styles.selectFilter}
          value={filtros.tipo_frete}
          onChange={(e) => handleFiltroChange('tipo_frete', e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="CIF">CIF</option>
          <option value="FOB">FOB</option>
        </select>

        <input
          type="text"
          className={`${styles.inputFilter} ${styles.ufFilter}`}
          placeholder="UF"
          maxLength="2"
          value={filtros.estado}
          onChange={(e) => handleFiltroChange('estado', e.target.value.toUpperCase())}
        />

        <select
          className={styles.selectFilter}
          value={filtros.ativo}
          onChange={(e) => handleFiltroChange('ativo', e.target.value)}
        >
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="">Todos</option>
        </select>

        <Button variant="outline" onClick={handleExport}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Exportar CSV
        </Button>
      </div>

      {/* Tabela */}
      {clientes.length > 0 ? (
        <TableContainer>
          <table className={styles.clientesTable}>
            <thead>
              <tr>
                <th>Razão Social</th>
                <th>Nome Fantasia</th>
                <th>CNPJ</th>
                <th className={styles.hideTablet}>Cidade</th>
                <th className={styles.hideTablet}>UF</th>
                <th>Tipo Frete</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td data-label="Razão Social">{cliente.razao_social}</td>
                  <td data-label="Nome Fantasia">{cliente.nome_fantasia || '-'}</td>
                  <td data-label="CNPJ">{cliente.cnpj_formatado || cliente.cnpj}</td>
                  <td data-label="Cidade" className={styles.hideTablet}>{cliente.cidade || '-'}</td>
                  <td data-label="UF" className={styles.hideTablet}>{cliente.estado || '-'}</td>
                  <td data-label="Tipo Frete">
                    <StatusPill status={cliente.tipo_frete?.toLowerCase()}>
                      {cliente.tipo_frete}
                    </StatusPill>
                  </td>
                  <td data-label="Status">
                    <StatusPill status={cliente.ativo ? 'ativo' : 'inativo'}>
                      {cliente.ativo ? 'Ativo' : 'Inativo'}
                    </StatusPill>
                  </td>
                  <td data-label="Ações" className={styles.actionsCell}>
                    <PermissionGuard modulo="clientes" acao="change">
                      <Button
                        variant="primary"
                        size="sm"
                        iconOnly
                        onClick={() => navigate(`/clientes/editar/${cliente.id}`)}
                        aria-label={`Editar ${cliente.razao_social}`}
                        title="Editar"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </Button>
                    </PermissionGuard>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      ) : (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Nao ha clientes com os filtros selecionados."
          action={
            <PermissionGuard modulo="clientes" acao="add">
              <Button variant="primary" onClick={() => navigate('/clientes/novo')}>
                Novo Cliente
              </Button>
            </PermissionGuard>
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

export default ClientesList;
