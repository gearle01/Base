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
    // Aplicar Configurações Globais
    // VERSÃO SEGURA - Valida o código antes de inserir
if (data.global_settings && data.global_settings.trackingCode) {
    const code = data.global_settings.trackingCode;
    
    // Whitelist de códigos permitidos
    const isGoogleAnalytics = code.includes('googletagmanager.com') || 
                               code.includes('analytics.google.com');
    const isFacebookPixel = code.includes('facebook.net/en_US/fbevents.js');
    const isHotjar = code.includes('static.hotjar.com');
    
    if (isGoogleAnalytics || isFacebookPixel || isHotjar) {
        // Usar DOMParser para segurança
        const parser = new DOMParser();
        const doc = parser.parseFromString(code, 'text/html');
        
        // Inserir apenas scripts válidos
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

    // Atualizar Logo
    const logoContainer = document.getElementById('logo');
    logoContainer.innerHTML = '';
    if (data.logoType === 'image' && data.logoImageUrl) {
        const img = document.createElement('img');
        img.src = data.logoImageUrl;
        img.style.maxHeight = '50px';
        logoContainer.appendChild(img);
    } else {
        logoContainer.textContent = data.empresaNome;
    }

    document.title = data.empresaNome || document.title;
    document.getElementById('footerNome').textContent = data.empresaNome;
    document.getElementById('bannerH1').textContent = data.bannerTitulo;
    document.getElementById('bannerP').textContent = data.bannerSubtitulo;
    
    const banner = document.querySelector('.banner');
    if (banner) {
        banner.style.backgroundImage = `url(${data.bannerImagem})`;
    }
    
    if (data.cores) {
        document.documentElement.style.setProperty('--primary-color', data.cores.primaria);
        document.documentElement.style.setProperty('--secondary-color', data.cores.secundaria);
        
        // Aplicar cores aos elementos
        document.querySelectorAll('.site-nav-links a').forEach(a => a.style.color = data.cores.primaria);
        document.querySelectorAll('.contact-icon').forEach(icon => icon.style.background = data.cores.primaria);
        
        const ctaBtn = document.querySelector('.cta-btn');
        if (ctaBtn) ctaBtn.style.background = data.cores.secundaria;
    }

    if (data.sobre) {
        document.getElementById('sobreTextoPreview').textContent = data.sobre.texto;
        document.getElementById('sobreImagemPreview').style.backgroundImage = `url(${data.sobre.imagem})`;
    }
    
    if (data.contato) {
        const tel1 = data.contato.telefone || '';
        const tel2 = data.contato.telefone2 || '';
        const cleanTel1 = tel1.replace(/\D/g, '');
        const cleanTel2 = tel2.replace(/\D/g, '');

        // Botão flutuante de WhatsApp
        if(cleanTel1) {
            document.getElementById('whatsapp-fab').href = `https://wa.me/${cleanTel1}`;
        }

        // Links de contato
        document.getElementById('telPreview').textContent = tel1;
        document.getElementById('telLink1').href = `tel:${cleanTel1}`;

        const contactTel2 = document.getElementById('contact-tel2');
        if (tel2) {
            document.getElementById('telPreview2').textContent = tel2;
            document.getElementById('telLink2').href = `tel:${cleanTel2}`;
            contactTel2.classList.remove('hidden');
        } else {
            contactTel2.classList.add('hidden');
        }

        document.getElementById('emailPreview').textContent = data.contato.email;
        document.getElementById('enderecoPreview').textContent = data.contato.endereco;
    }
    
    if (data.modules) {
        document.querySelector('.sobre-section').classList.toggle('hidden', !data.modules.sobre);
        document.querySelector('.nav-sobre').classList.toggle('hidden', !data.modules.sobre);
        document.querySelector('.produtos-section').classList.toggle('hidden', !data.modules.produtos);
        document.querySelector('.nav-produtos').classList.toggle('hidden', !data.modules.produtos);
        document.querySelector('.contato-section').classList.toggle('hidden', !data.modules.contato);
        document.querySelector('.nav-contato').classList.toggle('hidden', !data.modules.contato);
    }
    
    if (data.produtos) {
        const produtosGrid = document.getElementById('produtosGrid');
        produtosGrid.innerHTML = data.produtos.map(p => `
            <div class="product-card">
                <div class="product-image" style="background-image: url(${p.imagem})"></div>
                <div class="product-info">
                    <h3>${escapeHtml(p.nome)}</h3>
                    <div class="product-price">${escapeHtml(p.preco)}</div>
                    <p>${escapeHtml(p.descricao)}</p>
                </div>
            </div>
        `).join('');
    }
}