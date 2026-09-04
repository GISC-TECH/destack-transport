import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { perfisAPI, usuariosAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../Common/Toast';
import Button from '../Common/Button';
import ErrorMessage from '../Common/ErrorMessage';
import Loading from '../Common/Loading';
import Modal from '../Common/Modal';
import PageHeader from '../Common/PageHeader';
import StatusPill from '../Common/StatusPill';
import AccessAudit from './AccessAudit';
import PermissionDiffModal from './PermissionDiffModal';
import PermissionModule from './PermissionModule';
import { normalizeAccess, normalizeProfiles, profileCapabilities } from './accessControl';
import styles from './UsuarioAcessos.module.css';

const MODE_PROFILE = 'perfil';
const MODE_CUSTOM = 'personalizado';

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  return [...left].every((key) => right.has(key));
}

function UsuarioAcessos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const { canCapability } = usePermission();
  const [targetUser, setTargetUser] = useState(null);
  const [modules, setModules] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [initialSelected, setInitialSelected] = useState(new Set());
  const [selected, setSelected] = useState(new Set());
  const [initialMode, setInitialMode] = useState(MODE_PROFILE);
  const [mode, setMode] = useState(MODE_PROFILE);
  const [initialProfile, setInitialProfile] = useState('');
  const [profile, setProfile] = useState('');
  const [version, setVersion] = useState(null);
  const [protections, setProtections] = useState({
    canManageAccess: true,
    canChangeStatus: true,
    canDelete: true,
    reason: '',
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState('');
  const [passwordReset, setPasswordReset] = useState({
    password: '',
    passwordConfirm: '',
    reason: '',
  });

  const loadAudit = useCallback(async () => {
    try {
      setAuditLoading(true);
      const response = await usuariosAPI.getAccessAudit(id, { limit: 20 });
      setAuditEntries(response.results || response.auditoria || response || []);
    } catch {
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  }, [id]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [access, catalog, profilesResponse] = await Promise.all([
        usuariosAPI.getAccess(id),
        usuariosAPI.getAccessCatalog(),
        perfisAPI.list(),
      ]);
      const normalizedModules = normalizeAccess(catalog, access);
      const enabled = new Set(
        access.enabled_capabilities
        || access.capabilities?.filter((item) => item.enabled).map((item) => item.key)
        || []
      );
      const nextMode = access.access_mode || access.modo || MODE_PROFILE;
      const nextProfile = access.profile || access.perfil || '';

      setTargetUser(access.user || access.usuario);
      setModules(normalizedModules);
      setProfiles(normalizeProfiles(catalog, profilesResponse.perfis || profilesResponse));
      setInitialSelected(enabled);
      setSelected(new Set(enabled));
      setInitialMode(nextMode);
      setMode(nextMode);
      setInitialProfile(nextProfile);
      setProfile(nextProfile);
      setVersion(access.version ?? access.versao);
      setProtections({
        canManageAccess: (access.can_manage_access ?? access.user?.can_manage_access) !== false,
        canChangeStatus: (access.can_change_status ?? access.user?.can_change_status) !== false,
        canDelete: (access.can_delete ?? access.user?.can_delete) !== false,
        reason: access.protection_reason
          || access.user?.protection_reason
          || access.motivo_protecao
          || '',
      });
    } catch (err) {
      setError(err.message || 'Erro ao carregar os acessos do usuário.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
    loadAudit();
  }, [loadData, loadAudit]);

  const allCapabilities = useMemo(
    () => Object.values(modules).flatMap((module) => module.capabilities),
    [modules]
  );
  const capabilityMap = useMemo(
    () => new Map(allCapabilities.map((capability) => [capability.key, capability])),
    [allCapabilities]
  );
  const isOwnAccount = Number(currentUser?.id) === Number(targetUser?.id);
  const protectedTarget = isOwnAccount || targetUser?.is_superuser || !protections.canManageAccess;
  const statusProtected = isOwnAccount || targetUser?.is_superuser || !protections.canChangeStatus;
  const canResetPassword = canCapability('usuarios.manage_access')
    && !isOwnAccount
    && !targetUser?.is_superuser
    && protections.canManageAccess;
  const dirty = mode !== initialMode
    || profile !== initialProfile
    || !sameSet(selected, initialSelected);

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const filteredModules = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedSearch) return Object.values(modules);
    return Object.values(modules).map((module) => ({
      ...module,
      capabilities: module.capabilities.filter((capability) => (
        module.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
        || capability.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
        || capability.description.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
      )),
    })).filter((module) => module.capabilities.length > 0);
  }, [modules, search]);

  const diff = useMemo(() => ({
    added: [...selected]
      .filter((key) => !initialSelected.has(key))
      .map((key) => capabilityMap.get(key) || { key, label: key, moduleLabel: 'Sistema' }),
    removed: [...initialSelected]
      .filter((key) => !selected.has(key))
      .map((key) => capabilityMap.get(key) || { key, label: key, moduleLabel: 'Sistema' }),
  }), [selected, initialSelected, capabilityMap]);

  const toggleCapability = (capability) => {
    if (capability.locked || mode !== MODE_CUSTOM || protectedTarget) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(capability.key)) next.delete(capability.key);
      else next.add(capability.key);
      return next;
    });
  };

  const toggleModule = (permissionModule, enabled) => {
    if (mode !== MODE_CUSTOM || protectedTarget) return;
    setSelected((current) => {
      const next = new Set(current);
      permissionModule.capabilities.forEach((capability) => {
        if (capability.locked) return;
        if (enabled) next.add(capability.key);
        else next.delete(capability.key);
      });
      return next;
    });
  };

  const handleProfileChange = async (nextProfile) => {
    setProfile(nextProfile);
    if (!nextProfile) return;
    try {
      setLoadingProfile(true);
      const details = await perfisAPI.get(nextProfile);
      const lockedEnabled = allCapabilities
        .filter((capability) => capability.locked && selected.has(capability.key))
        .map((capability) => capability.key);
      const preview = profileCapabilities(details, lockedEnabled);
      setSelected(new Set([...preview].filter((key) => capabilityMap.has(key))));
    } catch (err) {
      toast.error(err.message || 'Não foi possível pré-visualizar o perfil.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    if (nextMode === MODE_PROFILE) {
      const nextProfile = profile || initialProfile || profiles[0]?.name || '';
      handleProfileChange(nextProfile);
    }
  };

  const discardChanges = () => {
    setMode(initialMode);
    setProfile(initialProfile);
    setSelected(new Set(initialSelected));
  };

  const saveAccess = async () => {
    try {
      setSaving(true);
      const editableSelected = [...selected].filter((key) => !capabilityMap.get(key)?.locked);
      await usuariosAPI.updateAccess(id, {
        mode: mode === MODE_PROFILE ? 'profile' : 'custom',
        profile: mode === MODE_PROFILE ? profile : null,
        enabled_capabilities: mode === MODE_CUSTOM ? editableSelected : [],
        expected_version: version,
      });
      setShowConfirm(false);
      toast.success('Acessos atualizados com sucesso.');
      await Promise.all([loadData(), loadAudit()]);
    } catch (err) {
      if (err.status === 409 || err.code === 'access_version_conflict') {
        toast.warning('Outra sessão alterou este usuário. Recarregue antes de salvar novamente.');
      } else {
        toast.error(err.message || 'Erro ao atualizar os acessos.');
      }
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    try {
      setChangingStatus(true);
      const nextStatus = !targetUser.is_active;
      const response = await usuariosAPI.updateStatus(id, {
        is_active: nextStatus,
        expected_version: version,
      });
      setTargetUser((current) => ({
        ...current,
        ...(response.user || response.usuario || response),
        is_active: response.user?.is_active ?? response.is_active ?? nextStatus,
      }));
      setVersion(response.version ?? response.versao ?? version);
      setStatusConfirm(false);
      toast.success(nextStatus ? 'Usuário ativado.' : 'Usuário desativado.');
      loadAudit();
    } catch (err) {
      toast.error(err.message || 'Erro ao alterar o status.');
    } finally {
      setChangingStatus(false);
    }
  };

  const closePasswordReset = () => {
    if (resettingPassword) return;
    setShowPasswordReset(false);
    setPasswordResetError('');
    setPasswordReset({ password: '', passwordConfirm: '', reason: '' });
  };

  const openPasswordReset = () => {
    if (!canResetPassword) return;
    setPasswordResetError('');
    setPasswordReset({ password: '', passwordConfirm: '', reason: '' });
    setShowPasswordReset(true);
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    const { password, passwordConfirm, reason } = passwordReset;

    if (password.length < 8) {
      setPasswordResetError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordResetError('A confirmação não corresponde à nova senha.');
      return;
    }
    if (reason.length > 1000) {
      setPasswordResetError('O motivo deve ter no máximo 1.000 caracteres.');
      return;
    }

    try {
      setResettingPassword(true);
      setPasswordResetError('');
      const response = await usuariosAPI.resetPassword(id, {
        password,
        password_confirm: passwordConfirm,
        motivo: reason,
      });
      setVersion(response.version ?? response.versao ?? version);
      setShowPasswordReset(false);
      setPasswordReset({ password: '', passwordConfirm: '', reason: '' });
      toast.success('Senha redefinida com sucesso.');
      loadAudit();
    } catch (err) {
      setPasswordResetError(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleBack = () => {
    if (dirty) setShowLeaveConfirm(true);
    else navigate('/usuarios');
  };

  if (loading) return <Loading message="Carregando acessos do usuário..." />;
  if (error) return <ErrorMessage message={error} onRetry={loadData} />;
  if (!targetUser) return <ErrorMessage message="Usuário não encontrado." />;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Gerenciar acessos"
        subtitle={`Defina o que @${targetUser.username} pode visualizar e executar`}
        breadcrumbs={[
          { label: 'Sistema' },
          { label: 'Usuários', onClick: handleBack },
          { label: targetUser.username },
        ]}
        icon={(
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        )}
        actions={<Button variant="outline" onClick={handleBack}>Voltar</Button>}
      />

      <section className={styles.userSummary} aria-labelledby="access-user-title">
        <div className={styles.avatar} aria-hidden="true">
          {(targetUser.full_name || targetUser.username).charAt(0).toUpperCase()}
        </div>
        <div className={styles.userIdentity}>
          <h2 id="access-user-title">{targetUser.full_name || targetUser.username}</h2>
          <p>@{targetUser.username}{targetUser.email ? ` · ${targetUser.email}` : ''}</p>
        </div>
        <div className={styles.userStatus}>
          <StatusPill status={targetUser.is_active ? 'ativo' : 'inativo'}>
            {targetUser.is_active ? 'Ativo' : 'Inativo'}
          </StatusPill>
          <Button
            size="sm"
            variant={targetUser.is_active ? 'danger' : 'success'}
            onClick={() => setStatusConfirm(true)}
            disabled={statusProtected}
            title={statusProtected
              ? (protections.reason || 'Esta conta não pode ser desativada por esta tela')
              : undefined}
          >
            {targetUser.is_active ? 'Desativar' : 'Ativar'}
          </Button>
          <Button
            size="sm"
            variant="warning"
            onClick={openPasswordReset}
            disabled={!canResetPassword}
            title={!canResetPassword
              ? (isOwnAccount
                ? 'Use seu perfil para alterar a própria senha'
                : (targetUser?.is_superuser
                  ? 'Senhas de contas-raiz só podem ser redefinidas pela infraestrutura'
                  : 'Você não pode redefinir a senha desta conta'))
              : undefined}
          >
            Redefinir senha
          </Button>
        </div>
      </section>

      {protectedTarget && (
        <div className={styles.protectedNotice} role="status">
          {isOwnAccount
            ? 'Seus acessos administrativos são protegidos. Você pode consultá-los, mas não alterá-los nem desativar a própria conta.'
            : (protections.reason || 'Esta é uma conta-raiz. O rebaixamento exige uma operação explícita de infraestrutura e não pode ser feito por esta tela.')}
        </div>
      )}

      <section className={styles.accessSettings} aria-labelledby="access-mode-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="access-mode-title">Forma de acesso</h2>
            <p>Use um perfil pronto ou personalize cada função individualmente.</p>
          </div>
          <span className={styles.versionBadge}>Versão {version}</span>
        </div>

        <div className={styles.modeOptions}>
          <label className={mode === MODE_PROFILE ? styles.selectedMode : ''}>
            <input
              type="radio"
              name="access-mode"
              value={MODE_PROFILE}
              checked={mode === MODE_PROFILE}
              onChange={() => handleModeChange(MODE_PROFILE)}
              disabled={protectedTarget}
            />
            <span><strong>Perfil</strong><small>Conjunto padronizado de permissões</small></span>
          </label>
          <label className={mode === MODE_CUSTOM ? styles.selectedMode : ''}>
            <input
              type="radio"
              name="access-mode"
              value={MODE_CUSTOM}
              checked={mode === MODE_CUSTOM}
              onChange={() => handleModeChange(MODE_CUSTOM)}
              disabled={protectedTarget}
            />
            <span><strong>Personalizado</strong><small>Controle função por função</small></span>
          </label>
        </div>

        {mode === MODE_PROFILE && (
          <div className={styles.profileField}>
            <label htmlFor="access-profile">Perfil de permissões</label>
            <select
              id="access-profile"
              value={profile}
              onChange={(event) => handleProfileChange(event.target.value)}
              disabled={protectedTarget || loadingProfile}
            >
              <option value="">Selecione um perfil</option>
              {profiles.map((item) => (
                <option key={item.name} value={item.name}>{item.label}</option>
              ))}
            </select>
            <small>{profiles.find((item) => item.name === profile)?.description}</small>
          </div>
        )}
      </section>

      <section className={styles.permissionsSection} aria-labelledby="permissions-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="permissions-title">Funções do sistema</h2>
            <p>{mode === MODE_CUSTOM
              ? 'Ative somente as funções necessárias para este usuário.'
              : 'Pré-visualização das funções fornecidas pelo perfil selecionado.'}</p>
          </div>
          <label className={styles.searchBox}>
            <span className={styles.srOnly}>Buscar função</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar módulo ou função..."
            />
          </label>
        </div>

        <div className={styles.modulesGrid} aria-live="polite">
          {filteredModules.length ? filteredModules.map((permissionModule) => (
            <PermissionModule
              key={permissionModule.key}
              module={permissionModule}
              selected={selected}
              disabled={mode !== MODE_CUSTOM || protectedTarget}
              onToggle={toggleCapability}
              onToggleModule={toggleModule}
            />
          )) : (
            <p className={styles.noResults}>Nenhuma função corresponde à busca.</p>
          )}
        </div>
      </section>

      <AccessAudit entries={auditEntries} loading={auditLoading} />

      <div className={styles.stickyActions} role="region" aria-label="Ações das permissões">
        <span aria-live="polite">
          {dirty ? `${diff.added.length + diff.removed.length} alterações pendentes` : 'Nenhuma alteração pendente'}
        </span>
        <div>
          <Button variant="outline" onClick={discardChanges} disabled={!dirty || saving}>Descartar</Button>
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!dirty || saving || loadingProfile || protectedTarget || (mode === MODE_PROFILE && !profile)}
          >
            Revisar e salvar
          </Button>
        </div>
      </div>

      <PermissionDiffModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={saveAccess}
        saving={saving}
        diff={diff}
        mode={mode}
        profile={profile}
      />

      <Modal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title="Descartar alterações?"
        size="sm"
        footer={(
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>Continuar editando</Button>
            <Button variant="danger" onClick={() => navigate('/usuarios')}>Descartar e sair</Button>
          </div>
        )}
      >
        <p className={styles.confirmText}>
          As alterações de perfil e permissões ainda não foram salvas.
        </p>
      </Modal>

      <Modal
        isOpen={statusConfirm}
        onClose={changingStatus ? undefined : () => setStatusConfirm(false)}
        closeOnOverlayClick={!changingStatus}
        title={targetUser.is_active ? 'Desativar usuário' : 'Ativar usuário'}
        size="sm"
        footer={(
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={() => setStatusConfirm(false)} disabled={changingStatus}>Cancelar</Button>
            <Button
              variant={targetUser.is_active ? 'danger' : 'success'}
              onClick={changeStatus}
              loading={changingStatus}
            >
              {targetUser.is_active ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
        )}
      >
        <p className={styles.confirmText}>
          {targetUser.is_active
            ? 'Novos acessos serão bloqueados. Sessões existentes seguirão a política de sessão do servidor.'
            : 'O usuário poderá voltar a entrar no sistema imediatamente.'}
        </p>
      </Modal>

      <Modal
        isOpen={showPasswordReset}
        onClose={closePasswordReset}
        closeOnOverlayClick={!resettingPassword}
        title="Redefinir senha"
        size="sm"
        footer={(
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={closePasswordReset} disabled={resettingPassword}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="password-reset-form"
              variant="warning"
              loading={resettingPassword}
            >
              Confirmar redefinição
            </Button>
          </div>
        )}
      >
        <form id="password-reset-form" className={styles.passwordForm} onSubmit={handlePasswordReset}>
          <p className={styles.confirmText}>
            Defina uma nova senha para <strong>@{targetUser.username}</strong>. A senha não será exibida novamente.
          </p>

          <div className={styles.formField}>
            <label htmlFor="reset-password">Nova senha</label>
            <input
              id="reset-password"
              type="password"
              value={passwordReset.password}
              onChange={(event) => setPasswordReset((current) => ({
                ...current,
                password: event.target.value,
              }))}
              minLength={8}
              required
              autoComplete="new-password"
              disabled={resettingPassword}
              aria-describedby="reset-password-hint"
            />
            <small id="reset-password-hint">Use pelo menos 8 caracteres.</small>
          </div>

          <div className={styles.formField}>
            <label htmlFor="reset-password-confirm">Confirmar nova senha</label>
            <input
              id="reset-password-confirm"
              type="password"
              value={passwordReset.passwordConfirm}
              onChange={(event) => setPasswordReset((current) => ({
                ...current,
                passwordConfirm: event.target.value,
              }))}
              minLength={8}
              required
              autoComplete="new-password"
              disabled={resettingPassword}
            />
          </div>

          <div className={styles.formField}>
            <label htmlFor="reset-password-reason">Motivo <span>(opcional)</span></label>
            <textarea
              id="reset-password-reason"
              value={passwordReset.reason}
              onChange={(event) => setPasswordReset((current) => ({
                ...current,
                reason: event.target.value,
              }))}
              maxLength={1000}
              rows={3}
              disabled={resettingPassword}
            />
          </div>

          {passwordResetError && (
            <p className={styles.fieldError} role="alert">{passwordResetError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}

export default UsuarioAcessos;
