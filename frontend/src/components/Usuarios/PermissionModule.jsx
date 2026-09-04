import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './UsuarioAcessos.module.css';

const SOURCE_LABELS = {
  profile: 'Perfil',
  perfil: 'Perfil',
  custom: 'Personalizado',
  personalizado: 'Personalizado',
  direct: 'Direta',
  protected: 'Protegida',
};

function PermissionModule({ module, selected, disabled, onToggle, onToggleModule }) {
  const [expanded, setExpanded] = useState(true);
  const moduleCheckboxRef = useRef(null);
  const editable = useMemo(
    () => module.capabilities.filter((capability) => !capability.locked),
    [module.capabilities]
  );
  const enabledCount = module.capabilities.filter((capability) => selected.has(capability.key)).length;
  const enabledEditable = editable.filter((capability) => selected.has(capability.key)).length;
  const allEnabled = editable.length > 0 && enabledEditable === editable.length;
  const partiallyEnabled = enabledEditable > 0 && !allEnabled;

  useEffect(() => {
    if (moduleCheckboxRef.current) {
      moduleCheckboxRef.current.indeterminate = partiallyEnabled;
    }
  }, [partiallyEnabled]);

  return (
    <section className={styles.moduleCard} aria-labelledby={`module-${module.key}`}>
      <div className={styles.moduleHeader}>
        <label className={styles.moduleToggle}>
          <input
            ref={moduleCheckboxRef}
            type="checkbox"
            checked={allEnabled}
            onChange={() => onToggleModule(module, !allEnabled)}
            disabled={disabled || editable.length === 0}
            aria-label={`${allEnabled ? 'Desativar' : 'Ativar'} permissões editáveis de ${module.label}`}
          />
          <span aria-hidden="true" />
        </label>
        <button
          type="button"
          className={styles.moduleTitleButton}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={`module-panel-${module.key}`}
        >
          <span id={`module-${module.key}`}>{module.label}</span>
          <small>{enabledCount} de {module.capabilities.length} ativas</small>
        </button>
        <button
          type="button"
          className={styles.expandButton}
          onClick={() => setExpanded((current) => !current)}
          aria-label={`${expanded ? 'Recolher' : 'Expandir'} módulo ${module.label}`}
          aria-expanded={expanded}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      </div>

      {expanded && (
        <div id={`module-panel-${module.key}`} className={styles.capabilityList}>
          {module.capabilities.map((capability) => {
            const inputId = `capability-${capability.key.replace(/[^a-z0-9_-]/gi, '-')}`;
            const isLocked = disabled || capability.locked;
            return (
              <label
                key={capability.key}
                htmlFor={inputId}
                className={`${styles.capabilityRow} ${isLocked ? styles.locked : ''}`}
              >
                <span className={styles.capabilityText}>
                  <span className={styles.capabilityName}>{capability.label}</span>
                  {(capability.description || capability.lockReason) && (
                    <small id={`${inputId}-description`}>
                      {capability.lockReason || capability.description}
                    </small>
                  )}
                </span>
                <span className={styles.capabilityMeta}>
                  {capability.source && (
                    <span className={styles.sourceBadge}>
                      {SOURCE_LABELS[capability.source] || capability.source}
                    </span>
                  )}
                  <input
                    id={inputId}
                    type="checkbox"
                    role="switch"
                    checked={selected.has(capability.key)}
                    onChange={() => onToggle(capability)}
                    disabled={isLocked}
                    aria-describedby={(capability.description || capability.lockReason)
                      ? `${inputId}-description`
                      : undefined}
                  />
                </span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default PermissionModule;
