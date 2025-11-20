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

console.log('🚀 [public.js] Iniciando...');

/**
 * Mostra conteúdo padrão se nenhum dado for carregado
 * (Função movida para o topo para clareza)
 */
function showDefaultContent() {
    console.log('📋 Mostrando conteúdo padrão');

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
        if (src) {
            el.style.backgroundImage = `url(${src})`;
        } else {
            el.style.backgroundImage = '';
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
    console.log('🎨 [UI] Atualizando interface...', data);

    if (!data) {
        console.warn('⚠️ [UI] Dados vazios recebidos em updatePublicSite');
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

        const logoEl = document.getElementById('logo');
        if (logoEl) {
            logoEl.innerHTML = '';
            if (data.logoType === 'image' && data.logoImageUrl) {
                const img = document.createElement('img');
                img.src = data.logoImageUrl;
                img.alt = siteTitle;
                img.style.height = '40px';
                img.style.width = 'auto';
                img.style.borderRadius = '4px';
                logoEl.appendChild(img);
            } else {
                logoEl.textContent = siteTitle;
            }
        }

        // Footer
        safeText('footerNome', siteTitle);

        // Banner
        safeText('bannerH1', data.bannerTitulo);
        safeText('bannerP', data.bannerSubtitulo);
        safeImage('banner', data.bannerImagem); // Assumindo que o ID da div do banner seja 'banner' ou ajustando se for classe
        // Se o banner for selecionado por classe no código original:
        const bannerEl = document.querySelector('.banner');
        if (bannerEl && data.bannerImagem) {
            bannerEl.style.backgroundImage = `url(${data.bannerImagem})`;
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
                grid.innerHTML = data.produtos.map(p => `
                    <div class="product-card">
                        <div class="product-image" style="background-image: url('${p.imagem || 'https://via.placeholder.com/400'}'); background-position: ${p.foco || 'center'};"></div>
                        <div class="product-info">
                            <h3>${p.nome}</h3>
                            <div class="product-price">${p.preco}</div>
                            <p>${p.descricao || ''}</p>
                        </div>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = ''; // Limpa se não houver produtos
            }
        }

        // Redes Sociais
        const socialContainer = document.querySelector('.social-icons-footer');
        if (socialContainer) {
            if (data.socialLinks && data.socialLinks.length > 0) {
                socialContainer.innerHTML = data.socialLinks.map(link => `
                    <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="social-icon" title="${link.name}">
                        ${link.icon || '📱'} 
                    </a>
                `).join('');
            } else {
                socialContainer.innerHTML = '';
            }
        }

        console.log('✅ [UI] Interface atualizada com sucesso');

    } catch (error) {
        console.error('❌ [UI] Erro ao atualizar:', error);
    }
}


// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 [DOM] Pronto, iniciando carregamento...');

    // 0. Feedback Visual Imediato
    if (window.skeletonLoader) {
        window.skeletonLoader.showAll();
    }

    // Comunicação do Iframe (para o Admin)
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'updateConfig') {
            console.log('🔄 [Preview] Configuração recebida do admin');
            console.log('📦 [Preview] ConfigManager disponível?', typeof window.ConfigManager);
            console.log('📦 [Preview] Helpers disponível?', typeof window.Helpers);
            console.log('📦 [Preview] Dados recebidos:', event.data.data);

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
            console.error('❌ Faltam managers essenciais (firebaseManager ou ConfigManager).');
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
            console.log('⚡ [Cache] Usando dados em cache para renderização imediata');
            updatePublicSite(cached.data);
            if (window.skeletonLoader) window.skeletonLoader.hideAll();
        }

        // B) Buscar Dados Atualizados (Background)
        console.log('📡 [public.js] Buscando dados atualizados do Firebase...');
        const config = await window.firebaseManager.loadInitialData();

        console.log('🔍 [DEBUG] Config recebido do Firebase:', config);
        console.log('🔍 [DEBUG] Produtos no config:', config?.produtos);

        if (!config) {
            // Se não temos config e não tínhamos cache, é um erro crítico
            if (!cached) throw new Error("Configuração não recebida do firebaseManager");
            console.warn('⚠️ [public.js] Falha ao buscar dados novos, mantendo cache.');
        } else {
            // C) Atualizar UI com dados novos
            console.log('📥 [public.js] Dados atualizados recebidos. Atualizando UI...');

            // Salvar no cache para a próxima vez
            const configHash = JSON.stringify(config);
            // Só atualiza se mudou algo (opcional, mas o ConfigManager já faz check de hash, 
            // aqui garantimos que o cache global seja atualizado com os dados brutos)
            globalCache.set('config', 'full', { hash: configHash, data: config, timestamp: Date.now() });

            if (window.skeletonLoader) window.skeletonLoader.hideAll();
            updatePublicSite(config);
        }

    } catch (error) {
        console.error('❌ Erro geral no public.js:', error);
        // Só mostra default se não conseguiu renderizar NADA (nem cache)
        // Verificamos se o título ainda é o default ou se algo falhou drasticamente
        if (document.title === "Site Profissional" && !document.getElementById('bannerH1').textContent) {
            showDefaultContent();
        }
        if (window.skeletonLoader) window.skeletonLoader.hideAll();
    }
});

console.log('✅ [public.js] Carregado e refatorado');