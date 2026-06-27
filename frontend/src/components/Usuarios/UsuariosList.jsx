import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usuariosAPI } from '../../services/api';
import { useToast } from '../Common/Toast';
import Loading from '../Common/Loading';
import ErrorMessage from '../Common/ErrorMessage';
import PageHeader from '../Common/PageHeader';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import StatusPill from '../Common/StatusPill';
import styles from './UsuariosList.module.css';

function UsuariosList() {
  const toast = useToast();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await usuariosAPI.list();
      setUsuarios(result.results || result || []);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      setError('Erro ao carregar usuários. Tente novamente.');
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!usuarioToDelete) return;

    try {
      setDeleting(true);
      await usuariosAPI.delete(usuarioToDelete.id);
      setUsuarios(usuarios.filter(u => u.id !== usuarioToDelete.id));
      setShowDeleteModal(false);
      setUsuarioToDelete(null);
    } catch (err) {
      toast.error('Erro ao excluir usuário: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (usuario) => {
    try {
      await usuariosAPI.patch(usuario.id, { is_active: !usuario.is_active });
      setUsuarios(usuarios.map(u =>
        u.id === usuario.id ? { ...u, is_active: !u.is_active } : u
      ));
    } catch (err) {
      toast.error('Erro ao alterar status: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusPill = (usuario) => (
    <StatusPill status={usuario.is_active ? 'ativo' : 'inativo'}>
      {usuario.is_active ? 'Ativo' : 'Inativo'}
    </StatusPill>
  );

  const getTipoPill = (usuario) => {
    if (usuario.is_superuser) {
      return <StatusPill status="warning">Super Admin</StatusPill>;
    }
    if (usuario.is_staff) {
      return <StatusPill status="info">Administrador</StatusPill>;
    }
    return <StatusPill status="muted">Operador</StatusPill>;
  };

  // Filtrar usuarios
  const usuariosFiltrados = usuarios.filter(usuario => {
    const matchSearch =
      usuario.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (usuario.first_name + ' ' + usuario.last_name).toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = !filtroStatus ||
      (filtroStatus === 'ativo' && usuario.is_active) ||
      (filtroStatus === 'inativo' && !usuario.is_active);

    const matchTipo = !filtroTipo ||
      (filtroTipo === 'superuser' && usuario.is_superuser) ||
      (filtroTipo === 'staff' && usuario.is_staff && !usuario.is_superuser) ||
      (filtroTipo === 'operador' && !usuario.is_staff && !usuario.is_superuser);

    return matchSearch && matchStatus && matchTipo;
  });

  // Contagens
  const contagens = {
    total: usuarios.length,
    ativos: usuarios.filter(u => u.is_active).length,
    inativos: usuarios.filter(u => !u.is_active).length,
    admins: usuarios.filter(u => u.is_staff || u.is_superuser).length
  };

  if (loading) return <Loading message="Carregando usuários..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadUsuarios} />;

  const usuarioIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Gerenciamento de Usuários"
        subtitle="Controle de acesso ao sistema"
        icon={usuarioIcon}
        breadcrumbs={[{ label: 'Sistema' }, { label: 'Usuários' }]}
        actions={
          <Button onClick={() => navigate('/usuarios/novo')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            Novo Usuário
          </Button>
        }
      />

      {/* Cards de resumo */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.total}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.total}</span>
            <span className={styles.summaryLabel}>Total</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.ativos}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.ativos}</span>
            <span className={styles.summaryLabel}>Ativos</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.inativos}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.inativos}</span>
            <span className={styles.summaryLabel}>Inativos</span>
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.admins}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryNumber}>{contagens.admins}</span>
            <span className={styles.summaryLabel}>Administradores</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className={styles.filtrosSection}>
        <div className={styles.filtrosRow}>
          <div className={styles.searchBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome, usuário ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className={styles.selectFilter}
          >
            <option value="">Todos os Status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className={styles.selectFilter}
          >
            <option value="">Todos os Tipos</option>
            <option value="superuser">Super Admin</option>
            <option value="staff">Administrador</option>
            <option value="operador">Operador</option>
          </select>
        </div>
      </div>

      {/* Resultados */}
      <div className={styles.resultsInfo}>
        <p>Exibindo {usuariosFiltrados.length} de {usuarios.length} usuários</p>
      </div>

      {/* Lista de usuários */}
      <div className={styles.grid}>
        {usuariosFiltrados.length === 0 ? (
          <div className={styles.emptyState}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="17" y1="11" x2="23" y2="11"></line>
            </svg>
            <h3>Nenhum usuário encontrado</h3>
            <p>Ajuste os filtros ou adicione um novo usuário.</p>
          </div>
        ) : (
          usuariosFiltrados.map((usuario) => (
            <div key={usuario.id} className={`${styles.card} ${!usuario.is_active ? styles.inativo : ''}`}>
              <div className={styles.cardHeader}>
                <div className={styles.avatar}>
                  {(usuario.first_name?.charAt(0) || usuario.username.charAt(0)).toUpperCase()}
                  {(usuario.last_name?.charAt(0) || '').toUpperCase()}
                </div>
                <div className={styles.info}>
                  <h3>{usuario.first_name} {usuario.last_name}</h3>
                  <span className={styles.username}>@{usuario.username}</span>
                </div>
                <div className={styles.badges}>
                  {getStatusPill(usuario)}
                  {getTipoPill(usuario)}
                </div>
              </div>

              <div className={styles.details}>
                <div className={styles.detailItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <span>{usuario.email}</span>
                </div>
                <div className={styles.detailItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <span>Criado em: {formatDate(usuario.date_joined)}</span>
                </div>
                <div className={styles.detailItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>Último acesso: {formatDate(usuario.last_login)}</span>
                </div>
              </div>

              <div className={styles.actions}>
                <Button
                  variant={usuario.is_active ? 'danger' : 'success'}
                  size="sm"
                  onClick={() => handleToggleStatus(usuario)}
                  title={usuario.is_active ? 'Desativar usuário' : 'Ativar usuário'}
                >
                  {usuario.is_active ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                      </svg>
                      Desativar
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      Ativar
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/usuarios/editar/${usuario.id}`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Editar
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setUsuarioToDelete(usuario);
                    setShowDeleteModal(true);
                  }}
                  disabled={usuario.is_superuser}
                  title={usuario.is_superuser ? 'Super Admin não pode ser excluído' : 'Excluir usuário'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Excluir
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmar Exclusão"
        size="sm"
        footer={
          <div className={styles.modalActions}>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Excluir Usuário'}
            </Button>
          </div>
        }
      >
        <div className={styles.modalWarning}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <p className={styles.modalText}>
          Tem certeza que deseja excluir o usuário <strong>@{usuarioToDelete?.username}</strong>?
        </p>
        <p className={styles.modalWarningText}>Esta ação não pode ser desfeita.</p>
      </Modal>
    </div>
  );
}

export default UsuariosList;
