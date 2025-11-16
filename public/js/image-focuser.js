/**
 * ✅ OTIMIZADO: Gerenciador de foco de imagens
 * @module ImageFocuser
 */

class ImageFocuser {
    constructor() {
        /** @type {Set<HTMLElement>} */
        this.elements = new Set();
        
        /** @type {Map<HTMLElement, Function>} */
        this.listeners = new Map();
    }

    /**
     * Inicializa o focuser para um elemento
     * @param {HTMLElement} element - Elemento alvo
     * @param {Object} options - Opções de configuração
     */
    init(element, options = {}) {
        if (!element) return;

        // Remove listener antigo se existir
        this.remove(element);

        // Cria novo listener
        const listener = this.createFocusListener(element, options);
        
        // Registra o novo listener
        element.addEventListener('click', listener);
        this.listeners.set(element, listener);
        this.elements.add(element);

        // Adiciona classe de estilo
        element.classList.add('image-focusable');
    }

    /**
     * Remove o focuser de um elemento
     * @param {HTMLElement} element - Elemento alvo
     */
    remove(element) {
        if (!element) return;

        // Remove listener antigo
        const oldListener = this.listeners.get(element);
        if (oldListener) {
            element.removeEventListener('click', oldListener);
            this.listeners.delete(element);
        }

        // Remove do conjunto de elementos
        this.elements.delete(element);

        // Remove classe de estilo
        element.classList.remove('image-focusable');
    }

    /**
     * Remove todos os listeners
     */
    removeAll() {
        this.elements.forEach(element => this.remove(element));
        this.elements.clear();
        this.listeners.clear();
    }

    /**
     * Cria o listener de foco
     * @private
     */
    createFocusListener(element, options) {
        return (event) => {
            event.preventDefault();

            // Cria overlay
            const overlay = document.createElement('div');
            overlay.className = 'image-focus-overlay';
            
            // Clona a imagem
            const clone = element.cloneNode(true);
            clone.classList.add('image-focus-content');
            
            // Adiciona ao overlay
            overlay.appendChild(clone);
            document.body.appendChild(overlay);

            // Animação de entrada
            requestAnimationFrame(() => {
                overlay.classList.add('active');
                clone.classList.add('active');
            });

            // Handler de fechamento
            const close = () => {
                overlay.classList.remove('active');
                clone.classList.remove('active');
                
                // Remove após animação
                setTimeout(() => {
                    overlay.remove();
                }, 300);
            };

            // Eventos de fechamento
            overlay.addEventListener('click', close);
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') close();
            }, { once: true });

            // Callback personalizado
            if (options.onClick) {
                options.onClick(event, { element, overlay, close });
            }
        };
    }
}

// Estilos necessários
const style = document.createElement('style');
style.textContent = `
    .image-focusable {
        cursor: zoom-in;
        transition: opacity 0.2s;
    }
    
    .image-focusable:hover {
        opacity: 0.9;
    }
    
    .image-focus-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: background 0.3s;
    }
    
    .image-focus-overlay.active {
        background: rgba(0,0,0,0.9);
    }
    
    .image-focus-content {
        max-width: 90%;
        max-height: 90vh;
        transform: scale(0.9);
        opacity: 0;
        transition: transform 0.3s, opacity 0.3s;
        cursor: zoom-out;
    }
    
    .image-focus-content.active {
        transform: scale(1);
        opacity: 1;
    }
`;
document.head.appendChild(style);

// Instância global
export const imageFocuser = new ImageFocuser();
export default ImageFocuser;