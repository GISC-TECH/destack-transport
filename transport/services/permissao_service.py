"""
Serviço centralizado para gestão de permissões e perfis de acesso.

Reutiliza os grupos nativos do Django (`auth_group`) e as permissões de modelo
para criar perfis pré-definidos: Leitura, Operacional, Financeiro e Administrativo.
"""

from django.apps import apps
from django.contrib.auth.models import Group, Permission
from django.db.models import Q


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


# ============================================================
# PERFIS PRÉ-DEFINIDOS
# ============================================================

PERFIS = {
    "Leitura": {
        "description": "Apenas visualização de dados. Não pode criar, editar ou excluir.",
        "acoes_por_modulo": {modulo: ["view"] for modulo in MODULOS_PERMISSOES},
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
            "usuarios": ["view"],
            "backup": ["view"],
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
            "usuarios": ["view"],
            "backup": ["view"],
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
            "usuarios": ["view", "add", "change", "delete"],
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

    # Permissões do app auth (usuários)
    if "usuarios" in config["acoes_por_modulo"]:
        acoes = config["acoes_por_modulo"]["usuarios"]
        for acao in acoes:
            codename = f"{acao}_user"
            permissoes_q |= Q(codename=codename, content_type__app_label="auth")

    return Permission.objects.filter(permissoes_q).distinct()


def criar_ou_atualizar_grupo(nome_perfil):
    """Cria ou atualiza um grupo do Django com as permissões do perfil."""
    if nome_perfil not in PERFIS:
        raise ValueError(f"Perfil '{nome_perfil}' não existe. Opções: {list(PERFIS.keys())}")

    config = PERFIS[nome_perfil]
    grupo, _ = Group.objects.get_or_create(name=nome_perfil)
    permissoes = get_permissoes_do_perfil(nome_perfil)
    grupo.permissions.set(permissoes)
    return grupo


def atualizar_permissoes_grupo(nome_perfil, modulos_acoes):
    """
    Atualiza as permissões de um grupo existente com base nos módulos/ações
    enviados pelo usuário. Não altera a definição estática em PERFIS.
    """
    if nome_perfil not in PERFIS:
        raise ValueError(f"Perfil '{nome_perfil}' não existe.")

    grupo, _ = Group.objects.get_or_create(name=nome_perfil)
    permissoes_q = Q()

    for modulo, acoes in modulos_acoes.items():
        if modulo not in MODULOS_PERMISSOES:
            continue

        modelos = get_modelos_do_modulo(modulo)
        app_label = "auth" if modulo == "usuarios" else "transport"

        for modelo in modelos:
            for acao in acoes:
                codename = f"{acao}_{modelo}"
                permissoes_q |= Q(codename=codename, content_type__app_label=app_label)

    permissoes = Permission.objects.filter(permissoes_q).distinct()
    grupo.permissions.set(permissoes)
    return grupo


def criar_todos_os_grupos_padrao():
    """Cria/atualiza todos os grupos padrão do sistema."""
    grupos = {}
    for nome in PERFIS:
        grupos[nome] = criar_ou_atualizar_grupo(nome)
    return grupos


def aplicar_perfil_usuario(user, nome_perfil):
    """Remove grupos antigos de perfil e aplica o novo grupo."""
    if nome_perfil not in PERFIS and nome_perfil != "Super Admin":
        raise ValueError(f"Perfil '{nome_perfil}' inválido.")

    # Limpa grupos de perfis conhecidos
    grupos_perfil = list(PERFIS.keys())
    user.groups.remove(*user.groups.filter(name__in=grupos_perfil))

    if nome_perfil == "Super Admin":
        user.is_superuser = True
        user.is_staff = True
    else:
        user.is_superuser = False
        # Mantém is_staff apenas para Administrativo
        user.is_staff = nome_perfil == "Administrativo"
        grupo = Group.objects.get(name=nome_perfil)
        user.groups.add(grupo)

    user.save(update_fields=["is_superuser", "is_staff"])
    return user


def get_permissoes_efetivas(user):
    """
    Retorna um dicionário com todas as permissões efetivas do usuário,
    organizadas por módulo e ação.
    """
    if user.is_superuser:
        # Superusuário tem tudo
        resultado = {}
        for modulo, info in MODULOS_PERMISSOES.items():
            acoes = info.get("acoes_padrao", ["view", "add", "change", "delete"])
            resultado[modulo] = {acao: True for acao in acoes}
        return {"superuser": True, "modulos": resultado}

    resultado = {}
    user_perms = set(user.get_all_permissions())

    for modulo, info in MODULOS_PERMISSOES.items():
        modelos = info["modelos"]
        acoes_padrao = info.get("acoes_padrao", ["view", "add", "change", "delete"])
        permissoes_modulo = {acao: False for acao in acoes_padrao}

        for modelo in modelos:
            for acao in acoes_padrao:
                codename = f"transport.{acao}_{modelo}"
                if codename in user_perms:
                    permissoes_modulo[acao] = True

        resultado[modulo] = permissoes_modulo

    # O dashboard é a tela inicial do sistema e não possui um modelo dedicado
    # (o modelo dashboardcache não existe). Qualquer usuário autenticado deve
    # poder visualizar o dashboard, já que ele apenas agrega dados dos módulos
    # aos quais o usuário já tem acesso.
    resultado["dashboard"] = resultado.get("dashboard", {})
    resultado["dashboard"]["view"] = True

    return {"superuser": False, "modulos": resultado}


def get_permissoes_flat(user):
    """Retorna lista simples de permissões que o usuário possui."""
    return sorted(user.get_all_permissions())
