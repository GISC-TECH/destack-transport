#!/usr/bin/env python
"""
Script de Diagnostico Completo - Erro 403 Forbidden
Identifica a causa raiz do problema
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from django.test import Client
from transport.models import Cliente

print("=" * 60)
print("DIAGNOSTICO COMPLETO - ERRO 403 FORBIDDEN")
print("=" * 60)
print()

# 1. Verificar Usuario
print("1. VERIFICANDO USUARIO ADMIN")
print("-" * 60)
try:
    user = User.objects.get(username='admin')
    print(f"✅ Usuario encontrado: {user.username}")
    print(f"   - is_active: {user.is_active}")
    print(f"   - is_staff: {user.is_staff}")
    print(f"   - is_superuser: {user.is_superuser}")
    print(f"   - Total de permissoes: {user.user_permissions.count()}")
    
    # Verificar permissoes especificas
    perms = ['add_cliente', 'change_cliente', 'delete_cliente']
    for perm in perms:
        has_perm = user.has_perm(f'transport.{perm}')
        status = "✅" if has_perm else "❌"
        print(f"   {status} {perm}: {has_perm}")
except User.DoesNotExist:
    print("❌ Usuario 'admin' nao encontrado!")
except Exception as e:
    print(f"❌ Erro: {e}")

print()

# 2. Testar Django Test Client (simula requisicao)
print("2. TESTANDO CRIACAO VIA DJANGO TEST CLIENT")
print("-" * 60)
try:
    client = Client()
    
    # Login
    logged_in = client.login(username='admin', password='admin123')
    print(f"Login: {'✅ Sucesso' if logged_in else '❌ Falhou'}")
    
    if logged_in:
        # Tentar criar cliente
        data = {
            'cnpj': '12345678000190',
            'razao_social': 'Teste Diagnostico LTDA',
            'nome_fantasia': 'Teste',
            'tipo_frete': 'CIF',
            'ativo': True
        }
        
        response = client.post('/api/clientes/', data, content_type='application/json')
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 201:
            print("✅ Cliente criado com sucesso via Test Client!")
            print(f"   Resposta: {response.json()}")
        elif response.status_code == 403:
            print("❌ Erro 403 Forbidden via Test Client")
            try:
                print(f"   Resposta: {response.json()}")
            except:
                print(f"   Resposta: {response.content}")
        else:
            print(f"⚠️ Status inesperado: {response.status_code}")
            try:
                print(f"   Resposta: {response.json()}")
            except:
                print(f"   Resposta: {response.content}")
                
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()

print()

# 3. Verificar Configuracoes DRF
print("3. VERIFICANDO CONFIGURACOES DRF")
print("-" * 60)
try:
    from django.conf import settings
    
    rest_config = settings.REST_FRAMEWORK
    print(f"DEFAULT_PERMISSION_CLASSES:")
    for perm_class in rest_config.get('DEFAULT_PERMISSION_CLASSES', []):
        print(f"   - {perm_class}")
    
    print(f"\nDEFAULT_AUTHENTICATION_CLASSES:")
    for auth_class in rest_config.get('DEFAULT_AUTHENTICATION_CLASSES', []):
        print(f"   - {auth_class}")
        
except Exception as e:
    print(f"❌ Erro: {e}")

print()

# 4. Verificar CSRF
print("4. VERIFICANDO CONFIGURACOES CSRF")
print("-" * 60)
try:
    from django.conf import settings
    
    print(f"CSRF_COOKIE_NAME: {settings.CSRF_COOKIE_NAME}")
    print(f"CSRF_COOKIE_HTTPONLY: {settings.CSRF_COOKIE_HTTPONLY}")
    print(f"CSRF_USE_SESSIONS: {settings.CSRF_USE_SESSIONS}")
    print(f"CSRF_COOKIE_SAMESITE: {settings.CSRF_COOKIE_SAMESITE}")
    
except Exception as e:
    print(f"❌ Erro: {e}")

print()

# 5. Testar Criacao Direta no Banco
print("5. TESTANDO CRIACAO DIRETA NO BANCO")
print("-" * 60)
try:
    # Criar cliente diretamente
    cliente = Cliente.objects.create(
        cnpj='99988877000166',
        razao_social='Teste Direto LTDA',
        nome_fantasia='Teste Direto',
        tipo_frete='CIF',
        ativo=True
    )
    print(f"✅ Cliente criado diretamente no banco!")
    print(f"   ID: {cliente.id}")
    print(f"   CNPJ: {cliente.cnpj}")
    print(f"   Razao Social: {cliente.razao_social}")
    
    # Deletar para nao poluir
    cliente.delete()
    print(f"✅ Cliente de teste deletado")
    
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()

print()

# 6. Conclusao
print("=" * 60)
print("CONCLUSAO")
print("=" * 60)
print()
print("Se:")
print("- Usuario tem permissoes: ✅")
print("- Test Client funciona: ✅")
print("- Criacao direta funciona: ✅")
print("- Mas browser retorna 403: ❌")
print()
print("Entao o problema esta em:")
print("1. CSRF Token nao sendo enviado corretamente")
print("2. Sessao nao sendo mantida entre requisicoes")
print("3. Middleware bloqueando requisicoes AJAX")
print()
