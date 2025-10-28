/**
 * ✅ OTIMIZADO: Gerenciador de estado da aplicação
 * @module StateManager
 */

/**
 * @typedef {Object} LoadState 
 * @property {boolean} dataLoaded - Estado de carregamento dos dados
 * @property {Promise<void>} [loadingPromise] - Promise do carregamento atual
 * @property {boolean} isLoading - Se está carregando no momento
 * @property {Error} [error] - Último erro ocorrido
 */

class StateManager {
    constructor() {
        /** @type {LoadState} */
        this.loadState = {
            dataLoaded: false,
            loadingPromise: null,
            isLoading: false,
            error: null
        };

        /** @type {Set<Function>} */
        this.subscribers = new Set();
    }

    /**
     * Registra um callback para mudanças de estado
     * @param {Function} callback 
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Notifica todos os subscribers
     * @private
     */
    notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.loadState));
    }

    /**
     * Inicia um carregamento de dados
     * @param {Function} loadFunction - Função que retorna Promise
     * @returns {Promise<void>}
     */
    async startLoading(loadFunction) {
        // Se já está carregando, retorna a Promise existente
        if (this.loadState.isLoading && this.loadState.loadingPromise) {
            return this.loadState.loadingPromise;
        }

        // Se já carregou, não precisa carregar de novo
        if (this.loadState.dataLoaded) {
            return Promise.resolve();
        }

        try {
            this.loadState.isLoading = true;
            this.loadState.error = null;
            this.notifySubscribers();

            // Cria nova Promise de carregamento
            this.loadState.loadingPromise = loadFunction();
            
            // Aguarda conclusão
            await this.loadState.loadingPromise;
            
            // Atualiza estado
            this.loadState.dataLoaded = true;
            this.loadState.isLoading = false;
            this.loadState.error = null;
            
        } catch (error) {
            this.loadState.error = error;
            this.loadState.isLoading = false;
            throw error;
            
        } finally {
            this.loadState.loadingPromise = null;
            this.notifySubscribers();
        }
    }

    /**
     * Reseta o estado de carregamento
     */
    reset() {
        this.loadState = {
            dataLoaded: false,
            loadingPromise: null,
            isLoading: false,
            error: null
        };
        this.notifySubscribers();
    }

    /**
     * @returns {boolean} Se os dados estão carregados
     */
    get isDataLoaded() {
        return this.loadState.dataLoaded;
    }

    /**
     * @returns {boolean} Se está carregando no momento
     */
    get isLoading() {
        return this.loadState.isLoading;
    }

    /**
     * @returns {Error|null} Último erro ocorrido
     */
    get lastError() {
        return this.loadState.error;
    }
}

// Instância global
export const stateManager = new StateManager();
export default StateManager;