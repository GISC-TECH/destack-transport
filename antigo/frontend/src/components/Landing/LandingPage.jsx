import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logoSvg from '../../assets/images/logo.svg';
import logoLarge from '../../assets/images/logo-large.png';
import truckImg from '../../assets/images/truck.png';
import './LandingPage.css';

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const navbarHeight = 80;
      const offsetPosition = element.offsetTop - navbarHeight;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      setMobileMenuOpen(false);
    }
  };

  const services = [
    {
      icon: 'radiation',
      color: 'green',
      title: 'Transporte de Produtos Perigosos',
      items: ['Classe 3 - Liquidos Inflamaveis', 'Classe 8 - Corrosivos', 'Equipamentos com protecao ATEX', 'Certificacao INMETRO']
    },
    {
      icon: 'satellite',
      color: 'blue',
      title: 'Monitoramento 24/7',
      items: ['Rastreamento via GPS', 'Sensores de temperatura', 'Relatorios de viagem online', 'Notificacoes em tempo real']
    },
    {
      icon: 'shield',
      color: 'orange',
      title: 'Seguranca Integrada',
      items: ['Escolta armada', 'Seguro de carga total', 'Treinamento NR-20', 'Kit emergencia quimica']
    },
    {
      icon: 'warehouse',
      color: 'purple',
      title: 'Armazenagem Controlada',
      items: ['Armazens climatizados', 'Areas classificadas', 'Estoque inteligente', 'Certificacao ISO 9001']
    },
    {
      icon: 'globe',
      color: 'teal',
      title: 'Transporte Internacional',
      items: ['Licenca OEA', 'Despacho aduaneiro', 'Documentacao integrada', 'Cobertura continental']
    },
    {
      icon: 'headset',
      color: 'red',
      title: 'Suporte Tecnico',
      items: ['Engenheiros quimicos', 'Consultoria legal', 'Plantao 24h', 'Auditoria de processos']
    }
  ];

  const getIconSvg = (icon) => {
    switch (icon) {
      case 'radiation':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
            <circle cx="12" cy="12" r="2"/>
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
            <path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
          </svg>
        );
      case 'satellite':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
            <path d="M13 10l-2 2"/>
            <circle cx="18" cy="6" r="3"/>
            <path d="M9 15l-5 5"/>
            <path d="M2 22l2-2"/>
            <path d="M14.5 14.5L19 19"/>
          </svg>
        );
      case 'shield':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        );
      case 'warehouse':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        );
      case 'globe':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        );
      case 'headset':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className={`landing-navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <a href="#" className="navbar-brand">
            <img src={logoSvg} alt="Destack Logo" className="navbar-logo" />
            <span className="navbar-brand-text">Destack Transportes</span>
          </a>

          {/* Desktop Menu */}
          <div className="navbar-menu desktop-menu">
            <a href="#sobre" onClick={(e) => scrollToSection(e, 'sobre')}>Sobre</a>
            <a href="#servicos" onClick={(e) => scrollToSection(e, 'servicos')}>Servicos</a>
            <a href="#contato" onClick={(e) => scrollToSection(e, 'contato')}>Contato</a>
            <Link to="/login" className="btn-admin">Area Adm</Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#sobre" onClick={(e) => scrollToSection(e, 'sobre')}>Sobre</a>
          <a href="#servicos" onClick={(e) => scrollToSection(e, 'servicos')}>Servicos</a>
          <a href="#contato" onClick={(e) => scrollToSection(e, 'contato')}>Contato</a>
          <Link to="/login" className="btn-admin">Area Adm</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <img src={truckImg} alt="Caminhao Euro 6" className="hero-image" />
          <div className="hero-overlay"></div>
        </div>

        <div className="hero-content">
          <h1>Transporte Especializado<br/>em Produtos Perigosos</h1>
          <p>
            Tecnologia avancada e seguranca maxima para cargas sensiveis.
            Sua carga entregue com a excelencia que voce precisa.
          </p>
          <a href="#contato" onClick={(e) => scrollToSection(e, 'contato')} className="btn-cta">
            Solicitar Orcamento
          </a>
        </div>
      </section>

      {/* Sobre Section */}
      <section id="sobre" className="sobre-section">
        <div className="section-container">
          <div className="sobre-grid">
            <div className="sobre-text">
              <h2>Destack Transportes</h2>
              <p className="lead">
                Especialistas em transporte de produtos perigosos com mais de 15 anos de experiencia no mercado brasileiro.
              </p>
              <p>
                Nossa empresa combina tecnologia de ponta, equipe altamente qualificada e os mais rigidos padroes de seguranca para garantir o transporte seguro e eficiente de cargas especializadas.
              </p>

              <div className="stats-grid">
                <div className="stat-card">
                  <h3>15+</h3>
                  <p>Anos de Experiencia</p>
                </div>
                <div className="stat-card">
                  <h3>100%</h3>
                  <p>Seguranca Garantida</p>
                </div>
              </div>
            </div>

            <div className="sobre-card">
              <div className="card-glow"></div>
              <h4>Por que escolher a Destack?</h4>
              <ul>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Certificacao completa para transporte de produtos perigosos
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Frota modernizada com tecnologia Euro 6
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Monitoramento 24/7 via satelite
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Equipe treinada e certificada
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Cobertura nacional e internacional
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Servicos Section */}
      <section id="servicos" className="servicos-section">
        <div className="section-container">
          <h2>Nossos Servicos</h2>

          <div className="servicos-grid">
            {services.map((service, index) => (
              <div key={index} className={`service-card service-${service.color}`}>
                <div className={`service-icon icon-${service.color}`}>
                  {getIconSvg(service.icon)}
                </div>
                <h3>{service.title}</h3>
                <ul>
                  {service.items.map((item, idx) => (
                    <li key={idx}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contato Section */}
      <section id="contato" className="contato-section">
        <div className="section-container">
          <div className="contato-grid">
            <div className="map-container">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.032730292895!2d-38.46678768465429!3d-12.972851563346624!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7161a0d9e3c99df%3A0x4d4a8e2b5c915c0!2sAv.%20Ernani%20de%20Oliveira%20Rocha%2C%202450%20-%20S%C3%A3o%20Sebasti%C3%A3o%20do%20Pass%C3%A9%20-%20BA%2C%2043850-000!5e0!3m2!1spt-BR!2sbr!4v1678905677974!5m2!1spt-BR!2sbr"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localizacao Destack Transportes"
              ></iframe>
            </div>

            <div className="contato-card">
              <h2>Entre em Contato</h2>

              <div className="contato-info">
                <div className="info-item">
                  <div className="info-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                  </div>
                  <div>
                    <h5>Endereco</h5>
                    <p>Avenida Ernani de Oliveira Rocha, 2450</p>
                    <p>Sao Sebastiao do Passe - BA</p>
                  </div>
                </div>

                <div className="info-item">
                  <div className="info-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div>
                    <h5>Telefone</h5>
                    <p>(71) 99999-9999</p>
                  </div>
                </div>

                <a href="mailto:contato@destacktransportes.com.br" className="btn-email">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Enviar Email
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="section-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <img src={logoLarge} alt="Logo Destack" className="footer-logo" />
              <p>Transporte especializado em produtos perigosos, garantindo seguranca e eficiencia.</p>
            </div>

            <div className="footer-contact">
              <h5>Contato</h5>
              <ul>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  (71) 99999-9999
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  contato@destacktransportes.com.br
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  Sao Sebastiao do Passe - BA
                </li>
              </ul>
            </div>

            <div className="footer-certs">
              <h5>Certificacoes</h5>
              <ul>
                <li>CNPJ: 24.633.774/0001-18</li>
                <li>Licenca ANTT: 1234.5678.910</li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <circle cx="12" cy="8" r="7"/>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                  </svg>
                  Certificacao ISO 9001
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2024 Destack Transportes. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
