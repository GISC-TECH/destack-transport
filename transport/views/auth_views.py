# transport/views/auth_views.py

# Imports do Django
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator

# Imports do Django REST Framework
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny

# Imports locais (serializers)
from ..permissions import TransportModelPermission
from ..serializers.user_serializers import UserSerializer, UserUpdateSerializer
from transport.services.permissao_service import get_permissoes_efetivas, PERFIS


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
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, TransportModelPermission]

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
