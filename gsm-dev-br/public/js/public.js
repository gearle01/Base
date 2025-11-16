/**
 * ✅ CORRIGIDO: Script público com melhor tratamento de carregamento
 */

console.log('🚀 [public.js] Iniciando...');

const { debounce, cache, vdom, imageLoader, loading } = window.SiteModules || {};

let isLoading = false;
let loadPromise = null;
let firebaseManager = null;

/**
 * Mostra skeleton loading
 */
function showLoadingSkeleton() {
    const sections = ['banner', 'sobre', 'produtos', 'contato'];
    sections.forEach(section => {
        const el = document.getElementById(section);
        if (el) {
            el.style.opacity = '0.5';
            el.style.pointerEvents = 'none';
        }
    });
}

/**
 * Remove skeleton loading
 */
function hideLoadingSkeleton() {
    const sections = ['banner', 'sobre', 'produtos', 'contato'];
    sections.forEach(section => {
        const el = document.getElementById(section);
        if (el) {
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
        }
    });
}

/**
 * Inicializa Firebase
 */
async function initializeFirebase() {
    try {
        console.log('🔥 [Firebase] Verificando disponibilidade...');

        // Aguardar Firebase estar disponível
        let retries = 0;
        while (typeof firebase === 'undefined' && retries < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }

        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK não carregou');
        }

        console.log('✅ [Firebase] SDK disponível');

        // Verificar se já foi inicializado
        if (firebase.apps.length === 0) {
            if (typeof firebaseConfig === 'undefined') {
                throw new Error('firebaseConfig não definido');
            }
            firebase.initializeApp(firebaseConfig);
            console.log('✅ [Firebase] App inicializado');
        }

        return firebase;

    } catch (error) {
        console.error('❌ [Firebase] Erro:', error.message);
        throw error;
    }
}

/**
 * Carrega dados do Firestore
 */
async function loadDataFromFirestore() {
    if (isLoading && loadPromise) {
        console.log('📦 [Firestore] Já carregando, aguardando...');
        return loadPromise;
    }

    try {
        isLoading = true;
        showLoadingSkeleton();

        console.log('📡 [Firestore] Iniciando carregamento...');

        const fb = await initializeFirebase();
        const db = fb.firestore();

        // Timeout para operação
        loadPromise = Promise.race([
            Promise.all([
                db.collection('site').doc('cliente-001').get(),
                db.collection('site').doc('cliente-001').collection('cores').doc('data').get(),
                db.collection('site').doc('cliente-001').collection('contato').doc('data').get(),
                db.collection('site').doc('cliente-001').collection('modules').doc('data').get(),
                db.collection('site').doc('cliente-001').collection('sobre').doc('data').get(),
                db.collection('site').doc('cliente-001').collection('global_settings').doc('data').get(),
                db.collection('site').doc('cliente-001').collection('produtos').get(),
                db.collection('site').doc('cliente-001').collection('social_links').doc('data').get()
            ]),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout ao carregar dados')), 10000)
            )
        ]);

        const [
            clientDoc,
            coresDoc,
            contatoDoc,
            modulesDoc,
            sobreDoc,
            globalDoc,
            produtosSnap,
            socialLinksDoc
        ] = await loadPromise;

        if (!clientDoc.exists) {
            console.warn('⚠️ [Firestore] Documento principal não encontrado');
            hideLoadingSkeleton();
            showDefaultContent();
            return;
        }

        console.log('✅ [Firestore] Dados carregados');

        let config = clientDoc.data();

        if (coresDoc.exists) config.cores = coresDoc.data();
        if (contatoDoc.exists) config.contato = contatoDoc.data();
        if (modulesDoc.exists) config.modules = modulesDoc.data();
        if (sobreDoc.exists) config.sobre = sobreDoc.data();
        if (globalDoc.exists) config.globalSettings = globalDoc.data();
        if (socialLinksDoc.exists) {
            config.socialLinks = socialLinksDoc.data().links || [];
        }

        config.produtos = produtosSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log('📥 [Firestore] Atualizando UI...');
        updatePublicSite(config);
        hideLoadingSkeleton();

    } catch (error) {
        console.error('❌ [Firestore] Erro:', error.message);
        hideLoadingSkeleton();
        showDefaultContent();
    } finally {
        isLoading = false;
        loadPromise = null;
    }
}

/**
 * Mostra conteúdo padrão se nenhum dado for carregado
 */
function showDefaultContent() {
    console.log('📋 Mostrando conteúdo padrão');
    
    document.getElementById('bannerH1').textContent = 'Bem-vindo ao GSM';
    document.getElementById('bannerP').textContent = 'Seu site profissional está pronto';
    document.getElementById('footerNome').textContent = 'GSM';
    document.getElementById('telPreview').textContent = 'Telefone não configurado';
    document.getElementById('emailPreview').textContent = 'Email não configurado';
    document.getElementById('sobreTextoPreview').textContent = 'Seção sobre não configurada';
}

/**
 * Atualiza o site com os dados carregados
 */
function updatePublicSite(data) {
    console.log('🎨 [UI] Atualizando interface...');

    try {
        // Logo
        const logoEl = document.getElementById('logo');
        if (logoEl && data.empresaNome) {
            logoEl.textContent = data.empresaNome;
        }

        // Footer
        const footerEl = document.getElementById('footerNome');
        if (footerEl && data.empresaNome) {
            footerEl.textContent = data.empresaNome;
        }

        // Banner
        if (data.bannerTitulo) {
            document.getElementById('bannerH1').textContent = data.bannerTitulo;
        }
        if (data.bannerSubtitulo) {
            document.getElementById('bannerP').textContent = data.bannerSubtitulo;
        }
        if (data.bannerImagem) {
            const banner = document.querySelector('.banner');
            banner.style.backgroundImage = `url(${data.bannerImagem})`;
        }

        // Cores
        if (data.cores) {
            const root = document.documentElement;
            if (data.cores.primaria) {
                root.style.setProperty('--primary', data.cores.primaria);
            }
            if (data.cores.secundaria) {
                root.style.setProperty('--secondary', data.cores.secundaria);
            }
        }

        // Sobre
        if (data.sobre) {
            if (data.sobre.texto) {
                document.getElementById('sobreTextoPreview').textContent = data.sobre.texto;
            }
            if (data.sobre.imagem) {
                const sobreImg = document.getElementById('sobreImagemPreview');
                sobreImg.style.backgroundImage = `url(${data.sobre.imagem})`;
            }
        }

        // Contato
        if (data.contato) {
            if (data.contato.telefone) {
                document.getElementById('telPreview').textContent = data.contato.telefone;
                document.getElementById('telLink1').href = `tel:${data.contato.telefone.replace(/\D/g, '')}`;
            }
            if (data.contato.telefone2) {
                document.getElementById('telPreview2').textContent = data.contato.telefone2;
                document.getElementById('contact-tel2').classList.remove('hidden');
            }
            if (data.contato.email) {
                document.getElementById('emailPreview').textContent = data.contato.email;
                document.getElementById('emailLink').href = `mailto:${data.contato.email}`;
            }
            if (data.contato.endereco) {
                document.getElementById('enderecoPreview').textContent = data.contato.endereco;
                const encoded = encodeURIComponent(data.contato.endereco);
                document.getElementById('enderecoLink').href = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
            }

            // Mapa
            if (data.contato.latitude && data.contato.longitude) {
                const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${data.contato.latitude},${data.contato.longitude}`;
                document.getElementById('googleMapEmbed').innerHTML = `
                    <iframe width="100%" height="100%" style="border:0;" loading="lazy" src="${mapUrl}"></iframe>
                `;
            }

            // WhatsApp
            if (data.contato.telefone) {
                const tel = data.contato.telefone.replace(/\D/g, '');
                const whatsappNum = tel.startsWith('55') ? tel : `55${tel}`;
                document.getElementById('whatsapp-fab').href = `https://wa.me/${whatsappNum}`;
            }
        }

        // Módulos
        if (data.modules) {
            if (!data.modules.sobre) document.getElementById('sobre').classList.add('hidden');
            if (!data.modules.produtos) document.getElementById('produtos').classList.add('hidden');
            if (!data.modules.contato) document.getElementById('contato').classList.add('hidden');
        }

        // Produtos
        if (data.produtos && data.produtos.length > 0) {
            const grid = document.getElementById('produtosGrid');
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
        }

        // Redes Sociais
        if (data.socialLinks && data.socialLinks.length > 0) {
            const socialContainer = document.querySelector('.social-icons-footer');
            if (socialContainer) {
                socialContainer.innerHTML = data.socialLinks.map(link => `
                    <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="social-icon" title="${link.name}">
                        ${link.icon || '📱'}
                    </a>
                `).join('');
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

    // Remove loading screen
    const pageLoading = document.getElementById('pageLoading');
    if (pageLoading) {
        pageLoading.classList.add('hidden');
        setTimeout(() => pageLoading.remove(), 400);
    }

    // Carregar dados
    try {
        await loadDataFromFirestore();
    } catch (error) {
        console.error('❌ Erro geral:', error);
        showDefaultContent();
    }
});

// Evento do SW
window.addEventListener('SW_READY', () => {
    console.log('✅ Service Worker ready');
});

console.log('✅ [public.js] Carregado');