import { usePermission } from '../../hooks/usePermission';

/**
 * Componente que renderiza children apenas se o usuário tiver a permissão especificada.
 *
 * Props:
 *   - modulo: string (ex: 'cte', 'clientes', 'financeiro')
 *   - acao: 'view' | 'add' | 'change' | 'delete'
 *   - fallback: elemento opcional renderizado quando não há permissão
 */
function PermissionGuard({ modulo, acao = 'view', fallback = null, children }) {
  const { hasPermission } = usePermission();

  if (!hasPermission(modulo, acao)) {
    return fallback;
  }

  return children;
}

export default PermissionGuard;
