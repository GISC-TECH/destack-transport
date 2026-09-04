import base64
from django.http import JsonResponse
from django.urls import resolve
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.contrib.auth import get_user, authenticate, logout

class APIAuthenticationMiddleware:
    """
    Middleware para autenticacao via Basic Auth em requisicoes API.
    NAO deve bloquear requisicoes aqui; a autenticacao/autorizacao e
    responsabilidade do DRF (SessionAuthentication + IsAuthenticated).
    Isso evita 401 prematuros em endpoints que dependem do processamento
    normal do Django/DRF (ex: /api/users/me/permissions/).
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
            except (ValueError, TypeError, UnicodeDecodeError):
                pass
        return False

    def __call__(self, request):
        # Aplica Basic Auth apenas para rotas /api/ que ja chegarem com credenciais.
        # Nao bloqueia requisicoes anonimas; o DRF/View decide o acesso.
        if request.path.startswith('/api/') and not request.user.is_authenticated:
            self._check_basic_auth(request)

        response = self.get_response(request)
        return response

class SessionSecurityMiddleware:
    """
    Middleware para adicionar seguranca extra as sessoes
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            from transport.services.permissao_service import obter_configuracao_acesso

            current_version = obter_configuracao_acesso(request.user).versao
            session_version = request.session.get('access_control_version')
            if session_version is None:
                # Compatibilidade com sessões abertas antes da implantação.
                request.session['access_control_version'] = current_version
            elif session_version != current_version:
                logout(request)

        # Adicionar cabecalhos de seguranca para paginas autenticadas
        response = self.get_response(request)

        if request.user.is_authenticated:
            # Adicionar cabecalhos de seguranca
            response['X-Frame-Options'] = 'DENY'
            response['X-Content-Type-Options'] = 'nosniff'
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        return response
