import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientesAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './ClientesList.css';

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

      const response = await fetch(url, { credentials: 'include' });
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
  };

  if (loading) return <Loading message="Carregando clientes..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadClientes} />;

  const clientesIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );

  const headerActions = (
    <button className="btn btn-primary" onClick={() => navigate('/clientes/novo')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Novo Cliente
    </button>
  );

  return (
    <div className="clientes-list">
      <PageHeader
        title="Clientes"
        subtitle={`${pagination.count} registros`}
        icon={clientesIcon}
        breadcrumbs={[{ label: 'Cadastros' }, { label: 'Clientes' }]}
        actions={headerActions}
      />

      {/* Filtros */}
      <div className="filtros-container">
        <input
          type="text"
          className="input-filter"
          placeholder="Buscar por razão social, fantasia ou CNPJ..."
          value={filtros.q}
          onChange={(e) => handleFiltroChange('q', e.target.value)}
        />

        <select
          className="select-filter"
          value={filtros.tipo_frete}
          onChange={(e) => handleFiltroChange('tipo_frete', e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="CIF">CIF</option>
          <option value="FOB">FOB</option>
        </select>

        <input
          type="text"
          className="input-filter"
          placeholder="UF"
          maxLength="2"
          value={filtros.estado}
          onChange={(e) => handleFiltroChange('estado', e.target.value.toUpperCase())}
          style={{ width: '80px' }}
        />

        <select
          className="select-filter"
          value={filtros.ativo}
          onChange={(e) => handleFiltroChange('ativo', e.target.value)}
        >
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="">Todos</option>
        </select>

        <button className="btn btn-outline" onClick={handleExport}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Tabela */}
      {clientes.length > 0 ? (
        <div className="table-container">
          <table className="clientes-table">
            <thead>
              <tr>
                <th>Razão Social</th>
                <th>Nome Fantasia</th>
                <th>CNPJ</th>
                <th>Cidade</th>
                <th>UF</th>
                <th>Tipo Frete</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{cliente.razao_social}</td>
                  <td>{cliente.nome_fantasia || '-'}</td>
                  <td>{cliente.cnpj_formatado || cliente.cnpj}</td>
                  <td>{cliente.cidade || '-'}</td>
                  <td>{cliente.estado || '-'}</td>
                  <td>
                    <span className={`badge badge-${cliente.tipo_frete?.toLowerCase()}`}>
                      {cliente.tipo_frete}
                    </span>
                  </td>
                  <td>
                    <span className={`status ${cliente.ativo ? 'ativo' : 'inativo'}`}>
                      {cliente.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn-action btn-edit"
                      onClick={() => navigate(`/clientes/editar/${cliente.id}`)}
                      title="Editar"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>Nenhum cliente encontrado com os filtros selecionados.</p>
        </div>
      )}

      {/* Botões de paginação */}
      {(pagination.previous || pagination.next) && (
        <div className="pagination-buttons">
          <button
            className="btn-page"
            disabled={!pagination.previous}
            onClick={handlePreviousPage}
          >
            Anterior
          </button>
          <button
            className="btn-page"
            disabled={!pagination.next}
            onClick={handleNextPage}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

export default ClientesList;
