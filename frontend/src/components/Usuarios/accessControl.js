const ACTION_LABELS = {
  view: 'Visualizar',
  add: 'Criar',
  change: 'Editar',
  delete: 'Excluir',
  special: 'Ação especial',
};

export function normalizeProfiles(catalog, fallback = []) {
  const source = catalog?.profiles || catalog?.perfis || fallback;
  return (source || []).map((profile) => ({
    name: profile.name || profile.nome,
    label: profile.label || profile.nome || profile.name,
    description: profile.description || profile.descricao || '',
  })).filter((profile) => profile.name && profile.name !== 'Super Admin');
}

function flattenCatalog(catalog) {
  const direct = catalog?.capabilities;
  if (Array.isArray(direct) && direct.length) return direct;

  const modules = catalog?.modules || catalog?.modulos || [];
  const moduleList = Array.isArray(modules)
    ? modules
    : Object.entries(modules).map(([key, value]) => ({ key, ...value }));

  return moduleList.flatMap((module) => [
    ...(module.actions || module.acoes || []),
    ...(module.special_actions || module.acoes_especiais || []),
  ].map((capability) => ({
    module: module.key,
    module_label: module.label,
    ...capability,
  })));
}

export function normalizeAccess(catalog, access) {
  const enabledKeys = new Set(
    access?.enabled_capabilities || access?.capacidades_ativas || []
  );
  const accessItems = Array.isArray(access?.capabilities) ? access.capabilities : [];
  const accessMap = new Map(accessItems.map((item) => [item.key, item]));
  const rawItems = flattenCatalog(catalog);
  const seen = new Set();
  const capabilities = [...rawItems, ...accessItems]
    .filter((item) => item?.key && !seen.has(item.key) && seen.add(item.key))
    .map((item) => {
      const current = accessMap.get(item.key) || {};
      const action = item.action || item.acao || item.key.split('.').at(-1);
      return {
        ...item,
        ...current,
        key: item.key,
        module: item.module || item.modulo || item.key.split('.')[0],
        moduleLabel: item.module_label || item.modulo_label || item.module || item.modulo,
        action,
        label: item.label || item.rotulo || ACTION_LABELS[action] || item.key,
        description: item.description || item.descricao || '',
        enabled: current.enabled ?? item.enabled ?? enabledKeys.has(item.key),
        source: current.source || item.source || access?.access_mode || access?.modo || 'profile',
        locked: current.locked ?? item.locked ?? false,
        lockReason: current.lock_reason || item.lock_reason || current.motivo_bloqueio || item.motivo_bloqueio || '',
      };
    });

  const moduleMetadata = new Map();
  const rawModules = catalog?.modules || catalog?.modulos || [];
  const moduleList = Array.isArray(rawModules)
    ? rawModules
    : Object.entries(rawModules).map(([key, value]) => ({ key, ...value }));
  moduleList.forEach((module) => moduleMetadata.set(module.key, module));

  return capabilities.reduce((groups, capability) => {
    if (!groups[capability.module]) {
      const metadata = moduleMetadata.get(capability.module) || {};
      groups[capability.module] = {
        key: capability.module,
        label: metadata.label || capability.moduleLabel || capability.module,
        icon: metadata.icon || null,
        capabilities: [],
      };
    }
    groups[capability.module].capabilities.push(capability);
    return groups;
  }, {});
}

export function profileCapabilities(profileDetail, lockedEnabled = []) {
  const selected = new Set(lockedEnabled);
  const enabledCapabilities = profileDetail?.enabled_capabilities
    || profileDetail?.capacidades_ativas;
  if (Array.isArray(enabledCapabilities)) {
    enabledCapabilities.forEach((key) => selected.add(key));
    return selected;
  }
  (profileDetail?.modulos || profileDetail?.modules || []).forEach((module) => {
    (module.acoes || module.actions || []).forEach((action) => {
      const actionKey = typeof action === 'string' ? action : action.key;
      if (module.key && actionKey) selected.add(`${module.key}.${actionKey}`);
    });
  });
  return selected;
}

export function formatAccessDate(value) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
