#!/usr/bin/env python
"""
Script para adicionar TODAS as permissoes ao usuario admin
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User, Permission
from django.contrib.contenttypes.models import ContentType

try:
    # Buscar usuario admin
    user = User.objects.get(username='admin')
    
    # Garantir que é superuser
    user.is_staff = True
    user.is_superuser = True
    user.save()
    
    # Adicionar TODAS as permissoes
    all_permissions = Permission.objects.all()
    user.user_permissions.set(all_permissions)
    
    print(f"✅ Usuario '{user.username}' atualizado com TODAS as permissoes!")
    print(f"   - is_staff: {user.is_staff}")
    print(f"   - is_superuser: {user.is_superuser}")
    print(f"   - Total de permissoes: {user.user_permissions.count()}")
    
    # Listar algumas permissoes importantes
    important_perms = user.user_permissions.filter(
        codename__in=['add_cliente', 'change_cliente', 'delete_cliente',
                      'add_motorista', 'change_motorista', 'delete_motorista',
                      'add_veiculo', 'change_veiculo', 'delete_veiculo']
    )
    
    if important_perms.exists():
        print(f"\n   Permissoes importantes adicionadas:")
        for perm in important_perms:
            print(f"   - {perm.codename}")
    
except User.DoesNotExist:
    print("❌ Usuario 'admin' nao encontrado!")
    
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()
