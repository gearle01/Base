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
            if (typeof vnode === 'string' || typeof vnode === 'number') {
                return document.createTextNode(vnode);
            }
            
            const element = document.createElement(vnode.type);
            
            // Adiciona propriedades ao elemento
            Object.entries(vnode.props || {}).forEach(([key, value]) => {
                if (key === 'children') return;
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'style') {
                    if (typeof value === 'string') {
                        element.setAttribute('style', value);
                    } else if (typeof value === 'object') {
                        Object.assign(element.style, value);
                    }
                } else if (key.startsWith('on') && typeof value === 'function') {
                    const eventName = key.toLowerCase().slice(2);
                    element.addEventListener(eventName, value);
                } else if (key.startsWith('data-')) {
                    element.setAttribute(key, value);
                } else {
                    try {
                        element.setAttribute(key, value);
                    } catch (e) {
                        console.warn(`Não foi possível definir atributo ${key}:`, e);
                    }
                }
            });
            
            // Adiciona filhos recursivamente
            if (vnode.props.children) {
                vnode.props.children
                    .filter(child => child != null) // Remove null/undefined
                    .map(child => this.createRealElement(child))
                    .forEach(child => element.appendChild(child));
            }
            
            return element;
        },

        // NOVO: Função para atualizar elemento existente (diff)
        updateElement(parent, newVNode, oldVNode, index = 0) {
            // Se não há nó antigo, adiciona o novo
            if (!oldVNode) {
                parent.appendChild(this.createRealElement(newVNode));
                return;
            }

            const node = parent.childNodes[index];

            // Se não há novo nó, remove o antigo
            if (!newVNode) {
                parent.removeChild(node);
                return;
            }

            // Se são diferentes tipos, substitui
            if (typeof newVNode !== typeof oldVNode || 
                (typeof newVNode === 'object' && newVNode.type !== oldVNode.type)) {
                parent.replaceChild(this.createRealElement(newVNode), node);
                return;
            }

            // Se são text nodes, atualiza o texto
            if (typeof newVNode === 'string' || typeof newVNode === 'number') {
                if (newVNode !== oldVNode) {
                    node.textContent = newVNode;
                }
                return;
            }

            // Atualiza atributos
            this.updateAttributes(node, newVNode.props || {}, oldVNode.props || {});

            // Atualiza filhos recursivamente
            const newChildren = newVNode.props.children || [];
            const oldChildren = oldVNode.props.children || [];
            const maxLength = Math.max(newChildren.length, oldChildren.length);

            for (let i = 0; i < maxLength; i++) {
                this.updateElement(node, newChildren[i], oldChildren[i], i);
            }
        },

        // NOVO: Atualiza atributos de um elemento
        updateAttributes(element, newProps, oldProps) {
            // Remove atributos antigos
            Object.keys(oldProps).forEach(key => {
                if (key === 'children') return;
                if (!(key in newProps)) {
                    if (key === 'className') {
                        element.className = '';
                    } else if (key.startsWith('on')) {
                        const eventName = key.toLowerCase().slice(2);
                        element.removeEventListener(eventName, oldProps[key]);
                    } else {
                        element.removeAttribute(key);
                    }
                }
            });

            // Adiciona/atualiza novos atributos
            Object.entries(newProps).forEach(([key, value]) => {
                if (key === 'children') return;
                if (oldProps[key] !== value) {
                    if (key === 'className') {
                        element.className = value;
                    } else if (key === 'style') {
                        if (typeof value === 'string') {
                            element.setAttribute('style', value);
                        } else if (typeof value === 'object') {
                            Object.assign(element.style, value);
                        }
                    } else if (key.startsWith('on') && typeof value === 'function') {
                        const eventName = key.toLowerCase().slice(2);
                        if (oldProps[key]) {
                            element.removeEventListener(eventName, oldProps[key]);
                        }
                        element.addEventListener(eventName, value);
                    } else {
                        element.setAttribute(key, value);
                    }
                }
            });
        }
    },

    // Image loader
    imageLoader: {
        observer: null,
        
        init() {
            if ('IntersectionObserver' in window) {
                if (this.observer) {
                    this.observer.disconnect();
                }
                
                this.observer = new IntersectionObserver(
                    (entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const img = entry.target;
                                const src = img.dataset.src;
                                
                                if (src) {
                                    // Pré-carrega a imagem
                                    const tempImg = new Image();
                                    tempImg.onload = () => {
                                        img.src = src;
                                        img.classList.add('loaded');
                                        img.removeAttribute('data-src');
                                    };
                                    tempImg.onerror = () => {
                                        console.error('Erro ao carregar imagem:', src);
                                        img.classList.add('error');
                                    };
                                    tempImg.src = src;
                                    
                                    this.observer.unobserve(img);
                                }
                            }
                        });
                    },
                    { 
                        rootMargin: '50px',
                        threshold: 0.01
                    }
                );

                document.querySelectorAll('img[data-src]').forEach(img => {
                    this.observer.observe(img);
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
        activeLoaders: new Set(),
        
        show(elementId, message = 'Carregando...') {
            const element = document.getElementById(elementId);
            if (!element) {
                console.warn(`Elemento ${elementId} não encontrado`);
                return;
            }

            // Remove loader existente se houver
            this.hide(elementId);

            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.setAttribute('data-loading-for', elementId);
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-message">${message}</div>
                </div>
            `;

            element.style.position = 'relative';
            element.appendChild(overlay);
            this.activeLoaders.add(elementId);
            
            // Força reflow para animação
            requestAnimationFrame(() => {
                overlay.classList.add('active');
            });
        },

        hide(elementId) {
            const element = document.getElementById(elementId);
            if (!element) return;

            const overlay = element.querySelector(`.loading-overlay[data-loading-for="${elementId}"]`);
            if (overlay) {
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    this.activeLoaders.delete(elementId);
                }, 300);
            }
        },

        hideAll() {
            this.activeLoaders.forEach(id => this.hide(id));
            this.activeLoaders.clear();
        }
    },

    // Error manager
    error: {
        container: null,
        
        getContainer() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'error-container';
                this.container.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    max-width: 400px;
                `;
                document.body.appendChild(this.container);
            }
            return this.container;
        },
        
        show(message, type = 'error') {
            const container = this.getContainer();
            const errorEl = document.createElement('div');
            errorEl.className = `error-message ${type}`;
            
            const icon = type === 'error' ? '✗' : 
                        type === 'warning' ? '⚠' : 
                        type === 'success' ? '✓' : 'ℹ';
            
            errorEl.innerHTML = `
                <span class="error-icon">${icon}</span>
                <span class="error-text">${message}</span>
                <button class="error-close">×</button>
            `;
            
            container.appendChild(errorEl);
            
            // Anima entrada
            requestAnimationFrame(() => {
                errorEl.classList.add('show');
            });
            
            // Botão fechar
            const closeBtn = errorEl.querySelector('.error-close');
            closeBtn.addEventListener('click', () => {
                errorEl.classList.remove('show');
                setTimeout(() => errorEl.remove(), 300);
            });
            
            // Auto-remove após 5 segundos
            setTimeout(() => {
                if (errorEl.parentNode) {
                    errorEl.classList.remove('show');
                    setTimeout(() => errorEl.remove(), 300);
                }
            }, 5000);
        }
    }
};

// Adiciona estilos necessários
const style = document.createElement('style');
style.textContent = `
    /* Loading Overlay */
    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .loading-overlay.active {
        opacity: 1;
    }

    .loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
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
        color: #666;
        font-size: 14px;
        text-align: center;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    /* Error Messages */
    .error-message {
        background: #fff;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        min-width: 300px;
    }

    .error-message.show {
        opacity: 1;
        transform: translateX(0);
    }

    .error-message.error { 
        background: #fee2e2; 
        color: #dc2626;
        border-left: 4px solid #dc2626;
    }
    
    .error-message.warning { 
        background: #fef3c7; 
        color: #d97706;
        border-left: 4px solid #d97706;
    }
    
    .error-message.success { 
        background: #dcfce7; 
        color: #16a34a;
        border-left: 4px solid #16a34a;
    }

    .error-message.info { 
        background: #dbeafe; 
        color: #2563eb;
        border-left: 4px solid #2563eb;
    }

    .error-icon {
        font-size: 20px;
        font-weight: bold;
        flex-shrink: 0;
    }

    .error-text {
        flex: 1;
        font-size: 14px;
    }

    .error-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: inherit;
        opacity: 0.6;
        transition: opacity 0.2s;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .error-close:hover {
        opacity: 1;
    }

    /* Image Loading States */
    img[data-src] {
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    img.loaded {
        opacity: 1;
    }

    img.error {
        opacity: 0.5;
        filter: grayscale(100%);
    }
`;
document.head.appendChild(style);

console.log('✅ SiteModules carregado com sucesso');