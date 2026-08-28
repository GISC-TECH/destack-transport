# transport/permissions.py
"""
Permissões granulares baseadas em grupos do Django.

Grupos fixos:
- Financeiro: view/add/change/delete em pagamentos/faturas/contas a pagar
- Operacional: view/add/change/delete em viagens, motoristas, veículos e manutenções
- Administrativo: view/add/change/delete em usuários e configurações
- Leitura: apenas view em todos os modelos principais

Superusuários têm acesso total.
"""

from rest_framework.permissions import BasePermission


CTE_EDITAR_VALOR_PERMISSION = 'editar_valor_frete_cte'
CTE_EXCLUIR_PERMISSION = 'excluir_cte_importado'


def has_direct_cte_permission(user, codename):
    """
    Verifica uma permissão especial atribuída diretamente ao usuário.

    Não usa ``has_perm`` de propósito: superusuários e grupos não devem obter
    automaticamente estas duas operações sensíveis de CT-e.
    """
    if not user or not user.is_authenticated:
        return False
    return user.user_permissions.filter(
        content_type__app_label='transport',
        content_type__model='ctedocumento',
        codename=codename,
    ).exists()


class CanEditCTeFreightValuePermission(BasePermission):
    """Permite editar o frete somente a usuários autorizados diretamente."""

    def has_permission(self, request, view):
        return has_direct_cte_permission(request.user, CTE_EDITAR_VALOR_PERMISSION)


class CanDeleteImportedCTePermission(BasePermission):
    """Permite excluir CT-e somente a usuários autorizados diretamente."""

    def has_permission(self, request, view):
        return has_direct_cte_permission(request.user, CTE_EXCLUIR_PERMISSION)


class TransportModelPermission(BasePermission):
    """
    Permissão customizada que exige a permissão Django nativa correspondente
    ao modelo do ViewSet e à ação executada.

    Ações padrão REST:
        - list / retrieve        -> view_<modelo>
        - create                 -> add_<modelo>
        - update / partial_update -> change_<modelo>
        - destroy                -> delete_<modelo>

    Ações customizadas (action) seguem o método HTTP:
        - GET/HEAD/OPTIONS -> view_<modelo>
        - POST/PUT/PATCH/DELETE -> change_<modelo>

    Superusuários têm acesso total.
    """

    # Ações que não fazem parte do CRUD padrão, mas que consideramos leitura
    SAFE_ACTIONS = frozenset({
        'export', 'vencimentos', 'estatisticas', 'buscar_por_km',
        'valores', 'download', 'indicadores', 'graficos', 'ultimos',
        'tendencias', 'calcular_km',
    })

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True

        action = getattr(view, 'action', None)
        perm_type = self._map_action(request, action)
        if perm_type is None:
            return False

        model_cls = self._get_model_class(view)
        if model_cls is None:
            return False

        perm = f"{model_cls._meta.app_label}.{perm_type}_{model_cls._meta.model_name}"
        return request.user.has_perm(perm)

    def _map_action(self, request, action):
        """Mapeia a ação atual para o tipo de permissão Django."""
        crud_map = {
            'list': 'view',
            'retrieve': 'view',
            'create': 'add',
            'update': 'change',
            'partial_update': 'change',
            'destroy': 'delete',
        }

        if action in crud_map:
            return crud_map[action]

        # Ações customizadas
        if action in self.SAFE_ACTIONS or request.method in ['GET', 'HEAD', 'OPTIONS']:
            return 'view'

        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return 'change'

        return None

    def _get_model_class(self, view):
        """Obtém a classe do modelo a partir do queryset ou serializer do ViewSet."""
        queryset = getattr(view, 'queryset', None)
        if queryset is not None:
            return queryset.model

        # Fallback para serializers baseados em ModelSerializer
        serializer_class = getattr(view, 'serializer_class', None)

        # Se o ViewSet define get_serializer_class dinamicamente, usa-o
        if serializer_class is None and hasattr(view, 'get_serializer_class'):
            try:
                serializer_class = view.get_serializer_class()
            except Exception:
                serializer_class = None

        if serializer_class is not None:
            return getattr(serializer_class.Meta, 'model', None)
        return None


class ReadOnlyPermission(BasePermission):
    """
    Permissão de apenas leitura. Permite apenas métodos seguros.
    Superusuários têm acesso total.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return request.method in ['GET', 'HEAD', 'OPTIONS']


class CanUploadXMLPermission(BasePermission):
    """
    Permissão para upload de XMLs (CT-e/MDF-e/eventos).
    Exige a permissão de adicionar CT-e ou MDF-e.
    Superusuários têm acesso total.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return (
            request.user.has_perm('transport.add_ctedocumento') or
            request.user.has_perm('transport.add_mdfedocumento')
        )


class CanUpdatePagamentoCTePermission(BasePermission):
    """
    Permissão para atualizar o status de pagamento de um CT-e.
    Permite usuários que podem alterar CT-e ou gerenciar pagamentos
    (agregados/próprios), já que a ação afeta diretamente o fluxo financeiro.
    Superusuários têm acesso total.
    """

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return (
            request.user.has_perm('transport.change_ctedocumento') or
            request.user.has_perm('transport.change_pagamentoagregado') or
            request.user.has_perm('transport.change_pagamentoproprio')
        )
