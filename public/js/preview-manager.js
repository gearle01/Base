/**
 * ✅ OTIMIZADO: Gerenciador de preview com debounce
 * @module PreviewManager
 */

import { debounce } from './performance.js';

class PreviewManager {
    constructor(options = {}) {
        this.options = {
            debounceDelay: 500,
            ...options
        };

        /** @type {HTMLIFrameElement} */
        this.iframe = null;
        
        /** @type {boolean} */
        this.isLoading = false;
        
        /** @type {Function} */
        this.debouncedUpdate = debounce(
            this.updatePreview.bind(this),
            this.options.debounceDelay
        );

        // Bind methods
        this.init = this.init.bind(this);
        this.reload = this.reload.bind(this);
    }

    /**
     * Inicializa o preview
     * @param {string} iframeId - ID do iframe
     */
    init(iframeId) {
        this.iframe = document.getElementById(iframeId);
        if (!this.iframe) {
            throw new Error(`Iframe ${iframeId} não encontrado`);
        }

        // Adiciona indicador de loading
        this.createLoadingIndicator();

        // Configura eventos
        this.setupEventListeners();
    }

    /**
     * Cria indicador de loading
     * @private
     */
    createLoadingIndicator() {
        const container = document.createElement('div');
        container.className = 'preview-loading-container';
        
        const spinner = document.createElement('div');
        spinner.className = 'preview-loading-spinner';
        
        container.appendChild(spinner);
        
        // Insere antes do iframe
        this.iframe.parentNode.insertBefore(container, this.iframe);
        this.loadingContainer = container;
    }

    /**
     * Configura event listeners
     * @private
     */
    setupEventListeners() {
        // Loading states
        this.iframe.addEventListener('load', () => {
            this.isLoading = false;
            this.loadingContainer.classList.remove('active');
        });

        // Comunicação com iframe
        window.addEventListener('message', (event) => {
            if (event.source === this.iframe.contentWindow) {
                this.handleIframeMessage(event.data);
            }
        });
    }

    /**
     * Atualiza o preview
     * @param {Object} data - Dados para atualizar
     */
    async updatePreview(data) {
        if (!this.iframe || this.isLoading) return;

        this.isLoading = true;
        this.loadingContainer.classList.add('active');

        try {
            // Clona os dados para evitar modificação
            const safeData = JSON.parse(JSON.stringify(data));
            
            // Envia mensagem para o iframe
            this.iframe.contentWindow.postMessage({
                type: 'update',
                data: safeData
            }, '*');

        } catch (error) {
            console.error('Erro ao atualizar preview:', error);
            this.isLoading = false;
            this.loadingContainer.classList.remove('active');
        }
    }

    /**
     * Processa mensagens do iframe
     * @private
     */
    handleIframeMessage(message) {
        switch (message.type) {
            case 'ready':
                this.isLoading = false;
                this.loadingContainer.classList.remove('active');
                break;
                
            case 'error':
                console.error('Erro no preview:', message.error);
                this.isLoading = false;
                this.loadingContainer.classList.remove('active');
                break;
        }
    }

    /**
     * Recarrega o iframe
     */
    reload() {
        if (this.iframe) {
            this.isLoading = true;
            this.loadingContainer.classList.add('active');
            this.iframe.src = this.iframe.src;
        }
    }
}

// Estilos necessários
const style = document.createElement('style');
style.textContent = `
    .preview-loading-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.8);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .preview-loading-container.active {
        display: flex;
    }
    
    .preview-loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: preview-spin 1s linear infinite;
    }
    
    @keyframes preview-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Instância global
export const previewManager = new PreviewManager();
export default PreviewManager;