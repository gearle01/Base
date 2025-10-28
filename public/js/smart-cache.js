// ✅ OTIMIZADO: Cache inteligente com timestamps por seção
export class SmartCache {
    constructor(ttl = 5 * 60 * 1000) { // 5 minutos padrão
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    /**
     * Define um valor no cache para uma seção específica
     * @param {string} section - Nome da seção (ex: 'produtos', 'sobre')
     * @param {string} key - Chave do item
     * @param {any} value - Valor a ser armazenado
     */
    set(section, key, value) {
        const now = Date.now();
        this.cache.set(`${section}:${key}`, {
            value,
            timestamp: now,
            section
        });
    }
    
    /**
     * Obtém um valor do cache
     * @param {string} section - Nome da seção
     * @param {string} key - Chave do item
     * @returns {any|null} Valor ou null se expirado/não encontrado
     */
    get(section, key) {
        const cacheKey = `${section}:${key}`;
        const item = this.cache.get(cacheKey);
        
        if (!item) return null;
        
        const now = Date.now();
        if (now - item.timestamp > this.ttl) {
            this.cache.delete(cacheKey);
            return null;
        }
        
        return item.value;
    }
    
    /**
     * Limpa itens expirados do cache
     */
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * Limpa todo o cache de uma seção específica
     * @param {string} section - Nome da seção para limpar
     */
    clearSection(section) {
        for (const [key, item] of this.cache.entries()) {
            if (item.section === section) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * Obtém o tempo restante de vida de um item no cache
     * @param {string} section - Nome da seção
     * @param {string} key - Chave do item
     * @returns {number} Tempo restante em ms ou 0 se expirado/não encontrado
     */
    getTTL(section, key) {
        const item = this.cache.get(`${section}:${key}`);
        if (!item) return 0;
        
        const now = Date.now();
        const elapsed = now - item.timestamp;
        return Math.max(0, this.ttl - elapsed);
    }
}

// Instância global do cache
export const globalCache = new SmartCache();