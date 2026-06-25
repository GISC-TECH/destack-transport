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
        """Obtém a classe do modelo a partir do queryset do ViewSet."""
        queryset = getattr(view, 'queryset', None)
        if queryset is not None:
            return queryset.model
        # Fallback para serializers baseados em ModelSerializer
        serializer_class = getattr(view, 'serializer_class', None)
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
