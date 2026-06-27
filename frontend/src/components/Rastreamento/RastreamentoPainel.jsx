import { useState, useEffect } from 'react';
import { veiculosAPI, gpsAPI } from '../../services/api';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import Button from '../Common/Button';
import PageHeader from '../Common/PageHeader';
import styles from './RastreamentoPainel.module.css';

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
    <div className={styles.page}>
      <PageHeader
        title="Rastreamento GPS"
        subtitle="Visualize a última posição dos veículos"
      />

      {error && <ErrorMessage message={error} onRetry={() => { setError(null); loadVeiculos(); }} />}

      <div className={styles.card}>
        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ flex: 2 }}>
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
          <div className={styles.formGroup} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button
              onClick={handleBuscarPosicao}
              loading={loadingPosicao}
              disabled={!veiculoSelecionado || loadingPosicao}
            >
              {loadingPosicao ? 'Buscando...' : 'Atualizar Posição'}
            </Button>
          </div>
        </div>

        {posicao && (
          <div className={styles.info}>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Placa</span>
                <span className={styles.infoValue}>{posicao.placa}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Latitude</span>
                <span className={styles.infoValue}>{posicao.latitude.toFixed(6)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Longitude</span>
                <span className={styles.infoValue}>{posicao.longitude.toFixed(6)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Velocidade</span>
                <span className={styles.infoValue}>{posicao.velocidade ? `${posicao.velocidade} km/h` : '-'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Data/Hora</span>
                <span className={styles.infoValue}>{new Date(posicao.data_hora).toLocaleString('pt-BR')}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Fonte</span>
                <span className={styles.infoValue}>{posicao.fonte === 'gps' ? 'GPS' : posicao.fonte}</span>
              </div>
            </div>

            {getMapUrl() && (
              <div className={styles.mapaContainer}>
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
          <div className={styles.emptyState}>
            <p>Nenhuma posição registrada para este veículo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RastreamentoPainel;
