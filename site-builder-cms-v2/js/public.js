document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore === 'undefined') {
        console.error('Erro: Firebase não configurado corretamente.');
        return;
    }
    loadDataFromFirestore();
});

async function loadDataFromFirestore() {
    const db = firebase.firestore();
    const clientId = 'cliente-001';

    try {
        const clientDocRef = db.collection('site').doc(clientId);
        const clientDoc = await clientDocRef.get();

        if (!clientDoc.exists) {
            console.log("Cliente não encontrado no Firestore. Usando conteúdo padrão.");
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

        updatePublicSite(config);

    } catch (error) {
        console.error("Erro ao buscar dados do site: ", error);
    }
}

function updatePublicSite(data) {
    // Aplicar Configurações Globais
    if (data.global_settings) {
        // Injetar fonte do Google
        if (data.global_settings.fontUrl) {
            const fontLink = document.createElement('link');
            fontLink.href = data.global_settings.fontUrl;
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }
        // Aplicar família da fonte
        if (data.global_settings.fontFamily) {
            document.body.style.fontFamily = data.global_settings.fontFamily;
        }
        // Injetar código de rastreamento
        if (data.global_settings.trackingCode) {
            const script = document.createElement('script');
            script.innerHTML = data.global_settings.trackingCode;
            document.body.appendChild(script);
        }
    }

    document.title = data.empresaNome || document.title;
    document.getElementById('logo').textContent = data.empresaNome;
    document.getElementById('footerNome').textContent = data.empresaNome;
    document.getElementById('bannerH1').textContent = data.bannerTitulo;
    document.getElementById('bannerP').textContent = data.bannerSubtitulo;
    document.getElementById('banner').style.backgroundImage = `url(${data.bannerImagem})`;
    
    if (data.cores) {
        document.documentElement.style.setProperty('--primary-color', data.cores.primaria);
        document.documentElement.style.setProperty('--secondary-color', data.cores.secundaria);
    }

    if (data.sobre) {
        document.getElementById('sobreTextoPreview').textContent = data.sobre.texto;
        document.getElementById('sobreImagemPreview').style.backgroundImage = `url(${data.sobre.imagem})`;
    }
    
    if (data.contato) {
        document.getElementById('telPreview').textContent = data.contato.telefone;
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
                    <h3>${p.nome}</h3>
                    <div class="product-price">${p.preco}</div>
                    <p>${p.descricao}</p>
                </div>
            </div>
        `).join('');
    }
}
