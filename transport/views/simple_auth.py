import json
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.csrf import csrf_protect, csrf_exempt
from django.views.decorators.http import require_POST
from django.contrib import messages
from django.http import JsonResponse
from django.core.cache import cache


def get_client_ip(request):
    """Obtem o IP real do cliente, considerando proxies."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def login_rate_limit(max_attempts=5, window=60):
    """
    Decorator que limita tentativas de login por IP.
    - max_attempts: numero maximo de tentativas no intervalo.
    - window: duracao da janela em segundos.
    Retorna 429 Too Many Requests quando o limite e excedido.
    """
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            if request.method == 'POST':
                ip = get_client_ip(request)
                cache_key = f"login_attempt_{ip}"
                attempts = cache.get(cache_key, 0)

                if attempts >= max_attempts:
                    return JsonResponse(
                        {'detail': 'Muitas tentativas de login. Tente novamente em alguns minutos.'},
                        status=429
                    )

                response = view_func(request, *args, **kwargs)

                # Em caso de sucesso, reseta o contador; caso contrario, incrementa.
                status = getattr(response, 'status_code', None)
                if status in (200, 302):
                    cache.delete(cache_key)
                else:
                    cache.set(cache_key, attempts + 1, window)

                return response

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


@sensitive_post_parameters('password')
@csrf_exempt  # Isenta CSRF para permitir login via API
@login_rate_limit(max_attempts=5, window=60)
def simple_login(request):
    """
    View de login que aceita tanto form tradicional quanto JSON.
    csrf_exempt para permitir login inicial sem cookie CSRF.
    """
    if request.method == 'POST':
        # Tenta parsear JSON primeiro (para frontend React)
        content_type = request.content_type or ''

        if 'application/json' in content_type:
            try:
                data = json.loads(request.body)
                username = data.get('username')
                password = data.get('password')
            except (json.JSONDecodeError, ValueError):
                return JsonResponse({'detail': 'JSON invalido'}, status=400)
        else:
            # Form tradicional
            username = request.POST.get('username')
            password = request.POST.get('password')

        if not username or not password:
            return JsonResponse({'detail': 'Username e password sao obrigatorios'}, status=400)

        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            from transport.services.permissao_service import obter_configuracao_acesso
            request.session['access_control_version'] = obter_configuracao_acesso(user).versao

            # Se for requisicao JSON, retorna JSON
            if 'application/json' in content_type:
                return JsonResponse({
                    'success': True,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                        'is_staff': user.is_staff,
                        'is_superuser': user.is_superuser,
                    }
                })
            else:
                # Redirect para form tradicional
                next_url = request.GET.get('next', '/dashboard/')
                return redirect(next_url)
        else:
            if 'application/json' in content_type:
                return JsonResponse({'detail': 'Credenciais invalidas'}, status=401)
            else:
                messages.error(request, 'Usuario ou senha incorretos.')

    # GET request - renderiza pagina de login
    if request.user.is_authenticated:
        return redirect('/dashboard/')

    return render(request, 'login.html')


@csrf_protect
@require_POST
def simple_logout(request):
    """
    View de logout para a API.

    Logout altera estado de autenticação, portanto só aceita POST protegido por
    CSRF. Isso evita que uma navegação GET force logout do usuário.
    """
    logout(request)
    return JsonResponse({'success': True, 'message': 'Logout realizado com sucesso'})
