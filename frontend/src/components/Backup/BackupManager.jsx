import { useState, useEffect } from 'react';
import { backupAPI } from '../../services/api';
import Loading from '../Common/Loading';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import StatusPill from '../Common/StatusPill';
import TableContainer from '../Common/TableContainer';
import styles from './Backup.module.css';

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
    } catch (err) {
      console.error('Erro ao carregar backups:', err);
      setBackups([]);
      setMessage({ type: 'error', text: err.message || 'Não foi possível carregar os backups.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGerarBackup = async () => {
    try {
      setGerando(true);
      setMessage(null);

      const result = await backupAPI.gerar();
      setMessage({ type: 'success', text: result.message || 'Backup gerado com sucesso!' });
      await loadBackups();

      if (result.backup?.id) {
        const a = document.createElement('a');
        a.href = backupAPI.downloadUrl(result.backup.id);
        a.download = result.backup.nome_arquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Erro ao gerar backup:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao gerar backup. Tente novamente.' });
    } finally {
      setGerando(false);
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

      const result = await backupAPI.restaurar(file);
      setMessage({ type: 'success', text: result.message || 'Arquivo de backup validado com sucesso!' });
      loadBackups();
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
    <div className={styles.page}>
      <PageHeader
        title="Gerenciamento de Backup"
        subtitle="Crie e baixe cópias de segurança do sistema"
        icon={backupIcon}
        breadcrumbs={[{ label: 'Sistema' }, { label: 'Backup' }]}
      />

      {message && (
        <div className={`${styles.alert} ${styles[`alert${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]}`}>
          {message.text}
          <button className={styles.alertClose} onClick={() => setMessage(null)}>&times;</button>
        </div>
      )}

      {/* Ações */}
      <div className={styles.actions}>
        <div className={styles.actionCard}>
          <div className={`${styles.actionIcon} ${styles.actionGerar}`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <h3>Gerar Backup</h3>
          <p>Criar um novo backup completo do banco de dados</p>
          <Button
            onClick={handleGerarBackup}
            loading={gerando}
            disabled={gerando}
          >
            Gerar Novo Backup
          </Button>
        </div>

        <div className={styles.actionCard}>
          <div className={`${styles.actionIcon} ${styles.actionRestaurar}`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <h3>Validar Backup</h3>
          <p>Enviar um arquivo SQL para validação antes da restauração manual</p>
          <label className={styles.downloadButton} style={{ cursor: restaurando ? 'not-allowed' : 'pointer', opacity: restaurando ? 0.6 : 1 }}>
            {restaurando ? 'Restaurando...' : 'Selecionar Arquivo'}
            <input
              type="file"
              className={styles.fileInputHidden}
              accept=".sql"
              onChange={handleRestaurar}
              disabled={restaurando}
            />
          </label>
        </div>
      </div>

      {/* Lista de Backups */}
      <div className={styles.section}>
        <h2>Backups Disponíveis</h2>
        <div className={styles.tableContainer}>
          <TableContainer>
            <table className={styles.table}>
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
                    <td colSpan="6" className={styles.textCenter}>
                      Nenhum backup encontrado
                    </td>
                  </tr>
                ) : (
                  backups.map((backup) => (
                    <tr key={backup.id}>
                      <td data-label="Arquivo">
                        <strong>{backup.nome_arquivo}</strong>
                      </td>
                      <td data-label="Tamanho">{formatBytes(backup.tamanho_bytes)}</td>
                      <td data-label="Data de Criação">{formatDate(backup.data_hora)}</td>
                      <td data-label="Status">
                        <StatusPill status={backup.status === 'completo' ? 'success' : backup.status === 'erro' ? 'danger' : 'warning'}>
                          {backup.status || 'Completo'}
                        </StatusPill>
                      </td>
                      <td data-label="Usuário">{backup.usuario || '-'}</td>
                      <td>
                        <a
                          className={`${styles.downloadButton} ${backup.disponivel === false ? styles.downloadDisabled : ''}`}
                          href={backup.disponivel === false ? undefined : backupAPI.downloadUrl(backup.id)}
                          download={backup.nome_arquivo}
                          title={backup.disponivel === false ? 'Arquivo não está mais disponível no servidor' : 'Baixar backup'}
                          aria-disabled={backup.disponivel === false}
                          onClick={backup.disponivel === false ? (event) => event.preventDefault() : undefined}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          {backup.disponivel === false ? 'Indisponível' : 'Baixar'}
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableContainer>
        </div>
      </div>

      {/* Informações */}
      <div className={styles.info}>
        <h3>Informações Importantes</h3>
        <ul>
          <li>Os backups manuais são armazenados em formato SQL</li>
          <li>Recomenda-se fazer backup regularmente antes de atualizações</li>
          <li>A restauração é executada manualmente por um administrador após validação</li>
          <li>Mantenha cópias dos backups em local seguro fora do servidor</li>
        </ul>
      </div>
    </div>
  );
}

export default BackupManager;
