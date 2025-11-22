/**
 * header-scroll.js
 * Controla o comportamento do header durante o scroll
 */

let lastScrollTop = 0;
let scrollTimeout = null;
let isScrolling = false;

document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('.page-header');
    const mainContent = document.querySelector('.main-content');
    
    if (!header) return;
    
    // Criar indicador de header escondido
    const indicator = document.createElement('div');
    indicator.className = 'header-indicator';
    indicator.innerHTML = '<i class="fas fa-chevron-down"></i> Clique para mostrar';
    indicator.title = 'Clique para mostrar o cabeçalho';
    document.body.appendChild(indicator);
    
    // Clique no indicador mostra o header
    indicator.addEventListener('click', function() {
        header.classList.remove('hidden');
        indicator.classList.remove('visible');
    });
    
    // Configurações do scroll behavior
    const scrollThreshold = 100; // Pixels necessários para ativar o auto-hide
    const hideDelay = 150; // Delay antes de esconder (ms)
    const compactThreshold = 50; // Quando aplicar estilo compacto
    
    function handleScroll() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDirection = currentScrollTop > lastScrollTop ? 'down' : 'up';
        const scrollDistance = Math.abs(currentScrollTop - lastScrollTop);
        
        // Limpar timeout anterior
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        // Marcar que estamos scrollando
        isScrolling = true;
        header.classList.add('scrolling');
        
        // Aplicar estilo compacto se rolou um pouco
        if (currentScrollTop > compactThreshold) {
            header.classList.add('compact');
        } else {
            header.classList.remove('compact');
        }
        
        // Auto-hide logic
        if (currentScrollTop > scrollThreshold && scrollDistance > 10) {
            if (scrollDirection === 'down') {
                // Esconder header ao rolar para baixo
                scrollTimeout = setTimeout(() => {
                    if (isScrolling && scrollDirection === 'down') {
                        header.classList.add('hidden');
                        indicator.classList.add('visible');
                    }
                }, hideDelay);
            } else if (scrollDirection === 'up') {
                // Mostrar header ao rolar para cima
                header.classList.remove('hidden');
                indicator.classList.remove('visible');
            }
        } else if (currentScrollTop <= scrollThreshold) {
            // Sempre mostrar header no topo da página
            header.classList.remove('hidden', 'compact');
        }
        
        // Marcar fim do scroll após um tempo
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
            header.classList.remove('scrolling');
        }, 150);
        
        lastScrollTop = currentScrollTop;
    }
    
    // Event listener otimizado para scroll
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(function() {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
    
    // Mostrar header ao passar mouse sobre ele (quando escondido)
    header.addEventListener('mouseenter', function() {
        if (header.classList.contains('hidden')) {
            header.classList.remove('hidden');
        }
    });
    
    // Re-esconder header após um tempo se ainda estiver no meio da página
    header.addEventListener('mouseleave', function() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (currentScrollTop > scrollThreshold) {
            setTimeout(() => {
                if (!header.matches(':hover') && currentScrollTop > scrollThreshold) {
                    header.classList.add('hidden');
                }
            }, 2000);
        }
    });
    
    // Tecla ESC para mostrar/esconder header
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            header.classList.toggle('hidden');
        }
    });
});

// Função para controle manual do header (pode ser chamada de outros scripts)
window.toggleHeader = function() {
    const header = document.querySelector('.page-header');
    if (header) {
        header.classList.toggle('hidden');
    }
};

window.showHeader = function() {
    const header = document.querySelector('.page-header');
    if (header) {
        header.classList.remove('hidden');
    }
};

window.hideHeader = function() {
    const header = document.querySelector('.page-header');
    if (header) {
        header.classList.add('hidden');
    }
};