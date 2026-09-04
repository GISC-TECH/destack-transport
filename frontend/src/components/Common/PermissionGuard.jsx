import { usePermission } from '../../hooks/usePermission';

/**
 * Componente que renderiza children apenas se o usuário tiver a permissão especificada.
 *
 * Props:
 *   - modulo: string (ex: 'cte', 'clientes', 'financeiro')
 *   - acao: 'view' | 'add' | 'change' | 'delete'
 *   - capability: capability especial calculada pelo backend (sem bypass)
 *   - capabilities: lista de capabilities especiais
 *   - requireAll: exige todas as capabilities quando true
 *   - fallback: elemento opcional renderizado quando não há permissão
 */
function PermissionGuard({
  modulo,
  acao = 'view',
  capability,
  capabilities = [],
  requireAll = true,
  fallback = null,
  children,
}) {
  const {
    hasPermission,
    canCapability,
    canAnyCapabilities,
    canAllCapabilities,
  } = usePermission();

  const requestedCapabilities = capability ? [capability] : capabilities;
  const hasCapabilityRequirement = requestedCapabilities.length > 0;
  const allowed = hasCapabilityRequirement
    ? (requireAll
      ? canAllCapabilities(requestedCapabilities)
      : canAnyCapabilities(requestedCapabilities))
    : hasPermission(modulo, acao);

  // Mantém o caso de uma única capability simples explícito e legível nos
  // DevTools/React Profiler, sem aplicar privilégios implícitos.
  const finalAllowed = capability ? canCapability(capability) : allowed;
  if (!finalAllowed) {
    return fallback;
  }

  return children;
}

export default PermissionGuard;
