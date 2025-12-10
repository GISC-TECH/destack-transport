import { useState, useEffect } from 'react';
import { backupAPI } from '../../services/api';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import './Backup.css';

// Mock data para backups (usa mesmos campos do backend: RegistroBackupSerializer)
const mockBackups = [
  {
    id: 1,
    nome_arquivo: 'backup_2024-12-01_10-30-00.sql',
    tamanho_bytes: 15900000,
    data_hora: '2024-12-01T10:30:00',
    status: 'completo',
    usuario: 'admin'
  },
  {
    id: 2,
    nome_arquivo: 'backup_2024-11-25_14-15-00.sql',
    tamanho_bytes: 14800000,
    data_hora: '2024-11-25T14:15:00',
    status: 'completo',
    usuario: 'admin'
  },
  {
    id: 3,
    nome_arquivo: 'backup_2024-11-20_09-00-00.sql',
    tamanho_bytes: 14500000,
    data_hora: '2024-11-20T09:00:00',
    status: 'completo',
    usuario: 'admin'
  }
];

// Formata bytes para tamanho legível
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      setLoading(true);
      const result = await backupAPI.list();
      // API já retorna array normalizado
      setBackups(Array.isArray(result) ? result : []);
      setUsingMockData(false);
    } catch (err) {
      console.error('Erro ao carregar backups:', err);
      setBackups(mockBackups);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGerarBackup = async () => {
    try {
      setGerando(true);
      setMessage(null);

      if (usingMockData) {
        // Simular geração
        await new Promise(resolve => setTimeout(resolve, 2000));
        const novoBackup = {
          id: Date.now(),
          nome_arquivo: `backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.sql`,
          tamanho_bytes: 15500000,
          data_hora: new Date().toISOString(),
          status: 'completo',
          usuario: 'admin'
        };
        setBackups([novoBackup, ...backups]);
        setMessage({ type: 'success', text: 'Backup gerado com sucesso!' });
      } else {
        const result = await backupAPI.gerar();
        setMessage({ type: 'success', text: result.message || 'Backup gerado com sucesso!' });

        // Se retornou blob, fazer download automaticamente
        if (result.blob) {
          const url = window.URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `backup_${new Date().toISOString().split('T')[0]}.sql`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }

        loadBackups();
      }
    } catch (err) {
      console.error('Erro ao gerar backup:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao gerar backup. Tente novamente.' });
    } finally {
      setGerando(false);
    }
  };

  const handleDownload = async (backup) => {
    try {
      if (usingMockData) {
        setMessage({ type: 'info', text: 'Download simulado em modo demonstração.' });
        return;
      }

      // Usa ID do backup para download
      const blob = await backupAPI.download(backup.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.nome_arquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar backup:', err);
      setMessage({ type: 'error', text: 'Erro ao baixar backup.' });
    }
  };

  const handleRestaurar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('ATENÇÃO: Restaurar um backup irá substituir todos os dados atuais. Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    try {
      setRestaurando(true);
      setMessage(null);

      if (usingMockData) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        setMessage({ type: 'success', text: 'Backup restaurado com sucesso (simulado)!' });
      } else {
        const result = await backupAPI.restaurar(file);
        setMessage({ type: 'success', text: result.message || 'Backup restaurado com sucesso!' });
        loadBackups();
      }
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      setMessage({ type: 'error', text: 'Erro ao restaurar backup. Verifique o arquivo.' });
    } finally {
      setRestaurando(false);
      e.target.value = '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) return <Loading message="Carregando backups..." />;

  const backupIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  );

  return (
    <div className="backup-page">
      <PageHeader
        title="Gerenciamento de Backup"
        subtitle={usingMockData ? "Crie e restaure backups do sistema (Modo Demonstração)" : "Crie e restaure backups do sistema"}
        icon={backupIcon}
        breadcrumbs={[{ label: 'Sistema' }, { label: 'Backup' }]}
      />

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button className="alert-close" onClick={() => setMessage(null)}>&times;</button>
        </div>
      )}

      {/* Ações */}
      <div className="backup-actions">
        <div className="action-card">
          <div className="action-icon gerar">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <h3>Gerar Backup</h3>
          <p>Criar um novo backup completo do banco de dados</p>
          <button
            className="btn-primary"
            onClick={handleGerarBackup}
            disabled={gerando}
          >
            {gerando ? (
              <>
                <span className="spinner"></span>
                Gerando...
              </>
            ) : (
              'Gerar Novo Backup'
            )}
          </button>
        </div>

        <div className="action-card">
          <div className="action-icon restaurar">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <h3>Restaurar Backup</h3>
          <p>Restaurar sistema a partir de um arquivo de backup</p>
          <label className={`btn-warning ${restaurando ? 'disabled' : ''}`}>
            {restaurando ? (
              <>
                <span className="spinner"></span>
                Restaurando...
              </>
            ) : (
              'Selecionar Arquivo'
            )}
            <input
              type="file"
              accept=".zip,.sql,.json"
              onChange={handleRestaurar}
              disabled={restaurando}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Lista de Backups */}
      <div className="backups-section">
        <h2>Backups Disponíveis</h2>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Tamanho</th>
                <th>Data de Criação</th>
                <th>Status</th>
                <th>Usuário</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center">
                    Nenhum backup encontrado
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <strong>{backup.nome_arquivo}</strong>
                    </td>
                    <td>{formatBytes(backup.tamanho_bytes)}</td>
                    <td>{formatDate(backup.data_hora)}</td>
                    <td>
                      <span className={`badge badge-${backup.status === 'completo' ? 'success' : backup.status === 'erro' ? 'danger' : 'warning'}`}>
                        {backup.status || 'Completo'}
                      </span>
                    </td>
                    <td>{backup.usuario || '-'}</td>
                    <td>
                      <button
                        className="btn-action btn-download"
                        onClick={() => handleDownload(backup)}
                        title="Baixar backup"
                        disabled={backup.status === 'erro'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Baixar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Informações */}
      <div className="backup-info">
        <h3>Informações Importantes</h3>
        <ul>
          <li>Os backups são armazenados em formato compactado (ZIP)</li>
          <li>Recomenda-se fazer backup regularmente antes de atualizações</li>
          <li>Ao restaurar um backup, todos os dados atuais serão substituídos</li>
          <li>Mantenha cópias dos backups em local seguro fora do servidor</li>
        </ul>
      </div>
    </div>
  );
}

export default BackupManager;
