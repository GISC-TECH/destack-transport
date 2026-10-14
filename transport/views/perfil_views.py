"""
Endpoints para gestão de perfis/grupos de permissões.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import Group
from transport.permissions import CanManageUserAccessPermission
from transport.services.permissao_service import (
    MODULOS_PERMISSOES,
    ACOES_ESPECIAIS,
    PERFIS,
    atualizar_permissoes_grupo,
    criar_ou_atualizar_grupo,
    get_permissoes_do_perfil,
)


class PerfisAPIView(APIView):
    """
    Retorna os perfis padrão do sistema e seus grupos correspondentes.
    Apenas usuários autenticados podem consultar.
    """
    permission_classes = [IsAuthenticated, CanManageUserAccessPermission]

    def get(self, request, format=None):
        perfis = []
        for nome, config in PERFIS.items():
            try:
                grupo = Group.objects.get(name=nome)
                grupo_id = grupo.id
                total_perms = grupo.permissions.count()
            except Group.DoesNotExist:
                grupo_id = None
                total_perms = 0

            perfis.append({
                'id': grupo_id,
                'nome': nome,
                'descricao': config['description'],
                'total_permissoes': total_perms,
            })

        return Response({'perfis': perfis})


class PerfilDetalheAPIView(APIView):
    """
    Retorna ou atualiza os detalhes de um perfil: módulos e ações permitidas.
    Apenas superusuários podem alterar permissões.
    """
    permission_classes = [IsAuthenticated, CanManageUserAccessPermission]

    def get(self, request, nome, format=None):
        if nome not in PERFIS:
            return Response({'error': 'Perfil não encontrado.'}, status=404)

        config = PERFIS[nome]
        grupo = Group.objects.filter(name=nome).first()
        codenames = set()
        if grupo:
            codenames = set(grupo.permissions.values_list('codename', flat=True))
        modulos = []

        for modulo_key, modulo_info in MODULOS_PERMISSOES.items():
            acoes = []
            for acao in ('view', 'add', 'change', 'delete'):
                if any(
                    f'{acao}_{modelo}' in codenames
                    for modelo in modulo_info['modelos']
                ):
                    acoes.append(acao)
            modulos.append({
                'key': modulo_key,
                'label': modulo_info['label'],
                'icon': modulo_info.get('icon'),
                'acoes': acoes,
            })

        return Response({
            'nome': nome,
            'descricao': config['description'],
            'modulos': modulos,
            'enabled_capabilities': [
                key for key, info in ACOES_ESPECIAIS.items()
                if info['codename'] in codenames
            ],
        })

    def put(self, request, nome, format=None):
        if nome not in PERFIS:
            return Response({'error': 'Perfil não encontrado.'}, status=404)

        modulos_acoes = request.data.get('modulos', {})
        if not isinstance(modulos_acoes, dict):
            return Response({'error': 'O campo "modulos" deve ser um objeto.'}, status=400)

        try:
            grupo = atualizar_permissoes_grupo(
                nome,
                modulos_acoes,
                actor=request.user,
                request=request,
                motivo=request.data.get('motivo', ''),
            )
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        return Response({
            'status': 'success',
            'nome': nome,
            'total_permissoes': grupo.permissions.count(),
        })


class ModulosPermissoesAPIView(APIView):
    """
    Retorna a estrutura de módulos e modelos do sistema.
    Útil para montar a tela de edição de perfis.
    """
    permission_classes = [IsAuthenticated, CanManageUserAccessPermission]

    def get(self, request, format=None):
        return Response({'modulos': MODULOS_PERMISSOES})


class SincronizarPerfisAPIView(APIView):
    """
    Recria/atualiza os grupos padrão com base nas permissões de modelo atuais.
    Apenas superusuários podem executar.
    """
    permission_classes = [IsAuthenticated, CanManageUserAccessPermission]

    def post(self, request, format=None):
        grupos = {}
        for nome in PERFIS:
            grupo = criar_ou_atualizar_grupo(
                nome,
                actor=request.user,
                request=request,
                motivo=request.data.get('motivo', 'Sincronização dos perfis padrão.'),
            )
            grupos[nome] = {
                'id': grupo.id,
                'total_permissoes': grupo.permissions.count(),
            }

        return Response({'status': 'success', 'grupos': grupos})
