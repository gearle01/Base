// Função para escapar HTML e prevenir XSS
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
}

// Usar em TODOS os lugares onde você insere dados do usuário no HTML
// Exemplo:
// ANTES:
// element.innerHTML = produto.nome;
// DEPOIS:
// element.textContent = produto.nome; // Mais seguro
// ou
// element.innerHTML = escapeHtml(produto.nome);


const cache = {
    data: null,
    timestamp: 0,
    isValid: function() {
        return this.data && (Date.now() - this.timestamp < 60000); // 1 min cache
    }
};

function escapeHtml(unsafe) {
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
}

function showLoadingSkeleton() {
    const produtosGrid = document.getElementById('produtosGrid');
    if (produtosGrid) {
        produtosGrid.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    function initializeFirebase() {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            loadDataFromFirestore();
        } else {
            // Se o Firebase não foi inicializado, tenta novamente em 100ms
            setTimeout(initializeFirebase, 100);
        }
    }
    initializeFirebase();
});

async function loadDataFromFirestore() {
    if (cache.isValid()) {
        updatePublicSite(cache.data);
        return;
    }

    showLoadingSkeleton();
    const db = firebase.firestore();
    const clientId = 'cliente-001';

    try {
        const clientDocRef = db.collection('site').doc(clientId);
        const clientDoc = await clientDocRef.get();

        if (!clientDoc.exists) {
            console.log("Cliente não encontrado no Firestore. Usando conteúdo padrão.");
            const produtosGrid = document.getElementById('produtosGrid');
            if(produtosGrid) produtosGrid.innerHTML = '';
            return;
        }

        let config = clientDoc.data();

        const subcollections = ['cores', 'contato', 'modules', 'sobre', 'global_settings'];
        const promises = subcollections.map(async (sub) => {
            const subDoc = await clientDocRef.collection(sub).doc('data').get();
            if (subDoc.exists) config[sub] = subDoc.data();
        });

        const produtosPromise = clientDocRef.collection('produtos').get().then(querySnapshot => {
            config.produtos = querySnapshot.docs.map(doc => doc.data());
        });

        await Promise.all([...promises, produtosPromise]);

        // Cache the data
        cache.data = config;
        cache.timestamp = Date.now();

        updatePublicSite(config);

    } catch (error) {
        console.error("Erro ao buscar dados do site: ", error);
    }
}

function updatePublicSite(data) {
    // ✅ CORREÇÃO 1: Aplicar Configurações Globais de Fonte
    if (data.global_settings) {
        // Aplicar fonte customizada
        if (data.global_settings.fontUrl) {
            let fontLink = document.getElementById('dynamic-font');
            if (!fontLink) {
                fontLink = document.createElement('link');
                fontLink.id = 'dynamic-font';
                fontLink.rel = 'stylesheet';
                document.head.appendChild(fontLink);
            }
            fontLink.href = data.global_settings.fontUrl;
        }

        if (data.global_settings.fontFamily) {
            document.body.style.fontFamily = data.global_settings.fontFamily;
        }

        // Código de rastreamento (validado)
        if (data.global_settings.trackingCode) {
            const code = data.global_settings.trackingCode;
            
            const isGoogleAnalytics = code.includes('googletagmanager.com') || 
                                       code.includes('analytics.google.com');
            const isFacebookPixel = code.includes('facebook.net/en_US/fbevents.js');
            const isHotjar = code.includes('static.hotjar.com');
            
            if (isGoogleAnalytics || isFacebookPixel || isHotjar) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(code, 'text/html');
                
                const scripts = doc.querySelectorAll('script');
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    if (script.src) {
                        newScript.src = script.src;
                    } else {
                        newScript.textContent = script.textContent;
                    }
                    if (script.async) newScript.async = true;
                    document.body.appendChild(newScript);
                });
            } else {
                console.warn('Código de rastreamento não reconhecido foi bloqueado');
            }
        }
    }

    // ✅ CORREÇÃO 2: Atualizar Logo (com suporte a imagem)
    const logoContainer = document.getElementById('logo');
    if (logoContainer) {
        logoContainer.innerHTML = '';
        
        if (data.logoType === 'image' && data.logoImageUrl) {
            const img = document.createElement('img');
            img.src = data.logoImageUrl;
            img.style.maxHeight = '50px';
            img.alt = data.empresaNome || 'Logo';
            logoContainer.appendChild(img);
        } else {
            logoContainer.textContent = data.empresaNome || 'MinhaEmpresa';
        }
    }

    // Atualizar título da página e footer
    document.title = data.empresaNome || 'Minha Empresa';
    const footerNome = document.getElementById('footerNome');
    if (footerNome) footerNome.textContent = data.empresaNome || 'MinhaEmpresa';

    // Atualizar banner
    const bannerH1 = document.getElementById('bannerH1');
    if (bannerH1) bannerH1.textContent = data.bannerTitulo || '';

    const bannerP = document.getElementById('bannerP');
    if (bannerP) bannerP.textContent = data.bannerSubtitulo || '';
    
    const banner = document.querySelector('.banner');
    if (banner && data.bannerImagem) {
        banner.style.backgroundImage = `url(${data.bannerImagem})`;
    }
    
    // ✅ CORREÇÃO 3: Aplicar cores
    if (data.cores) {
        document.documentElement.style.setProperty('--primary-color', data.cores.primaria);
        document.documentElement.style.setProperty('--secondary-color', data.cores.secundaria);
        
        // Aplicar cores aos elementos
        document.querySelectorAll('.site-nav-links a').forEach(a => {
            a.style.color = data.cores.primaria;
        });
        
        document.querySelectorAll('.contact-icon').forEach(icon => {
            icon.style.background = data.cores.primaria;
        });
        
        const ctaBtn = document.querySelector('.cta-btn');
        if (ctaBtn) ctaBtn.style.background = data.cores.secundaria;
    }

    // Atualizar seção Sobre
    if (data.sobre) {
        const sobreTexto = document.getElementById('sobreTextoPreview');
        if (sobreTexto) sobreTexto.textContent = data.sobre.texto || '';

        const sobreImagem = document.getElementById('sobreImagemPreview');
        if (sobreImagem && data.sobre.imagem) {
            sobreImagem.style.backgroundImage = `url(${data.sobre.imagem})`;
        }
    }
    
    // ✅ CORREÇÃO 4: Atualizar contato com telefones
    if (data.contato) {
        const tel1 = data.contato.telefone || '';
        const tel2 = data.contato.telefone2 || '';
        const cleanTel1 = tel1.replace(/\D/g, '');
        const cleanTel2 = tel2.replace(/\D/g, '');

        // Botão flutuante de WhatsApp
        const whatsappFab = document.getElementById('whatsapp-fab');
        if (whatsappFab && cleanTel1) {
            whatsappFab.href = `https://wa.me/55${cleanTel1}`;
            whatsappFab.style.display = 'flex';
        }

        // Telefone 1
        const telPreview = document.getElementById('telPreview');
        const telLink1 = document.getElementById('telLink1');
        if (telPreview) telPreview.textContent = tel1;
        if (telLink1) telLink1.href = `tel:+55${cleanTel1}`;

        // Telefone 2 (mostrar/ocultar)
        const contactTel2 = document.getElementById('contact-tel2');
        const telPreview2 = document.getElementById('telPreview2');
        const telLink2 = document.getElementById('telLink2');
        
        if (tel2 && contactTel2) {
            if (telPreview2) telPreview2.textContent = tel2;
            if (telLink2) telLink2.href = `tel:+55${cleanTel2}`;
            contactTel2.classList.remove('hidden');
        } else if (contactTel2) {
            contactTel2.classList.add('hidden');
        }

        // Email e endereço
        const emailPreview = document.getElementById('emailPreview');
        if (emailPreview) emailPreview.textContent = data.contato.email || '';

        const enderecoPreview = document.getElementById('enderecoPreview');
        if (enderecoPreview) enderecoPreview.textContent = data.contato.endereco || '';
    }
    
    // ✅ CORREÇÃO 5: Mostrar/ocultar módulos
    if (data.modules) {
        const sobreSection = document.querySelector('.sobre-section');
        if (sobreSection) {
            sobreSection.classList.toggle('hidden', !data.modules.sobre);
        }
        
        const navSobre = document.querySelector('.nav-sobre');
        if (navSobre) {
            navSobre.classList.toggle('hidden', !data.modules.sobre);
        }

        const produtosSection = document.querySelector('.produtos-section');
        if (produtosSection) {
            produtosSection.classList.toggle('hidden', !data.modules.produtos);
        }
        
        const navProdutos = document.querySelector('.nav-produtos');
        if (navProdutos) {
            navProdutos.classList.toggle('hidden', !data.modules.produtos);
        }

        const contatoSection = document.querySelector('.contato-section');
        if (contatoSection) {
            contatoSection.classList.toggle('hidden', !data.modules.contato);
        }
        
        const navContato = document.querySelector('.nav-contato');
        if (navContato) {
            navContato.classList.toggle('hidden', !data.modules.contato);
        }
    }
    
    // ✅ Renderizar produtos com proteção XSS
    if (data.produtos) {
        const produtosGrid = document.getElementById('produtosGrid');
        if (produtosGrid) {
            produtosGrid.innerHTML = data.produtos.map(p => `
                <div class="product-card">
                    <div class="product-image" style="background-image: url(${escapeHtml(p.imagem || 'https://via.placeholder.com/400')})"></div>
                    <div class="product-info">
                        <h3>${escapeHtml(p.nome)}</h3>
                        <div class="product-price">${escapeHtml(p.preco)}</div>
                        <p>${escapeHtml(p.descricao)}</p>
                    </div>
                </div>
            `).join('');
        }
    }
}