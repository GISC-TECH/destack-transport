import base64
from django.http import JsonResponse
from django.urls import resolve
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.contrib.auth import get_user, authenticate

class APIAuthenticationMiddleware:
    """
    Middleware para garantir que todas as requisicoes API sejam autenticadas
    Suporta Session Auth e Basic Auth
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def _check_basic_auth(self, request):
        """Verifica e autentica via Basic Auth se presente"""
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Basic '):
            try:
                encoded = auth_header.split(' ', 1)[1]
                decoded = base64.b64decode(encoded).decode('utf-8')
                username, password = decoded.split(':', 1)
                user = authenticate(request, username=username, password=password)
                if user and user.is_active:
                    request.user = user
                    return True
            except Exception:
                pass
        return False

    def __call__(self, request):
        # Verificar se e uma requisicao para API
        if request.path.startswith('/api/'):
            # Excluir algumas rotas publicas se necessario
            public_api_paths = [
                '/api/token/',  # Se ainda estiver sendo usado
                '/api/swagger/',
                '/api/redoc/',
                '/api/health/',  # Health check endpoint
                '/api/auth/',    # Endpoints de autenticacao (login, logout, csrf, check)
            ]

            # Debug: check if health endpoint is being excluded
            if request.path == '/api/health/':
                return self.get_response(request)

            if not any(request.path.startswith(path) for path in public_api_paths):
                # Verificar se o usuario esta autenticado (Session ou Basic Auth)
                if not request.user.is_authenticated:
                    # Tentar Basic Auth
                    self._check_basic_auth(request)

                if not request.user.is_authenticated:
                    return JsonResponse({
                        'error': 'Authentication required',
                        'detail': 'You must be logged in to access this API endpoint.',
                        'login_url': '/login/'
                    }, status=401)

        response = self.get_response(request)
        return response

class SessionSecurityMiddleware:
    """
    Middleware para adicionar seguranca extra as sessoes
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Adicionar cabecalhos de seguranca para paginas autenticadas
        response = self.get_response(request)

        if request.user.is_authenticated:
            # Adicionar cabecalhos de seguranca
            response['X-Frame-Options'] = 'DENY'
            response['X-Content-Type-Options'] = 'nosniff'
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        return response
