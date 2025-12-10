import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motoristasAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './MotoristasList.css';

// Mock data para exibição quando API não está disponível
const mockMotoristas = [
  {
    id: 1,
    nome: 'José Carlos Silva',
    cpf: '12345678901',
    cpf_formatado: '123.456.789-01',
    cnh: 'ABC1234567890',
    categoria_cnh: 'E',
    cnh_validade: '2025-08-15',
    ativo: true,
    documentos_vencendo: []
  },
  {
    id: 2,
    nome: 'Marcos Antônio Oliveira',
    cpf: '98765432109',
    cpf_formatado: '987.654.321-09',
    cnh: 'DEF9876543210',
    categoria_cnh: 'D',
    cnh_validade: '2024-12-20',
    ativo: true,
    documentos_vencendo: [
      { documento: 'CNH', validade: '2024-12-20', vencido: false, dias_restantes: 25 }
    ]
  },
  {
    id: 3,
    nome: 'Pedro Henrique Santos',
    cpf: '55566677788',
    cpf_formatado: '555.666.777-88',
    cnh: 'GHI5556667778',
    categoria_cnh: 'E',
    cnh_validade: '2026-03-10',
    ativo: true,
    documentos_vencendo: []
  },
  {
    id: 4,
    nome: 'Roberto Mendes',
    cpf: '11122233344',
    cpf_formatado: '111.222.333-44',
    cnh: 'JKL1112223334',
    categoria_cnh: 'C',
    cnh_validade: '2024-11-05',
    ativo: false,
    documentos_vencendo: []
  },
  {
    id: 5,
    nome: 'Fernando Costa Lima',
    cpf: '77788899900',
    cpf_formatado: '777.888.999-00',
    cnh: 'MNO7778889990',
    categoria_cnh: 'E',
    cnh_validade: '2025-06-30',
    ativo: true,
    documentos_vencendo: []
  },
  {
    id: 6,
    nome: 'Ricardo Alves',
    cpf: '33344455566',
    cpf_formatado: '333.444.555-66',
    cnh: 'PQR3334445556',
    categoria_cnh: 'D',
    cnh_validade: '2024-12-01',
    ativo: true,
    documentos_vencendo: [
      { documento: 'CNH', validade: '2024-12-01', vencido: false, dias_restantes: 5 }
    ]
  }
];

function MotoristasList() {
  const navigate = useNavigate();
  const [motoristas, setMotoristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [filtros, setFiltros] = useState({
    ativo: 'true',
    categoria_cnh: '',
    q: ''
  });
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null
  });
  const [showAlerts, setShowAlerts] = useState(false);
  const [vencimentos, setVencimentos] = useState([]);

  useEffect(() => {
    loadMotoristas();
  }, [filtros]);

  const loadMotoristas = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = Object.fromEntries(
        Object.entries(filtros).filter(([_, v]) => v !== '')
      );

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
      setUsingMockData(false);
    } catch (err) {
      console.error('Erro ao carregar motoristas:', err);
      // Usar dados mock quando API falhar
      let filteredMock = [...mockMotoristas];

      if (filtros.ativo !== '') {
        filteredMock = filteredMock.filter(m =>
          filtros.ativo === 'true' ? m.ativo : !m.ativo
        );
      }
      if (filtros.categoria_cnh) {
        filteredMock = filteredMock.filter(m => m.categoria_cnh === filtros.categoria_cnh);
      }
      if (filtros.q) {
        const query = filtros.q.toLowerCase();
        filteredMock = filteredMock.filter(m =>
          m.nome.toLowerCase().includes(query) ||
          m.cpf.includes(query) ||
          m.cnh.toLowerCase().includes(query)
        );
      }

      setMotoristas(filteredMock);
      setPagination({ count: filteredMock.length, next: null, previous: null });
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const loadVencimentos = async () => {
    try {
      setLoading(true);

      if (usingMockData) {
        // Usar mock data para vencimentos
        const mockVencimentos = mockMotoristas.filter(m =>
          m.documentos_vencendo && m.documentos_vencendo.length > 0
        );
        setVencimentos(mockVencimentos);
        setShowAlerts(true);
      } else {
        const data = await motoristasAPI.vencimentos(30);
        setVencimentos(data.results || data);
        setShowAlerts(true);
      }
    } catch (err) {
      // Fallback para mock
      const mockVencimentos = mockMotoristas.filter(m =>
        m.documentos_vencendo && m.documentos_vencendo.length > 0
      );
      setVencimentos(mockVencimentos);
      setShowAlerts(true);
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
      await motoristasAPI.export(params);
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

  if (loading) return <Loading message="Carregando motoristas..." />;

  // Se mostrando alertas
  if (showAlerts) {
    return (
      <div className="motoristas-list">
        <div className="motoristas-header">
          <h2>Alertas de Vencimento (30 dias)</h2>
          <button className="btn-secondary" onClick={() => setShowAlerts(false)}>
            Voltar para Lista
          </button>
        </div>

        {vencimentos.length > 0 ? (
          <div className="alertas-container">
            {vencimentos.map((motorista) => (
              <div key={motorista.id} className="alerta-card">
                <h3>{motorista.nome}</h3>
                <p><strong>CPF:</strong> {motorista.cpf_formatado || motorista.cpf}</p>
                <p><strong>CNH:</strong> {motorista.cnh}</p>

                <div className="documentos-vencendo">
                  <h4>Documentos:</h4>
                  {motorista.documentos_vencendo?.map((doc, idx) => (
                    <div
                      key={idx}
                      className={`doc-item ${doc.vencido ? 'vencido' : 'vencendo'}`}
                    >
                      <span className="doc-nome">{doc.documento}</span>
                      <span className="doc-validade">{doc.validade}</span>
                      <span className="doc-dias">
                        {doc.vencido ? 'VENCIDO' : `${doc.dias_restantes} dias`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state success">
            <p>Nenhum documento vencendo nos próximos 30 dias!</p>
          </div>
        )}
      </div>
    );
  }

  const motoristasIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  const headerActions = (
    <div className="header-buttons">
      <button className="btn btn-warning" onClick={loadVencimentos}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Vencimentos
      </button>
      <button className="btn btn-primary" onClick={() => navigate('/motoristas/novo')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Novo Motorista
      </button>
    </div>
  );

  // Lista normal
  return (
    <div className="motoristas-list">
      <PageHeader
        title="Motoristas"
        subtitle={usingMockData ? "Modo Demonstracao" : `${pagination.count} registros`}
        icon={motoristasIcon}
        breadcrumbs={[{ label: 'Cadastros' }, { label: 'Motoristas' }]}
        actions={headerActions}
      />

      {/* Filtros */}
      <div className="filtros-container">
        <input
          type="text"
          className="input-filter"
          placeholder="Buscar por nome, CPF ou CNH..."
          value={filtros.q}
          onChange={(e) => handleFiltroChange('q', e.target.value)}
        />

        <select
          className="select-filter"
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
          Exportar
        </button>
      </div>

      {/* Tabela */}
      {motoristas.length > 0 ? (
        <div className="table-container">
          <table className="motoristas-table">
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
                  <td>{motorista.nome}</td>
                  <td>{motorista.cpf_formatado || motorista.cpf}</td>
                  <td>{motorista.cnh}</td>
                  <td>
                    <span className="badge badge-categoria">{motorista.categoria_cnh}</span>
                  </td>
                  <td>{motorista.cnh_validade || '-'}</td>
                  <td>
                    <span className={`status ${motorista.ativo ? 'ativo' : 'inativo'}`}>
                      {motorista.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-action"
                      onClick={() => navigate(`/motoristas/editar/${motorista.id}`)}
                      title="Editar"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>Nenhum motorista encontrado com os filtros selecionados.</p>
        </div>
      )}
    </div>
  );
}

export default MotoristasList;
