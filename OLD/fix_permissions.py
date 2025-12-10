#!/usr/bin/env python
"""
Script para corrigir permissoes do usuario admin
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User

try:
    # Buscar usuario admin
    user = User.objects.get(username='admin')
    
    # Atualizar permissoes
    user.is_staff = True
    user.is_superuser = True
    user.save()
    
    print(f"✅ Usuario '{user.username}' atualizado com sucesso!")
    print(f"   - is_staff: {user.is_staff}")
    print(f"   - is_superuser: {user.is_superuser}")
    print(f"   - is_active: {user.is_active}")
    
except User.DoesNotExist:
    print("❌ Usuario 'admin' nao encontrado!")
    print("Criando novo superusuario...")
    
    user = User.objects.create_superuser(
        username='admin',
        email='admin@destack.com',
        password='admin123'
    )
    print(f"✅ Superusuario 'admin' criado com sucesso!")
    print(f"   - Username: {user.username}")
    print(f"   - Email: {user.email}")
    print(f"   - Password: admin123")
    
except Exception as e:
    print(f"❌ Erro: {e}")
