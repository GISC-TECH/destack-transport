import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Common/Toast';
import Sidebar from './components/Common/Sidebar';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Login from './components/Auth/Login';

// Landing Page (publica)
import LandingPage from './components/Landing/LandingPage';

// Dashboard
import Dashboard from './components/Dashboard/Dashboard';

// Clientes
import ClientesList from './components/Clientes/ClientesList';
import ClienteForm from './components/Clientes/ClienteForm';

// Motoristas
import MotoristasList from './components/Motoristas/MotoristasList';
import MotoristaForm from './components/Motoristas/MotoristaForm';

// Veículos
import VeiculosList from './components/Veiculos/VeiculosList';
import VeiculoForm from './components/Veiculos/VeiculoForm';

// CT-e
import CTeList from './components/CTe/CTeList';
import CTeDetail from './components/CTe/CTeDetail';
import PagamentosPendentes from './components/CTe/PagamentosPendentes';

// MDF-e
import MDFeList from './components/MDFe/MDFeList';
import MDFeDetail from './components/MDFe/MDFeDetail';

// Upload XML
import UploadXML from './components/Upload/UploadXML';

// Pagamentos
import PagamentosList from './components/Pagamentos/PagamentosList';
import PagamentoAgregadoForm from './components/Pagamentos/PagamentoAgregadoForm';
import PagamentoProprioForm from './components/Pagamentos/PagamentoProprioForm';

// Manutenção
import ManutencaoList from './components/Manutencao/ManutencaoList';
import ManutencaoForm from './components/Manutencao/ManutencaoForm';

// Financeiro
import FinanceiroPainel from './components/Financeiro/FinanceiroPainel';

// Configurações
import Configuracoes from './components/Configuracoes/Configuracoes';

// Relatórios
import Relatorios from './components/Relatorios/Relatorios';

// Backup
import BackupManager from './components/Backup/BackupManager';

// Alertas
import AlertasSistema from './components/Alertas/AlertasSistema';

// Faixas KM
import FaixasKmList from './components/FaixasKm/FaixasKmList';

// Vencimentos
import VencimentosPainel from './components/Vencimentos/VencimentosPainel';

// Geografico
import GeograficoPainel from './components/Geografico/GeograficoPainel';

// Usuarios
import UsuariosList from './components/Usuarios/UsuariosList';
import UsuarioForm from './components/Usuarios/UsuarioForm';

import './App.css';

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

                        {/* Financeiro */}
                        <Route path="/financeiro" element={<FinanceiroPainel />} />

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

                        {/* Usuários */}
                        <Route path="/usuarios" element={<UsuariosList />} />
                        <Route path="/usuarios/novo" element={<UsuarioForm />} />
                        <Route path="/usuarios/editar/:id" element={<UsuarioForm />} />

                        {/* Rota padrão - redireciona para Dashboard */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
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
