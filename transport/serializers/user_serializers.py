# transport/serializers/user_serializers.py

from rest_framework import serializers
from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from transport.services.permissao_service import (
    aplicar_perfil_usuario,
    get_acesso_usuario,
    get_permissoes_flat,
    PERFIS,
)

# =======================================
# === Serializers para Usuários (User) ===
# =======================================

class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer para atualizar o perfil do usuário logado (PATCH)."""
    # Campo de senha não é obrigatório para atualização, apenas se for mudar
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, style={'input_type': 'password'}, help_text="Opcional. Defina para alterar a senha.")
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True, style={'input_type': 'password'}, help_text="Confirmação da nova senha.")

    class Meta:
        model = User
        # Campos permitidos para atualização pelo próprio usuário
        fields = ['first_name', 'last_name', 'email', 'password', 'password_confirm']
        extra_kwargs = {
            # Nenhum campo é estritamente obrigatório no PATCH/PUT vindo do 'me' endpoint
            'email': {'required': False},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate(self, data):
        """Valida a confirmação de senha e se o email já existe."""
        password = data.get('password')
        password_confirm = data.pop('password_confirm', None) # Remove confirmação dos dados a salvar

        # Validação de senha
        if password: # Se uma nova senha foi fornecida
            if not password_confirm:
                raise serializers.ValidationError({"password_confirm": "Confirmação de senha é obrigatória ao definir uma nova senha."})
            if password != password_confirm:
                raise serializers.ValidationError({"password_confirm": "As senhas não coincidem."})
        elif password_confirm:
             # Se a confirmação foi enviada mas a senha não (ou em branco)
             raise serializers.ValidationError({"password": "Senha é obrigatória se a confirmação for fornecida."})

        # Validação de email (verifica se outro usuário já tem esse email)
        email = data.get('email')
        if email and self.instance: # Apenas na atualização (instance existe)
            if User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError({'email': 'Este endereço de e-mail já está em uso por outro usuário.'})

        return data

    def validate_password(self, value):
        if not value:
            return value
        try:
            validate_password(value, self.instance)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def update(self, instance, validated_data):
        """Atualiza a instância do usuário."""
        # Trata a senha separadamente usando set_password para hashing
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)

        # Atualiza os outros campos
        instance = super().update(instance, validated_data)
        instance.save()
        return instance


class UserSerializer(serializers.ModelSerializer):
    """Serializer para CRUD completo de Usuários (usado pelo UserViewSet - Admin)."""
    password = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'},
        help_text="Obrigatório na criação. Opcional na atualização."
    )
    groups = serializers.SlugRelatedField(
        many=True,
        read_only=True,
        slug_field='name'
    )
    perfil = serializers.ChoiceField(
        choices=[(p, p) for p in PERFIS],
        write_only=True,
        required=False,
        allow_blank=True,
        help_text="Perfil de permissões do usuário"
    )
    permissoes = serializers.SerializerMethodField(read_only=True)
    modo_acesso = serializers.SerializerMethodField(read_only=True)
    versao_acesso = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        # Define os campos a serem expostos/editados pela API de admin
        fields = ['id', 'username', 'password', 'first_name', 'last_name', 'email',
                  'is_staff', 'is_active', 'is_superuser',
                  'groups', 'perfil', 'permissoes', 'modo_acesso', 'versao_acesso',
                  'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login', 'permissoes']
        extra_kwargs = {
            'password': {'write_only': True, 'required': False}, # Não obrigatório em GET/PATCH
            'username': {'required': True}, # Username sempre obrigatório
            'email': {'required': False}, # Email não é obrigatório por padrão no Django User
        }

    def get_permissoes(self, obj):
        """Retorna as permissões efetivas do usuário como lista simples."""
        return get_permissoes_flat(obj)

    def get_modo_acesso(self, obj):
        return self._get_access_data(obj)['access_mode']

    def get_versao_acesso(self, obj):
        return self._get_access_data(obj)['version']

    def _get_access_data(self, obj):
        cache_name = '_serialized_access_data'
        if not hasattr(obj, cache_name):
            setattr(obj, cache_name, get_acesso_usuario(obj))
        return getattr(obj, cache_name)

    def validate_username(self, value):
        query = User.objects.filter(username__iexact=value)
        if self.instance:
            query = query.exclude(pk=self.instance.pk)
        if query.exists():
            raise serializers.ValidationError('Já existe um usuário com este nome.')
        return value

    def validate_password(self, value):
        if self.instance and value:
            raise serializers.ValidationError(
                'Use a ação dedicada de redefinição de senha.'
            )
        if value:
            try:
                validate_password(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_email(self, value):
        """Validação extra para garantir unicidade de email na criação/atualização via admin."""
        if not value: # Permite email vazio se 'required=False'
            return value

        # Verifica se o email já existe para outro usuário
        query = User.objects.filter(email__iexact=value)
        if self.instance: # Se for update, exclui o próprio usuário da checagem
             query = query.exclude(pk=self.instance.pk)
        if query.exists():
             raise serializers.ValidationError("Este endereço de e-mail já está em uso.")
        return value

    def validate(self, attrs):
        """Aplica validadores de similaridade usando os dados do novo usuário."""
        attrs = super().validate(attrs)
        password = attrs.get('password')
        if self.instance is None and password:
            candidate = User(
                username=attrs.get('username', ''),
                email=attrs.get('email', ''),
                first_name=attrs.get('first_name', ''),
                last_name=attrs.get('last_name', ''),
            )
            try:
                validate_password(password, candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(
                    {'password': list(exc.messages)}
                ) from exc
        return attrs

    def create(self, validated_data):
        """Cria um novo usuário."""
        perfil = validated_data.pop('perfil', None)

        # Garante que a senha seja obrigatória na criação
        if 'password' not in validated_data or not validated_data['password']:
            raise serializers.ValidationError({'password': 'Este campo é obrigatório na criação.'})

        # Usa create_user para garantir o hash correto da senha
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            is_staff=False,
            is_active=validated_data.get('is_active', True),
            is_superuser=False
        )

        if perfil:
            aplicar_perfil_usuario(user, perfil)

        return user

    def update(self, instance, validated_data):
        """Atualiza um usuário existente."""
        perfil = validated_data.pop('perfil', None)

        # Atualiza a senha SE ela for fornecida e não estiver vazia
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)

        # Impede alteração de is_superuser/is_staff diretamente pelo serializer;
        # isso é controlado pelo perfil.
        validated_data.pop('is_superuser', None)
        validated_data.pop('is_staff', None)
        # Estado é alterado pelo endpoint dedicado, com proteção e auditoria.
        validated_data.pop('is_active', None)

        # Atualiza outros campos (chama o método padrão para o resto)
        instance = super().update(instance, validated_data)
        instance.save()

        if perfil:
            aplicar_perfil_usuario(instance, perfil)

        return instance


class UserAccessUpdateSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=['profile', 'custom'], required=False)
    modo = serializers.ChoiceField(choices=['perfil', 'personalizado'], required=False)
    profile = serializers.ChoiceField(choices=list(PERFIS), required=False, allow_null=True)
    perfil = serializers.ChoiceField(choices=list(PERFIS), required=False, allow_null=True)
    enabled_capabilities = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False,
    )
    modules = serializers.DictField(required=False)
    modulos = serializers.DictField(required=False)
    expected_version = serializers.IntegerField(min_value=1, required=False)
    versao = serializers.IntegerField(min_value=1, required=False)
    confirm_demote_superuser = serializers.BooleanField(required=False, default=False)
    motivo = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        mode = attrs.get('mode', attrs.get('modo'))
        aliases = {'profile': 'perfil', 'custom': 'personalizado'}
        if mode in aliases:
            attrs['mode'] = aliases[mode]
        elif mode:
            attrs['mode'] = mode
        if 'profile' in attrs and 'perfil' not in attrs:
            attrs['perfil'] = attrs['profile']
        if 'expected_version' in attrs and 'versao' not in attrs:
            attrs['versao'] = attrs['expected_version']
        if not attrs.get('mode'):
            raise serializers.ValidationError({'mode': 'Este campo é obrigatório.'})
        if attrs['mode'] == 'perfil' and not attrs.get('perfil'):
            raise serializers.ValidationError({'profile': 'Informe o perfil base.'})
        if attrs['mode'] == 'personalizado' and not (
            'enabled_capabilities' in attrs or 'modules' in attrs or 'modulos' in attrs
        ):
            raise serializers.ValidationError({
                'enabled_capabilities': 'Informe as capacidades personalizadas.',
            })
        if 'versao' not in attrs:
            raise serializers.ValidationError({'expected_version': 'Informe a versão atual.'})
        return attrs


class UserStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()
    expected_version = serializers.IntegerField(min_value=1, required=False)
    versao = serializers.IntegerField(min_value=1, required=False)
    motivo = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if 'expected_version' not in attrs and 'versao' not in attrs:
            raise serializers.ValidationError({
                'expected_version': 'Informe a versão atual do usuário.',
            })
        return attrs


class UserPasswordResetSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    motivo = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'As senhas não coincidem.'})
        return attrs

    def validate_password(self, value):
        try:
            validate_password(value, self.context.get('user'))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value
