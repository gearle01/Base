// ✅ OTIMIZADO: Classe para gerenciar lazy loading de imagens
const ImageLoader = {
    defaultOptions: {
        root: null,
        rootMargin: '50px 0px',
        threshold: 0.1
    },
    
    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(this.onIntersection.bind(this), this.defaultOptions);
            this.observeImages();
        } else {
            this.loadAllImages();
        }
    },
    
    observeImages() {
        // Observa imagens com data-src ou data-bg
        document.querySelectorAll('img[data-src], [data-bg]').forEach(el => {
            this.observer.observe(el);
        });
    },
    
    onIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                this.loadImage(entry.target);
                this.observer.unobserve(entry.target);
            }
        });
    },
    
    async loadImage(element) {
        try {
            if (element.tagName.toLowerCase() === 'img') {
                const src = element.dataset.src;
                if (src) {
                    // Adiciona loading="lazy" para suporte nativo
                    element.loading = 'lazy';
                    
                    // Pré-carrega a imagem
                    await this.preloadImage(src);
                    
                    element.src = src;
                    element.removeAttribute('data-src');
                }
            } else if (element.dataset.bg) {
                // Para backgrounds
                const src = element.dataset.bg;
                if (src) {
                    // Pré-carrega a imagem de background
                    await this.preloadImage(src);
                    
                    element.style.backgroundImage = `url(${src})`;
                    element.removeAttribute('data-bg');
                }
            }
            
            // Adiciona classe para fade in
            element.classList.add('loaded');
            
        } catch (error) {
            console.error('Erro ao carregar imagem:', error);
            element.classList.add('error');
        }
    },
    
    preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = src;
        });
    },
    
    loadAllImages() {
        // Fallback para browsers sem suporte a IntersectionObserver
        document.querySelectorAll('img[data-src], [data-bg]').forEach(el => {
            this.loadImage(el);
        });
    }
};

// Estilo para fade in de imagens
const style = document.createElement('style');
style.textContent = `
    img[data-src], [data-bg] {
        opacity: 0;
        transition: opacity 0.3s ease-in;
    }
    
    img.loaded, [data-bg].loaded {
        opacity: 1;
    }
    
    img.error, [data-bg].error {
        opacity: 0.5;
    }
`;
document.head.appendChild(style);

// Inicializa o loader quando o DOM estiver pronto
// document.addEventListener('DOMContentLoaded', () => ImageLoader.init());