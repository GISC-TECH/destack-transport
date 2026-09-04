import { formatAccessDate } from './accessControl';
import styles from './UsuarioAcessos.module.css';

const ACTION_LABELS = {
  alteracao_acessos: 'Alteração de acessos',
  ativacao: 'Ativação da conta',
  desativacao: 'Desativação da conta',
  exclusao: 'Remoção da conta',
};

function AccessAudit({ entries, loading }) {
  return (
    <section className={styles.auditCard} aria-labelledby="audit-title">
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="audit-title">Histórico de alterações</h2>
          <p>Registro das mudanças recentes de status, perfil e permissões.</p>
        </div>
      </div>

      {loading ? (
        <p className={styles.auditEmpty}>Carregando histórico...</p>
      ) : entries.length === 0 ? (
        <p className={styles.auditEmpty}>Nenhuma alteração de acesso registrada.</p>
      ) : (
        <ol className={styles.auditList}>
          {entries.map((entry, index) => {
            const actor = entry.actor_name
              || entry.ator_nome
              || (typeof entry.actor === 'string' ? entry.actor : entry.actor?.username)
              || (typeof entry.ator === 'string' ? entry.ator : entry.ator?.username)
              || 'Administrador';
            const action = entry.action || entry.acao || 'alteracao_acessos';
            const date = entry.created_at || entry.criado_em || entry.data;
            return (
              <li key={entry.id || `${date}-${index}`}>
                <span className={styles.auditMarker} aria-hidden="true" />
                <div>
                  <strong>{ACTION_LABELS[action] || action}</strong>
                  <p>Por {actor} em {formatAccessDate(date)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default AccessAudit;
