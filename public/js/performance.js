// ✅ OTIMIZADO: Função debounce otimizada com TypeScript-like comments
/**
 * Cria uma versão debounced de uma função
 * @param {Function} func - Função a ser debounced
 * @param {number} wait - Tempo de espera em ms
 * @param {boolean} [immediate=false] - Se verdadeiro, executa no início ao invés do fim
 * @returns {Function} Função debounced
 */
function debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
        const context = this;
        
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(context, args);
    };
}

// ✅ OTIMIZADO: Cache de performance
const PerformanceCache = {
    data: new Map(),
    timestamp: new Map(),
    ttl: 5 * 60 * 1000, // 5 minutos em ms
    
    set(key, value, section = 'global') {
        const cacheKey = `${section}:${key}`;
        this.data.set(cacheKey, value);
        this.timestamp.set(cacheKey, Date.now());
    },
    
    get(key, section = 'global') {
        const cacheKey = `${section}:${key}`;
        const timestamp = this.timestamp.get(cacheKey);
        
        if (!timestamp) return null;
        
        if (Date.now() - timestamp > this.ttl) {
            this.data.delete(cacheKey);
            this.timestamp.delete(cacheKey);
            return null;
        }
        
        return this.data.get(cacheKey);
    },
    
    clear(section = null) {
        if (section) {
            // Limpa apenas a seção específica
            for (const [key] of this.data) {
                if (key.startsWith(`${section}:`)) {
                    this.data.delete(key);
                    this.timestamp.delete(key);
                }
            }
        } else {
            // Limpa todo o cache
            this.data.clear();
            this.timestamp.clear();
        }
    }
};

// Exporta as funções helpers
export { debounce, PerformanceCache };