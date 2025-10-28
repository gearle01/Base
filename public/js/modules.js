/**
 * ✅ OTIMIZADO: Gerenciador central de módulos
 */

// Exporta todos os módulos em um namespace global
window.SiteModules = {
    // Performance e Cache
    debounce: function(func, wait, immediate = false) {
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
    },

    // Cache global com suporte a namespaces
    cache: {
        _store: new Map(),
        
        // Obtém um valor do cache
        get(namespace, key) {
            const ns = this._store.get(namespace);
            return ns ? ns.get(key) : undefined;
        },
        
        // Define um valor no cache
        set(namespace, key, value) {
            if (!this._store.has(namespace)) {
                this._store.set(namespace, new Map());
            }
            this._store.get(namespace).set(key, value);
        },
        
        // Remove um valor do cache
        delete(namespace, key) {
            const ns = this._store.get(namespace);
            if (ns) {
                ns.delete(key);
            }
        },
        
        // Limpa todo o cache ou um namespace específico
        clear(namespace) {
            if (namespace) {
                this._store.delete(namespace);
            } else {
                this._store.clear();
            }
        }
    },
    
    // Virtual DOM simplificado
    vdom: {
        createElement(type, props = {}, ...children) {
            return { type, props: { ...props, children: children.flat() } };
        },
        
        createRealElement(vnode) {
            if (typeof vnode === 'string') return document.createTextNode(vnode);
            
            const element = document.createElement(vnode.type);
            Object.entries(vnode.props || {}).forEach(([key, value]) => {
                if (key === 'children') return;
                element[key] = value;
            });
            
            (vnode.props.children || []).forEach(child => 
                element.appendChild(this.createRealElement(child))
            );
            
            return element;
        }
    },

    // Image loader
    imageLoader: {
        init() {
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver(
                    (entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const img = entry.target;
                                if (img.dataset.src) {
                                    img.src = img.dataset.src;
                                    img.classList.add('loaded');
                                    img.removeAttribute('data-src');
                                    observer.unobserve(img);
                                }
                            }
                        });
                    },
                    { rootMargin: '50px' }
                );

                document.querySelectorAll('img[data-src]').forEach(img => {
                    observer.observe(img);
                });
            } else {
                // Fallback para browsers sem suporte
                document.querySelectorAll('img[data-src]').forEach(img => {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                });
            }
        }
    },

    // Loading manager
    loading: {
        show(elementId, message = 'Carregando...') {
            const element = document.getElementById(elementId);
            if (!element) return;

            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            `;

            element.style.position = 'relative';
            element.appendChild(overlay);
        },

        hide(elementId) {
            const element = document.getElementById(elementId);
            if (!element) return;

            const overlay = element.querySelector('.loading-overlay');
            if (overlay) {
                overlay.remove();
            }
        }
    },

    // Error manager
    error: {
        show(message, type = 'error') {
            const container = document.createElement('div');
            container.className = `error-message ${type}`;
            container.textContent = message;
            
            document.body.appendChild(container);
            setTimeout(() => container.remove(), 5000);
        }
    }
};

// Adiciona estilos necessários
const style = document.createElement('style');
style.textContent = `
    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .loading-message {
        margin-top: 10px;
        color: #666;
    }

    .error-message {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
    }

    .error-message.error { background: #fee2e2; color: #dc2626; }
    .error-message.warning { background: #fef3c7; color: #d97706; }
    .error-message.success { background: #dcfce7; color: #16a34a; }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);