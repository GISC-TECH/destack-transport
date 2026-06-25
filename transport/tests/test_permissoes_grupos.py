# transport/tests/test_permissoes_grupos.py
"""
Testes para garantir que os grupos de permissões funcionam corretamente.

Foco no grupo Leitura: usuários deste grupo devem conseguir visualizar dados,
mas NÃO devem conseguir criar, alterar ou excluir registros.
"""

from django.test import TestCase
from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient
from rest_framework import status

from transport.models import Veiculo, Motorista


class PermissoesGruposTests(TestCase):
    """Garante que o grupo Leitura não altera dados."""

    def setUp(self):
        self.client = APIClient()

        # Cria o grupo Leitura e atribui permissão de visualização de Veiculo e Motorista
        self.grupo_leitura, _ = Group.objects.get_or_create(name="Leitura")

        veiculo_ct = ContentType.objects.get_for_model(Veiculo)
        motorista_ct = ContentType.objects.get_for_model(Motorista)

        view_veiculo = Permission.objects.get(
            codename="view_veiculo", content_type=veiculo_ct
        )
        view_motorista = Permission.objects.get(
            codename="view_motorista", content_type=motorista_ct
        )

        self.grupo_leitura.permissions.set([view_veiculo, view_motorista])

        # Cria usuário de leitura
        self.usuario_leitura = User.objects.create_user(
            username="usuario_leitura",
            password="senha12345",
        )
        self.usuario_leitura.groups.add(self.grupo_leitura)

        # Cria um veículo e um motorista para os testes
        self.veiculo = Veiculo.objects.create(
            placa="ABC1234",
            tipo_proprietario="00",
            ativo=True,
        )
        self.motorista = Motorista.objects.create(
            nome="Motorista Teste",
            cpf="12345678901",
            ativo=True,
        )

    def _autenticar_usuario_leitura(self):
        """Autentica o cliente com o usuário de leitura via sessão Django."""
        self.client.login(username=self.usuario_leitura.username, password="senha12345")

    def test_usuario_leitura_pode_listar_veiculos(self):
        """Usuário do grupo Leitura deve conseguir listar veículos."""
        self._autenticar_usuario_leitura()
        response = self.client.get("/api/veiculos/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_usuario_leitura_pode_visualizar_detalhe_veiculo(self):
        """Usuário do grupo Leitura deve conseguir ver detalhes de um veículo."""
        self._autenticar_usuario_leitura()
        response = self.client.get(f"/api/veiculos/{self.veiculo.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_usuario_leitura_nao_pode_criar_veiculo(self):
        """Usuário do grupo Leitura NÃO deve conseguir criar veículos."""
        self._autenticar_usuario_leitura()
        payload = {
            "placa": "XYZ9876",
            "tipo_proprietario": "00",
            "ativo": True,
        }
        response = self.client.post("/api/veiculos/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_leitura_nao_pode_alterar_veiculo(self):
        """Usuário do grupo Leitura NÃO deve conseguir alterar veículos."""
        self._autenticar_usuario_leitura()
        payload = {"observacoes": "Tentativa de alteração"}
        response = self.client.patch(
            f"/api/veiculos/{self.veiculo.id}/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_leitura_nao_pode_excluir_veiculo(self):
        """Usuário do grupo Leitura NÃO deve conseguir excluir veículos."""
        self._autenticar_usuario_leitura()
        response = self.client.delete(f"/api/veiculos/{self.veiculo.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_leitura_nao_pode_criar_motorista(self):
        """Usuário do grupo Leitura NÃO deve conseguir criar motoristas."""
        self._autenticar_usuario_leitura()
        payload = {
            "nome": "Novo Motorista",
            "cpf": "98765432100",
            "ativo": True,
        }
        response = self.client.post("/api/motoristas/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_leitura_nao_pode_alterar_motorista(self):
        """Usuário do grupo Leitura NÃO deve conseguir alterar motoristas."""
        self._autenticar_usuario_leitura()
        payload = {"nome": "Nome Alterado"}
        response = self.client.patch(
            f"/api/motoristas/{self.motorista.id}/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_sem_permissao_nao_visualiza_dados(self):
        """Usuário autenticado sem permissões não deve acessar veículos."""
        usuario_sem_permissao = User.objects.create_user(
            username="usuario_sem_permissao",
            password="senha12345",
        )
        self.client.login(username=usuario_sem_permissao.username, password="senha12345")
        response = self.client.get("/api/veiculos/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
