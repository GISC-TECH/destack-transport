"""Fecha o atalho não auditado de usuários e grupos no Django Admin.

Usuários, perfis e permissões são administrados pela API/tela dedicada, que
exige a permissão direta protegida e grava auditoria transacional. Manter os
admins padrão de ``auth.User`` e ``auth.Group`` permitiria que qualquer conta
``is_superuser`` contornasse essas duas garantias.
"""

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.admin.sites import NotRegistered


for model in (get_user_model(), Group):
    try:
        admin.site.unregister(model)
    except NotRegistered:
        # Compatível com ambientes que já substituem o admin de autenticação.
        pass
