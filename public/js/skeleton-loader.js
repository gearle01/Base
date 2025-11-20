/**
 * ✅ OTIMIZADO: Sistema de Skeleton Loading
 * @module SkeletonLoader
 */

class SkeletonLoader {
    constructor() {
        this.loadingStates = new Map();
        this.injectStyles();
    }

    /**
     * Adiciona estilos necessários para os skeletons
     * @private
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes skeleton-loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            .skeleton {
                background: linear-gradient(90deg, 
                    #f0f0f0 25%, 
                    #e0e0e0 37%, 
                    #f0f0f0 63%
                );
                background-size: 400% 100%;
                animation: skeleton-loading 1.4s ease infinite;
                border-radius: 4px;
                min-height: 16px;
            }

            .skeleton-text {
                height: 16px;
                margin-bottom: 8px;
                width: 100%;
            }

            .skeleton-text.short { width: 60%; }
            .skeleton-text.medium { width: 80%; }
            
            .skeleton-title {
                height: 24px;
                margin-bottom: 16px;
                width: 50%;
            }

            .skeleton-image {
                aspect-ratio: 16/9;
                width: 100%;
            }

            .skeleton-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
            }

            .skeleton-card {
                padding: 16px;
                border-radius: 8px;
                background: #fff;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }

            .skeleton-button {
                height: 36px;
                width: 120px;
                border-radius: 18px;
            }

            .skeleton-container {
                position: relative;
            }

            .skeleton-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255,255,255,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
            }

            .skeleton-overlay.active {
                opacity: 1;
                pointer-events: all;
            }

            /* Skeletons específicos por seção */
            .skeleton-produtos {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 24px;
                padding: 16px;
            }

            .skeleton-produto-card {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .skeleton-contato {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
                padding: 16px;
            }

            .skeleton-sobre {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 32px;
                padding: 24px;
            }

            .skeleton-banner {
                height: 400px;
                width: 100%;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Cria um skeleton para uma seção
     * @param {string} section - Nome da seção
     * @returns {HTMLElement} Elemento skeleton
     */
    createSkeleton(section) {
        const container = document.createElement('div');
        container.className = `skeleton-container skeleton-${section}`;

        switch (section) {
            case 'produtos':
                container.innerHTML = this.createProdutosSkeleton();
                break;
            case 'sobre':
                container.innerHTML = this.createSobreSkeleton();
                break;
            case 'contato':
                container.innerHTML = this.createContatoSkeleton();
                break;
            case 'banner':
                container.innerHTML = this.createBannerSkeleton();
                break;
            default:
                container.innerHTML = this.createDefaultSkeleton();
        }

        return container;
    }

    /**
     * Templates para diferentes tipos de skeleton
     * @private
     */
    createProdutosSkeleton() {
        return Array(6).fill(0).map(() => `
            <div class="skeleton-card skeleton-produto-card">
                <div class="skeleton skeleton-image"></div>
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
                <div class="skeleton skeleton-button"></div>
            </div>
        `).join('');
    }

    createSobreSkeleton() {
        return `
            <div>
                <div class="skeleton skeleton-title"></div>
                ${Array(4).fill(0).map(() => `
                    <div class="skeleton skeleton-text"></div>
                `).join('')}
            </div>
            <div class="skeleton skeleton-image"></div>
        `;
    }

    createContatoSkeleton() {
        return `
            <div>
                <div class="skeleton skeleton-title"></div>
                ${Array(3).fill(0).map(() => `
                    <div class="skeleton-card" style="margin-bottom: 16px;">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text short"></div>
                    </div>
                `).join('')}
            </div>
            <div class="skeleton skeleton-image"></div>
        `;
    }

    createBannerSkeleton() {
        return `
            <div class="skeleton skeleton-banner">
                <div class="skeleton-overlay">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text medium"></div>
                    <div class="skeleton skeleton-button"></div>
                </div>
            </div>
        `;
    }

    createDefaultSkeleton() {
        return `
            <div class="skeleton-card">
                <div class="skeleton skeleton-title"></div>
                ${Array(3).fill(0).map(() => `
                    <div class="skeleton skeleton-text"></div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Mostra skeleton para uma seção
     * @param {string} sectionId - ID da seção
     * @param {string} type - Tipo de skeleton
     */
    show(sectionId, type) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        // Guarda o conteúdo original
        const originalContent = section.innerHTML;
        this.loadingStates.set(sectionId, {
            originalContent,
            type
        });

        // Insere skeleton
        const skeleton = this.createSkeleton(type);
        section.innerHTML = '';
        section.appendChild(skeleton);
    }

    /**
     * Remove skeleton e restaura conteúdo
     * @param {string} sectionId - ID da seção
     */
    hide(sectionId) {
        const section = document.getElementById(sectionId);
        const state = this.loadingStates.get(sectionId);

        if (!section || !state) return;

        // Restaura conteúdo com fade
        section.style.opacity = '0';
        setTimeout(() => {
            section.innerHTML = state.originalContent;
            section.style.opacity = '1';
            this.loadingStates.delete(sectionId);
        }, 300);
    }

    /**
     * Mostra skeletons em todas as seções
     */
    showAll() {
        ['banner', 'sobre', 'produtos', 'contato'].forEach(section => {
            this.show(section, section);
        });
    }

    /**
     * Remove todos os skeletons
     */
    hideAll() {
        this.loadingStates.forEach((_, sectionId) => {
            this.hide(sectionId);
        });
    }
}

// Instância global
export const skeletonLoader = new SkeletonLoader();
window.skeletonLoader = skeletonLoader;
export default SkeletonLoader;