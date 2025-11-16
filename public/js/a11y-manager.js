/**
 * ✅ OTIMIZADO: Gerenciador de acessibilidade
 * @module A11yManager
 */

class A11yManager {
    constructor() {
        this.currentAnnouncement = null;
        this.setupAriaLive();
    }

    /**
     * Configura região live para anúncios
     * @private
     */
    setupAriaLive() {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);
        
        this.liveRegion = liveRegion;
    }

    /**
     * Anuncia uma mensagem para leitores de tela
     * @param {string} message - Mensagem a ser anunciada
     * @param {Object} options - Opções do anúncio
     */
    announce(message, options = {}) {
        const config = {
            priority: 'polite',
            delay: 150,
            ...options
        };

        if (this.currentAnnouncement) {
            clearTimeout(this.currentAnnouncement);
        }

        this.currentAnnouncement = setTimeout(() => {
            this.liveRegion.setAttribute('aria-live', config.priority);
            this.liveRegion.textContent = message;
            
            // Limpa após 3 segundos
            setTimeout(() => {
                this.liveRegion.textContent = '';
            }, 3000);
        }, config.delay);
    }

    /**
     * Adiciona aria-labels onde faltam
     */
    addMissingLabels() {
        // Navegação
        const nav = document.querySelector('.site-nav');
        if (nav) {
            nav.setAttribute('aria-label', 'Navegação principal');
        }

        // Logo
        const logo = document.getElementById('logo');
        if (logo) {
            logo.setAttribute('aria-label', 'Logo da empresa');
        }

        // Botão de menu mobile
        const menuBtn = document.querySelector('.hamburger');
        if (menuBtn) {
            menuBtn.setAttribute('aria-label', 'Abrir menu');
            menuBtn.setAttribute('role', 'button');
            menuBtn.setAttribute('tabindex', '0');
        }

        // Links de seção
        const sectionLinks = document.querySelectorAll('.site-nav-links a');
        sectionLinks.forEach(link => {
            if (!link.getAttribute('aria-label')) {
                link.setAttribute('aria-label', `Ir para seção ${link.textContent}`);
            }
        });

        // Cards de produtos
        const productCards = document.querySelectorAll('.product-card');
        productCards.forEach(card => {
            const title = card.querySelector('h3')?.textContent || 'Produto';
            card.setAttribute('aria-label', `Card do produto ${title}`);
        });

        // Botões de contato
        const contactButtons = document.querySelectorAll('.contact-item a');
        contactButtons.forEach(btn => {
            if (!btn.getAttribute('aria-label')) {
                const type = btn.closest('.contact-item').querySelector('h4')?.textContent || 'Contato';
                btn.setAttribute('aria-label', `${type}: ${btn.textContent}`);
            }
        });

        // Mapa
        const map = document.getElementById('map');
        if (map) {
            map.setAttribute('aria-label', 'Mapa de localização');
            map.setAttribute('role', 'region');
        }
    }

    /**
     * Adiciona roles semânticos
     */
    addSemanticRoles() {
        // Banner
        const banner = document.querySelector('.banner');
        if (banner) {
            banner.setAttribute('role', 'banner');
        }

        // Seções principais
        const sections = document.querySelectorAll('.site-section');
        sections.forEach(section => {
            if (!section.getAttribute('role')) {
                section.setAttribute('role', 'region');
            }
        });

        // Lista de produtos
        const productsGrid = document.querySelector('.products-grid');
        if (productsGrid) {
            productsGrid.setAttribute('role', 'list');
            productsGrid.querySelectorAll('.product-card').forEach(card => {
                card.setAttribute('role', 'listitem');
            });
        }

        // Grid de contato
        const contactGrid = document.querySelector('.contact-grid');
        if (contactGrid) {
            contactGrid.setAttribute('role', 'group');
            contactGrid.setAttribute('aria-label', 'Informações de contato');
        }
    }

    /**
     * Adiciona estados interativos
     */
    addInteractiveStates() {
        // Botões e links
        const interactiveElements = document.querySelectorAll('button, a, [role="button"]');
        interactiveElements.forEach(el => {
            if (!el.getAttribute('tabindex')) {
                el.setAttribute('tabindex', '0');
            }
        });

        // Campos de formulário
        const formFields = document.querySelectorAll('input, textarea, select');
        formFields.forEach(field => {
            if (!field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby')) {
                const label = document.querySelector(`label[for="${field.id}"]`);
                if (label) {
                    field.setAttribute('aria-labelledby', label.id);
                }
            }
        });
    }

    /**
     * Melhora navegação por teclado
     */
    enhanceKeyboardNavigation() {
        // Skip link
        const skipLink = document.createElement('a');
        skipLink.href = '#main';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Pular para conteúdo principal';
        document.body.insertBefore(skipLink, document.body.firstChild);

        // Ordem de tabulação lógica
        const main = document.querySelector('main') || document.createElement('main');
        main.setAttribute('id', 'main');
        main.setAttribute('tabindex', '-1');

        // Handler de teclas
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Fecha modais, menus, etc
                const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
                modals.forEach(modal => {
                    if (modal.getAttribute('aria-hidden') === 'false') {
                        modal.setAttribute('aria-hidden', 'true');
                    }
                });
            }
        });
    }

    /**
     * Aplica todas as melhorias de acessibilidade
     */
    enhance() {
        this.addMissingLabels();
        this.addSemanticRoles();
        this.addInteractiveStates();
        this.enhanceKeyboardNavigation();

        // Adiciona estilos necessários
        const style = document.createElement('style');
        style.textContent = `
            .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }

            .skip-link {
                position: absolute;
                top: -40px;
                left: 0;
                background: #000;
                color: white;
                padding: 8px;
                z-index: 100;
                transition: top 0.3s;
            }

            .skip-link:focus {
                top: 0;
            }

            /* Indicadores de foco */
            :focus {
                outline: 2px solid #4299e1;
                outline-offset: 2px;
            }

            /* Estado hover/focus para interativos */
            a:hover, button:hover,
            a:focus, button:focus {
                opacity: 0.8;
            }
        `;
        document.head.appendChild(style);
    }
}

// Instância global
export const a11yManager = new A11yManager();
export default A11yManager;