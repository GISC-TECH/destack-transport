# transport/views/auth_views.py

# Imports do Django
from django.contrib.auth.models import User
from django.db import transaction
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator

# Imports do Django REST Framework
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny

# Imports locais (serializers)
from ..models import AuditoriaAcessoUsuario
from ..permissions import CanManageUserAccessPermission
from ..serializers.user_serializers import (
    UserAccessUpdateSerializer,
    UserPasswordResetSerializer,
    UserSerializer,
    UserStatusSerializer,
    UserUpdateSerializer,
)
from transport.services.permissao_service import (
    ConflitoVersaoAcesso,
    OperacaoAcessoProtegida,
    PERFIS,
    atualizar_acesso_usuario,
    atualizar_status_usuario,
    get_acesso_usuario,
    get_catalogo_acessos,
    get_permissoes_efetivas,
    obter_configuracao_acesso,
    redefinir_senha_usuario,
    registrar_auditoria_usuario,
)


# ===============================================================
# ==> CSRF e Verificacao de Autenticacao (para frontend React)
# ===============================================================

@method_decorator(ensure_csrf_cookie, name='dispatch')
class CSRFTokenAPIView(APIView):
    """API para obter CSRF token (necessario para POST/PUT/DELETE)."""
    permission_classes = [AllowAny]

    def get(self, request, format=None):
        return Response({'csrfToken': get_token(request)})


class CheckAuthAPIView(APIView):
    """API para verificar se o usuario esta autenticado."""
    permission_classes = [AllowAny]

    def get(self, request, format=None):
        if request.user.is_authenticated:
            return Response({
                'authenticated': True,
                'user': {
                    'id': request.user.id,
                    'username': request.user.username,
                    'email': request.user.email,
                    'first_name': request.user.first_name,
                    'last_name': request.user.last_name,
                    'is_staff': request.user.is_staff,
                    'is_superuser': request.user.is_superuser,
                }
            })
        else:
            return Response({'authenticated': False})


# ===============================================================
# ==> USUARIOS e AUTENTICACAO
# ===============================================================

class CurrentUserAPIView(APIView):
    """API para obter e atualizar os dados do usuario autenticado."""
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        """Retorna os dados do usuario autenticado."""
        user = request.user
        permissoes = get_permissoes_efetivas(user)
        data = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'last_login': user.last_login,
            'date_joined': user.date_joined,
            'permissions': permissoes,
        }
        return Response(data)

    def patch(self, request, format=None):
        """Atualiza os dados do usuario autenticado."""
        user = request.user
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserPermissionsAPIView(APIView):
    """API para obter as permissoes efetivas do usuario autenticado."""
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        """Retorna as permissoes efetivas do usuario logado."""
        permissoes = get_permissoes_efetivas(request.user)
        return Response(permissoes)


class UserViewSet(viewsets.ModelViewSet):
    """API para administracao de usuarios (somente admin)."""
    queryset = User.objects.select_related('configuracao_acesso').prefetch_related(
        'user_permissions__content_type',
        'groups__permissions__content_type',
    ).order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, CanManageUserAccessPermission]

    def _verificar_permissao_super_admin(self, dados):
        """
        Apenas superusuarios podem criar/editar usuarios com perfil Super Admin
        ou alterar o perfil de um superusuario existente.
        """
        if dados.get('perfil') == 'Super Admin':
            raise PermissionDenied('O perfil Super Admin não pode ser atribuído pelo painel.')

    def create(self, request, *args, **kwargs):
        self._verificar_permissao_super_admin(request.data)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._verificar_permissao_super_admin(request.data)
        instance = self.get_object()
        if 'perfil' in request.data:
            raise PermissionDenied('Use a tela de acessos para alterar o perfil do usuário.')
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        expected_version = (
            request.data.get('expected_version')
            or request.data.get('versao')
            or request.query_params.get('expected_version')
            or request.query_params.get('versao')
        )
        if expected_version is None:
            return Response(
                {'detail': 'expected_version é obrigatório para excluir o usuário.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            atualizar_status_usuario(
                request.user, instance, False, request=request,
                motivo=request.data.get('motivo', 'Desativação solicitada pela exclusão lógica.'),
                expected_version=expected_version,
            )
        except ConflitoVersaoAcesso as exc:
            return Response({
                'code': 'access_version_conflict',
                'detail': str(exc),
                'current_version': exc.versao_atual,
                'versao_atual': exc.versao_atual,
            }, status=status.HTTP_409_CONFLICT)
        except (OperacaoAcessoProtegida, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @transaction.atomic
    def perform_create(self, serializer):
        user = serializer.save()
        config = obter_configuracao_acesso(user)
        registrar_auditoria_usuario(
            self.request.user,
            user,
            'criacao_usuario',
            {},
            {
                'username': user.username,
                'is_active': user.is_active,
                'access_mode': config.modo,
                'profile': config.perfil_base or None,
                'version': config.versao,
            },
            self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.instance
        before = {
            'username': instance.username,
            'first_name': instance.first_name,
            'last_name': instance.last_name,
            'email': instance.email,
        }
        user = serializer.save()
        after = {
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
        }
        registrar_auditoria_usuario(
            self.request.user, user, 'alteracao_usuario', before, after,
            self.request,
        )

    def get_serializer_class(self):
        """Define qual serializer usar dependendo da acao."""
        if self.action == 'me' and self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer

    @action(detail=False, methods=['get', 'put', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Endpoint para o usuario logado gerenciar seu proprio perfil."""
        user = request.user

        if request.method == 'GET':
            serializer = self.get_serializer(user)
            return Response(serializer.data)
        elif request.method in ['PUT', 'PATCH']:
            partial = (request.method == 'PATCH')
            serializer = self.get_serializer(user, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=False, methods=['get'], url_path='catalogo-acessos')
    def catalogo_acessos(self, request):
        return Response(get_catalogo_acessos())

    @action(detail=True, methods=['get', 'put'], url_path='acessos')
    def acessos(self, request, pk=None):
        user = self.get_object()
        if request.method == 'GET':
            return Response(get_acesso_usuario(user, actor=request.user))

        serializer = UserAccessUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated, _ = atualizar_acesso_usuario(
                request.user, user, serializer.validated_data, request=request,
            )
        except ConflitoVersaoAcesso as exc:
            return Response({
                'code': 'access_version_conflict',
                'detail': str(exc),
                'current_version': exc.versao_atual,
                'versao_atual': exc.versao_atual,
            }, status=status.HTTP_409_CONFLICT)
        except (OperacaoAcessoProtegida, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(get_acesso_usuario(updated, actor=request.user))

    @action(detail=True, methods=['patch'], url_path='status')
    def alterar_status(self, request, pk=None):
        serializer = UserStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            updated, config = atualizar_status_usuario(
                request.user,
                self.get_object(),
                serializer.validated_data['is_active'],
                request=request,
                motivo=serializer.validated_data.get('motivo', ''),
                expected_version=serializer.validated_data.get(
                    'expected_version', serializer.validated_data.get('versao')
                ),
            )
        except ConflitoVersaoAcesso as exc:
            return Response({
                'code': 'access_version_conflict',
                'detail': str(exc),
                'current_version': exc.versao_atual,
                'versao_atual': exc.versao_atual,
            }, status=status.HTTP_409_CONFLICT)
        except OperacaoAcessoProtegida as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'id': updated.pk,
            'is_active': updated.is_active,
            'version': config.versao,
            'versao': config.versao,
        })

    @action(detail=True, methods=['get'], url_path='auditoria')
    def auditoria(self, request, pk=None):
        user = self.get_object()
        logs = AuditoriaAcessoUsuario.objects.filter(usuario_afetado=user).select_related('ator')[:100]
        return Response({'results': [{
            'id': log.pk,
            'action': log.acao,
            'acao': log.acao,
            'actor': log.ator.username if log.ator else None,
            'ator': log.ator.username if log.ator else None,
            'before': log.antes,
            'antes': log.antes,
            'after': log.depois,
            'depois': log.depois,
            'reason': log.motivo,
            'motivo': log.motivo,
            'origin': log.origem,
            'request_id': log.request_id,
            'created_at': log.criado_em,
        } for log in logs]})

    @action(detail=True, methods=['post'], url_path='redefinir-senha')
    def redefinir_senha(self, request, pk=None):
        target = self.get_object()
        serializer = UserPasswordResetSerializer(
            data=request.data,
            context={'user': target},
        )
        serializer.is_valid(raise_exception=True)
        try:
            _, config = redefinir_senha_usuario(
                request.user,
                target,
                serializer.validated_data['password'],
                request=request,
                motivo=serializer.validated_data.get('motivo', ''),
            )
        except OperacaoAcessoProtegida as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'success', 'version': config.versao})
