/**
 * ✅ OTIMIZADO: Sistema de mensagens de erro contextuais
 * @module ErrorManager
 */

class ErrorManager {
    constructor() {
        this.errorContainers = new Map();
        this.injectStyles();
    }

    /**
     * Adiciona estilos necessários
     * @private
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .error-container {
                position: relative;
                margin: 8px 0;
            }

            .error-message {
                background: #fff5f5;
                color: #c53030;
                padding: 12px 16px;
                border-radius: 4px;
                border-left: 4px solid #fc8181;
                font-size: 14px;
                margin: 8px 0;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .error-message.show {
                opacity: 1;
                transform: translateY(0);
            }

            .error-message .icon {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
            }

            .error-message .close {
                margin-left: auto;
                cursor: pointer;
                opacity: 0.6;
                transition: opacity 0.2s;
            }

            .error-message .close:hover {
                opacity: 1;
            }

            .error-context {
                font-size: 12px;
                color: #718096;
                margin-top: 4px;
            }

            .error-actions {
                margin-top: 8px;
                display: flex;
                gap: 8px;
            }

            .error-action-btn {
                background: #fff;
                border: 1px solid #cbd5e0;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .error-action-btn:hover {
                background: #f7fafc;
                border-color: #a0aec0;
            }

            .error-action-btn.primary {
                background: #4299e1;
                color: white;
                border-color: #3182ce;
            }

            .error-action-btn.primary:hover {
                background: #3182ce;
            }

            /* Estilos específicos por contexto */
            .error-upload {
                border-color: #fc8181;
                background: #fff5f5;
            }

            .error-validation {
                border-color: #f6ad55;
                background: #fffaf0;
            }

            .error-network {
                border-color: #63b3ed;
                background: #ebf8ff;
            }

            .error-permission {
                border-color: #9f7aea;
                background: #faf5ff;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Cria container de erro para um elemento
     * @param {HTMLElement} element - Elemento alvo
     * @returns {HTMLElement} Container de erro
     */
    createErrorContainer(element) {
        const container = document.createElement('div');
        container.className = 'error-container';
        element.parentNode.insertBefore(container, element.nextSibling);
        return container;
    }

    /**
     * Mostra uma mensagem de erro
     * @param {string} elementId - ID do elemento
     * @param {Object} options - Opções da mensagem
     */
    show(elementId, options = {}) {
        const element = document.getElementById(elementId);
        if (!element) return;

        // Configurações padrão
        const config = {
            message: 'Ocorreu um erro',
            type: 'error',
            context: '',
            actions: [],
            autoHide: 5000,
            ...options
        };

        // Cria ou recupera container
        let container = this.errorContainers.get(elementId);
        if (!container) {
            container = this.createErrorContainer(element);
            this.errorContainers.set(elementId, container);
        }

        // Cria mensagem de erro
        const errorMessage = document.createElement('div');
        errorMessage.className = `error-message ${config.type}`;
        
        // Conteúdo da mensagem
        errorMessage.innerHTML = `
            <svg class="icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <div>
                <div>${config.message}</div>
                ${config.context ? `<div class="error-context">${config.context}</div>` : ''}
                ${config.actions.length ? `
                    <div class="error-actions">
                        ${config.actions.map(action => `
                            <button class="error-action-btn ${action.primary ? 'primary' : ''}" 
                                    data-action="${action.id}">
                                ${action.label}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <span class="close">&times;</span>
        `;

        // Adiciona event listeners
        const closeBtn = errorMessage.querySelector('.close');
        closeBtn.addEventListener('click', () => this.hide(elementId));

        // Adiciona listeners para ações
        const actionButtons = errorMessage.querySelectorAll('.error-action-btn');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.action;
                const action = config.actions.find(a => a.id === actionId);
                if (action?.onClick) {
                    action.onClick();
                }
            });
        });

        // Limpa erros anteriores
        container.innerHTML = '';
        container.appendChild(errorMessage);

        // Mostra com animação
        requestAnimationFrame(() => {
            errorMessage.classList.add('show');
        });

        // Auto-hide se configurado
        if (config.autoHide) {
            setTimeout(() => this.hide(elementId), config.autoHide);
        }

        // Marca elemento como inválido
        element.classList.add('error');
    }

    /**
     * Remove mensagem de erro
     * @param {string} elementId - ID do elemento
     */
    hide(elementId) {
        const container = this.errorContainers.get(elementId);
        const element = document.getElementById(elementId);
        
        if (container) {
            const errorMessage = container.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.classList.remove('show');
                setTimeout(() => {
                    container.innerHTML = '';
                }, 300);
            }
        }

        if (element) {
            element.classList.remove('error');
        }
    }

    /**
     * Remove todas as mensagens de erro
     */
    hideAll() {
        this.errorContainers.forEach((_, elementId) => {
            this.hide(elementId);
        });
    }
}

// Instância global
export const errorManager = new ErrorManager();
export default ErrorManager;