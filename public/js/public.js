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
function updatePublicSite(data) {
    console.log('🎨 [UI] Atualizando interface...');

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
        const footerEl = document.getElementById('footerNome');
        if (footerEl) footerEl.textContent = siteTitle;

        // Banner
        if (data.bannerTitulo) document.getElementById('bannerH1').textContent = data.bannerTitulo;
        if (data.bannerSubtitulo) document.getElementById('bannerP').textContent = data.bannerSubtitulo;
        if (data.bannerImagem) document.querySelector('.banner').style.backgroundImage = `url(${data.bannerImagem})`;

        // Sobre
        if (data.sobre) {
            if (data.sobre.texto) document.getElementById('sobreTextoPreview').textContent = data.sobre.texto;
            if (data.sobre.imagem) document.getElementById('sobreImagemPreview').style.backgroundImage = `url(${data.sobre.imagem})`;
        }

        // Contato e Mapa
        if (data.contato) {
            if (data.contato.telefone) {
                document.getElementById('telPreview').textContent = data.contato.telefone;
                document.getElementById('telLink1').href = `tel:${data.contato.telefone.replace(/\D/g, '')}`;
            }
            if (data.contato.telefone2) {
                document.getElementById('telPreview2').textContent = data.contato.telefone2;
                document.getElementById('contact-tel2').classList.remove('hidden');
            } else {
                 document.getElementById('contact-tel2').classList.add('hidden');
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
            if (data.contato.mostrarMapa && data.contato.latitude && data.contato.longitude) {
                const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${data.contato.latitude},${data.contato.longitude}`;
                document.getElementById('googleMapEmbed').innerHTML = `<iframe width="100%" height="100%" style="border:0;" loading="lazy" src="${mapUrl}"></iframe>`;
                document.getElementById('mapContainer').classList.remove('hidden');
            } else {
                 document.getElementById('mapContainer').classList.add('hidden');
            }
            if (data.contato.telefone) {
                const tel = data.contato.telefone.replace(/\D/g, '');
                const whatsappNum = tel.startsWith('55') ? tel : `55${tel}`;
                document.getElementById('whatsapp-fab').href = `https://wa.me/${whatsappNum}`;
            }
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
    
    // Comunicação do Iframe (para o Admin)
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'updateConfig') {
            console.log('🔄 [Preview] Configuração recebida do admin');
            updatePublicSite(event.data.data);
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

        // 2. Usar o manager para carregar dados (LÓGICA CENTRALIZADA)
        console.log('📡 [public.js] Usando firebaseManager para carregar dados...');
        const config = await window.firebaseManager.loadInitialData();

        if (!config) {
            throw new Error("Configuração não recebida do firebaseManager");
        }

        // 3. Atualizar a UI
        console.log('📥 [public.js] Atualizando UI com dados...');
        updatePublicSite(config);

    } catch (error) {
        console.error('❌ Erro geral no public.js:', error);
        showDefaultContent();
    }
});

console.log('✅ [public.js] Carregado e refatorado');