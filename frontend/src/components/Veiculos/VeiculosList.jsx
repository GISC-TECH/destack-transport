import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { veiculosAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import './VeiculosList.css';

function VeiculosList() {
  const navigate = useNavigate();
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
      setError('Erro ao carregar veículos. Tente novamente.');
      setVeiculos([]);
      setPagination({ count: 0, next: null, previous: null });
    } finally {
      setLoading(false);
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
  };

  const handleExport = async () => {
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
      <button className="btn btn-outline" onClick={handleExport}>
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
        subtitle={`${pagination.count} registros`}
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
