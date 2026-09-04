import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para verificar permissões do usuário logado no frontend.
 *
 * As permissões são organizadas por módulo (cte, mdfe, clientes, etc.)
 * e ação (view, add, change, delete).
 *
 * Exemplos:
 *   const { canView, canAdd, canChange, canDelete } = usePermission();
 *   const podeVerCTe = canView('cte');
 *   const podeEditarCliente = canChange('clientes');
 */

const MODULO_POR_ROTA = {
  '/dashboard': 'dashboard',
  '/ctes': 'cte',
  '/ctes/pendentes': 'cte',
  '/mdfes': 'mdfe',
  '/upload': 'cte',
  '/clientes': 'clientes',
  '/motoristas': 'motoristas',
  '/veiculos': 'veiculos',
  '/pagamentos': 'pagamentos',
  '/financeiro': 'financeiro',
  '/faturas': 'financeiro',
  '/financeiro/contas-a-pagar': 'financeiro',
  '/financeiro/conciliacao': 'financeiro',
  '/financeiro/inadimplencia': 'financeiro',
  '/financeiro/fluxo-caixa': 'financeiro',
  '/financeiro/dre': 'financeiro',
  '/manutencoes': 'veiculos',
  '/ordens-viagem': 'ordens_viagem',
  '/abastecimentos': 'frota',
  '/planos-manutencao': 'veiculos',
  '/frota/multas-sinistros': 'frota',
  '/pedagios': 'frota',
  '/tabelas-frete': 'frota',
  '/rastreamento': 'frota',
  '/comunicacao': 'comunicacao',
  '/ciot': 'frota',
  '/documentos': 'documentos',
  '/relatorios': 'dashboard',
  '/geografico': 'dashboard',
  '/alertas': 'alertas',
  '/vencimentos': 'alertas',
  '/faixas-km': 'pagamentos',
  '/usuarios': 'usuarios',
  '/configuracoes': 'configuracoes',
  '/backup': 'backup',
};

export function usePermission() {
  const { permissions, user } = useAuth();

  const modulos = useMemo(() => {
    return permissions?.modulos || {};
  }, [permissions]);

  const isSuperuser = useMemo(() => {
    return !!permissions?.superuser;
  }, [permissions]);

  const isStaff = useMemo(() => {
    return !!user?.is_staff;
  }, [user]);

  const capabilities = useMemo(() => {
    const raw = permissions?.capabilities;
    if (!raw) return {};

    if (Array.isArray(raw)) {
      return raw.reduce((result, capability) => {
        if (typeof capability === 'string') {
          result[capability] = true;
        } else if (capability?.key) {
          result[capability.key] = capability.enabled !== false;
        }
        return result;
      }, {});
    }

    return Object.entries(raw).reduce((result, [key, value]) => {
      result[key] = typeof value === 'object' ? value?.enabled === true : value === true;
      return result;
    }, {});
  }, [permissions]);

  const hasPermission = useCallback((modulo, acao) => {
    if (isSuperuser) return true;
    if (!modulo || !acao) return false;
    return !!modulos[modulo]?.[acao];
  }, [isSuperuser, modulos]);

  // Capabilities são decisões finais do backend. Não há bypass implícito para
  // superuser/staff, pois algumas operações são deliberadamente diretas e
  // exclusivas (por exemplo, administrar acessos de outros usuários).
  const canCapability = useCallback((key) => {
    if (!key) return false;
    return capabilities[key] === true;
  }, [capabilities]);

  const canAnyCapabilities = useCallback((keys = []) => {
    return keys.some((key) => canCapability(key));
  }, [canCapability]);

  const canAllCapabilities = useCallback((keys = []) => {
    return keys.length > 0 && keys.every((key) => canCapability(key));
  }, [canCapability]);

  const canView = useCallback((modulo) => hasPermission(modulo, 'view'), [hasPermission]);
  const canAdd = useCallback((modulo) => hasPermission(modulo, 'add'), [hasPermission]);
  const canChange = useCallback((modulo) => hasPermission(modulo, 'change'), [hasPermission]);
  const canDelete = useCallback((modulo) => hasPermission(modulo, 'delete'), [hasPermission]);

  const canAccessRoute = useCallback((route) => {
    const normalized = route.replace(/\/+$/, '').split('?')[0];
    const modulo = MODULO_POR_ROTA[normalized];
    if (!modulo) return false;
    return canView(modulo);
  }, [canView]);

  return {
    isSuperuser,
    isStaff,
    modulos,
    capabilities,
    hasPermission,
    canCapability,
    canAnyCapabilities,
    canAllCapabilities,
    canView,
    canAdd,
    canChange,
    canDelete,
    canAccessRoute,
  };
}

export default usePermission;
