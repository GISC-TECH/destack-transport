# transport/api_urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers

# --- Documentação da API (drf-yasg) ---
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# --- Views ---
from .views.auth_views import (
    UserViewSet, CurrentUserAPIView,
    CSRFTokenAPIView, CheckAuthAPIView
)
from .views.upload_views import UnifiedUploadViewSet
from .views.cte_views import CTeDocumentoViewSet
from .views.mdfe_views import MDFeDocumentoViewSet
from .views.vehicle_views import VeiculoViewSet, ManutencaoVeiculoViewSet, ManutencaoPainelViewSet, CompartimentacaoVeiculoViewSet
from .views.payment_views import FaixaKMViewSet, PagamentoAgregadoViewSet, PagamentoProprioViewSet
from .views.financeiro_views import (
    FaturaViewSet, ContaPagarViewSet, InadimplenciaAPIView, FluxoCaixaAPIView, DREAPIView
)
from .views.ordem_viagem_views import OrdemViagemViewSet, DespesaViagemViewSet
from .views.posicao_veiculo_views import PosicaoVeiculoViewSet
from .views.abastecimento_views import AbastecimentoViewSet
from .views.plano_manutencao_views import PlanoManutencaoViewSet
from .views.multa_sinistro_views import MultaViewSet, SinistroViewSet
from .views.pedagio_views import PedagioViewSet
from .views.tabela_frete_views import TabelaFreteViewSet
from .views.conciliacao_views import TransacaoBancariaViewSet
from .views.cliente_views import ClienteViewSet
from .views.motorista_views import MotoristaViewSet
from .views.recepcao_views import DocumentoFiscalGenericoViewSet, DocumentoEventoViewSet
from .views.documento_views import (
    DocumentoAnexoViewSet,
    ClienteDocumentoViewSet,
    MotoristaDocumentoViewSet,
    VeiculoDocumentoViewSet,
    CTeDocumentoAnexoViewSet
)
from .views.dashboard_views import (
    DashboardGeralAPIView, CtePainelAPIView, MdfePainelAPIView,
    FinanceiroPainelAPIView, FinanceiroMensalAPIView, FinanceiroDetalheAPIView,
    GeograficoPainelAPIView, AlertasPagamentoAPIView, AlertaSistemaViewSet,
    FrotaPainelAPIView, PerformancePainelAPIView
)
from .views.config_views import (
    ConfiguracaoEmpresaViewSet, ParametroSistemaViewSet,
    BackupAPIView, RelatorioAPIView
)
from .views.gps_views import webhook_posicao_gps, ultima_posicao_veiculo
from .views.comunicacao_views import enviar_comunicacao, testar_whatsapp, MensagemComunicacaoViewSet
from .views.ciot_views import CIOTViewSet

# --- Configuração Swagger (Schema View) ---
schema_view = get_schema_view(
   openapi.Info(
      title="API Destack Transportes",
      default_version='v1',
      description="Documentacao da API para o sistema de gestao de CT-e e MDF-e.\n\n"
                  "## Autenticacao\n"
                  "Use o endpoint `/api/auth/login/` para fazer login e obter uma sessao.\n\n"
                  "## Endpoints Principais\n"
                  "- **CT-e**: `/api/ctes/` - Gestao de Conhecimentos de Transporte\n"
                  "- **MDF-e**: `/api/mdfes/` - Gestao de Manifestos de Documentos\n"
                  "- **Veiculos**: `/api/veiculos/` - Cadastro de frota\n"
                  "- **Clientes**: `/api/clientes/` - Cadastro de clientes\n"
                  "- **Motoristas**: `/api/motoristas/` - Cadastro de motoristas\n",
      contact=openapi.Contact(email="contato@destacktransportes.com.br"),
      license=openapi.License(name="MIT License"),
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)

# ------------------------------------------------------------------ #
# DRF routers
# ------------------------------------------------------------------ #
router = DefaultRouter()
# Registros do router
router.register(r"upload", UnifiedUploadViewSet, basename="unified-upload")
router.register(r"ctes", CTeDocumentoViewSet, basename="cte-documento")
router.register(r"mdfes", MDFeDocumentoViewSet, basename="mdfe-documento")
router.register(r"veiculos", VeiculoViewSet, basename="veiculo")
router.register(r"clientes", ClienteViewSet, basename="cliente")
router.register(r"motoristas", MotoristaViewSet, basename="motorista")
router.register(r"pagamentos/agregados", PagamentoAgregadoViewSet, basename="pagamento-agregado")
router.register(r"pagamentos/proprios", PagamentoProprioViewSet, basename="pagamento-proprio")
router.register(r"faixas-km", FaixaKMViewSet, basename="faixa-km")
router.register(r"manutencao/painel", ManutencaoPainelViewSet, basename="manutencao-painel")
router.register(r"manutencoes", ManutencaoVeiculoViewSet, basename="manutencao-veiculo")
router.register(r"faturas", FaturaViewSet, basename="fatura")
router.register(r"contas-a-pagar", ContaPagarViewSet, basename="conta-pagar")
router.register(r"transacoes", TransacaoBancariaViewSet, basename="transacao-bancaria")
router.register(r"ordens-viagem", OrdemViagemViewSet, basename="ordem-viagem")
router.register(r"despesas-viagem", DespesaViagemViewSet, basename="despesa-viagem")
router.register(r"posicoes", PosicaoVeiculoViewSet, basename="posicao-veiculo")
router.register(r"comunicacoes", MensagemComunicacaoViewSet, basename="comunicacao")
router.register(r"ciots", CIOTViewSet, basename="ciot")
router.register(r"abastecimentos", AbastecimentoViewSet, basename="abastecimento")
router.register(r"planos-manutencao", PlanoManutencaoViewSet, basename="plano-manutencao")
router.register(r"multas", MultaViewSet, basename="multa")
router.register(r"sinistros", SinistroViewSet, basename="sinistro")
router.register(r"pedagios", PedagioViewSet, basename="pedagio")
router.register(r"tabelas-frete", TabelaFreteViewSet, basename="tabela-frete")
router.register(r"usuarios", UserViewSet, basename="usuario")
router.register(r"configuracoes/empresa", ConfiguracaoEmpresaViewSet, basename="configuracao-empresa")
router.register(r"configuracoes/parametros", ParametroSistemaViewSet, basename="parametros-sistema")
router.register(r"backup", BackupAPIView, basename="backup")
router.register(r"documentos", DocumentoAnexoViewSet, basename="documento-anexo")
router.register(r"recepcao/genericos", DocumentoFiscalGenericoViewSet, basename="recepcao-generico")
router.register(r"recepcao/eventos", DocumentoEventoViewSet, basename="recepcao-evento")

# Rotas aninhadas para manutenções e compartimentação de veículos
veiculos_router = routers.NestedSimpleRouter(router, r"veiculos", lookup="veiculo")
veiculos_router.register(r"manutencoes", ManutencaoVeiculoViewSet, basename="veiculo-manutencao")
veiculos_router.register(r"compartimentos", CompartimentacaoVeiculoViewSet, basename="veiculo-compartimento")
veiculos_router.register(r"documentos", VeiculoDocumentoViewSet, basename="veiculo-documento")

# Rotas aninhadas para documentos de clientes
clientes_router = routers.NestedSimpleRouter(router, r"clientes", lookup="cliente")
clientes_router.register(r"documentos", ClienteDocumentoViewSet, basename="cliente-documento")

# Rotas aninhadas para documentos de motoristas
motoristas_router = routers.NestedSimpleRouter(router, r"motoristas", lookup="motorista")
motoristas_router.register(r"documentos", MotoristaDocumentoViewSet, basename="motorista-documento")

# Rotas aninhadas para documentos anexos de CT-e
ctes_router = routers.NestedSimpleRouter(router, r"ctes", lookup="cte")
ctes_router.register(r"documentos", CTeDocumentoAnexoViewSet, basename="cte-documento")

# ------------------------------------------------------------------ #
# URL patterns - APENAS APIs
# ------------------------------------------------------------------ #
urlpatterns = [
    # --- API Endpoints ---
    path("", include(router.urls)),  # Inclui as rotas do router principal
    path("", include(veiculos_router.urls)),  # Inclui as rotas aninhadas de veiculos
    path("", include(clientes_router.urls)),  # Inclui as rotas aninhadas de clientes
    path("", include(motoristas_router.urls)),  # Inclui as rotas aninhadas de motoristas
    path("", include(ctes_router.urls)),  # Inclui as rotas aninhadas de documentos de CT-e

    # APIViews avulsas (não gerenciadas pelo router)
    path("dashboard/", DashboardGeralAPIView.as_view(), name="dashboard-geral"),
    path("painel/cte/", CtePainelAPIView.as_view(), name="painel-cte"),
    path("painel/mdfe/", MdfePainelAPIView.as_view(), name="painel-mdfe"),
    path("painel/financeiro/", FinanceiroPainelAPIView.as_view(), name="painel-financeiro"),
    path("financeiro/mensal/", FinanceiroMensalAPIView.as_view(), name="financeiro-mensal"),
    path("financeiro/detalhe/", FinanceiroDetalheAPIView.as_view(), name="financeiro-detalhe"),
    path("financeiro/inadimplencia/", InadimplenciaAPIView.as_view(), name="financeiro-inadimplencia"),
    path("financeiro/fluxo-caixa/", FluxoCaixaAPIView.as_view(), name="financeiro-fluxo-caixa"),
    path("financeiro/dre/", DREAPIView.as_view(), name="financeiro-dre"),
    path("painel/geografico/", GeograficoPainelAPIView.as_view(), name="painel-geografico"),
    path("painel/frota/", FrotaPainelAPIView.as_view(), name="painel-frota"),
    path("painel/performance/", PerformancePainelAPIView.as_view(), name="painel-performance"),
    path("alertas/pagamentos/", AlertasPagamentoAPIView.as_view(), name="alertas-pagamentos"),
    path(
        "alertas/sistema/",
        AlertaSistemaViewSet.as_view({"get": "list"}),
        name="alertas-sistema",
    ),
    path(
        "alertas/sistema/limpar_todos/",
        AlertaSistemaViewSet.as_view({"post": "limpar_todos"}),
        name="alertas-sistema-limpar-todos",
    ),
    path(
        "alertas/sistema/<int:pk>/marcar_lido/",
        AlertaSistemaViewSet.as_view({"patch": "marcar_lido"}),
        name="alertas-sistema-marcar-lido",
    ),
    path(
        "alertas/sistema/<int:pk>/marcar_resolvido/",
        AlertaSistemaViewSet.as_view({"patch": "marcar_resolvido"}),
        name="alertas-sistema-marcar-resolvido",
    ),
    path(
        "alertas/sistema/<int:pk>/",
        AlertaSistemaViewSet.as_view({"delete": "destroy"}),
        name="alertas-sistema-detalhe",
    ),

    # Endpoint de Relatórios (APIView)
    path("relatorios/", RelatorioAPIView.as_view(), name="relatorios"),

    # Endpoints específicos de actions dos ViewSets que não são padrão REST
    path("configuracoes/parametros/valores/", ParametroSistemaViewSet.as_view({'get': 'valores'}), name="parametros-valores"),
    path("configuracoes/parametros/atualizar-multiplos/", ParametroSistemaViewSet.as_view({'post': 'atualizar_multiplos'}), name="parametros-atualizar-multiplos"),

    # Dados do usuário autenticado (usado pelo JavaScript)
    path("users/me/", CurrentUserAPIView.as_view(), name="user_me"),

    # --- Autenticação API (para frontend React SPA) ---
    # Login/Logout são tratados em core/urls.py via simple_auth.py (csrf_exempt)
    path("auth/csrf/", CSRFTokenAPIView.as_view(), name="api-csrf"),
    path("auth/user/", CheckAuthAPIView.as_view(), name="api-check-auth"),

    # --- Integração GPS ---
    path("gps/webhook/", webhook_posicao_gps, name="gps-webhook"),
    path("gps/veiculos/<int:veiculo_id>/ultima-posicao/", ultima_posicao_veiculo, name="gps-ultima-posicao"),

    # --- Comunicação ---
    path("comunicacoes/enviar/", enviar_comunicacao, name="comunicacao-enviar"),
    path("comunicacoes/whatsapp/testar/", testar_whatsapp, name="comunicacao-whatsapp-testar"),

    # --- Documentação da API (Swagger/ReDoc) ---
    path('swagger<format>/', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]