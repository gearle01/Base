/**
 * ✅ OTIMIZADO: Gerenciador de estados de loading
 * @module LoadingManager
 */

class LoadingManager {
    constructor() {
        this.loadingStates = new Map();
        this.injectStyles();
    }

    /**
     * Adiciona estilos necessários
     * @private
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Container de loading */
            .loading-container {
                position: relative;
                min-height: 50px;
            }

            /* Overlay de loading */
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255,255,255,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
            }

            .loading-overlay.active {
                opacity: 1;
                pointer-events: all;
            }

            /* Spinner principal */
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            /* Spinner pequeno */
            .loading-spinner.small {
                width: 20px;
                height: 20px;
                border-width: 2px;
            }

            /* Spinner com texto */
            .loading-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }

            .loading-text {
                color: #4a5568;
                font-size: 14px;
                text-align: center;
            }

            /* Progress bar */
            .loading-progress {
                width: 100%;
                height: 4px;
                background: #edf2f7;
                border-radius: 2px;
                overflow: hidden;
            }

            .loading-progress-bar {
                height: 100%;
                background: #3498db;
                transition: width 0.3s ease;
            }

            /* Dots loading */
            .loading-dots {
                display: flex;
                gap: 4px;
            }

            .loading-dot {
                width: 8px;
                height: 8px;
                background: #3498db;
                border-radius: 50%;
                animation: pulse 1s ease-in-out infinite;
            }

            .loading-dot:nth-child(2) { animation-delay: 0.2s; }
            .loading-dot:nth-child(3) { animation-delay: 0.4s; }

            /* Estados específicos */
            .loading-button {
                position: relative;
                padding-right: 36px;
            }

            .loading-button .loading-spinner {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
            }

            .loading-input {
                padding-right: 36px;
                background-position: right 8px center;
                background-repeat: no-repeat;
                background-size: 20px;
            }

            /* Animações */
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes pulse {
                0%, 100% { transform: scale(0.8); opacity: 0.5; }
                50% { transform: scale(1); opacity: 1; }
            }

            /* Estados de carregamento por seção */
            .loading-section {
                position: relative;
                min-height: 100px;
            }

            .loading-produtos .loading-spinner { border-top-color: #48bb78; }
            .loading-sobre .loading-spinner { border-top-color: #ed8936; }
            .loading-contato .loading-spinner { border-top-color: #9f7aea; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Mostra loading em um elemento
     * @param {string} elementId - ID do elemento
     * @param {Object} options - Opções de loading
     */
    show(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const config = {
            type: 'spinner',
            text: '',
            size: 'normal',
            progress: 0,
            section: '',
            ...options
        };

        // Adiciona classe de loading
        element.classList.add('loading-container');
        if (config.section) {
            element.classList.add(`loading-${config.section}`);
        }

        // Cria overlay
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';

        // Conteúdo baseado no tipo
        const content = document.createElement('div');
        content.className = 'loading-content';

        switch (config.type) {
            case 'spinner':
                content.innerHTML = `
                    <div class="loading-spinner ${config.size}"></div>
                    ${config.text ? `<div class="loading-text">${config.text}</div>` : ''}
                `;
                break;

            case 'progress':
                content.innerHTML = `
                    <div class="loading-progress">
                        <div class="loading-progress-bar" style="width: ${config.progress}%"></div>
                    </div>
                    ${config.text ? `<div class="loading-text">${config.text}</div>` : ''}
                `;
                break;

            case 'dots':
                content.innerHTML = `
                    <div class="loading-dots">
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                    </div>
                    ${config.text ? `<div class="loading-text">${config.text}</div>` : ''}
                `;
                break;
        }

        overlay.appendChild(content);
        element.appendChild(overlay);

        // Ativa com animação
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Guarda referência
        this.loadingStates.set(elementId, {
            overlay,
            config
        });
    }

    /**
     * Atualiza estado de loading
     * @param {string} elementId - ID do elemento
     * @param {Object} updates - Atualizações
     */
    update(elementId, updates = {}) {
        const state = this.loadingStates.get(elementId);
        if (!state) return;

        const config = { ...state.config, ...updates };
        const overlay = state.overlay;

        if ('text' in updates) {
            const textEl = overlay.querySelector('.loading-text');
            if (textEl) {
                textEl.textContent = updates.text;
            }
        }

        if ('progress' in updates && config.type === 'progress') {
            const progressBar = overlay.querySelector('.loading-progress-bar');
            if (progressBar) {
                progressBar.style.width = `${updates.progress}%`;
            }
        }

        // Atualiza estado guardado
        this.loadingStates.set(elementId, { overlay, config });
    }

    /**
     * Remove loading de um elemento
     * @param {string} elementId - ID do elemento
     */
    hide(elementId) {
        const state = this.loadingStates.get(elementId);
        if (!state) return;

        const element = document.getElementById(elementId);
        const overlay = state.overlay;

        if (element && overlay) {
            overlay.classList.remove('active');
            
            setTimeout(() => {
                element.classList.remove('loading-container');
                if (state.config.section) {
                    element.classList.remove(`loading-${state.config.section}`);
                }
                overlay.remove();
            }, 300);
        }

        this.loadingStates.delete(elementId);
    }

    /**
     * Remove todos os loadings
     */
    hideAll() {
        this.loadingStates.forEach((_, elementId) => {
            this.hide(elementId);
        });
    }
}

// Instância global
export const loadingManager = new LoadingManager();
export default LoadingManager;