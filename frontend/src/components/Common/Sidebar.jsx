import { useState, useEffect, useRef, Fragment } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/images/logo.svg';
import styles from './Sidebar.module.css';

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [openBottomSheet, setOpenBottomSheet] = useState(null);
  const [openMoreMenu, setOpenMoreMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const prevPathnameRef = useRef(location.pathname);

  // Fechar menus ao mudar de rota
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      setIsMobileOpen(false);
      setOpenBottomSheet(null);
      setOpenMoreMenu(false);
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
        { label: 'Faturas', path: '/faturas' },
        { label: 'Contas a Pagar', path: '/financeiro/contas-a-pagar' },
        { label: 'Conciliação Bancária', path: '/financeiro/conciliacao' },
        { label: 'Inadimplência', path: '/financeiro/inadimplencia' },
        { label: 'Fluxo de Caixa', path: '/financeiro/fluxo-caixa' },
        { label: 'DRE', path: '/financeiro/dre' },
        { label: 'Pagamentos', path: '/pagamentos' },
        { label: 'CT-es Pendentes', path: '/ctes/pendentes' },
        { label: 'Faixas de KM', path: '/faixas-km' }
      ]
    },
    {
      id: 'operacao',
      section: 'Operação',
      label: 'Operação',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      ),
      submenu: [
        { label: 'Ordens de Viagem', path: '/ordens-viagem' },
        { label: 'Rastreamento GPS', path: '/rastreamento' },
        { label: 'Comunicação', path: '/comunicacao' },
        { label: 'CIOT', path: '/ciot' },
        { label: 'Abastecimento', path: '/abastecimentos' },
        { label: 'Planos de Manutenção', path: '/planos-manutencao' },
        { label: 'Pedágios', path: '/pedagios' },
        { label: 'Multas/Sinistros', path: '/frota/multas-sinistros' },
        { label: 'Tabela de Frete', path: '/tabelas-frete' },
        { label: 'Manutenção', path: '/manutencoes' }
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

  const sidebarClasses = [
    styles.sidebar,
    isCollapsed && styles.collapsed,
    isMobileOpen && styles.mobileOpen,
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Mobile Header */}
      <header className={styles.mobileHeader} role="banner">
        <button
          className={styles.menuToggle}
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
        <div className={styles.mobileBrand}>
          <img src={logo} alt="Destack Transporte" className={styles.mobileLogo} />
        </div>
        <div className={styles.mobileUser}>
          <button className={styles.mobileLogout} onClick={handleLogout} aria-label="Sair do sistema">
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
        className={`${styles.sidebarOverlay} ${isMobileOpen ? styles.sidebarOverlayActive : ''}`}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={sidebarClasses}
        aria-label="Menu principal"
      >
        {/* Brand */}
        <div className={styles.sidebarBrand}>
          <Link to="/dashboard" aria-label="Destack Transporte">
            <img src={logo} alt="Destack Transporte" className={styles.sidebarLogo} />
          </Link>
          <button
            className={styles.collapseBtn}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points={isCollapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}></polyline>
            </svg>
          </button>
        </div>

        {/* Menu */}
        <nav className={styles.sidebarNav} id="sidebar-nav" role="navigation" aria-label="Navegacao principal">
          <ul className={styles.sidebarMenu} role="menubar">
            {menuItems.map((item, idx) => (
              <Fragment key={item.id}>
                {item.section && item.section !== menuItems[idx - 1]?.section && (
                  <li className={styles.menuSection} role="presentation" aria-hidden="true">
                    {item.section}
                  </li>
                )}
                <li
                  className={[
                    styles.menuItem,
                    item.submenu && styles.hasSubmenu,
                    (openMenus[item.id] || isSubmenuActive(item.submenu)) && styles.open,
                  ].filter(Boolean).join(' ')}
                  role="none"
                >
                  {item.path ? (
                    <Link
                      to={item.path}
                      className={[styles.menuLink, isActive(item.path) && styles.menuLinkActive].filter(Boolean).join(' ')}
                      title={isCollapsed ? item.label : ''}
                      role="menuitem"
                      aria-current={isActive(item.path) ? 'page' : undefined}
                    >
                      <span className={styles.menuIcon} aria-hidden="true">{item.icon}</span>
                      <span className={styles.menuLabel}>{item.label}</span>
                    </Link>
                  ) : (
                    <>
                      <button
                        className={[styles.menuLink, isSubmenuActive(item.submenu) && styles.menuLinkActive].filter(Boolean).join(' ')}
                        onClick={() => toggleSubmenu(item.id)}
                        title={isCollapsed ? item.label : ''}
                        role="menuitem"
                        aria-expanded={openMenus[item.id] || isSubmenuActive(item.submenu)}
                        aria-haspopup="menu"
                        aria-controls={`submenu-${item.id}`}
                      >
                        <span className={styles.menuIcon} aria-hidden="true">{item.icon}</span>
                        <span className={styles.menuLabel}>{item.label}</span>
                        <svg className={styles.submenuArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                      <ul className={styles.submenu} id={`submenu-${item.id}`} role="menu" aria-label={item.label}>
                        {item.submenu.map((subItem) => (
                          <li key={subItem.path} role="none">
                            <Link
                              to={subItem.path}
                              className={isActive(subItem.path) ? styles.submenuLinkActive : ''}
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
        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user?.username || 'Usuário'}</span>
              <span className={styles.userRole}>{user?.is_staff ? 'Administrador' : 'Usuário'}</span>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Sair" aria-label="Sair do sistema">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Bottom Navigation - mobile app-style (4 principais + Mais) */}
      {(() => {
        const mainItems = menuItems.slice(0, 4);
        const moreItems = menuItems.slice(4);
        const moreActive = moreItems.some(i => i.submenu ? isSubmenuActive(i.submenu) : isActive(i.path));

        return (
          <>
            <nav className={styles.bottomNav} aria-label="Navegacao inferior">
              {mainItems.map((item) => (
                <button
                  key={item.id}
                  className={[
                    styles.bottomNavItem,
                    item.submenu
                      ? (isSubmenuActive(item.submenu) || openBottomSheet === item.id) && styles.bottomNavItemActive
                      : isActive(item.path) && styles.bottomNavItemActive,
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setOpenMoreMenu(false);
                    if (item.submenu) {
                      setOpenBottomSheet(openBottomSheet === item.id ? null : item.id);
                    } else {
                      navigate(item.path);
                    }
                  }}
                  aria-label={item.label}
                >
                  <span className={styles.bottomNavIcon} aria-hidden="true">{item.icon}</span>
                  <span className={styles.bottomNavLabel}>{item.label}</span>
                </button>
              ))}
              <button
                className={[
                  styles.bottomNavItem,
                  styles.moreItem,
                  (moreActive || openMoreMenu) && styles.bottomNavItemActive,
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  setOpenBottomSheet(null);
                  setOpenMoreMenu(!openMoreMenu);
                }}
                aria-label="Mais opcoes"
                aria-expanded={openMoreMenu}
              >
                <span className={styles.bottomNavIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                  </svg>
                </span>
                <span className={styles.bottomNavLabel}>Mais</span>
              </button>
            </nav>

            {/* Bottom Sheet para submenus dos 4 principais */}
            {openBottomSheet && (
              <>
                <div
                  className={`${styles.bottomSheetOverlay} ${styles.bottomSheetOverlayActive}`}
                  onClick={() => setOpenBottomSheet(null)}
                  aria-hidden="true"
                />
                <div className={`${styles.bottomSheet} ${styles.bottomSheetOpen}`} role="dialog" aria-modal="true" aria-label={`Menu ${menuItems.find(i => i.id === openBottomSheet)?.label}`}>
                  <div className={styles.bottomSheetHeader}>
                    <span className={styles.bottomSheetTitle}>
                      {menuItems.find(i => i.id === openBottomSheet)?.label}
                    </span>
                    <button
                      className={styles.bottomSheetClose}
                      onClick={() => setOpenBottomSheet(null)}
                      aria-label="Fechar menu"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <ul className={styles.bottomSheetMenu}>
                    {menuItems.find(i => i.id === openBottomSheet)?.submenu?.map((subItem) => (
                      <li key={subItem.path}>
                        <Link
                          to={subItem.path}
                          className={isActive(subItem.path) ? 'active' : ''}
                          onClick={() => setOpenBottomSheet(null)}
                        >
                          {subItem.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* Card suspenso "Mais" com itens extras */}
            {openMoreMenu && (
              <>
                <div
                  className={`${styles.bottomSheetOverlay} ${styles.bottomSheetOverlayActive}`}
                  onClick={() => setOpenMoreMenu(false)}
                  aria-hidden="true"
                />
                <div className={`${styles.bottomSheet} ${styles.bottomSheetOpen} ${styles.moreSheet}`} role="dialog" aria-modal="true" aria-label="Mais opcoes">
                  <div className={styles.bottomSheetHeader}>
                    <span className={styles.bottomSheetTitle}>Mais</span>
                    <button
                      className={styles.bottomSheetClose}
                      onClick={() => setOpenMoreMenu(false)}
                      aria-label="Fechar menu"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <div className={styles.bottomSheetGrid}>
                    {moreItems.map((item) => (
                      <button
                        key={item.id}
                        className={[
                          styles.bottomSheetGridItem,
                          item.submenu
                            ? isSubmenuActive(item.submenu) && styles.bottomSheetGridItemActive
                            : isActive(item.path) && styles.bottomSheetGridItemActive,
                        ].filter(Boolean).join(' ')}
                        onClick={() => {
                          if (item.submenu) {
                            setOpenMoreMenu(false);
                            setOpenBottomSheet(item.id);
                          } else {
                            navigate(item.path);
                          }
                        }}
                      >
                        <span className={styles.bottomSheetGridIcon} aria-hidden="true">{item.icon}</span>
                        <span className={styles.bottomSheetGridLabel}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        );
      })()}
    </>
  );
}

export default Sidebar;
