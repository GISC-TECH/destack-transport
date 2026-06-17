import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import logoSvg from '../../assets/images/logo.svg';
import logoLarge from '../../assets/images/logo-large.png';
import truckImg from '../../assets/images/truck.png';
import './LandingPage.css';

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const revealRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll reveal — adiciona .in-view aos elementos [data-reveal] quando entram na viewport
  useEffect(() => {
    const elements = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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

  const heroStats = [
    { value: '15+', label: 'Anos de estrada' },
    { value: '24/7', label: 'Monitoramento' },
    { value: '100%', label: 'Carga segura' },
    { value: 'Nacional', label: 'Cobertura' }
  ];

  const services = [
    {
      icon: 'radiation',
      color: 'green',
      title: 'Transporte de Produtos Perigosos',
      items: ['Classe 3 — Líquidos Inflamáveis', 'Classe 8 — Corrosivos', 'Equipamentos com proteção ATEX', 'Certificação INMETRO']
    },
    {
      icon: 'satellite',
      color: 'blue',
      title: 'Monitoramento 24/7',
      items: ['Rastreamento via GPS', 'Sensores de temperatura', 'Relatórios de viagem online', 'Notificações em tempo real']
    },
    {
      icon: 'shield',
      color: 'orange',
      title: 'Segurança Integrada',
      items: ['Escolta armada', 'Seguro de carga total', 'Treinamento NR-20', 'Kit de emergência química']
    },
    {
      icon: 'warehouse',
      color: 'purple',
      title: 'Armazenagem Controlada',
      items: ['Armazéns climatizados', 'Áreas classificadas', 'Estoque inteligente', 'Certificação ISO 9001']
    },
    {
      icon: 'globe',
      color: 'teal',
      title: 'Transporte Internacional',
      items: ['Licença OEA', 'Despacho aduaneiro', 'Documentação integrada', 'Cobertura continental']
    },
    {
      icon: 'headset',
      color: 'red',
      title: 'Suporte Técnico',
      items: ['Engenheiros químicos', 'Consultoria legal', 'Plantão 24h', 'Auditoria de processos']
    }
  ];

  const diferenciais = [
    'Certificação completa para transporte de produtos perigosos',
    'Frota modernizada com tecnologia Euro 6',
    'Monitoramento 24/7 via satélite',
    'Equipe treinada e certificada',
    'Cobertura nacional e internacional'
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
    <div className="landing-page" ref={revealRef}>
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
            <a href="#servicos" onClick={(e) => scrollToSection(e, 'servicos')}>Serviços</a>
            <a href="#contato" onClick={(e) => scrollToSection(e, 'contato')}>Contato</a>
            <Link to="/login" className="btn-admin">Área Adm</Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menu"
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
          <a href="#servicos" onClick={(e) => scrollToSection(e, 'servicos')}>Serviços</a>
          <a href="#contato" onClick={(e) => scrollToSection(e, 'contato')}>Contato</a>
          <Link to="/login" className="btn-admin">Área Adm</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <img src={truckImg} alt="Caminhão Euro 6 da Destack Transportes" className="hero-image" />
          <div className="hero-overlay"></div>
          <div className="hero-grid"></div>
          <span className="hazard-diamond diamond-1" aria-hidden="true"></span>
          <span className="hazard-diamond diamond-2" aria-hidden="true"></span>
          <span className="hazard-diamond diamond-3" aria-hidden="true"></span>
        </div>

        <div className="hero-content">
          <span className="hero-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Certificação ADR · NR-20 · INMETRO
          </span>
          <h1>
            Transporte especializado em<br/>
            <span className="hero-highlight">produtos perigosos</span>
          </h1>
          <p>
            Tecnologia avançada e segurança máxima para cargas sensíveis.
            Sua carga entregue com a excelência que a sua operação exige.
          </p>
          <div className="hero-actions">
            <a href="#contato" onClick={(e) => scrollToSection(e, 'contato')} className="btn-cta">
              Solicitar Orçamento
            </a>
            <a href="#servicos" onClick={(e) => scrollToSection(e, 'servicos')} className="btn-ghost">
              Conheça os serviços
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </a>
          </div>

          <div className="hero-stats">
            {heroStats.map((stat, idx) => (
              <div className="hero-stat" key={idx}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre Section */}
      <section id="sobre" className="sobre-section">
        <div className="section-container">
          <div className="sobre-grid">
            <div className="sobre-text" data-reveal>
              <span className="section-eyebrow">Quem somos</span>
              <h2>Destack Transportes</h2>
              <p className="lead">
                Especialistas em transporte de produtos perigosos com mais de 15 anos de experiência no mercado brasileiro.
              </p>
              <p>
                Nossa empresa combina tecnologia de ponta, equipe altamente qualificada e os mais rígidos padrões de segurança para garantir o transporte seguro e eficiente de cargas especializadas.
              </p>

              <div className="stats-grid">
                <div className="stat-card">
                  <h3>15+</h3>
                  <p>Anos de Experiência</p>
                </div>
                <div className="stat-card">
                  <h3>100%</h3>
                  <p>Segurança Garantida</p>
                </div>
              </div>
            </div>

            <div className="sobre-card" data-reveal>
              <div className="card-glow"></div>
              <h4>Por que escolher a Destack?</h4>
              <ul>
                {diferenciais.map((item, idx) => (
                  <li key={idx}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Servicos Section */}
      <section id="servicos" className="servicos-section">
        <div className="section-container">
          <div className="section-head" data-reveal>
            <span className="section-eyebrow">O que fazemos</span>
            <h2>Nossos Serviços</h2>
            <p>Soluções completas para cada etapa do transporte de cargas críticas.</p>
          </div>

          <div className="servicos-grid">
            {services.map((service, index) => (
              <div
                key={index}
                className={`service-card service-${service.color}`}
                data-reveal
                style={{ transitionDelay: `${(index % 3) * 80}ms` }}
              >
                <div className="service-card-top">
                  <div className={`service-icon icon-${service.color}`}>
                    {getIconSvg(service.icon)}
                  </div>
                  <span className="service-index">{String(index + 1).padStart(2, '0')}</span>
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
          <div className="section-head" data-reveal>
            <span className="section-eyebrow">Fale conosco</span>
            <h2>Vamos transportar a sua carga?</h2>
            <p>Solicite um orçamento ou visite a nossa base em São Sebastião do Passé.</p>
          </div>

          <div className="contato-grid">
            <div className="map-container" data-reveal>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.032730292895!2d-38.46678768465429!3d-12.972851563346624!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7161a0d9e3c99df%3A0x4d4a8e2b5c915c0!2sAv.%20Ernani%20de%20Oliveira%20Rocha%2C%202450%20-%20S%C3%A3o%20Sebasti%C3%A3o%20do%20Pass%C3%A9%20-%20BA%2C%2043850-000!5e0!3m2!1spt-BR!2sbr!4v1678905677974!5m2!1spt-BR!2sbr"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização Destack Transportes"
              ></iframe>
            </div>

            <div className="contato-card" data-reveal>
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
                    <h5>Endereço</h5>
                    <p>Avenida Ernani de Oliveira Rocha, 2450</p>
                    <p>São Sebastião do Passé - BA</p>
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
                  Enviar E-mail
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
              <p>Transporte especializado em produtos perigosos, garantindo segurança e eficiência.</p>
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
                  São Sebastião do Passé - BA
                </li>
              </ul>
            </div>

            <div className="footer-certs">
              <h5>Certificações</h5>
              <ul>
                <li>CNPJ: 24.633.774/0001-18</li>
                <li>Licença ANTT: 1234.5678.910</li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <circle cx="12" cy="8" r="7"/>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                  </svg>
                  Certificação ISO 9001
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2026 Destack Transportes. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
