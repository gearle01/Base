// Estado da aplicação
let state = {
    modules: { sobre: true, produtos: true, contato: true },
    produtos: []
};

// Referências do Firebase
let db, storage;
const clientId = 'cliente-001';

// ===== INICIALIZAÇÃO COM SESSÃO ANÔNIMA =====
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar se Firebase está carregado
    if (typeof firebase === 'undefined') {
        console.error('ERRO: Firebase não foi carregado.');
        showToast('Firebase não configurado.', 'error');
        return;
    }

    // Inicializar Firebase
    try {
        if (!firebase.apps.length) {
            console.log('Inicializando Firebase...');
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase inicializado com sucesso!');
        }
        
        db = firebase.firestore();
        storage = firebase.storage();

        // Verificar autenticação Firebase
        firebase.auth().onAuthStateChanged(async function(user) {
            if (!user) {
                console.log('Usuário não autenticado, redirecionando para login...');
                window.location.href = 'login.html';
                return;
            }

            // ✅ CRIAR SESSÃO ANÔNIMA NO APPWRITE
            try {
                // Aguardar Appwrite estar pronto
                if (typeof Appwrite === 'undefined') {
                    await new Promise(resolve => {
                        window.addEventListener('appwriteReady', resolve, { once: true });
                    });
                }

                const account = new Appwrite.Account(window.appwriteClient);
                
                // Tentar criar sessão anônima (só funciona se não houver sessão ativa)
                try {
                    await account.createAnonymousSession();
                    console.log('✅ Sessão anônima Appwrite criada');
                } catch (error) {
                    // Se já existe sessão, não faz nada
                    if (error.code !== 401) {
                        console.log('ℹ️ Sessão Appwrite já existe');
                    }
                }
            } catch (error) {
                console.warn('⚠️ Não foi possível criar sessão Appwrite:', error.message);
            }

            // Carregar dados
            loadDataFromFirestore();
        });
        
        console.log('Firestore e Storage prontos!');
        
    } catch (error) {
        console.error('ERRO ao inicializar:', error);
        showToast('Erro ao conectar: ' + error.message, 'error');
    }
});

// ===== UPLOAD DE IMAGEM =====
async function compressImage(file, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    // CORREÇÃO: Converter Blob para File
                    const compressedFile = new File([blob], file.name, {
                        type: file.type,
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, file.type, quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

async function handleImageUpload(event, targetInputId, previewSelector) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione uma imagem válida.', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
        showToast('Imagem muito grande! Máximo 5MB', 'error');
        return;
    }

    try {
        showToast('Comprimindo imagem...', 'info');
        const compressedFile = await compressImage(file);

        showToast(`Fazendo upload de ${file.name}...`, 'info');
        
        // ✅ CORREÇÃO: Appwrite precisa de um File nativo do navegador
        // Não precisa converter Blob para File manualmente
        const promise = appwriteStorage.createFile(
            '68f04fe50018c9e1abc4', // Bucket ID
            'unique()', // ✅ CORREÇÃO: Use string 'unique()' ao invés de Appwrite.ID.unique()
            compressedFile // Já é um File válido
        );

        promise.then(function (response) {
            const fileId = response.$id;
            // ✅ CORREÇÃO: Usar getFileView ao invés de getFilePreview
            const viewResult = appwriteStorage.getFileView('68f04fe50018c9e1abc4', fileId);
            const downloadURL = viewResult.href;

            document.getElementById(targetInputId).value = downloadURL;
            if (previewSelector) {
                document.querySelector(previewSelector).style.backgroundImage = `url(${downloadURL})`;
            }
            
            showToast('Upload concluído!', 'success');
            update();
            autoSave();

        }, function (error) {
            console.error("Erro no upload: ", error);
            showToast('Falha no upload da imagem: ' + error.message, 'error');
        });

    } catch (error) {
        console.error("Erro no upload: ", error);
        showToast('Falha no upload da imagem: ' + error.message, 'error');
    }
}

// ✅ Função compressImage corrigida para retornar File
async function compressImage(file, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    // ✅ Converter Blob para File CORRETAMENTE
                    const compressedFile = new File([blob], file.name, {
                        type: file.type,
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, file.type, quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// ===== LÓGICA DE DADOS (FIRESTORE) =====
async function loadDataFromFirestore() {
    if (!db) {
        console.error('Firestore não está inicializado!');
        showToast('Erro: Banco de dados não conectado.', 'error');
        return;
    }

    const clientDocRef = db.collection('site').doc(clientId);
    console.log('Carregando dados do cliente:', clientId);
    showToast('Carregando dados...', 'info');

    try {
        const clientDoc = await clientDocRef.get();
        
        if (!clientDoc.exists) {
            console.warn('Cliente não encontrado. Criando documento padrão...');
            showToast('Cliente não encontrado. Usando modelo padrão.', 'info');
            update();
            return;
        }

        console.log('Documento principal encontrado:', clientDoc.data());
        let config = clientDoc.data();

        const subcollections = ['cores', 'contato', 'modules', 'sobre', 'global_settings'];
        const promises = subcollections.map(async (sub) => {
            const subDoc = await clientDocRef.collection(sub).doc('data').get();
            if (subDoc.exists) {
                console.log(`Subcoleção ${sub} carregada:`, subDoc.data());
                config[sub] = subDoc.data();
            } else {
                console.warn(`Subcoleção ${sub} não encontrada.`);
            }
        });

        const produtosPromise = clientDocRef.collection('produtos').get().then(snap => {
            console.log(`${snap.docs.length} produtos encontrados`);
            config.produtos = snap.docs.map(doc => doc.data());
        });

        await Promise.all([...promises, produtosPromise]);

        state.modules = config.modules || state.modules;
        state.produtos = config.produtos || state.produtos;
        loadConfig(config);
        console.log('Dados carregados com sucesso!');
        showToast('Dados carregados com sucesso!', 'success');

    } catch (error) {
        console.error("Erro detalhado ao carregar dados:", error);
        showToast('Erro ao carregar dados: ' + error.message, 'error');
        update();
    }
}

async function saveConfig() {
    if (!validateForm()) {
        showToast('Corrija os erros antes de salvar', 'error');
        return;
    }

    if (!db) {
        showToast('Erro: Banco de dados não conectado.', 'error');
        return;
    }

    showSaving();
    const config = getConfig();
    console.log('Salvando configuração:', config);
    
    const batch = db.batch();
    const clientDocRef = db.collection('site').doc(clientId);

    batch.set(clientDocRef, {
        empresaNome: config.empresaNome,
        bannerTitulo: config.bannerTitulo,
        bannerSubtitulo: config.bannerSubtitulo,
        bannerImagem: config.bannerImagem,
        logoType: config.logoType,
        logoImageUrl: config.logoImageUrl
    }, { merge: true });

    batch.set(clientDocRef.collection('global_settings').doc('data'), config.global_settings);
    batch.set(clientDocRef.collection('cores').doc('data'), config.cores);
    batch.set(clientDocRef.collection('contato').doc('data'), config.contato);
    batch.set(clientDocRef.collection('modules').doc('data'), config.modules);
    batch.set(clientDocRef.collection('sobre').doc('data'), config.sobre);

    const produtosRef = clientDocRef.collection('produtos');
    try {
        const oldProdutos = await produtosRef.get();
        oldProdutos.forEach(doc => batch.delete(doc.ref));
        config.produtos.forEach(produto => {
            const newProdRef = produtosRef.doc();
            batch.set(newProdRef, produto);
        });

        await batch.commit();
        console.log('Dados salvos com sucesso!');
        showSaved();
        showToast('Site atualizado com sucesso!', 'success');

    } catch (error) {
        console.error("Erro detalhado ao salvar:", error);
        showToast('Erro ao salvar: ' + error.message, 'error');
    }
}

// ===== FUNÇÕES DE UI E ESTADO =====

function setLogoType(type) {
    document.getElementById('logoType').value = type;
    const textGroup = document.getElementById('logoTextInputGroup');
    const imageGroup = document.getElementById('logoImageInputGroup');
    const textBtn = document.getElementById('logoTypeTextBtn');
    const imageBtn = document.getElementById('logoTypeImageBtn');

    if (type === 'text') {
        textGroup.classList.remove('hidden');
        imageGroup.classList.add('hidden');
        textBtn.classList.add('active');
        imageBtn.classList.remove('active');
    } else {
        textGroup.classList.add('hidden');
        imageGroup.classList.remove('hidden');
        textBtn.classList.remove('active');
        imageBtn.classList.add('active');
    }
}

function logout() {
    firebase.auth().signOut().then(() => {
        showToast('Saindo...', 'info');
        window.location.href = 'login.html';
    });
}

function getConfig() {
    return {
        logoType: document.getElementById('logoType').value,
        logoImageUrl: document.getElementById('logoImageUrl').value,
        empresaNome: document.getElementById('empresaNome').value,
        bannerTitulo: document.getElementById('bannerTitulo').value,
        bannerSubtitulo: document.getElementById('bannerSubtitulo').value,
        bannerImagem: document.getElementById('bannerImagem').value,
        global_settings: {
            fontUrl: document.getElementById('fontUrl').value,
            fontFamily: document.getElementById('fontFamily').value,
            trackingCode: document.getElementById('trackingCode').value
        },
        cores: { primaria: document.getElementById('corPrimaria').value, secundaria: document.getElementById('corSecundaria').value },
        modules: state.modules,
        sobre: { texto: document.getElementById('sobreTexto').value, imagem: document.getElementById('sobreImagem').value },
        produtos: state.produtos,
        contato: {
            telefone: document.getElementById('telefone').value,
            telefone2: document.getElementById('telefone2').value,
            email: document.getElementById('email').value,
            endereco: document.getElementById('endereco').value
        }
    };
}

function loadConfig(config) {
    document.getElementById('empresaNome').value = config.empresaNome || '';
    document.getElementById('bannerTitulo').value = config.bannerTitulo || '';
    document.getElementById('bannerSubtitulo').value = config.bannerSubtitulo || '';
    document.getElementById('bannerImagem').value = config.bannerImagem || '';
    
    setLogoType(config.logoType || 'text');
    document.getElementById('logoImageUrl').value = config.logoImageUrl || '';
    if (config.logoImageUrl) {
        document.querySelector('#logoPreview').style.backgroundImage = `url(${config.logoImageUrl})`;
    }

    if (config.global_settings) {
        document.getElementById('fontUrl').value = config.global_settings.fontUrl || '';
        document.getElementById('fontFamily').value = config.global_settings.fontFamily || '';
        document.getElementById('trackingCode').value = config.global_settings.trackingCode || '';
    }
    if (config.cores) {
        document.getElementById('corPrimaria').value = config.cores.primaria;
        document.getElementById('corSecundaria').value = config.cores.secundaria;
    }
    if (config.sobre) {
        document.getElementById('sobreTexto').value = config.sobre.texto || '';
        document.getElementById('sobreImagem').value = config.sobre.imagem || '';
    }
    if (config.contato) {
        document.getElementById('telefone').value = config.contato.telefone || '';
        document.getElementById('telefone2').value = config.contato.telefone2 || '';
        document.getElementById('email').value = config.contato.email || '';
        document.getElementById('endereco').value = config.contato.endereco || '';
    }
    if (config.modules) {
        Object.keys(config.modules).forEach(module => {
            const sw = document.querySelector(`[data-module="${module}"]`);
            if (sw) sw.classList.toggle('active', config.modules[module]);
        });
    }
    update();
}

function update() {
    const fontUrl = document.getElementById('fontUrl').value;
    if (fontUrl) {
        let fontLink = document.getElementById('dynamic-font');
        if (!fontLink) {
            fontLink = document.createElement('link');
            fontLink.id = 'dynamic-font';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }
        fontLink.href = fontUrl;
    }
    const fontFamily = document.getElementById('fontFamily').value;
    if (fontFamily) {
        const previewSite = document.querySelector('.preview .site');
        if (previewSite) previewSite.style.fontFamily = fontFamily;
    }

    const logoContainer = document.getElementById('logo');
    if (logoContainer) {
        const logoType = document.getElementById('logoType').value;
        logoContainer.innerHTML = '';
        if (logoType === 'image') {
            const imgUrl = document.getElementById('logoImageUrl').value;
            if (imgUrl) {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.style.maxHeight = '50px';
                logoContainer.appendChild(img);
            } else {
                logoContainer.textContent = document.getElementById('empresaNome').value;
            }
        } else {
            logoContainer.textContent = document.getElementById('empresaNome').value;
        }
    }

    const footerNome = document.getElementById('footerNome');
    if (footerNome) footerNome.textContent = document.getElementById('empresaNome').value;

    const bannerH1 = document.getElementById('bannerH1');
    if (bannerH1) bannerH1.textContent = document.getElementById('bannerTitulo').value;

    const bannerP = document.getElementById('bannerP');
    if (bannerP) bannerP.textContent = document.getElementById('bannerSubtitulo').value;

    const banner = document.querySelector('.banner');
    if (banner) banner.style.backgroundImage = `url(${document.getElementById('bannerImagem').value})`;

    const corPrimaria = document.getElementById('corPrimaria').value;
    const corSecundaria = document.getElementById('corSecundaria').value;
    
    const corPrimariaInput = document.querySelector('#corPrimaria + input');
    if (corPrimariaInput) corPrimariaInput.value = corPrimaria;

    const corSecundariaInput = document.querySelector('#corSecundaria + input');
    if (corSecundariaInput) corSecundariaInput.value = corSecundaria;

    document.querySelectorAll('.site-nav-links a').forEach(a => a.style.color = corPrimaria);
    document.querySelectorAll('.contact-icon').forEach(icon => icon.style.background = corPrimaria);
    
    const ctaBtn = document.querySelector('.cta-btn');
    if (ctaBtn) ctaBtn.style.background = corSecundaria;

    const sobreTextoPreview = document.getElementById('sobreTextoPreview');
    if (sobreTextoPreview) sobreTextoPreview.textContent = document.getElementById('sobreTexto').value;

    const sobreImagemPreview = document.getElementById('sobreImagemPreview');
    if (sobreImagemPreview) sobreImagemPreview.style.backgroundImage = `url(${document.getElementById('sobreImagem').value})`;

    const telPreview = document.getElementById('telPreview');
    if (telPreview) telPreview.textContent = document.getElementById('telefone').value;

    const telPreview2 = document.getElementById('telPreview2');
    if (telPreview2) telPreview2.textContent = document.getElementById('telefone2').value;

    const emailPreview = document.getElementById('emailPreview');
    if (emailPreview) emailPreview.textContent = document.getElementById('email').value;

    const enderecoPreview = document.getElementById('enderecoPreview');
    if (enderecoPreview) enderecoPreview.textContent = document.getElementById('endereco').value;

    if(state.modules) {
        const sobreSection = document.querySelector('.sobre-section');
        if (sobreSection) sobreSection.classList.toggle('hidden', !state.modules.sobre);

        const navSobre = document.querySelector('.nav-sobre');
        if (navSobre) navSobre.classList.toggle('hidden', !state.modules.sobre);

        const produtosSection = document.querySelector('.produtos-section');
        if (produtosSection) produtosSection.classList.toggle('hidden', !state.modules.produtos);

        const navProdutos = document.querySelector('.nav-produtos');
        if (navProdutos) navProdutos.classList.toggle('hidden', !state.modules.produtos);

        const contatoSection = document.querySelector('.contato-section');
        if (contatoSection) contatoSection.classList.toggle('hidden', !state.modules.contato);

        const navContato = document.querySelector('.nav-contato');
        if (navContato) navContato.classList.toggle('hidden', !state.modules.contato);
    }
    renderProdutos();
}

function renderProdutos() {
    const grid = document.getElementById('produtosGrid');
    if(grid) grid.innerHTML = state.produtos.map(p => `
        <div class="product-card">
            <div class="product-image" style="background-image: url(${p.imagem})"></div>
            <div class="product-info">
                <h3>${p.nome}</h3>
                <div class="product-price">${p.preco}</div>
                <p>${p.descricao}</p>
            </div>
        </div>
    `).join('');
    const list = document.getElementById('produtosList');
    if(list) list.innerHTML = state.produtos.map((p, i) => `
        <div style="background: #f8f9fa; padding: 0.8rem; border-radius: 4px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div><strong>${p.nome}</strong><br><small>${p.preco}</small></div>
            <div>
                <button class="btn btn-secondary" style="width: auto; padding: 0.4rem 0.8rem; margin: 0; font-size: 0.8rem;" onclick="openProdutoModal(${i})">✏️ Editar</button>
                <button class="btn btn-primary" style="width: auto; padding: 0.4rem 0.8rem; margin: 0; font-size: 0.8rem;" onclick="removeProduto(${i})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function openProdutoModal(index) {
    const modal = document.getElementById('produtoModal');
    const title = document.getElementById('produtoModalTitle');
    const idInput = document.getElementById('produtoId');
    const nomeInput = document.getElementById('produtoNome');
    const precoInput = document.getElementById('produtoPreco');
    const descricaoInput = document.getElementById('produtoDescricao');
    const imagemInput = document.getElementById('produtoImagem');

    if (index !== undefined && state.produtos[index]) {
        const produto = state.produtos[index];
        title.textContent = 'Editar Produto';
        idInput.value = index;
        nomeInput.value = produto.nome;
        precoInput.value = produto.preco;
        descricaoInput.value = produto.descricao;
        imagemInput.value = produto.imagem;
    } else {
        title.textContent = 'Adicionar Produto';
        idInput.value = '';
        nomeInput.value = '';
        precoInput.value = '';
        descricaoInput.value = '';
        imagemInput.value = '';
    }

    modal.style.display = 'block';
}

function closeProdutoModal() {
    document.getElementById('produtoModal').style.display = 'none';
}

function saveProduto() {
    const id = document.getElementById('produtoId').value;
    const nome = document.getElementById('produtoNome').value;
    const preco = document.getElementById('produtoPreco').value;
    const descricao = document.getElementById('produtoDescricao').value;
    const imagem = document.getElementById('produtoImagem').value;

    if (!nome || !preco) {
        showToast('Nome e preço são obrigatórios.', 'error');
        return;
    }

    const produto = { nome, preco, descricao, imagem: imagem || 'https://via.placeholder.com/400' };

    if (id) {
        state.produtos[id] = produto;
        showToast('Produto atualizado!', 'success');
    } else {
        state.produtos.push(produto);
        showToast('Produto adicionado!', 'success');
    }

    update();
    autoSave();
    closeProdutoModal();
}

function removeProduto(index) {
    if (confirm('Remover este produto?')) {
        state.produtos.splice(index, 1);
        update();
        autoSave();
        showToast('Produto removido', 'info');
    }
}

let saveTimeout;
function autoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await saveConfig();
        } catch (error) {
            console.error('Erro detalhado no auto-save:', error);
            showToast(`Erro: ${error.message}`, 'error');
        }
    }, 1500);
}

function toggleHelp() { document.getElementById('shortcutsHelp').classList.toggle('show'); }

document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && (e.key === 's' || e.key === 'e')) {
        e.preventDefault();
        try {
            await saveConfig();
        } catch (error) {
            console.error('Erro detalhado ao salvar (Ctrl+S):', error);
            showToast(`Erro: ${error.message}`, 'error');
        }
    }
    if (e.key === '?') { toggleHelp(); }
    if (e.key === 'Escape') { document.getElementById('shortcutsHelp').classList.remove('show'); }
});

document.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => { update(); autoSave(); });
    el.addEventListener('input', function() { this.classList.remove('error'); });
});

document.querySelectorAll('.switch').forEach(sw => {
    sw.addEventListener('click', function() {
        this.classList.toggle('active');
        state.modules[this.dataset.module] = this.classList.contains('active');
        update();
        autoSave();
    });
});