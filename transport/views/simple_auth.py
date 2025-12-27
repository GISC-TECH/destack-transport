import json
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_protect, csrf_exempt
from django.contrib import messages
from django.http import JsonResponse


@csrf_exempt  # Isenta CSRF para permitir login via API
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
def simple_logout(request):
    """
    View de logout que aceita JSON.
    Requer CSRF token para prevenir ataques de logout forçado.
    """
    logout(request)

    content_type = request.content_type or ''
    if 'application/json' in content_type or request.method == 'POST':
        return JsonResponse({'success': True, 'message': 'Logout realizado com sucesso'})

    return redirect('/')