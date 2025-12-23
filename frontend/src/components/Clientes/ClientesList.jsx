import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientesAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './ClientesList.css';

// Mock data para exibição quando API não está disponível
const mockClientes = [
  {
    id: 1,
    razao_social: 'Empresa Alpha Transportes LTDA',
    nome_fantasia: 'Alpha Transportes',
    cnpj: '12345678000190',
    cnpj_formatado: '12.345.678/0001-90',
    cidade: 'São Paulo',
    estado: 'SP',
    tipo_frete: 'CIF',
    ativo: true
  },
  {
    id: 2,
    razao_social: 'Beta Distribuidora S.A.',
    nome_fantasia: 'Beta Dist',
    cnpj: '98765432000188',
    cnpj_formatado: '98.765.432/0001-88',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    tipo_frete: 'FOB',
    ativo: true
  },
  {
    id: 3,
    razao_social: 'Gamma Comércio e Indústria LTDA',
    nome_fantasia: 'Gamma Comercial',
    cnpj: '55566677000122',
    cnpj_formatado: '55.566.677/0001-22',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    tipo_frete: 'CIF',
    ativo: true
  },
  {
    id: 4,
    razao_social: 'Delta Logística EIRELI',
    nome_fantasia: 'Delta Log',
    cnpj: '11122233000144',
    cnpj_formatado: '11.122.233/0001-44',
    cidade: 'Curitiba',
    estado: 'PR',
    tipo_frete: 'FOB',
    ativo: false
  },
  {
    id: 5,
    razao_social: 'Epsilon Materiais de Construção LTDA',
    nome_fantasia: 'Epsilon Mat',
    cnpj: '77788899000155',
    cnpj_formatado: '77.788.899/0001-55',
    cidade: 'Porto Alegre',
    estado: 'RS',
    tipo_frete: 'CIF',
    ativo: true
  },
  {
    id: 6,
    razao_social: 'Zeta Agropecuária S.A.',
    nome_fantasia: 'Zeta Agro',
    cnpj: '33344455000166',
    cnpj_formatado: '33.344.455/0001-66',
    cidade: 'Goiânia',
    estado: 'GO',
    tipo_frete: 'CIF',
    ativo: true
  }
];

function ClientesList() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
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

  useEffect(() => {
    loadClientes();
  }, [filtros]);

  const loadClientes = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = Object.fromEntries(
        Object.entries(filtros).filter(([_, v]) => v !== '')
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
      setUsingMockData(false);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
      // Usar dados mock quando API falhar
      let filteredMock = [...mockClientes];

      // Aplicar filtros nos dados mock
      if (filtros.ativo !== '') {
        filteredMock = filteredMock.filter(c =>
          filtros.ativo === 'true' ? c.ativo : !c.ativo
        );
      }
      if (filtros.tipo_frete) {
        filteredMock = filteredMock.filter(c => c.tipo_frete === filtros.tipo_frete);
      }
      if (filtros.estado) {
        filteredMock = filteredMock.filter(c =>
          c.estado.toLowerCase().includes(filtros.estado.toLowerCase())
        );
      }
      if (filtros.q) {
        const query = filtros.q.toLowerCase();
        filteredMock = filteredMock.filter(c =>
          c.razao_social.toLowerCase().includes(query) ||
          c.nome_fantasia?.toLowerCase().includes(query) ||
          c.cnpj.includes(query)
        );
      }

      setClientes(filteredMock);
      setPagination({ count: filteredMock.length, next: null, previous: null });
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (usingMockData) {
      alert('Exportação não disponível em modo demonstração');
      return;
    }
    try {
      const params = Object.fromEntries(
        Object.entries(filtros).filter(([_, v]) => v !== '')
      );
      await clientesAPI.export(params);
    } catch (err) {
      alert('Erro ao exportar: ' + err.message);
    }
  };

  const handleFiltroChange = (field, value) => {
    setFiltros(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) return <Loading message="Carregando clientes..." />;

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
        subtitle={usingMockData ? "Modo Demonstracao" : `${pagination.count} registros`}
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
      {(pagination.previous || pagination.next) && !usingMockData && (
        <div className="pagination-buttons">
          <button
            className="btn-page"
            disabled={!pagination.previous}
            onClick={() => {/* TODO: implementar paginação */}}
          >
            Anterior
          </button>
          <button
            className="btn-page"
            disabled={!pagination.next}
            onClick={() => {/* TODO: implementar paginação */}}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

export default ClientesList;
