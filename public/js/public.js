/**
 * ✅ FICHEIRO PÚBLICO REATORADO
 *
 * Esta versão foi simplificada para remover a lógica duplicada.
 * Agora, este ficheiro confia em:
 * 1. `firebase-manager.js` (para carregar dados)
 * 2. `config-manager.js` (para aplicar cores e módulos)
 *
 * A função `updatePublicSite` foi mantida, mas apenas para
 * aplicar o CONTEÚDO (texto, imagens, etc.).
 */

import { globalCache } from './smart-cache.js';

// console.log('🚀 [public.js] Iniciando...');

// Variável global para armazenar produtos carregados (para o modal)
let currentProducts = [];

/**
 * Mostra conteúdo padrão se nenhum dado for carregado
 * (Função movida para o topo para clareza)
 */
function showDefaultContent() {
    // console.log('📋 Mostrando conteúdo padrão');

    document.title = "Site Profissional"; // Título padrão
    document.getElementById('bannerH1').textContent = 'Bem-vindo ao GSM';
    document.getElementById('bannerP').textContent = 'Seu site profissional está pronto';
    document.getElementById('footerNome').textContent = 'Seu Site';
    document.getElementById('telPreview').textContent = 'Telefone não configurado';
    document.getElementById('emailPreview').textContent = 'Email não configurado';
    document.getElementById('sobreTextoPreview').textContent = 'Seção sobre não configurada';
    document.getElementById('logo').textContent = 'Seu Site';
}

/**
 * Atualiza o CONTEÚDO do site com os dados carregados
 * (A lógica de cores e módulos foi movida para config-manager.js)
 */
/**
 * Funções Auxiliares de Segurança (Null Checks)
 */
function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text || '';
    }
}

function safeImage(id, src) {
    const el = document.getElementById(id);
    if (el) {
        if (el.tagName === 'IMG') {
            if (src) {
                el.src = src;
                el.classList.remove('hidden');
            } else {
                el.src = '';
                el.classList.add('hidden');
            }
        } else {
            // Fallback for divs (background image)
            if (src) {
                el.style.backgroundImage = `url(${src})`;
            } else {
                el.style.backgroundImage = '';
            }
        }
    }
}

function safeHref(id, url) {
    const el = document.getElementById(id);
    if (el) {
        el.href = url || '#';
    }
}

function safeShow(id, shouldShow) {
    const el = document.getElementById(id);
    if (el) {
        if (shouldShow) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
}

/**
 * Atualiza o CONTEÚDO do site com os dados carregados
 * (A lógica de cores e módulos foi movida para config-manager.js)
 */
function updatePublicSite(data) {
    // console.log('🎨 [UI] Atualizando interface...', data);

    if (!data) {
        // console.warn('⚠️ [UI] Dados vazios recebidos em updatePublicSite');
        return;
    }

    try {
        // --- Aplica Cores, Fontes e Módulos ---
        // Esta função vem do 'config-manager.js'
        if (window.ConfigManager && typeof window.ConfigManager.applyConfig === 'function') {
            window.ConfigManager.applyConfig(data);
        } else {
            console.warn('ConfigManager.applyConfig não encontrado. Carregando cores manualmente...');
            if (data.cores) {
                const root = document.documentElement;
                if (data.cores.primaria) root.style.setProperty('--primary', data.cores.primaria);
                if (data.cores.secundaria) root.style.setProperty('--secondary', data.cores.secundaria);
            }
        }

        // --- Aplica Conteúdo ---

        // Título da Página e Logo
        const siteTitle = (data.empresaNome && data.empresaNome.trim() !== '') ? data.empresaNome : "Site Profissional";
        document.title = siteTitle;

        // Favicon Handling
        const faviconLink = document.getElementById('dynamic-favicon');
        if (faviconLink && (data.faviconImageUrl || (data.main && data.main.faviconImageUrl))) {
            const faviconUrl = data.faviconImageUrl || data.main.faviconImageUrl;
            faviconLink.href = faviconUrl;
        }

        // Logo Handling (Supports .logo-element class and legacy #logo id)
        let logoElements = Array.from(document.querySelectorAll('.logo-element'));
        if (logoElements.length === 0) {
            const legacyLogo = document.getElementById('logo');
            if (legacyLogo) logoElements.push(legacyLogo);
        }

        logoElements.forEach(logoEl => {
            logoEl.innerHTML = '';
            // Check for logoImageUrl in root (flat) or main (nested)
            const logoUrl = data.logoImageUrl || (data.main && data.main.logoImageUrl);
            // Check for logoType
            const logoType = data.logoType || (data.main && data.main.logoType);

            if (logoType === 'image' && logoUrl) {
                const img = document.createElement('img');
                img.src = logoUrl;
                img.alt = siteTitle;
                img.style.height = '40px';
                img.style.width = 'auto';
                img.style.borderRadius = '4px';
                logoEl.appendChild(img);
                // Remove gradient text class if image
                logoEl.classList.remove('bg-gradient-to-r', 'from-primary', 'to-secondary', 'from-primary', 'to-indigo-600', 'bg-clip-text', 'text-transparent');
                logoEl.classList.add('text-gray-900');
            } else {
                logoEl.textContent = siteTitle;
                // Re-add gradient text classes
                logoEl.classList.add('bg-gradient-to-r', 'from-primary', 'to-secondary', 'bg-clip-text', 'text-transparent');
                logoEl.classList.remove('text-gray-900');
            }
        });

        // Footer
        safeText('footerNome', siteTitle);

        // Banner
        safeText('bannerH1', data.bannerTitulo);
        safeText('bannerP', data.bannerSubtitulo);

        // Banner Background Handling
        const bannerBg = document.getElementById('banner-bg-image');
        const bannerGradient = document.getElementById('banner-gradient');

        if (bannerBg) {
            if (data.bannerImagem && data.bannerImagem.trim() !== '') {
                // Se tem imagem customizada
                bannerBg.style.backgroundImage = `url(${data.bannerImagem})`;

                // Remove efeitos de overlay para mostrar a imagem pura
                bannerBg.classList.remove('opacity-60', 'mix-blend-overlay');
                bannerBg.classList.add('opacity-100');

                // Oculta o degradê padrão
                if (bannerGradient) bannerGradient.classList.add('hidden');

            } else {
                // Estado padrão (sem imagem)
                bannerBg.style.backgroundImage = '';

                // Reseta efeitos
                bannerBg.classList.add('opacity-60', 'mix-blend-overlay');
                bannerBg.classList.remove('opacity-100');

                // Mostra o degradê padrão
                if (bannerGradient) bannerGradient.classList.remove('hidden');
            }
        }

        // Sobre
        if (data.sobre) {
            safeText('sobreTextoPreview', data.sobre.texto);
            safeImage('sobreImagemPreview', data.sobre.imagem);
        }

        // Contato e Mapa
        if (data.contato) {
            // Telefone 1
            if (data.contato.telefone) {
                safeText('telPreview', data.contato.telefone);
                safeHref('telLink1', `tel:${data.contato.telefone.replace(/\D/g, '')}`);
            }

            // Telefone 2
            const tel2Container = document.getElementById('contact-tel2');
            if (data.contato.telefone2 && data.contato.telefone2.trim() !== '') {
                safeText('telPreview2', data.contato.telefone2);
                safeHref('telLink2', `tel:${data.contato.telefone2.replace(/\D/g, '')}`);
                if (tel2Container) {
                    tel2Container.classList.remove('hidden');
                    tel2Container.style.display = 'flex';
                }
            } else {
                if (tel2Container) {
                    tel2Container.classList.add('hidden');
                    tel2Container.style.display = 'none';
                }
            }

            // Email
            if (data.contato.email) {
                safeText('emailPreview', data.contato.email);
                safeHref('emailLink', `mailto:${data.contato.email}`);
            }

            // Endereço
            if (data.contato.endereco) {
                safeText('enderecoPreview', data.contato.endereco);
                const encoded = encodeURIComponent(data.contato.endereco);
                safeHref('enderecoLink', `https://www.google.com/maps/search/?api=1&query=${encoded}`);
            }

            // Mapa
            const mapContainer = document.getElementById('mapContainer');
            const googleMapEmbed = document.getElementById('googleMapEmbed');

            if (data.contato.mostrarMapa && data.contato.latitude && data.contato.longitude) {
                const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${data.contato.latitude},${data.contato.longitude}`;
                if (googleMapEmbed) {
                    googleMapEmbed.innerHTML = `<iframe width="100%" height="100%" style="border:0;" loading="lazy" src="${mapUrl}"></iframe>`;
                }
                if (mapContainer) mapContainer.classList.remove('hidden');
            } else {
                if (mapContainer) mapContainer.classList.add('hidden');
            }

            // WhatsApp FAB
            if (data.contato.telefone) {
                const tel = data.contato.telefone.replace(/\D/g, '');
                const whatsappNum = tel.startsWith('55') ? tel : `55${tel}`;
                safeHref('whatsapp-fab', `https://wa.me/${whatsappNum}`);
            }
        }


        // Produtos
        const grid = document.getElementById('produtosGrid');
        if (grid) {
            if (data.produtos && data.produtos.length > 0) {
                // Atualiza a lista global de produtos
                currentProducts = data.produtos;

                grid.innerHTML = data.produtos.map((p, index) => `
                    <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 flex flex-col h-full group">
                        <div class="h-64 overflow-hidden relative">
                            <div class="w-full h-full bg-cover bg-center transform group-hover:scale-110 transition-transform duration-700" style="background-image: url('${p.imagem || 'https://via.placeholder.com/400'}'); background-position: ${p.foco || 'center'};"></div>
                            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        </div>
                        <div class="p-8 flex flex-col flex-grow relative">
                            <h3 class="text-2xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">${p.nome}</h3>
                            <div class="text-2xl font-bold text-secondary mb-4 font-mono tracking-tight">${p.preco}</div>
                            <p class="text-gray-600 text-base leading-relaxed flex-grow border-t border-gray-100 pt-4 cursor-pointer" onclick="window.openProductModal(${index})">${(p.descricao || '').substring(0, 100)}${p.descricao && p.descricao.length > 100 ? '...' : ''}</p>
                            <button onclick="window.openProductModal(${index})" class="w-full mt-6 py-3 bg-gray-50 text-gray-900 font-semibold rounded-xl hover:bg-primary hover:text-white transition-all border border-gray-200 hover:border-primary">Saber Mais</button>
                        </div>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-300">Nenhum produto disponível no momento.</div>';
            }
        }

        // Redes Sociais
        const socialContainer = document.querySelector('.social-icons-footer');
        if (socialContainer) {
            if (data.socialLinks && data.socialLinks.length > 0) {
                socialContainer.innerHTML = data.socialLinks.map(link => {
                    // Verificar tanto 'name' quanto 'nome' (compatibilidade)
                    const socialName = (link.name || link.nome || "").toLowerCase().trim();

                    // Mapeamento expandido de ícones
                    let iconClass = "fas fa-link"; // fallback

                    if (socialName.includes("instagram")) iconClass = "fab fa-instagram";
                    else if (socialName.includes("facebook")) iconClass = "fab fa-facebook-f";
                    else if (socialName.includes("linkedin")) iconClass = "fab fa-linkedin-in";
                    else if (socialName.includes("twitter") || socialName.includes("x")) iconClass = "fab fa-x-twitter";
                    else if (socialName.includes("youtube")) iconClass = "fab fa-youtube";
                    else if (socialName.includes("whatsapp")) iconClass = "fab fa-whatsapp";
                    else if (socialName.includes("tiktok")) iconClass = "fab fa-tiktok";
                    else if (socialName.includes("telegram")) iconClass = "fab fa-telegram";
                    else if (socialName.includes("pinterest")) iconClass = "fab fa-pinterest";
                    else if (socialName.includes("discord")) iconClass = "fab fa-discord";
                    else if (socialName.includes("github")) iconClass = "fab fa-github";
                    else if (socialName.includes("spotify")) iconClass = "fab fa-spotify";
                    else if (socialName.includes("twitch")) iconClass = "fab fa-twitch";
                    else if (socialName.includes("email") || socialName.includes("e-mail")) iconClass = "fas fa-envelope";
                    else if (socialName.includes("site") || socialName.includes("website")) iconClass = "fas fa-globe";

                    const displayName = link.name || link.nome || "Link";
                    const linkUrl = link.url || link.link || "#";

                    return `
                    <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="social-icon text-gray-400 hover:text-white transition-colors transform hover:scale-110" title="${displayName}">
                        <i class="${iconClass}"></i>
                    </a>
                `}).join('');
            } else {
                socialContainer.innerHTML = '';
            }
        }

        console.log('✅ [UI] Interface atualizada com sucesso');

    } catch (error) {
        console.error('❌ [UI] Erro ao atualizar:', error);
    }
}

// ===== MODAL DE PRODUTOS =====
window.openProductModal = (index) => {
    if (!currentProducts || !currentProducts[index]) return;

    const product = currentProducts[index];

    // Limpar campos
    document.getElementById('modal-product-name').textContent = '';
    document.getElementById('modal-product-price').textContent = '';
    document.getElementById('modal-product-description').textContent = '';

    // Preencher dados de texto
    if (product.nome) document.getElementById('modal-product-name').textContent = product.nome;
    if (product.preco) document.getElementById('modal-product-price').textContent = product.preco;
    document.getElementById('modal-product-description').textContent = product.descricao || 'Sem descrição.';

    // Mostrar/Ocultar Container da Imagem com tratamento de erro
    const imgContainer = document.getElementById('modal-image-container');
    const imgEl = document.getElementById('modal-product-image');

    // Reset handlers
    imgEl.onload = null;
    imgEl.onerror = null;

    if (product.imagem && product.imagem.trim() !== '') {
        // Ocultar se der erro ao carregar
        imgEl.onerror = function () {
            if (imgContainer) imgContainer.classList.add('hidden');
        };
        // Garantir visualização se carregar ok
        imgEl.onload = function () {
            if (imgContainer) imgContainer.classList.remove('hidden');
        };

        imgEl.src = product.imagem;
        if (imgContainer) imgContainer.classList.remove('hidden');
    } else {
        imgEl.src = '';
        if (imgContainer) imgContainer.classList.add('hidden');
    }

    // Mostrar modal
    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
};

window.closeProductModal = () => {
    const modal = document.getElementById('product-modal');
    modal.classList.add('hidden');
    // Restore scrolling
    document.body.style.overflow = '';
};

// Mobile Menu Logic
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('button.hamburger');
    const menu = document.getElementById('mobile-menu');

    if (btn && menu) {
        btn.addEventListener('click', () => {
            menu.classList.toggle('hidden');
        });

        // Close menu when clicking a link
        menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.add('hidden');
            });
        });
    }
});


// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    // console.log('📄 [DOM] Pronto, iniciando carregamento...');

    // 0. Feedback Visual Imediato
    if (window.skeletonLoader) {
        window.skeletonLoader.showAll();
    }

    // Comunicação do Iframe (para o Admin)
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'updateConfig') {
            // console.log('🔄 [Preview] Configuração recebida do admin');
            // console.log('📦 [Preview] ConfigManager disponível?', typeof window.ConfigManager);
            // console.log('📦 [Preview] Helpers disponível?', typeof window.Helpers);
            // console.log('📦 [Preview] Dados recebidos:', event.data.data);

            // Garantir que o DOM está pronto antes de aplicar
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    updatePublicSite(event.data.data);
                    if (window.skeletonLoader) window.skeletonLoader.hideAll();
                });
            } else {
                updatePublicSite(event.data.data);
                if (window.skeletonLoader) window.skeletonLoader.hideAll();
            }
        }
    });

    // Carregar dados
    try {
        // 1. Verificar se os managers globais existem
        if (!window.firebaseManager || !window.ConfigManager) {
            // console.error('❌ Faltam managers essenciais (firebaseManager ou ConfigManager).');
            // Tentar carregar o firebaseManager se não estiver presente
            if (!window.firebaseManager && typeof FirebaseRealtimeManager !== 'undefined') {
                window.firebaseManager = new FirebaseRealtimeManager();
                await window.firebaseManager.init();
            } else {
                throw new Error('Dependências não carregadas.');
            }
        }

        // 2. Estratégia Stale-While-Revalidate

        // A) Tentar Cache Primeiro
        const cached = globalCache.get('config', 'full');
        if (cached && cached.data) {
            // console.log('⚡ [Cache] Usando dados em cache para renderização imediata');
            updatePublicSite(cached.data);
            if (window.skeletonLoader) window.skeletonLoader.hideAll();
        }

        // B) Buscar Dados Atualizados (Background)
        // console.log('📡 [public.js] Buscando dados atualizados do Firebase...');
        const config = await window.firebaseManager.loadInitialData();

        // console.log('🔍 [DEBUG] Config recebido do Firebase:', config);
        // console.log('🔍 [DEBUG] Produtos no config:', config?.produtos);

        if (!config) {
            // Se não temos config e não tínhamos cache, é um erro crítico
            if (!cached) throw new Error("Configuração não recebida do firebaseManager");
            // console.warn('⚠️ [public.js] Falha ao buscar dados novos, mantendo cache.');
        } else {
            // C) Atualizar UI com dados novos
            // console.log('📥 [public.js] Dados atualizados recebidos. Atualizando UI...');

            // Salvar no cache para a próxima vez
            const configHash = JSON.stringify(config);
            // Só atualiza se mudou algo (opcional, mas o ConfigManager já faz check de hash, 
            // aqui garantimos que o cache global seja atualizado com os dados brutos)
            globalCache.set('config', 'full', { hash: configHash, data: config, timestamp: Date.now() });

            if (window.skeletonLoader) window.skeletonLoader.hideAll();
            updatePublicSite(config);
        }

    } catch (error) {
        // console.error('❌ Erro geral no public.js:', error);
        // Só mostra default se não conseguiu renderizar NADA (nem cache)
        // Verificamos se o título ainda é o default ou se algo falhou drasticamente
        if (document.title === "Site Profissional" && !document.getElementById('bannerH1').textContent) {
            showDefaultContent();
        }
        if (window.skeletonLoader) window.skeletonLoader.hideAll();
    }
});

// console.log('✅ [public.js] Carregado e refatorado');