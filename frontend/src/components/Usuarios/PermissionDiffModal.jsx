import Button from '../Common/Button';
import Modal from '../Common/Modal';
import styles from './UsuarioAcessos.module.css';

function PermissionList({ title, items, variant }) {
  if (!items.length) return null;
  return (
    <section className={styles.diffSection}>
      <h4 className={styles[variant]}>{title} ({items.length})</h4>
      <ul>
        {items.map((item) => <li key={item.key}>{item.moduleLabel}: {item.label}</li>)}
      </ul>
    </section>
  );
}

function PermissionDiffModal({ isOpen, onClose, onConfirm, saving, diff, mode, profile }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      closeOnOverlayClick={!saving}
      title="Confirmar alterações de acesso"
      size="md"
      footer={(
        <div className={styles.modalActions}>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={onConfirm} loading={saving}>Confirmar alterações</Button>
        </div>
      )}
    >
      <p className={styles.confirmText}>
        {mode === 'perfil'
          ? <>O perfil <strong>{profile}</strong> será aplicado ao usuário.</>
          : 'O usuário passará a usar uma configuração personalizada.'}
      </p>
      <PermissionList title="Permissões adicionadas" items={diff.added} variant="diffAdded" />
      <PermissionList title="Permissões removidas" items={diff.removed} variant="diffRemoved" />
      {!diff.added.length && !diff.removed.length && (
        <p className={styles.noDiff}>Somente o modo ou perfil de acesso será alterado.</p>
      )}
    </Modal>
  );
}

export default PermissionDiffModal;
