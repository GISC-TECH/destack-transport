import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Common/Toast';
import Sidebar from './components/Common/Sidebar';
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
                          <Route path="/dashboard" element={<Dashboard />} />

                          {/* Clientes */}
                          <Route path="/clientes" element={<ClientesList />} />
                          <Route path="/clientes/novo" element={<ClienteForm />} />
                          <Route path="/clientes/editar/:id" element={<ClienteForm />} />

                          {/* Motoristas */}
                          <Route path="/motoristas" element={<MotoristasList />} />
                          <Route path="/motoristas/novo" element={<MotoristaForm />} />
                          <Route path="/motoristas/editar/:id" element={<MotoristaForm />} />

                          {/* Veículos */}
                          <Route path="/veiculos" element={<VeiculosList />} />
                          <Route path="/veiculos/novo" element={<VeiculoForm />} />
                          <Route path="/veiculos/editar/:id" element={<VeiculoForm />} />

                          {/* CT-e */}
                          <Route path="/ctes" element={<CTeList />} />
                          <Route path="/ctes/pendentes" element={<PagamentosPendentes />} />
                          <Route path="/ctes/:id" element={<CTeDetail />} />

                          {/* MDF-e */}
                          <Route path="/mdfes" element={<MDFeList />} />
                          <Route path="/mdfes/:id" element={<MDFeDetail />} />

                          {/* Upload XML */}
                          <Route path="/upload" element={<UploadXML />} />

                          {/* Pagamentos */}
                          <Route path="/pagamentos" element={<PagamentosList />} />
                          <Route path="/pagamentos/agregados/novo" element={<PagamentoAgregadoForm />} />
                          <Route path="/pagamentos/agregados/:id/editar" element={<PagamentoAgregadoForm />} />
                          <Route path="/pagamentos/proprios/novo" element={<PagamentoProprioForm />} />
                          <Route path="/pagamentos/proprios/:id/editar" element={<PagamentoProprioForm />} />

                          {/* Manutenção */}
                          <Route path="/manutencoes" element={<ManutencaoList />} />
                          <Route path="/manutencoes/nova" element={<ManutencaoForm />} />
                          <Route path="/manutencoes/:id" element={<ManutencaoForm />} />

                          {/* Ordens de Viagem */}
                          <Route path="/ordens-viagem" element={<OrdensViagemList />} />
                          <Route path="/ordens-viagem/nova" element={<OrdemViagemForm />} />
                          <Route path="/ordens-viagem/:id" element={<OrdemViagemForm />} />

                          {/* Abastecimento */}
                          <Route path="/abastecimentos" element={<AbastecimentosList />} />
                          <Route path="/abastecimentos/novo" element={<AbastecimentoForm />} />
                          <Route path="/abastecimentos/:id" element={<AbastecimentoForm />} />

                          {/* Planos de Manutenção */}
                          <Route path="/planos-manutencao" element={<PlanosManutencaoList />} />
                          <Route path="/planos-manutencao/novo" element={<PlanoManutencaoForm />} />
                          <Route path="/planos-manutencao/:id" element={<PlanoManutencaoForm />} />

                          {/* Multas e Sinistros */}
                          <Route path="/frota/multas-sinistros" element={<MultasSinistros />} />

                          {/* Pedágio */}
                          <Route path="/pedagios" element={<PedagiosList />} />
                          <Route path="/pedagios/novo" element={<PedagioForm />} />
                          <Route path="/pedagios/:id" element={<PedagioForm />} />

                          {/* Tabela de Frete */}
                          <Route path="/tabelas-frete" element={<TabelasFreteList />} />
                          <Route path="/tabelas-frete/nova" element={<TabelaFreteForm />} />
                          <Route path="/tabelas-frete/:id" element={<TabelaFreteForm />} />

                          {/* Financeiro */}
                          <Route path="/financeiro" element={<FinanceiroPainel />} />
                          <Route path="/faturas" element={<FaturasList />} />
                          <Route path="/faturas/nova" element={<FaturaForm />} />
                          <Route path="/faturas/:id/editar" element={<FaturaForm />} />
                          <Route path="/financeiro/contas-a-pagar" element={<ContasPagarList />} />
                          <Route path="/financeiro/contas-a-pagar/nova" element={<ContaPagarForm />} />
                          <Route path="/financeiro/contas-a-pagar/:id/editar" element={<ContaPagarForm />} />
                          <Route path="/financeiro/conciliacao" element={<ConciliacaoBancaria />} />
                          <Route path="/financeiro/inadimplencia" element={<Inadimplencia />} />
                          <Route path="/financeiro/fluxo-caixa" element={<FluxoCaixa />} />
                          <Route path="/financeiro/dre" element={<DRE />} />

                          {/* Configurações */}
                          <Route path="/configuracoes" element={<Configuracoes />} />

                          {/* Relatórios */}
                          <Route path="/relatorios" element={<Relatorios />} />

                          {/* Backup */}
                          <Route path="/backup" element={<BackupManager />} />

                          {/* Alertas */}
                          <Route path="/alertas" element={<AlertasSistema />} />

                          {/* Faixas KM */}
                          <Route path="/faixas-km" element={<FaixasKmList />} />

                          {/* Vencimentos */}
                          <Route path="/vencimentos" element={<VencimentosPainel />} />

                          {/* Geográfico */}
                          <Route path="/geografico" element={<GeograficoPainel />} />

                          {/* Rastreamento GPS */}
                          <Route path="/rastreamento" element={<RastreamentoPainel />} />

                          {/* Comunicação */}
                          <Route path="/comunicacao" element={<ComunicacaoPanel />} />

                          {/* CIOT */}
                          <Route path="/ciot" element={<CIOTManager />} />

                          {/* Usuários */}
                          <Route path="/usuarios" element={<UsuariosList />} />
                          <Route path="/usuarios/novo" element={<UsuarioForm />} />
                          <Route path="/usuarios/editar/:id" element={<UsuarioForm />} />

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
