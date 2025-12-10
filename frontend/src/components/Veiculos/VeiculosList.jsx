import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { veiculosAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './VeiculosList.css';

// Mock data para exibição quando API não está disponível
const mockVeiculos = [
  {
    id: 1,
    placa: 'ABC-1234',
    renavam: '12345678901',
    tipo_proprietario: '00',
    proprietario_nome: 'Transportadora Alpha LTDA',
    capacidade_kg: 25000,
    capacidade_m3: 45,
    compartimentos: [
      { numero: 1, capacidade_litros: 15000 },
      { numero: 2, capacidade_litros: 15000 },
      { numero: 3, capacidade_litros: 15000 }
    ],
    ativo: true,
    documentos_vencendo: []
  },
  {
    id: 2,
    placa: 'DEF-5678',
    renavam: '98765432109',
    tipo_proprietario: '02',
    proprietario_nome: 'João da Silva - Agregado',
    capacidade_kg: 18000,
    capacidade_m3: 32,
    compartimentos: [
      { numero: 1, capacidade_litros: 12000 },
      { numero: 2, capacidade_litros: 12000 }
    ],
    ativo: true,
    documentos_vencendo: [
      { documento: 'CRLV', validade: '2024-12-15', vencido: false, dias_restantes: 20 }
    ]
  },
  {
    id: 3,
    placa: 'GHI-9012',
    renavam: '55566677788',
    tipo_proprietario: '00',
    proprietario_nome: 'Transportadora Alpha LTDA',
    capacidade_kg: 30000,
    capacidade_m3: 55,
    compartimentos: [
      { numero: 1, capacidade_litros: 18000 },
      { numero: 2, capacidade_litros: 18000 },
      { numero: 3, capacidade_litros: 18000 }
    ],
    ativo: true,
    documentos_vencendo: []
  },
  {
    id: 4,
    placa: 'JKL-3456',
    renavam: '11122233344',
    tipo_proprietario: '01',
    proprietario_nome: 'Locadora Beta S.A.',
    capacidade_kg: 22000,
    capacidade_m3: 40,
    compartimentos: [],
    ativo: false,
    documentos_vencendo: []
  },
  {
    id: 5,
    placa: 'MNO-7890',
    renavam: '77788899900',
    tipo_proprietario: '02',
    proprietario_nome: 'Carlos Pereira - Agregado',
    capacidade_kg: 20000,
    capacidade_m3: 38,
    compartimentos: [
      { numero: 1, capacidade_litros: 14000 },
      { numero: 2, capacidade_litros: 14000 }
    ],
    ativo: true,
    documentos_vencendo: [
      { documento: 'Seguro', validade: '2024-12-01', vencido: false, dias_restantes: 5 }
    ]
  },
  {
    id: 6,
    placa: 'PQR-1234',
    renavam: '33344455566',
    tipo_proprietario: '00',
    proprietario_nome: 'Transportadora Alpha LTDA',
    capacidade_kg: 28000,
    capacidade_m3: 50,
    compartimentos: [
      { numero: 1, capacidade_litros: 16000 },
      { numero: 2, capacidade_litros: 16000 },
      { numero: 3, capacidade_litros: 16000 }
    ],
    ativo: true,
    documentos_vencendo: []
  }
];

function VeiculosList() {
  const navigate = useNavigate();
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
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

  useEffect(() => {
    loadVeiculos();
  }, [filtros]);

  const loadVeiculos = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = Object.fromEntries(
        Object.entries(filtros).filter(([_, v]) => v !== '')
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
      setUsingMockData(false);
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
      // Usar dados mock quando API falhar
      let filteredMock = [...mockVeiculos];

      if (filtros.ativo !== '') {
        filteredMock = filteredMock.filter(v =>
          filtros.ativo === 'true' ? v.ativo : !v.ativo
        );
      }
      if (filtros.tipo_proprietario) {
        filteredMock = filteredMock.filter(v => v.tipo_proprietario === filtros.tipo_proprietario);
      }
      if (filtros.placa) {
        filteredMock = filteredMock.filter(v =>
          v.placa.toLowerCase().includes(filtros.placa.toLowerCase())
        );
      }

      setVeiculos(filteredMock);
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
        const mockVencimentos = mockVeiculos.filter(v =>
          v.documentos_vencendo && v.documentos_vencendo.length > 0
        );
        setVencimentos(mockVencimentos);
        setShowAlerts(true);
      } else {
        const data = await veiculosAPI.vencimentos(30);
        setVencimentos(data.results || data);
        setShowAlerts(true);
      }
    } catch (err) {
      // Fallback para mock
      const mockVencimentos = mockVeiculos.filter(v =>
        v.documentos_vencendo && v.documentos_vencendo.length > 0
      );
      setVencimentos(mockVencimentos);
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
      await veiculosAPI.export(params);
    } catch (err) {
      alert('Erro ao exportar: ' + err.message);
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

  if (loading) return <Loading message="Carregando veículos..." />;

  // Se mostrando alertas
  if (showAlerts) {
    return (
      <div className="veiculos-list">
        <div className="veiculos-header">
          <h2>Alertas de Vencimento - Documentos de Veículos (30 dias)</h2>
          <button className="btn-secondary" onClick={() => setShowAlerts(false)}>
            Voltar para Lista
          </button>
        </div>

        {vencimentos.length > 0 ? (
          <div className="alertas-container">
            {vencimentos.map((veiculo) => (
              <div key={veiculo.id} className="alerta-card">
                <h3>{veiculo.placa}</h3>
                <p><strong>Proprietário:</strong> {veiculo.proprietario_nome || '-'}</p>
                <p><strong>Tipo:</strong> {getTipoProprietario(veiculo.tipo_proprietario)}</p>

                <div className="documentos-vencendo">
                  <h4>Documentos:</h4>
                  {veiculo.documentos_vencendo?.map((doc, idx) => (
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

  const veiculosIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="3" width="15" height="13"></rect>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
      <circle cx="5.5" cy="18.5" r="2.5"></circle>
      <circle cx="18.5" cy="18.5" r="2.5"></circle>
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
      <button className="btn btn-outline" onClick={handleExport} disabled={usingMockData}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Exportar
      </button>
      <button className="btn btn-primary" onClick={() => navigate('/veiculos/novo')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Novo Veiculo
      </button>
    </div>
  );

  // Lista normal
  return (
    <div className="veiculos-list">
      <PageHeader
        title="Veiculos"
        subtitle={usingMockData ? "Modo Demonstracao" : `${pagination.count} registros`}
        icon={veiculosIcon}
        breadcrumbs={[{ label: 'Cadastros' }, { label: 'Veiculos' }]}
        actions={headerActions}
      />

      {/* Filtros */}
      <div className="filtros-container">
        <input
          type="text"
          className="input-filter"
          placeholder="Buscar por placa..."
          value={filtros.placa}
          onChange={(e) => handleFiltroChange('placa', e.target.value.toUpperCase())}
        />

        <select
          className="select-filter"
          value={filtros.tipo_proprietario}
          onChange={(e) => handleFiltroChange('tipo_proprietario', e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="00">Próprio</option>
          <option value="01">Arrendado</option>
          <option value="02">Agregado</option>
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
      </div>

      {/* Tabela */}
      {veiculos.length > 0 ? (
        <div className="table-container">
          <table className="veiculos-table">
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
                  <td><strong>{veiculo.placa}</strong></td>
                  <td>{veiculo.renavam || '-'}</td>
                  <td>
                    <span className={`badge badge-tipo-${veiculo.tipo_proprietario}`}>
                      {getTipoProprietario(veiculo.tipo_proprietario)}
                    </span>
                  </td>
                  <td>{veiculo.proprietario_nome || '-'}</td>
                  <td>{veiculo.capacidade_kg ? `${veiculo.capacidade_kg.toLocaleString()} kg` : '-'}</td>
                  <td>{veiculo.capacidade_m3 ? `${veiculo.capacidade_m3} m3` : '-'}</td>
                  <td>
                    {veiculo.compartimentos && veiculo.compartimentos.length > 0 ? (
                      <span className="badge badge-compartimentos">
                        {veiculo.compartimentos.length} boca{veiculo.compartimentos.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <span className={`status ${veiculo.ativo ? 'ativo' : 'inativo'}`}>
                      {veiculo.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-action"
                      onClick={() => navigate(`/veiculos/editar/${veiculo.id}`)}
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
          <p>Nenhum veículo encontrado com os filtros selecionados.</p>
        </div>
      )}
    </div>
  );
}

export default VeiculosList;
