import { useState, useEffect } from 'react';
import { veiculosAPI, gpsAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import './RastreamentoPainel.css';

function RastreamentoPainel() {
  const [veiculos, setVeiculos] = useState([]);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState('');
  const [posicao, setPosicao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPosicao, setLoadingPosicao] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadVeiculos();
  }, []);

  const loadVeiculos = async () => {
    try {
      const result = await veiculosAPI.list({ ativo: true });
      setVeiculos(result.results || result);
    } catch (err) {
      setError('Erro ao carregar veículos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarPosicao = async () => {
    if (!veiculoSelecionado) return;
    try {
      setLoadingPosicao(true);
      const result = await gpsAPI.ultimaPosicaoVeiculo(veiculoSelecionado);
      setPosicao(result);
    } catch (err) {
      setPosicao(null);
      setError('Erro ao buscar posição: ' + err.message);
    } finally {
      setLoadingPosicao(false);
    }
  };

  useEffect(() => {
    if (veiculoSelecionado) {
      handleBuscarPosicao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculoSelecionado]);

  const getMapUrl = () => {
    if (!posicao) return null;
    const { latitude, longitude } = posicao;
    const bbox = `${longitude - 0.05}%2C${latitude - 0.05}%2C${longitude + 0.05}%2C${latitude + 0.05}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  };

  if (loading) return <Loading message="Carregando veículos..." />;

  return (
    <div className="rastreamento-page">
      <div className="page-header">
        <div className="header-title">
          <h1>Rastreamento GPS</h1>
          <p>Visualize a última posição dos veículos</p>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => { setError(null); loadVeiculos(); }} />}

      <div className="rastreamento-card">
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>Veículo</label>
            <select
              value={veiculoSelecionado}
              onChange={(e) => setVeiculoSelecionado(e.target.value)}
            >
              <option value="">Selecione um veículo</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>
                  {v.placa} {v.gps_identificador ? `(GPS: ${v.gps_identificador})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn-primary"
              onClick={handleBuscarPosicao}
              disabled={!veiculoSelecionado || loadingPosicao}
            >
              {loadingPosicao ? 'Buscando...' : 'Atualizar Posição'}
            </button>
          </div>
        </div>

        {posicao && (
          <div className="rastreamento-info">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Placa</span>
                <span className="info-value">{posicao.placa}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Latitude</span>
                <span className="info-value">{posicao.latitude.toFixed(6)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Longitude</span>
                <span className="info-value">{posicao.longitude.toFixed(6)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Velocidade</span>
                <span className="info-value">{posicao.velocidade ? `${posicao.velocidade} km/h` : '-'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Data/Hora</span>
                <span className="info-value">{new Date(posicao.data_hora).toLocaleString('pt-BR')}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Fonte</span>
                <span className="info-value">{posicao.fonte === 'gps' ? 'GPS' : posicao.fonte}</span>
              </div>
            </div>

            {getMapUrl() && (
              <div className="mapa-container">
                <iframe
                  title="Mapa de rastreamento"
                  width="100%"
                  height="400"
                  frameBorder="0"
                  scrolling="no"
                  src={getMapUrl()}
                  style={{ border: 0 }}
                />
              </div>
            )}
          </div>
        )}

        {veiculoSelecionado && !posicao && !loadingPosicao && (
          <div className="empty-state">
            <p>Nenhuma posição registrada para este veículo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RastreamentoPainel;
