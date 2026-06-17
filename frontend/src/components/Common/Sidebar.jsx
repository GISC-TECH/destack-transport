import { useState, useEffect, useRef, Fragment } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const prevPathnameRef = useRef(location.pathname);

  // Fechar menu mobile ao mudar de rota
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsMobileOpen(false);
    }
  }, [location.pathname]);

  // Fechar menu mobile ao redimensionar para desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSubmenu = (menu) => {
    setOpenMenus(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    {
      id: 'dashboard',
      section: 'Principal',
      label: 'Dashboard',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ),
      path: '/dashboard'
    },
    {
      id: 'documentos',
      section: 'Operação',
      label: 'Documentos',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      ),
      submenu: [
        { label: 'CT-e', path: '/ctes' },
        { label: 'MDF-e', path: '/mdfes' },
        { label: 'Upload XML', path: '/upload' }
      ]
    },
    {
      id: 'cadastros',
      section: 'Cadastros',
      label: 'Cadastros',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
      submenu: [
        { label: 'Clientes', path: '/clientes' },
        { label: 'Motoristas', path: '/motoristas' },
        { label: 'Veículos', path: '/veiculos' }
      ]
    },
    {
      id: 'financeiro',
      section: 'Financeiro',
      label: 'Financeiro',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      ),
      submenu: [
        { label: 'Painel Financeiro', path: '/financeiro' },
        { label: 'Pagamentos', path: '/pagamentos' },
        { label: 'CT-es Pendentes', path: '/ctes/pendentes' },
        { label: 'Faixas de KM', path: '/faixas-km' }
      ]
    },
    {
      id: 'manutencao',
      section: 'Frota',
      label: 'Manutenção',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
      ),
      path: '/manutencoes'
    },
    {
      id: 'relatorios',
      section: 'Inteligência',
      label: 'Relatórios',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      ),
      submenu: [
        { label: 'Relatórios Gerais', path: '/relatorios' },
        { label: 'Painel Geográfico', path: '/geografico' }
      ]
    },
    {
      id: 'sistema',
      section: 'Sistema',
      label: 'Sistema',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      ),
      submenu: [
        { label: 'Alertas', path: '/alertas' },
        { label: 'Vencimentos', path: '/vencimentos' },
        { label: 'Usuários', path: '/usuarios' },
        { label: 'Backup', path: '/backup' },
        { label: 'Configurações', path: '/configuracoes' }
      ]
    }
  ];

  const isSubmenuActive = (submenu) => {
    return submenu?.some(item => isActive(item.path));
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="mobile-header" role="banner">
        <button
          className="menu-toggle"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label={isMobileOpen ? 'Fechar menu de navegacao' : 'Abrir menu de navegacao'}
          aria-expanded={isMobileOpen}
          aria-controls="sidebar-nav"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isMobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </>
            )}
          </svg>
        </button>
        <div className="mobile-brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
          <span>Destack Transport</span>
        </div>
        <div className="mobile-user">
          <button className="mobile-logout" onClick={handleLogout} aria-label="Sair do sistema">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* Overlay para mobile */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Menu principal"
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <Link to="/dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            <span className="brand-text">Destack Transport</span>
          </Link>
          <button
            className="collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points={isCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}></polyline>
            </svg>
          </button>
        </div>

        {/* Menu */}
        <nav className="sidebar-nav" id="sidebar-nav" role="navigation" aria-label="Navegacao principal">
          <ul className="sidebar-menu" role="menubar">
            {menuItems.map((item, idx) => (
              <Fragment key={item.id}>
                {item.section && item.section !== menuItems[idx - 1]?.section && (
                  <li className="menu-section" role="presentation" aria-hidden="true">
                    {item.section}
                  </li>
                )}
              <li
                className={`menu-item ${item.submenu ? 'has-submenu' : ''} ${openMenus[item.id] || isSubmenuActive(item.submenu) ? 'open' : ''}`}
                role="none"
              >
                {item.path ? (
                  <Link
                    to={item.path}
                    className={`menu-link ${isActive(item.path) ? 'active' : ''}`}
                    title={isCollapsed ? item.label : ''}
                    role="menuitem"
                    aria-current={isActive(item.path) ? 'page' : undefined}
                  >
                    <span className="menu-icon" aria-hidden="true">{item.icon}</span>
                    <span className="menu-label">{item.label}</span>
                  </Link>
                ) : (
                  <>
                    <button
                      className={`menu-link ${isSubmenuActive(item.submenu) ? 'active' : ''}`}
                      onClick={() => toggleSubmenu(item.id)}
                      title={isCollapsed ? item.label : ''}
                      role="menuitem"
                      aria-expanded={openMenus[item.id] || isSubmenuActive(item.submenu)}
                      aria-haspopup="menu"
                      aria-controls={`submenu-${item.id}`}
                    >
                      <span className="menu-icon" aria-hidden="true">{item.icon}</span>
                      <span className="menu-label">{item.label}</span>
                      <svg className="submenu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    <ul className="submenu" id={`submenu-${item.id}`} role="menu" aria-label={item.label}>
                      {item.submenu.map((subItem) => (
                        <li key={subItem.path} role="none">
                          <Link
                            to={subItem.path}
                            className={isActive(subItem.path) ? 'active' : ''}
                            role="menuitem"
                            aria-current={isActive(subItem.path) ? 'page' : undefined}
                          >
                            {subItem.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
              </Fragment>
            ))}
          </ul>
        </nav>

        {/* User Section */}
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="user-details">
              <span className="user-name">{user?.username || 'Usuário'}</span>
              <span className="user-role">{user?.is_staff ? 'Administrador' : 'Usuário'}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sair" aria-label="Sair do sistema">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
