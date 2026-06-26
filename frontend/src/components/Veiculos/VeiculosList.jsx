import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { veiculosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import { SkeletonTable, SkeletonMobileCards } from '../Common/Skeleton';
import EmptyState from '../Common/EmptyState';
import PageHeader from '../Common/PageHeader';
import './VeiculosList.css';

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

  if (loading) {
    return (
      <div className="veiculos-list">
        <PageHeader
          title="Veículos"
          subtitle="Carregando..."
          icon={veiculosIcon}
          breadcrumbs={[{ label: 'Cadastros' }, { label: 'Veículos' }]}
        />
        <div className="table-container desktop-only">
          <SkeletonTable rows={5} columns={9} />
        </div>
        <div className="mobile-only">
          <SkeletonMobileCards count={4} />
        </div>
      </div>
    );
  }

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
        Novo Veículo
      </button>
    </div>
  );

  // Lista normal
  return (
    <div className="veiculos-list">
      <PageHeader
        title="Veículos"
        subtitle={`${pagination.count} registros`}
        icon={veiculosIcon}
        breadcrumbs={[{ label: 'Cadastros' }, { label: 'Veículos' }]}
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

      {/* Tabela Desktop */}
      {veiculos.length > 0 ? (
        <>
          <div className="table-container desktop-only">
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
                    <td className="actions-cell">
                      <button
                        className="btn-action btn-edit"
                        onClick={() => navigate(`/veiculos/editar/${veiculo.id}`)}
                        title="Editar"
                        aria-label={`Editar veículo ${veiculo.placa}`}
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

          {/* Cards Mobile */}
          <div className="mobile-cards mobile-only">
            {veiculos.map((veiculo) => (
              <div key={veiculo.id} className="mobile-card" onClick={() => navigate(`/veiculos/editar/${veiculo.id}`)}>
                <div className="mobile-card-header">
                  <h4>{veiculo.placa}</h4>
                  <span className={`status ${veiculo.ativo ? 'ativo' : 'inativo'}`}>
                    {veiculo.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Tipo</span>
                    <span className={`badge badge-tipo-${veiculo.tipo_proprietario}`}>
                      {getTipoProprietario(veiculo.tipo_proprietario)}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">RENAVAM</span>
                    <span className="mobile-card-value">{veiculo.renavam || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Proprietário</span>
                    <span className="mobile-card-value">{veiculo.proprietario_nome || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Capacidade</span>
                    <span className="mobile-card-value">
                      {veiculo.capacidade_kg ? `${veiculo.capacidade_kg.toLocaleString()} kg` : '-'}
                      {' / '}
                      {veiculo.capacidade_m3 ? `${veiculo.capacidade_m3} m³` : '-'}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Compartimentos</span>
                    <span className="mobile-card-value">
                      {veiculo.compartimentos && veiculo.compartimentos.length > 0 ? (
                        <span className="badge badge-compartimentos">
                          {veiculo.compartimentos.length} boca{veiculo.compartimentos.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        '-'
                      )}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-footer">
                  <button
                    className="btn-action btn-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/veiculos/editar/${veiculo.id}`);
                    }}
                    aria-label={`Editar veículo ${veiculo.placa}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="Nenhum veículo encontrado"
          description="Não há veículos com os filtros selecionados."
          action={
            <button className="btn btn-primary" onClick={() => navigate('/veiculos/novo')}>
              Novo Veículo
            </button>
          }
        />
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

export default VeiculosList;
