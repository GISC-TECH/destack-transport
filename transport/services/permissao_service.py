"""
Serviço centralizado para gestão de permissões e perfis de acesso.

Reutiliza os grupos nativos do Django (`auth_group`) e as permissões de modelo
para criar perfis pré-definidos: Leitura, Operacional, Financeiro e Administrativo.
"""

from django.apps import apps
from django.contrib.auth.models import Group, Permission
from django.db import transaction
from django.db.models import Q

from transport.models import AuditoriaAcessoUsuario, ConfiguracaoAcessoUsuario


ACOES_PERMITIDAS = ('view', 'add', 'change', 'delete')
PERMISSOES_PROTEGIDAS = frozenset({
    'transport.gerenciar_acessos_usuarios',
    'transport.editar_valor_frete_cte',
    'transport.excluir_cte_importado',
})


class ConflitoVersaoAcesso(Exception):
    def __init__(self, versao_atual):
        self.versao_atual = versao_atual
        super().__init__('As permissões foram alteradas por outra sessão.')


class OperacaoAcessoProtegida(Exception):
    pass


# ============================================================
# MAPEAMENTO DE MÓDULOS E MODELOS
# ============================================================

MODULOS_PERMISSOES = {
    "dashboard": {
        "label": "Dashboard e Painéis",
        "icon": "layout-dashboard",
        "modelos": [
            "dashboardcache",
        ],
        "acoes_padrao": ["view"],
    },
    "cte": {
        "label": "CT-e",
        "icon": "file-text",
        "modelos": [
            "ctedocumento",
            "cteidentificacao",
            "cteemitente",
            "cteremetente",
            "ctedestinatario",
            "cteprestacaoservico",
            "ctetributos",
            "cteprotocoloautorizacao",
            "ctecomplemento",
            "ctesuplementar",
            "ctecarga",
            "ctecancelamento",
            "ctecartacorrecao",
            "documentoevento",
        ],
    },
    "mdfe": {
        "label": "MDF-e",
        "icon": "truck",
        "modelos": [
            "mdfedocumento",
            "mdfeidentificacao",
            "mdfeemitente",
            "mdfeveiculotracao",
            "mdfedocumentosvinculados",
            "mdfeprotocoloautorizacao",
            "mdfemunicipiocarregamento",
            "mdfemunicipiodescarga",
            "mdfecancelamento",
            "mdfecancelamentoencerramento",
        ],
    },
    "clientes": {
        "label": "Clientes",
        "icon": "users",
        "modelos": ["cliente", "clientedocumento"],
    },
    "motoristas": {
        "label": "Motoristas",
        "icon": "user",
        "modelos": ["motorista", "motoristadocumento"],
    },
    "veiculos": {
        "label": "Veículos",
        "icon": "truck",
        "modelos": ["veiculo", "compartimentacaoveiculo", "veiculodocumento", "manutencaoveiculo", "planomanutencao"],
    },
    "pagamentos": {
        "label": "Pagamentos",
        "icon": "dollar-sign",
        "modelos": ["pagamentoagregado", "pagamentoproprio", "faixakm"],
    },
    "financeiro": {
        "label": "Financeiro",
        "icon": "trending-up",
        "modelos": [
            "fatura",
            "faturaitem",
            "contapagar",
            "transacaobancaria",
            "inadimplencia",
        ],
    },
    "ordens_viagem": {
        "label": "Ordens de Viagem",
        "icon": "map-pin",
        "modelos": ["ordemviagem", "ordemviagemcte", "ordemviagemparada", "despesaviagem"],
    },
    "frota": {
        "label": "Frota e Operações",
        "icon": "cpu",
        "modelos": [
            "abastecimento",
            "pedagio",
            "multa",
            "sinistro",
            "tabelafrete",
            "ciot",
            "posicaoveiculo",
        ],
    },
    "comunicacao": {
        "label": "Comunicação",
        "icon": "message-circle",
        "modelos": ["mensagemcomunicacao"],
    },
    "documentos": {
        "label": "Documentos Anexos",
        "icon": "paperclip",
        "modelos": ["documentoanexo", "ctedocumentoanexo"],
    },
    "recepcao": {
        "label": "Recepção de Documentos",
        "icon": "inbox",
        "modelos": ["documentofiscalgenerico", "documentoevento"],
    },
    "configuracoes": {
        "label": "Configurações",
        "icon": "settings",
        "modelos": ["configuracaoempresa", "parametrosistema", "controlenumeracao"],
    },
    "usuarios": {
        "label": "Usuários",
        "icon": "shield",
        "modelos": ["user"],  # auth.User
    },
    "backup": {
        "label": "Backup",
        "icon": "archive",
        "modelos": ["registrobackup"],
    },
    "alertas": {
        "label": "Alertas",
        "icon": "bell",
        "modelos": ["alertasistema"],
    },
}


# Actions que não correspondem diretamente ao CRUD de um ViewSet. O catálogo
# público usa chaves estáveis; codenames e modelos internos não são aceitos da UI.
ACOES_ESPECIAIS = {
    'financeiro.inadimplencia': {
        'modulo': 'financeiro', 'acao_base': 'view',
        'codename': 'visualizar_inadimplencia', 'label': 'Visualizar inadimplência',
    },
    'financeiro.fluxo_caixa': {
        'modulo': 'financeiro', 'acao_base': 'view',
        'codename': 'visualizar_fluxo_caixa', 'label': 'Visualizar fluxo de caixa',
    },
    'financeiro.dre': {
        'modulo': 'financeiro', 'acao_base': 'view',
        'codename': 'visualizar_dre', 'label': 'Visualizar DRE',
    },
    'comunicacao.enviar': {
        'modulo': 'comunicacao', 'acao_base': 'add',
        'codename': 'enviar_comunicacao', 'label': 'Enviar comunicações',
    },
    'comunicacao.testar': {
        'modulo': 'comunicacao', 'acao_base': 'change',
        'codename': 'testar_comunicacao', 'label': 'Testar integração de comunicação',
    },
    'frota.visualizar_gps': {
        'modulo': 'frota', 'acao_base': 'view',
        'codename': 'visualizar_posicao_gps', 'label': 'Visualizar posição GPS',
    },
    'dashboard.relatorios': {
        'modulo': 'dashboard', 'acao_base': 'view',
        'codename': 'visualizar_relatorios', 'label': 'Visualizar relatórios',
    },
    'dashboard.geral': {
        'modulo': 'dashboard', 'acao_base': 'view',
        'codename': 'visualizar_dashboard_geral', 'label': 'Visualizar dashboard geral',
    },
    'cte.painel': {
        'modulo': 'cte', 'acao_base': 'view',
        'codename': 'visualizar_dashboard_cte', 'label': 'Visualizar painel de CT-e',
    },
    'mdfe.painel': {
        'modulo': 'mdfe', 'acao_base': 'view',
        'codename': 'visualizar_dashboard_mdfe', 'label': 'Visualizar painel de MDF-e',
    },
    'financeiro.painel': {
        'modulo': 'financeiro', 'acao_base': 'view',
        'codename': 'visualizar_dashboard_financeiro', 'label': 'Visualizar painel financeiro',
    },
    'frota.painel': {
        'modulo': 'frota', 'acao_base': 'view',
        'codename': 'visualizar_dashboard_frota', 'label': 'Visualizar painel de frota',
    },
}


# ============================================================
# PERFIS PRÉ-DEFINIDOS
# ============================================================

PERFIS = {
    "Leitura": {
        "description": "Apenas visualização de dados. Não pode criar, editar ou excluir.",
        "acoes_por_modulo": {
            modulo: ["view"]
            for modulo in MODULOS_PERMISSOES
            if modulo not in {"usuarios", "backup"}
        },
    },
    "Operacional": {
        "description": "Operação do dia a dia: CT-e, MDF-e, motoristas, veículos, clientes, ordens de viagem e manutenção.",
        "acoes_por_modulo": {
            "dashboard": ["view"],
            "cte": ["view", "add", "change"],
            "mdfe": ["view", "add", "change"],
            "clientes": ["view", "add", "change"],
            "motoristas": ["view", "add", "change"],
            "veiculos": ["view", "add", "change"],
            "pagamentos": ["view"],
            "financeiro": ["view"],
            "ordens_viagem": ["view", "add", "change"],
            "frota": ["view", "add", "change"],
            "comunicacao": ["view", "add"],
            "documentos": ["view", "add", "change", "delete"],
            "recepcao": ["view", "add", "change"],
            "configuracoes": ["view"],
            "alertas": ["view", "change"],
        },
    },
    "Financeiro": {
        "description": "Gestão financeira: pagamentos, faturas, contas a pagar, conciliação, DRE e fluxo de caixa.",
        "acoes_por_modulo": {
            "dashboard": ["view"],
            "cte": ["view"],
            "mdfe": ["view"],
            "clientes": ["view"],
            "motoristas": ["view"],
            "veiculos": ["view"],
            "pagamentos": ["view", "add", "change", "delete"],
            "financeiro": ["view", "add", "change", "delete"],
            "ordens_viagem": ["view"],
            "frota": ["view"],
            "comunicacao": ["view"],
            "documentos": ["view"],
            "recepcao": ["view"],
            "configuracoes": ["view"],
            "alertas": ["view", "change"],
        },
    },
    "Administrativo": {
        "description": "Configurações do sistema, usuários, backup, parâmetros e cadastros administrativos.",
        "acoes_por_modulo": {
            "dashboard": ["view"],
            "cte": ["view"],
            "mdfe": ["view"],
            "clientes": ["view", "add", "change", "delete"],
            "motoristas": ["view", "add", "change", "delete"],
            "veiculos": ["view", "add", "change", "delete"],
            "pagamentos": ["view"],
            "financeiro": ["view"],
            "ordens_viagem": ["view"],
            "frota": ["view"],
            "comunicacao": ["view", "add"],
            "documentos": ["view", "add", "change", "delete"],
            "recepcao": ["view", "add", "change", "delete"],
            "configuracoes": ["view", "add", "change", "delete"],
            "backup": ["view", "add", "change", "delete"],
            "alertas": ["view", "add", "change", "delete"],
        },
    },
}


def get_modelos_do_modulo(modulo):
    """Retorna a lista de nomes de modelos de um módulo."""
    return MODULOS_PERMISSOES.get(modulo, {}).get("modelos", [])


def get_permissoes_do_perfil(nome_perfil):
    """
    Retorna um QuerySet de Permission correspondente a um perfil pré-definido.
    """
    if nome_perfil not in PERFIS:
        return Permission.objects.none()

    config = PERFIS[nome_perfil]
    permissoes_q = Q()

    for modulo, acoes in config["acoes_por_modulo"].items():
        modelos = get_modelos_do_modulo(modulo)
        for modelo in modelos:
            for acao in acoes:
                codename = f"{acao}_{modelo}"
                permissoes_q |= Q(codename=codename, content_type__app_label="transport")

    for info in ACOES_ESPECIAIS.values():
        if info['acao_base'] in config['acoes_por_modulo'].get(info['modulo'], []):
            permissoes_q |= Q(
                codename=info['codename'],
                content_type__app_label='transport',
                content_type__model='configuracaoacessousuario',
            )

    # Permissões do app auth (usuários)
    if "usuarios" in config["acoes_por_modulo"]:
        acoes = config["acoes_por_modulo"]["usuarios"]
        for acao in acoes:
            codename = f"{acao}_user"
            permissoes_q |= Q(codename=codename, content_type__app_label="auth")

    return Permission.objects.filter(permissoes_q).distinct()


@transaction.atomic
def criar_ou_atualizar_grupo(nome_perfil, actor=None, request=None, motivo=''):
    """Cria ou atualiza um grupo do Django com as permissões do perfil."""
    if nome_perfil not in PERFIS:
        raise ValueError(f"Perfil '{nome_perfil}' não existe. Opções: {list(PERFIS.keys())}")

    config = PERFIS[nome_perfil]
    grupo, _ = Group.objects.get_or_create(name=nome_perfil)
    affected = []
    before = {}
    if actor:
        affected = list(grupo.user_set.select_for_update())
        for user in affected:
            user_config = obter_configuracao_acesso(user, bloquear=True)
            before[user.pk] = _snapshot_acesso(user, user_config)
    permissoes = get_permissoes_do_perfil(nome_perfil)
    grupo.permissions.set(permissoes)
    if actor:
        for user in affected:
            user_config = obter_configuracao_acesso(user, bloquear=True)
            user_config.versao += 1
            user_config.atualizado_por = actor
            user_config.save(update_fields=['versao', 'atualizado_por', 'atualizado_em'])
            user._state.fields_cache['configuracao_acesso'] = user_config
            for cache_name in ('_perm_cache', '_user_perm_cache', '_group_perm_cache', '_access_permission_context'):
                user.__dict__.pop(cache_name, None)
            _registrar_auditoria(
                actor, user, 'sincronizacao_perfil', before[user.pk],
                _snapshot_acesso(user, user_config), request, motivo=motivo,
            )
    return grupo


@transaction.atomic
def atualizar_permissoes_grupo(
    nome_perfil, modulos_acoes, actor=None, request=None, motivo=''
):
    """
    Atualiza as permissões de um grupo existente com base nos módulos/ações
    enviados pelo usuário. Não altera a definição estática em PERFIS.
    """
    if nome_perfil not in PERFIS:
        raise ValueError(f"Perfil '{nome_perfil}' não existe.")

    grupo, _ = Group.objects.get_or_create(name=nome_perfil)
    affected = []
    before = {}
    if actor:
        affected = list(grupo.user_set.select_for_update())
        for user in affected:
            user_config = obter_configuracao_acesso(user, bloquear=True)
            before[user.pk] = _snapshot_acesso(user, user_config)
    permissoes_q = Q()

    for modulo, acoes in modulos_acoes.items():
        if modulo not in MODULOS_PERMISSOES:
            raise ValueError(f"Módulo '{modulo}' inválido.")
        if modulo == 'backup' and nome_perfil != 'Administrativo' and acoes:
            raise ValueError(
                'O acesso a backup nao pode ser concedido a perfis nao administrativos.'
            )
        acoes_invalidas = set(acoes) - set(ACOES_PERMITIDAS)
        if acoes_invalidas:
            raise ValueError(
                f"Ações inválidas no módulo '{modulo}': {', '.join(sorted(acoes_invalidas))}."
            )

        modelos = get_modelos_do_modulo(modulo)
        app_label = "auth" if modulo == "usuarios" else "transport"

        for modelo in modelos:
            for acao in acoes:
                codename = f"{acao}_{modelo}"
                permissoes_q |= Q(codename=codename, content_type__app_label=app_label)

    for info in ACOES_ESPECIAIS.values():
        if info['acao_base'] in modulos_acoes.get(info['modulo'], []):
            permissoes_q |= Q(
                codename=info['codename'],
                content_type__app_label='transport',
                content_type__model='configuracaoacessousuario',
            )

    permissoes = Permission.objects.filter(permissoes_q).distinct()
    grupo.permissions.set(permissoes)
    if actor:
        for user in affected:
            user_config = obter_configuracao_acesso(user, bloquear=True)
            user_config.versao += 1
            user_config.atualizado_por = actor
            user_config.save(update_fields=['versao', 'atualizado_por', 'atualizado_em'])
            user._state.fields_cache['configuracao_acesso'] = user_config
            for cache_name in ('_perm_cache', '_user_perm_cache', '_group_perm_cache', '_access_permission_context'):
                user.__dict__.pop(cache_name, None)
            _registrar_auditoria(
                actor, user, 'alteracao_perfil', before[user.pk],
                _snapshot_acesso(user, user_config), request, motivo=motivo,
            )
    return grupo


def criar_todos_os_grupos_padrao():
    """Cria/atualiza todos os grupos padrão do sistema."""
    grupos = {}
    for nome in PERFIS:
        grupos[nome] = criar_ou_atualizar_grupo(nome)
    return grupos


def aplicar_perfil_usuario(user, nome_perfil):
    """Remove grupos antigos de perfil e aplica o novo grupo."""
    if nome_perfil not in PERFIS:
        raise ValueError(f"Perfil '{nome_perfil}' inválido.")

    # Limpa grupos de perfis conhecidos
    grupos_perfil = list(PERFIS.keys())
    user.groups.remove(*user.groups.filter(name__in=grupos_perfil))

    user.is_superuser = False
    # Mantém is_staff apenas para Administrativo
    user.is_staff = nome_perfil == "Administrativo"
    grupo = Group.objects.get(name=nome_perfil)
    user.groups.add(grupo)

    user.save(update_fields=["is_superuser", "is_staff"])
    ConfiguracaoAcessoUsuario.objects.update_or_create(
        usuario=user,
        defaults={
            'modo': ConfiguracaoAcessoUsuario.MODO_PERFIL,
            'perfil_base': nome_perfil,
        },
    )
    return user


def get_permissoes_efetivas(user):
    """
    Retorna um dicionário com todas as permissões efetivas do usuário,
    organizadas por módulo e ação.
    """
    from transport.permissions import can_manage_user_access

    config = obter_configuracao_acesso(user)
    capabilities = {
        key: user_has_capability(user, key)
        for key in ACOES_ESPECIAIS
    }
    capabilities['usuarios.manage_access'] = can_manage_user_access(user)

    if user.is_superuser:
        # Superusuário tem tudo
        resultado = {}
        for modulo, info in MODULOS_PERMISSOES.items():
            acoes = info.get("acoes_padrao", ["view", "add", "change", "delete"])
            resultado[modulo] = {acao: True for acao in acoes}
        return {
            "superuser": True,
            "modulos": resultado,
            "capabilities": capabilities,
            "version": config.versao,
        }

    resultado = {}
    for modulo, info in MODULOS_PERMISSOES.items():
        modelos = info["modelos"]
        acoes_padrao = info.get("acoes_padrao", ["view", "add", "change", "delete"])
        permissoes_modulo = {acao: False for acao in acoes_padrao}

        # O modelo User pertence ao app auth, não ao transport
        app_label = "auth" if modulo == "usuarios" else "transport"

        for modelo in modelos:
            for acao in acoes_padrao:
                codename = f"{app_label}.{acao}_{modelo}"
                if user_has_model_permission(user, codename, modelo):
                    permissoes_modulo[acao] = True

        resultado[modulo] = permissoes_modulo

    resultado["dashboard"] = resultado.get("dashboard", {})
    resultado["dashboard"]["view"] = user_has_capability(user, 'dashboard.geral')

    return {
        "superuser": False,
        "modulos": resultado,
        "capabilities": capabilities,
        "version": config.versao,
    }


def get_permissoes_flat(user):
    """Retorna lista simples de permissões que o usuário possui."""
    return sorted(_permission_context(user)['effective'])


def obter_configuracao_acesso(user, bloquear=False):
    """Obtém a configuração, inferindo o modo atual sem alterar permissões."""
    if not bloquear:
        try:
            return user.configuracao_acesso
        except ConfiguracaoAcessoUsuario.DoesNotExist:
            pass

    queryset = ConfiguracaoAcessoUsuario.objects
    if bloquear:
        queryset = queryset.select_for_update()

    grupos_perfil = list(user.groups.filter(name__in=PERFIS).values_list('name', flat=True))
    modo = ConfiguracaoAcessoUsuario.MODO_PERFIL if len(grupos_perfil) == 1 else ConfiguracaoAcessoUsuario.MODO_PERSONALIZADO
    perfil = grupos_perfil[0] if len(grupos_perfil) == 1 else ''
    config, _ = queryset.get_or_create(
        usuario=user,
        defaults={'modo': modo, 'perfil_base': perfil},
    )
    if not bloquear:
        user._state.fields_cache['configuracao_acesso'] = config
    return config


def _permission_context(user):
    """Carrega permissões uma única vez por instância de User/requisição."""
    cached = getattr(user, '_access_permission_context', None)
    if cached is not None:
        return cached

    prefetched = getattr(user, '_prefetched_objects_cache', {})
    direct_source = (
        user.user_permissions.all()
        if 'user_permissions' in prefetched
        else user.user_permissions.select_related('content_type').all()
    )
    group_source = (
        user.groups.all()
        if 'groups' in prefetched
        else user.groups.prefetch_related('permissions__content_type').all()
    )
    direct = {
        f'{permission.content_type.app_label}.{permission.codename}'
        for permission in direct_source
    }
    group_permissions = {
        f'{permission.content_type.app_label}.{permission.codename}'
        for group in group_source
        for permission in group.permissions.all()
    }
    context = {
        'direct': direct,
        'groups': group_permissions,
        'effective': direct | group_permissions,
        'config': obter_configuracao_acesso(user),
    }
    user._access_permission_context = context
    return context


def _model_permission_q(modulo, acoes):
    info = MODULOS_PERMISSOES[modulo]
    app_label = 'auth' if modulo == 'usuarios' else 'transport'
    query = Q(pk__in=[])
    for modelo in info['modelos']:
        for acao in acoes:
            query |= Q(
                content_type__app_label=app_label,
                content_type__model=modelo,
                codename=f'{acao}_{modelo}',
            )
    return query


def get_permissoes_catalogadas():
    """Permissões comuns e especiais que podem ser atribuídas pela tela."""
    query = Q(pk__in=[])
    for modulo, info in MODULOS_PERMISSOES.items():
        if modulo == 'usuarios':
            continue
        query |= _model_permission_q(modulo, info.get('acoes_padrao', ACOES_PERMITIDAS))
    query |= Q(
        content_type__app_label='transport',
        content_type__model='configuracaoacessousuario',
        codename__in=[item['codename'] for item in ACOES_ESPECIAIS.values()],
    )
    return Permission.objects.filter(query).exclude(
        content_type__app_label='transport',
        codename__in=[perm.split('.', 1)[1] for perm in PERMISSOES_PROTEGIDAS],
    ).distinct()


def _model_exists(app_label, model_name):
    try:
        return apps.get_model(app_label, model_name, require_ready=False) is not None
    except LookupError:
        return False


def get_catalogo_acessos():
    """Catálogo declarativo aceito pela API de administração de acessos."""
    modulos = []
    capabilities = []

    for modulo, info in MODULOS_PERMISSOES.items():
        if modulo == 'usuarios':
            continue
        app_label = 'transport'
        acoes = []
        for acao in info.get('acoes_padrao', ACOES_PERMITIDAS):
            exists = any(
                _model_exists(app_label, modelo)
                for modelo in info['modelos']
            )
            if exists or modulo == 'dashboard':
                item = {
                    'key': f'{modulo}.{acao}',
                    'module': modulo,
                    'module_label': info['label'],
                    'label': {'view': 'Visualizar', 'add': 'Criar', 'change': 'Editar', 'delete': 'Excluir'}[acao],
                    'action': acao,
                    'locked': modulo == 'dashboard' and not exists,
                }
                acoes.append(item)
                capabilities.append(item)
        especiais = []
        for key, special in ACOES_ESPECIAIS.items():
            if special['modulo'] != modulo:
                continue
            item = {
                'key': key,
                'module': modulo,
                'module_label': info['label'],
                'label': special['label'],
                'action': 'special',
                'locked': False,
            }
            especiais.append(item)
            capabilities.append(item)
        modulos.append({
            'key': modulo,
            'label': info['label'],
            'icon': info.get('icon'),
            'actions': acoes,
            'special_actions': especiais,
        })

    capabilities.extend([
        {
            'key': 'usuarios.manage_access', 'module': 'usuarios',
            'module_label': 'Usuários', 'label': 'Gerenciar usuários e acessos',
            'action': 'special', 'locked': True,
            'lock_reason': 'Permissão operacional protegida.',
        },
        {
            'key': 'cte.editar_valor_frete', 'module': 'cte',
            'module_label': 'CT-e', 'label': 'Editar valor do frete',
            'action': 'special', 'locked': True,
            'lock_reason': 'Permissão exclusiva concedida fora do painel.',
        },
        {
            'key': 'cte.excluir_importado', 'module': 'cte',
            'module_label': 'CT-e', 'label': 'Excluir CT-e importado',
            'action': 'special', 'locked': True,
            'lock_reason': 'Permissão exclusiva concedida fora do painel.',
        },
    ])
    return {
        'modules': modulos,
        'modulos': modulos,
        'capabilities': capabilities,
        'profiles': [
            {'name': nome, 'label': nome, 'description': cfg['description']}
            for nome, cfg in PERFIS.items()
        ],
    }


def _permission_ids_for_capabilities(keys, target=None):
    """Traduz somente chaves públicas allowlisted para Permission IDs."""
    catalog = get_catalogo_acessos()
    all_keys = {item['key'] for item in catalog['capabilities']}
    assignable = {item['key'] for item in catalog['capabilities'] if not item.get('locked')}
    unknown = set(keys) - all_keys
    if unknown:
        raise ValueError(f"Capacidades inválidas: {', '.join(sorted(unknown))}.")
    locked = set(keys) - assignable
    if locked:
        current_locked = set()
        if target:
            current_locked = {
                item['key'] for item in get_acesso_usuario(target)['capabilities']
                if item.get('locked') and item.get('enabled')
            }
        forbidden = locked - current_locked
        if forbidden:
            raise ValueError(
                f"Capacidades protegidas não podem ser atribuídas: {', '.join(sorted(forbidden))}."
            )
        keys = [key for key in keys if key in assignable]

    query = Q(pk__in=[])
    for key in keys:
        if key in ACOES_ESPECIAIS:
            query |= Q(
                content_type__app_label='transport',
                content_type__model='configuracaoacessousuario',
                codename=ACOES_ESPECIAIS[key]['codename'],
            )
            continue
        modulo, acao = key.split('.', 1)
        query |= _model_permission_q(modulo, [acao])
    return list(Permission.objects.filter(query).distinct())


def _capabilities_from_modules(modulos):
    if not isinstance(modulos, dict):
        raise ValueError('O campo "modulos" deve ser um objeto.')
    keys = []
    for modulo, acoes in modulos.items():
        if modulo not in MODULOS_PERMISSOES or modulo == 'usuarios':
            raise ValueError(f"Módulo '{modulo}' inválido ou protegido.")
        if not isinstance(acoes, list):
            raise ValueError(f"As ações de '{modulo}' devem ser uma lista.")
        invalidas = set(acoes) - set(ACOES_PERMITIDAS)
        if invalidas:
            raise ValueError(f"Ações inválidas em '{modulo}': {', '.join(sorted(invalidas))}.")
        keys.extend(f'{modulo}.{acao}' for acao in acoes)
        keys.extend(
            key for key, info in ACOES_ESPECIAIS.items()
            if info['modulo'] == modulo and info['acao_base'] in acoes
        )
    return keys


def _snapshot_acesso(user, config):
    catalog = get_catalogo_acessos()
    permission_context = _permission_context(user)
    enabled = []
    for item in catalog['capabilities']:
        key = item['key']
        if key == 'usuarios.manage_access':
            ativo = 'transport.gerenciar_acessos_usuarios' in permission_context['direct']
        elif key == 'cte.editar_valor_frete':
            ativo = 'transport.editar_valor_frete_cte' in permission_context['direct']
        elif key == 'cte.excluir_importado':
            ativo = 'transport.excluir_cte_importado' in permission_context['direct']
        else:
            ativo = user_has_capability(user, key)
        if ativo:
            enabled.append(key)
    return {
        'is_active': user.is_active,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'access_mode': config.modo,
        'profile': config.perfil_base or None,
        'groups': sorted(group.name for group in user.groups.all()),
        'enabled_capabilities': sorted(enabled),
        'version': config.versao,
    }


def get_acesso_usuario(user, actor=None):
    config = obter_configuracao_acesso(user)
    snapshot = _snapshot_acesso(user, config)
    catalog = get_catalogo_acessos()
    enabled = set(snapshot['enabled_capabilities'])
    capabilities = []
    for item in catalog['capabilities']:
        capability = dict(item)
        capability['enabled'] = capability['key'] in enabled
        capability['source'] = config.modo
        capabilities.append(capability)
    self_protected = bool(actor and actor.pk == user.pk)
    protection_reason = None
    if self_protected:
        protection_reason = 'Você não pode alterar ou desativar sua própria autoridade.'
    elif user.is_superuser:
        protection_reason = 'É necessário confirmar o rebaixamento deste superusuário.'
    return {
        'user': {
            'id': user.pk,
            'username': user.username,
            'full_name': user.get_full_name(),
            'email': user.email,
            'is_active': user.is_active,
            'is_superuser': user.is_superuser,
        },
        'version': config.versao,
        'versao': config.versao,
        'access_mode': config.modo,
        'modo': config.modo,
        'profile': config.perfil_base or None,
        'perfil': config.perfil_base or None,
        'enabled_capabilities': snapshot['enabled_capabilities'],
        'capabilities': capabilities,
        'can_change_status': not self_protected,
        'can_delete': not self_protected,
        'can_manage_access': not self_protected,
        'protection_reason': protection_reason,
        'requires_demote_confirmation': bool(user.is_superuser and not self_protected),
    }


def _registrar_auditoria(
    actor, target, action, before, after, request=None, motivo='', origem='painel'
):
    remote_addr = request.META.get('REMOTE_ADDR') if request else None
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:500] if request else ''
    request_id = ''
    if request:
        request_id = request.META.get('HTTP_X_REQUEST_ID', '')[:100]
    return AuditoriaAcessoUsuario.objects.create(
        ator=actor,
        usuario_afetado=target,
        usuario_afetado_nome=target.username,
        acao=action,
        antes=before,
        depois=after,
        motivo=motivo or '',
        request_id=request_id,
        origem=origem,
        endereco_ip=remote_addr,
        user_agent=user_agent,
    )


@transaction.atomic
def atualizar_acesso_usuario(actor, target, payload, request=None):
    target = target.__class__.objects.select_for_update().get(pk=target.pk)
    if actor.pk == target.pk:
        raise OperacaoAcessoProtegida('Você não pode alterar seus próprios acessos administrativos.')
    if target.is_superuser and not payload.get('confirm_demote_superuser', False):
        raise OperacaoAcessoProtegida(
            'Confirme explicitamente o rebaixamento do superusuário para aplicar acessos comuns.'
        )
    config = obter_configuracao_acesso(target, bloquear=True)
    expected = payload.get('expected_version', payload.get('versao'))
    if expected is None:
        raise ValueError('Informe a versão atual das permissões.')
    if int(expected) != config.versao:
        raise ConflitoVersaoAcesso(config.versao)

    mode = payload.get('mode', payload.get('modo'))
    if mode not in (ConfiguracaoAcessoUsuario.MODO_PERFIL, ConfiguracaoAcessoUsuario.MODO_PERSONALIZADO):
        raise ValueError('Modo de acesso inválido.')
    before = _snapshot_acesso(target, config)
    managed = list(get_permissoes_catalogadas())

    if mode == ConfiguracaoAcessoUsuario.MODO_PERFIL:
        profile = payload.get('profile', payload.get('perfil'))
        if profile not in PERFIS:
            raise ValueError('Perfil de acesso inválido.')
        group, created = Group.objects.get_or_create(name=profile)
        if created:
            group.permissions.set(get_permissoes_do_perfil(profile))
        target.groups.remove(*target.groups.filter(name__in=PERFIS))
        target.groups.add(group)
        target.user_permissions.remove(*managed)
        target.is_superuser = False
        target.is_staff = profile == 'Administrativo'
        config.perfil_base = profile
    else:
        keys = payload.get('enabled_capabilities')
        if keys is None:
            keys = _capabilities_from_modules(payload.get('modules', payload.get('modulos', {})))
        if not isinstance(keys, list):
            raise ValueError('O campo "enabled_capabilities" deve ser uma lista.')
        selected = _permission_ids_for_capabilities(keys, target=target)
        target.groups.remove(*target.groups.filter(name__in=PERFIS))
        target.user_permissions.remove(*managed)
        target.user_permissions.add(*selected)
        target.is_superuser = False
        target.is_staff = False
        config.perfil_base = ''

    target.save(update_fields=['is_superuser', 'is_staff'])
    config.modo = mode
    config.versao += 1
    config.atualizado_por = actor
    config.save(update_fields=['modo', 'perfil_base', 'versao', 'atualizado_por', 'atualizado_em'])
    target._state.fields_cache['configuracao_acesso'] = config
    for cache_name in ('_perm_cache', '_user_perm_cache', '_group_perm_cache', '_access_permission_context'):
        target.__dict__.pop(cache_name, None)
    after = _snapshot_acesso(target, config)
    _registrar_auditoria(
        actor, target, 'alteracao_acessos', before, after, request,
        motivo=payload.get('motivo', ''),
    )
    return target, config


@transaction.atomic
def atualizar_status_usuario(
    actor, target, is_active, request=None, motivo='', expected_version=None
):
    target = target.__class__.objects.select_for_update().get(pk=target.pk)
    if actor.pk == target.pk and not is_active:
        raise OperacaoAcessoProtegida('Você não pode desativar sua própria conta.')
    if target.is_superuser:
        raise OperacaoAcessoProtegida(
            'O status de um superusuário não pode ser alterado pelo painel.'
        )
    config = obter_configuracao_acesso(target, bloquear=True)
    if expected_version is not None and int(expected_version) != config.versao:
        raise ConflitoVersaoAcesso(config.versao)
    before = _snapshot_acesso(target, config)
    target.is_active = bool(is_active)
    target.save(update_fields=['is_active'])
    config.versao += 1
    config.atualizado_por = actor
    config.save(update_fields=['versao', 'atualizado_por', 'atualizado_em'])
    target._state.fields_cache['configuracao_acesso'] = config
    after = _snapshot_acesso(target, config)
    _registrar_auditoria(
        actor, target, 'ativacao' if is_active else 'desativacao',
        before, after, request, motivo=motivo,
    )
    return target, config


@transaction.atomic
def redefinir_senha_usuario(actor, target, password, request=None, motivo=''):
    target = target.__class__.objects.select_for_update().get(pk=target.pk)
    if actor.pk == target.pk:
        raise OperacaoAcessoProtegida(
            'Use a área do próprio perfil para alterar sua senha.'
        )
    if target.is_superuser:
        raise OperacaoAcessoProtegida(
            'A senha de um superusuário não pode ser redefinida pelo painel.'
        )
    config = obter_configuracao_acesso(target, bloquear=True)
    before = {'password_reset': False, 'version': config.versao}
    target.set_password(password)
    target.save(update_fields=['password'])
    config.versao += 1
    config.atualizado_por = actor
    config.save(update_fields=['versao', 'atualizado_por', 'atualizado_em'])
    target._state.fields_cache['configuracao_acesso'] = config
    after = {'password_reset': True, 'version': config.versao}
    _registrar_auditoria(
        actor, target, 'redefinicao_senha', before, after, request,
        motivo=motivo,
    )
    return target, config


def registrar_auditoria_usuario(
    actor, target, action, before, after, request=None, motivo='', origem='painel'
):
    """API pública para registrar CRUD sem expor o helper de baixo nível."""
    return _registrar_auditoria(
        actor, target, action, before, after, request, motivo=motivo,
        origem=origem,
    )


def user_has_capability(user, capability_key):
    """Resolve uma chave pública do catálogo para autorização no backend."""
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if capability_key == 'usuarios.manage_access':
        from transport.permissions import can_manage_user_access
        return can_manage_user_access(user)
    if capability_key in ACOES_ESPECIAIS:
        codename = ACOES_ESPECIAIS[capability_key]['codename']
        return user_has_model_permission(
            user,
            f'transport.{codename}',
            content_type_model='configuracaoacessousuario',
        )
    try:
        modulo, acao = capability_key.split('.', 1)
    except ValueError:
        return False
    if modulo not in MODULOS_PERMISSOES or acao not in ACOES_PERMITIDAS:
        return False
    app_label = 'auth' if modulo == 'usuarios' else 'transport'
    return any(
        user_has_model_permission(
            user,
            f'{app_label}.{acao}_{modelo}',
            content_type_model=modelo,
        )
        for modelo in MODULOS_PERMISSOES[modulo]['modelos']
    )


def _is_cataloged_permission(app_label, codename, content_type_model=None):
    if app_label == 'transport' and codename in {
        item['codename'] for item in ACOES_ESPECIAIS.values()
    }:
        return True
    for modulo, info in MODULOS_PERMISSOES.items():
        expected_app = 'auth' if modulo == 'usuarios' else 'transport'
        if expected_app != app_label:
            continue
        for modelo in info['modelos']:
            if content_type_model and modelo != content_type_model:
                continue
            if codename in {f'{acao}_{modelo}' for acao in ACOES_PERMITIDAS}:
                return modulo != 'usuarios'
    return False


def user_has_model_permission(user, permission_name, content_type_model=None):
    """Respeita o modo personalizado sem deixar grupos reativarem uma função."""
    if not user or not user.is_authenticated or not user.is_active:
        return False
    try:
        app_label, codename = permission_name.split('.', 1)
    except ValueError:
        return False
    if user.is_superuser:
        return True
    context = _permission_context(user)
    config = context['config']
    if (
        config.modo == ConfiguracaoAcessoUsuario.MODO_PERSONALIZADO
        and _is_cataloged_permission(app_label, codename, content_type_model)
    ):
        return permission_name in context['direct']
    return permission_name in context['effective']
