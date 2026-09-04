import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Common/Toast';
import Sidebar from './components/Common/Sidebar';
import PermissionGuard from './components/Common/PermissionGuard';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Login from './components/Auth/Login';

// Landing Page (publica)
import LandingPage from './components/Landing/LandingPage';

// Dashboard (carregado imediatamente por ser a tela principal)
import Dashboard from './components/Dashboard/Dashboard';

import './styles/tokens.module.css';
import './App.css';

// Componente de loading para code-splitting
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner" />
      <p>Carregando...</p>
    </div>
  );
}

function GuardedPage({ modulo, acao = 'view', capability, children }) {
  return (
    <PermissionGuard
      modulo={modulo}
      acao={acao}
      capability={capability}
      fallback={<Navigate to="/dashboard" replace />}
    >
      {children}
    </PermissionGuard>
  );
}

// Clientes
const ClientesList = lazy(() => import('./components/Clientes/ClientesList'));
const ClienteForm = lazy(() => import('./components/Clientes/ClienteForm'));

// Motoristas
const MotoristasList = lazy(() => import('./components/Motoristas/MotoristasList'));
const MotoristaForm = lazy(() => import('./components/Motoristas/MotoristaForm'));

// Veículos
const VeiculosList = lazy(() => import('./components/Veiculos/VeiculosList'));
const VeiculoForm = lazy(() => import('./components/Veiculos/VeiculoForm'));

// CT-e
const CTeList = lazy(() => import('./components/CTe/CTeList'));
const CTeDetail = lazy(() => import('./components/CTe/CTeDetail'));
const PagamentosPendentes = lazy(() => import('./components/CTe/PagamentosPendentes'));

// MDF-e
const MDFeList = lazy(() => import('./components/MDFe/MDFeList'));
const MDFeDetail = lazy(() => import('./components/MDFe/MDFeDetail'));

// Upload XML
const UploadXML = lazy(() => import('./components/Upload/UploadXML'));

// Pagamentos
const PagamentosList = lazy(() => import('./components/Pagamentos/PagamentosList'));
const PagamentoAgregadoForm = lazy(() => import('./components/Pagamentos/PagamentoAgregadoForm'));
const PagamentoProprioForm = lazy(() => import('./components/Pagamentos/PagamentoProprioForm'));

// Manutenção
const ManutencaoList = lazy(() => import('./components/Manutencao/ManutencaoList'));
const ManutencaoForm = lazy(() => import('./components/Manutencao/ManutencaoForm'));

// Ordens de Viagem
const OrdensViagemList = lazy(() => import('./components/OrdensViagem/OrdensViagemList'));
const OrdemViagemForm = lazy(() => import('./components/OrdensViagem/OrdemViagemForm'));

// Abastecimento
const AbastecimentosList = lazy(() => import('./components/Abastecimento/AbastecimentosList'));
const AbastecimentoForm = lazy(() => import('./components/Abastecimento/AbastecimentoForm'));

// Planos de Manutenção
const PlanosManutencaoList = lazy(() => import('./components/PlanosManutencao/PlanosManutencaoList'));
const PlanoManutencaoForm = lazy(() => import('./components/PlanosManutencao/PlanoManutencaoForm'));

// Multas e Sinistros
const MultasSinistros = lazy(() => import('./components/Frota/MultasSinistros'));

// Pedágio
const PedagiosList = lazy(() => import('./components/Pedagio/PedagiosList'));
const PedagioForm = lazy(() => import('./components/Pedagio/PedagioForm'));

// Tabela de Frete
const TabelasFreteList = lazy(() => import('./components/TabelaFrete/TabelasFreteList'));
const TabelaFreteForm = lazy(() => import('./components/TabelaFrete/TabelaFreteForm'));

// Financeiro
const FinanceiroPainel = lazy(() => import('./components/Financeiro/FinanceiroPainel'));
const FaturasList = lazy(() => import('./components/Financeiro/FaturasList'));
const FaturaForm = lazy(() => import('./components/Financeiro/FaturaForm'));
const ContasPagarList = lazy(() => import('./components/Financeiro/ContasPagarList'));
const ContaPagarForm = lazy(() => import('./components/Financeiro/ContaPagarForm'));
const ConciliacaoBancaria = lazy(() => import('./components/Financeiro/ConciliacaoBancaria'));
const Inadimplencia = lazy(() => import('./components/Financeiro/Inadimplencia'));
const FluxoCaixa = lazy(() => import('./components/Financeiro/FluxoCaixa'));
const DRE = lazy(() => import('./components/Financeiro/DRE'));

// Configurações
const Configuracoes = lazy(() => import('./components/Configuracoes/Configuracoes'));

// Relatórios
const Relatorios = lazy(() => import('./components/Relatorios/Relatorios'));

// Backup
const BackupManager = lazy(() => import('./components/Backup/BackupManager'));

// Alertas
const AlertasSistema = lazy(() => import('./components/Alertas/AlertasSistema'));

// Faixas KM
const FaixasKmList = lazy(() => import('./components/FaixasKm/FaixasKmList'));

// Vencimentos
const VencimentosPainel = lazy(() => import('./components/Vencimentos/VencimentosPainel'));

// Geografico
const GeograficoPainel = lazy(() => import('./components/Geografico/GeograficoPainel'));

// Rastreamento GPS
const RastreamentoPainel = lazy(() => import('./components/Rastreamento/RastreamentoPainel'));

// Comunicação
const ComunicacaoPanel = lazy(() => import('./components/Comunicacao/ComunicacaoPanel'));

// CIOT
const CIOTManager = lazy(() => import('./components/CIOT/CIOTManager'));

// Usuarios
const UsuariosList = lazy(() => import('./components/Usuarios/UsuariosList'));
const UsuarioForm = lazy(() => import('./components/Usuarios/UsuarioForm'));
const UsuarioAcessos = lazy(() => import('./components/Usuarios/UsuarioAcessos'));

// Perfis
const Perfis = lazy(() => import('./components/Perfis/Perfis'));

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
        <Routes>
          {/* Landing Page (publica) */}
          <Route path="/" element={<LandingPage />} />

          {/* Rota de Login (publica) */}
          <Route path="/login" element={<Login />} />

          {/* Rotas protegidas */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="app-layout">
                  <Sidebar />
                  <div className="app-main">
                    <main className="main-content">
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/dashboard" element={<GuardedPage capability="dashboard.geral"><Dashboard /></GuardedPage>} />

                          {/* Clientes */}
                          <Route path="/clientes" element={<GuardedPage modulo="clientes"><ClientesList /></GuardedPage>} />
                          <Route path="/clientes/novo" element={<GuardedPage modulo="clientes" acao="add"><ClienteForm /></GuardedPage>} />
                          <Route path="/clientes/editar/:id" element={<GuardedPage modulo="clientes" acao="change"><ClienteForm /></GuardedPage>} />

                          {/* Motoristas */}
                          <Route path="/motoristas" element={<GuardedPage modulo="motoristas"><MotoristasList /></GuardedPage>} />
                          <Route path="/motoristas/novo" element={<GuardedPage modulo="motoristas" acao="add"><MotoristaForm /></GuardedPage>} />
                          <Route path="/motoristas/editar/:id" element={<GuardedPage modulo="motoristas" acao="change"><MotoristaForm /></GuardedPage>} />

                          {/* Veículos */}
                          <Route path="/veiculos" element={<GuardedPage modulo="veiculos"><VeiculosList /></GuardedPage>} />
                          <Route path="/veiculos/novo" element={<GuardedPage modulo="veiculos" acao="add"><VeiculoForm /></GuardedPage>} />
                          <Route path="/veiculos/editar/:id" element={<GuardedPage modulo="veiculos" acao="change"><VeiculoForm /></GuardedPage>} />

                          {/* CT-e */}
                          <Route path="/ctes" element={<GuardedPage modulo="cte"><CTeList /></GuardedPage>} />
                          <Route path="/ctes/pendentes" element={<GuardedPage modulo="cte"><PagamentosPendentes /></GuardedPage>} />
                          <Route path="/ctes/:id" element={<GuardedPage modulo="cte"><CTeDetail /></GuardedPage>} />

                          {/* MDF-e */}
                          <Route path="/mdfes" element={<GuardedPage modulo="mdfe"><MDFeList /></GuardedPage>} />
                          <Route path="/mdfes/:id" element={<GuardedPage modulo="mdfe"><MDFeDetail /></GuardedPage>} />

                          {/* Upload XML */}
                          <Route path="/upload" element={<GuardedPage modulo="cte" acao="add"><UploadXML /></GuardedPage>} />

                          {/* Pagamentos */}
                          <Route path="/pagamentos" element={<GuardedPage modulo="pagamentos"><PagamentosList /></GuardedPage>} />
                          <Route path="/pagamentos/agregados/novo" element={<GuardedPage modulo="pagamentos" acao="add"><PagamentoAgregadoForm /></GuardedPage>} />
                          <Route path="/pagamentos/agregados/:id/editar" element={<GuardedPage modulo="pagamentos" acao="change"><PagamentoAgregadoForm /></GuardedPage>} />
                          <Route path="/pagamentos/proprios/novo" element={<GuardedPage modulo="pagamentos" acao="add"><PagamentoProprioForm /></GuardedPage>} />
                          <Route path="/pagamentos/proprios/:id/editar" element={<GuardedPage modulo="pagamentos" acao="change"><PagamentoProprioForm /></GuardedPage>} />

                          {/* Manutenção */}
                          <Route path="/manutencoes" element={<GuardedPage modulo="veiculos"><ManutencaoList /></GuardedPage>} />
                          <Route path="/manutencoes/nova" element={<GuardedPage modulo="veiculos" acao="add"><ManutencaoForm /></GuardedPage>} />
                          <Route path="/manutencoes/:id" element={<GuardedPage modulo="veiculos" acao="change"><ManutencaoForm /></GuardedPage>} />

                          {/* Ordens de Viagem */}
                          <Route path="/ordens-viagem" element={<GuardedPage modulo="ordens_viagem"><OrdensViagemList /></GuardedPage>} />
                          <Route path="/ordens-viagem/nova" element={<GuardedPage modulo="ordens_viagem" acao="add"><OrdemViagemForm /></GuardedPage>} />
                          <Route path="/ordens-viagem/:id" element={<GuardedPage modulo="ordens_viagem" acao="change"><OrdemViagemForm /></GuardedPage>} />

                          {/* Abastecimento */}
                          <Route path="/abastecimentos" element={<GuardedPage modulo="frota"><AbastecimentosList /></GuardedPage>} />
                          <Route path="/abastecimentos/novo" element={<GuardedPage modulo="frota" acao="add"><AbastecimentoForm /></GuardedPage>} />
                          <Route path="/abastecimentos/:id" element={<GuardedPage modulo="frota" acao="change"><AbastecimentoForm /></GuardedPage>} />

                          {/* Planos de Manutenção */}
                          <Route path="/planos-manutencao" element={<GuardedPage modulo="veiculos"><PlanosManutencaoList /></GuardedPage>} />
                          <Route path="/planos-manutencao/novo" element={<GuardedPage modulo="veiculos" acao="add"><PlanoManutencaoForm /></GuardedPage>} />
                          <Route path="/planos-manutencao/:id" element={<GuardedPage modulo="veiculos" acao="change"><PlanoManutencaoForm /></GuardedPage>} />

                          {/* Multas e Sinistros */}
                          <Route path="/frota/multas-sinistros" element={<GuardedPage modulo="frota"><MultasSinistros /></GuardedPage>} />

                          {/* Pedágio */}
                          <Route path="/pedagios" element={<GuardedPage modulo="frota"><PedagiosList /></GuardedPage>} />
                          <Route path="/pedagios/novo" element={<GuardedPage modulo="frota" acao="add"><PedagioForm /></GuardedPage>} />
                          <Route path="/pedagios/:id" element={<GuardedPage modulo="frota" acao="change"><PedagioForm /></GuardedPage>} />

                          {/* Tabela de Frete */}
                          <Route path="/tabelas-frete" element={<GuardedPage modulo="frota"><TabelasFreteList /></GuardedPage>} />
                          <Route path="/tabelas-frete/nova" element={<GuardedPage modulo="frota" acao="add"><TabelaFreteForm /></GuardedPage>} />
                          <Route path="/tabelas-frete/:id" element={<GuardedPage modulo="frota" acao="change"><TabelaFreteForm /></GuardedPage>} />

                          {/* Financeiro */}
                          <Route path="/financeiro" element={<GuardedPage capability="financeiro.painel"><FinanceiroPainel /></GuardedPage>} />
                          <Route path="/faturas" element={<GuardedPage modulo="financeiro"><FaturasList /></GuardedPage>} />
                          <Route path="/faturas/nova" element={<GuardedPage modulo="financeiro" acao="add"><FaturaForm /></GuardedPage>} />
                          <Route path="/faturas/:id/editar" element={<GuardedPage modulo="financeiro" acao="change"><FaturaForm /></GuardedPage>} />
                          <Route path="/financeiro/contas-a-pagar" element={<GuardedPage modulo="financeiro"><ContasPagarList /></GuardedPage>} />
                          <Route path="/financeiro/contas-a-pagar/nova" element={<GuardedPage modulo="financeiro" acao="add"><ContaPagarForm /></GuardedPage>} />
                          <Route path="/financeiro/contas-a-pagar/:id/editar" element={<GuardedPage modulo="financeiro" acao="change"><ContaPagarForm /></GuardedPage>} />
                          <Route path="/financeiro/conciliacao" element={<GuardedPage modulo="financeiro"><ConciliacaoBancaria /></GuardedPage>} />
                          <Route path="/financeiro/inadimplencia" element={<GuardedPage capability="financeiro.inadimplencia"><Inadimplencia /></GuardedPage>} />
                          <Route path="/financeiro/fluxo-caixa" element={<GuardedPage capability="financeiro.fluxo_caixa"><FluxoCaixa /></GuardedPage>} />
                          <Route path="/financeiro/dre" element={<GuardedPage capability="financeiro.dre"><DRE /></GuardedPage>} />

                          {/* Configurações */}
                          <Route path="/configuracoes" element={<GuardedPage modulo="configuracoes"><Configuracoes /></GuardedPage>} />

                          {/* Relatórios */}
                          <Route path="/relatorios" element={<GuardedPage capability="dashboard.relatorios"><Relatorios /></GuardedPage>} />

                          {/* Backup */}
                          <Route path="/backup" element={<GuardedPage modulo="backup"><BackupManager /></GuardedPage>} />

                          {/* Alertas */}
                          <Route path="/alertas" element={<GuardedPage modulo="alertas"><AlertasSistema /></GuardedPage>} />

                          {/* Faixas KM */}
                          <Route path="/faixas-km" element={<GuardedPage modulo="pagamentos"><FaixasKmList /></GuardedPage>} />

                          {/* Vencimentos */}
                          <Route path="/vencimentos" element={<GuardedPage modulo="alertas"><VencimentosPainel /></GuardedPage>} />

                          {/* Geográfico */}
                          <Route path="/geografico" element={<GuardedPage capability="dashboard.geral"><GeograficoPainel /></GuardedPage>} />

                          {/* Rastreamento GPS */}
                          <Route path="/rastreamento" element={<GuardedPage capability="frota.visualizar_gps"><RastreamentoPainel /></GuardedPage>} />

                          {/* Comunicação */}
                          <Route path="/comunicacao" element={<GuardedPage modulo="comunicacao"><ComunicacaoPanel /></GuardedPage>} />

                          {/* CIOT */}
                          <Route path="/ciot" element={<GuardedPage modulo="frota"><CIOTManager /></GuardedPage>} />

                          {/* Usuários */}
                          <Route path="/usuarios" element={
                            <PermissionGuard capability="usuarios.manage_access" fallback={<Navigate to="/dashboard" replace />}>
                              <UsuariosList />
                            </PermissionGuard>
                          } />
                          <Route path="/usuarios/novo" element={
                            <PermissionGuard capability="usuarios.manage_access" fallback={<Navigate to="/dashboard" replace />}>
                              <UsuarioForm />
                            </PermissionGuard>
                          } />
                          <Route path="/usuarios/editar/:id" element={
                            <PermissionGuard capability="usuarios.manage_access" fallback={<Navigate to="/dashboard" replace />}>
                              <UsuarioForm />
                            </PermissionGuard>
                          } />
                          <Route path="/usuarios/:id/acessos" element={
                            <PermissionGuard capability="usuarios.manage_access" fallback={<Navigate to="/dashboard" replace />}>
                              <UsuarioAcessos />
                            </PermissionGuard>
                          } />

                          {/* Perfis */}
                          <Route path="/perfis" element={
                            <PermissionGuard capability="usuarios.manage_access" fallback={<Navigate to="/dashboard" replace />}>
                              <Perfis />
                            </PermissionGuard>
                          } />

                          {/* Rota padrão - redireciona para Dashboard */}
                          <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </Suspense>
                    </main>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
