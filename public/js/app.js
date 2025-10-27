// ===== ESTADO DA APLICAÇÃO =====
let state = {
    modules: { sobre: true, produtos: true, contato: true },
    produtos: []
};

let expandedProductId = null;
let db, storage;
const clientId = 'cliente-001';

// ===== RATE LIMITERS =====
const SaveRateLimiter = {
    lastSave: 0,
    minInterval: 2000,
    
    canSave() {
        const now = Date.now();
        if (now - this.lastSave < this.minInterval) {
            return false;
        }
        this.lastSave = now;
        return true;
    },
    
    getRemainingTime() {
        const elapsed = Date.now() - this.lastSave;
        const remaining = Math.ceil((this.minInterval - elapsed) / 1000);
        return Math.max(0, remaining);
    }
};

const FirestoreRateLimiter = {
    operations: [],
    maxOps: 10,
    windowMs: 60000,
    
    canOperate() {
        const now = Date.now();
        this.operations = this.operations.filter(time => now - time < this.windowMs);
        
        if (this.operations.length >= this.maxOps) {
            return false;
        }
        
        this.operations.push(now);
        return true;
    }
};

// ===== MONITORAMENTO DE SESSÃO =====
const SessionMonitor = {
    lastActivity: Date.now(),
    timeout: 30 * 60 * 1000,
    
    init() {
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => this.updateActivity(), true);
        });
        
        setInterval(() => this.check(), 60000);
    },
    
    updateActivity() {
        this.lastActivity = Date.now();
    },
    
    check() {
        if (Date.now() - this.lastActivity > this.timeout) {
            firebase.auth().signOut();
            showToast('Sessão expirada por inatividade', 'warning');
            window.location.href = 'login.html';
        }
    }
};

// ===== PROTEÇÃO CONTRA CLICKJACKING =====
if (window.self !== window.top) {
    window.top.location = window.self.location;
}

// ===== HELPERS DE SEGURANÇA =====
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    
    const cleaned = unsafe
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
    
    const div = document.createElement('div');
    div.textContent = cleaned;
    return div.innerHTML;
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operação excedeu o tempo limite')), ms)
        )
    ]);
}

function validateCoordinates(lat, lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Coordenadas inválidas');
    }
    
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('Coordenadas fora do intervalo válido');
    }
    
    return { latitude, longitude };
}

async function validateImageFile(file) {
    if (!file.type.startsWith('image/')) {
        throw new Error('Arquivo não é uma imagem válida');
    }
    
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('Imagem muito grande! Máximo 5MB');
    }
    
    // Validar magic bytes (assinatura real do arquivo)
    const buffer = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Assinaturas de magic bytes mais robustas (incluindo SVG)
    const validSignatures = {
        'ffd8ff': 'image/jpeg',      // JPEG/JFIF (3 bytes)
        '89504e47': 'image/png',      // PNG
        '47494638': 'image/gif',      // GIF
        '52494646': 'image/webp',     // RIFF/WebP (4 bytes)
        '3c3f786d': 'image/svg+xml',  // SVG (starts with <?xml)
        '3c737667': 'image/svg+xml'   // SVG (starts with <svg)
    };
    
    const isValid = Object.keys(validSignatures).some(sig => hex.startsWith(sig));
    
    if (!isValid) {
        throw new Error('Formato de imagem não suportado ou arquivo corrompido');
    }
}

function sanitizeLogData(data) {
    const sanitized = JSON.parse(JSON.stringify(data));
    if (sanitized.contato && sanitized.contato.email) {
        sanitized.contato.email = '***@***.com';
    }
    return sanitized;
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async function() {
    if (typeof firebase === 'undefined') {
        console.error('ERRO: Firebase não foi carregado.');
        showToast('Firebase não configurado.', 'error');
        return;
    }

    try {
        if (!firebase.apps.length) {
            console.log('Inicializando Firebase...');
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase inicializado com sucesso!');
        }
        
        db = firebase.firestore();
        storage = firebase.storage();

        firebase.auth().onAuthStateChanged(async function(user) {
            if (!user) {
                console.log('Usuário não autenticado, redirecionando...');
                window.location.href = 'login.html';
                return;
            }

            SessionMonitor.init();

            try {
                if (typeof Appwrite === 'undefined') {
                    await new Promise(resolve => {
                        window.addEventListener('appwriteReady', resolve, { once: true });
                    });
                }

                const account = new Appwrite.Account(window.appwriteClient);
                
                try {
                    await account.createAnonymousSession();
                    console.log('✅ Sessão Appwrite criada');
                } catch (error) {
                    if (error.code !== 401) {
                        console.log('ℹ️ Sessão Appwrite já existe');
                    }
                }
            } catch (error) {
                console.warn('⚠️ Appwrite:', error.message);
            }

            loadDataFromFirestore();
        });
        
    } catch (error) {
        console.error('ERRO ao inicializar:', error);
        showToast('Erro ao conectar: ' + error.message, 'error');
    }
});

state.hasUnsavedChanges = false;

function markAsUnsaved() {
    state.hasUnsavedChanges = true;
    updateSaveStatus();
}

function updateSaveStatus() {
    const saveStatus = document.getElementById('saveStatus');
    const saveText = document.getElementById('saveText');
    
    if (!saveStatus || !saveText) return;
    
    if (state.hasUnsavedChanges) {
        saveStatus.className = 'save-status unsaved';
        saveText.innerHTML = '⚫ Mudanças não salvas';
    } else {
        saveStatus.className = 'save-status saved';
        saveText.textContent = '✓ Salvo';
    }
}

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

    try {
        await validateImageFile(file);
        
        showToast('Comprimindo imagem...', 'info');
        const compressedFile = await compressImage(file);

        showToast(`Fazendo upload de ${file.name}...`, 'info');
        
        const promise = appwriteStorage.createFile(
            '68f04fe50018c9e1abc4',
            'unique()',
            compressedFile
        );

        promise.then(function (response) {
            const fileId = response.$id;
            const viewResult = appwriteStorage.getFileView('68f04fe50018c9e1abc4', fileId);
            const downloadURL = viewResult.href;

            document.getElementById(targetInputId).value = downloadURL;
            if (previewSelector) {
                document.querySelector(previewSelector).style.backgroundImage = `url(${downloadURL})`;
            }
            
            showToast('Upload concluído!', 'success');
            update();
            markAsUnsaved();

        }, function (error) {
            console.error("Erro no upload: ", error);
            showToast('Falha no upload: ' + error.message, 'error');
        });

    } catch (error) {
        console.error("Erro:", error);
        showToast(error.message, 'error');
        event.target.value = '';
    }
}

// ===== FIRESTORE =====
async function loadDataFromFirestore() {
    if (!db) {
        console.error('Firestore não inicializado!');
        showToast('Erro: Banco não conectado.', 'error');
        return;
    }

    if (!FirestoreRateLimiter.canOperate()) {
        showToast('Muitas operações. Aguarde.', 'warning');
        return;
    }

    const clientDocRef = db.collection('site').doc(clientId);
    console.log('Carregando dados:', clientId);
    showToast('Carregando dados...', 'info');

    try {
        const [clientDoc, coresDoc, contatoDoc, modulesDoc, sobreDoc, globalDoc, produtosSnap] = await withTimeout(
            Promise.all([
                clientDocRef.get(),
                clientDocRef.collection('cores').doc('data').get(),
                clientDocRef.collection('contato').doc('data').get(),
                clientDocRef.collection('modules').doc('data').get(),
                clientDocRef.collection('sobre').doc('data').get(),
                clientDocRef.collection('global_settings').doc('data').get(),
                clientDocRef.collection('produtos').get()
            ]),
            10000
        );
        
        if (!clientDoc.exists) {
            console.warn('Cliente não encontrado.');
            showToast('Usando modelo padrão.', 'info');
            update();
            return;
        }

        console.log('✅ Dados carregados!');
        
        let config = clientDoc.data();
        
        if (coresDoc.exists) config.cores = coresDoc.data();
        if (contatoDoc.exists) config.contato = contatoDoc.data();
        if (modulesDoc.exists) config.modules = modulesDoc.data();
        if (sobreDoc.exists) config.sobre = sobreDoc.data();
        if (globalDoc.exists) config.global_settings = globalDoc.data();
        
        config.produtos = produtosSnap.docs.map(doc => doc.data());

        state.modules = config.modules || state.modules;
        state.produtos = config.produtos || state.produtos;
        loadConfig(config);
        showToast('Dados carregados!', 'success');

    } catch (error) {
        if (error.message.includes('tempo limite')) {
            showToast('Servidor demorou muito. Tente novamente.', 'error');
        } else {
            console.error("Erro:", error);
            showToast('Erro ao carregar: ' + error.message, 'error');
        }
        update();
    }
}

async function saveConfig() {
    if (!validateForm()) {
        showToast('Corrija os erros antes de salvar', 'error');
        return;
    }

    if (!SaveRateLimiter.canSave()) {
        const remaining = SaveRateLimiter.getRemainingTime();
        showToast(`Aguarde ${remaining}s`, 'warning');
        return;
    }

    if (!FirestoreRateLimiter.canOperate()) {
        showToast('Muitas operações. Aguarde.', 'warning');
        return;
    }

    if (!db) {
        showToast('Erro: Banco não conectado.', 'error');
        return;
    }

    showSaving();
    const config = getConfig();
    console.log('Salvando:', sanitizeLogData(config));
    
    const batch = db.batch();
    const clientDocRef = db.collection('site').doc(clientId);

    batch.set(clientDocRef, {
        empresaNome: config.empresaNome,
        bannerTitulo: config.bannerTitulo,
        bannerSubtitulo: config.bannerSubtitulo,
        bannerImagem: config.bannerImagem,
        logoType: config.logoType,
        logoImageUrl: config.logoImageUrl,
        // NOVO: Adiciona o Favicon
        faviconImageUrl: config.faviconImageUrl
    }, { merge: true });

    batch.set(clientDocRef.collection('global_settings').doc('data'), config.global_settings);
    batch.set(clientDocRef.collection('cores').doc('data'), config.cores);
    batch.set(clientDocRef.collection('contato').doc('data'), config.contato);
    batch.set(clientDocRef.collection('modules').doc('data'), config.modules);
    batch.set(clientDocRef.collection('sobre').doc('data'), config.sobre);

    const produtosRef = clientDocRef.collection('produtos');
    try {
        const oldProdutos = await withTimeout(produtosRef.get(), 5000);
        oldProdutos.forEach(doc => batch.delete(doc.ref));
        
        config.produtos.forEach(produto => {
            const newProdRef = produtosRef.doc();
            batch.set(newProdRef, produto);
        });

        await withTimeout(batch.commit(), 10000);
        console.log('✅ Salvo!');
        state.hasUnsavedChanges = false;
        updateSaveStatus();
        showSaved();
        showToast('Site atualizado!', 'success');

    } catch (error) {
        if (error.message.includes('tempo limite')) {
            showToast('Tempo excedido. Tente novamente.', 'error');
        } else {
            console.error("Erro:", error);
            showToast('Erro ao salvar: ' + error.message, 'error');
        }
    }
}

// ===== UI E ESTADO =====
function setLogoType(type) {
    // CORREÇÃO: Lógica para os botões e campo hidden
    const imageGroup = document.getElementById('logoImageInputGroup');
    const textBtn = document.getElementById('logoTypeTextBtn');
    const imageBtn = document.getElementById('logoTypeImageBtn');
    const logoTypeInput = document.getElementById('logoType'); // Campo oculto

    if (imageGroup && logoTypeInput) {
        logoTypeInput.value = type; // Salva o valor no campo oculto
        
        if (type === 'text') {
            imageGroup.classList.add('hidden');
        } else {
            imageGroup.classList.remove('hidden');
        }
    }
    
    // Atualiza classes dos botões (se existirem)
    if (textBtn) {
        textBtn.classList.toggle('active', type === 'text');
    }
    if (imageBtn) {
        imageBtn.classList.toggle('active', type === 'image');
    }
    
    markAsUnsaved();
    update();
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
        // NOVO: Favicon
        faviconImageUrl: document.getElementById('faviconImageUrl').value,
        empresaNome: document.getElementById('empresaNome').value,
        bannerTitulo: document.getElementById('bannerTitulo').value,
        bannerSubtitulo: document.getElementById('bannerSubtitulo').value,
        bannerImagem: document.getElementById('bannerImagem').value,
        global_settings: {
            fontUrl: document.getElementById('fontUrl').value,
            fontFamily: document.getElementById('fontFamily').value,
            trackingCode: document.getElementById('trackingCode').value
        },
        cores: { 
            primaria: document.getElementById('corPrimaria').value, 
            secundaria: document.getElementById('corSecundaria').value 
        },
        modules: state.modules,
        sobre: { 
            texto: document.getElementById('sobreTexto').value, 
            imagem: document.getElementById('sobreImagem').value 
        },
        produtos: state.produtos,
        contato: {
            telefone: document.getElementById('telefone').value,
            telefone2: document.getElementById('telefone2').value,
            email: document.getElementById('email').value,
            endereco: document.getElementById('endereco').value,
            mostrarMapa: document.getElementById('mostrarMapa').checked,
            latitude: parseFloat(document.getElementById('latitude').value) || -23.5505,
            longitude: parseFloat(document.getElementById('longitude').value) || -46.6333
        }
    };
}

function loadConfig(config) {
    document.getElementById('empresaNome').value = config.empresaNome || '';
    document.getElementById('bannerTitulo').value = config.bannerTitulo || '';
    document.getElementById('bannerSubtitulo').value = config.bannerSubtitulo || '';
    document.getElementById('bannerImagem').value = config.bannerImagem || '';
    
    // ATUALIZADO: setLogoType usa o valor do campo oculto (que é atualizado pelos botões)
    const logoTypeInput = document.getElementById('logoType');
    const type = config.logoType || 'text';
    logoTypeInput.value = type;
    setLogoType(type); // Chama para atualizar o display dos botões
    
    document.getElementById('logoImageUrl').value = config.logoImageUrl || '';
    if (config.logoImageUrl) {
        document.querySelector('#logoPreview').style.backgroundImage = `url(${config.logoImageUrl})`;
    }

    // NOVO: Carregar Favicon
    document.getElementById('faviconImageUrl').value = config.faviconImageUrl || '';
    if (config.faviconImageUrl) {
        document.querySelector('#faviconPreview').style.backgroundImage = `url(${config.faviconImageUrl})`;
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
    
    if (config.modules) {
        Object.keys(config.modules).forEach(module => {
            const sw = document.querySelector(`[data-module="${module}"]`);
            if (sw) sw.classList.toggle('active', config.modules[module]);
        });
    }
    
    if (config.contato) {
        document.getElementById('telefone').value = config.contato.telefone || '';
        document.getElementById('telefone2').value = config.contato.telefone2 || '';
        document.getElementById('email').value = config.contato.email || '';
        document.getElementById('endereco').value = config.contato.endereco || '';
        document.getElementById('mostrarMapa').checked = config.contato.mostrarMapa !== false;
        
        document.getElementById('latitude').value = config.contato.latitude || -23.5505;
        document.getElementById('longitude').value = config.contato.longitude || -46.6333;
        document.getElementById('latitudeDisplay').textContent = (config.contato.latitude || -23.5505).toFixed(4);
        document.getElementById('longitudeDisplay').textContent = (config.contato.longitude || -46.6333).toFixed(4);
        
        setTimeout(() => {
            if (typeof mapAdmin !== 'undefined' && mapAdmin) {
                latitudeAtual = config.contato.latitude || -23.5505;
                longitudeAtual = config.contato.longitude || -46.6333;
                mapAdmin.setView([latitudeAtual, longitudeAtual], 15);
                markerAdmin.setLatLng([latitudeAtual, longitudeAtual]);
            }
        }, 500);
    }

    update();
}

function update() {
    console.log('🔄 Atualizando preview...');
    
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
    const adminLogoIcon = document.getElementById('adminLogoIcon');
    const logoType = document.getElementById('logoType').value;
    const empresaNome = document.getElementById('empresaNome').value;
    const logoImageUrl = document.getElementById('logoImageUrl').value;


    if (logoContainer) {
        logoContainer.innerHTML = '';
        if (logoType === 'image') {
            if (logoImageUrl) {
                const img = document.createElement('img');
                img.src = logoImageUrl;
                img.style.maxHeight = '50px';
                logoContainer.appendChild(img);
            } else {
                logoContainer.textContent = empresaNome;
            }
        } else {
            logoContainer.textContent = empresaNome;
        }
    }

    // ATUALIZADO: Atualizar Logo no Cabeçalho do Admin
    if (adminLogoIcon) {
        adminLogoIcon.innerHTML = '';
        if (logoType === 'image' && logoImageUrl) {
            const img = document.createElement('img');
            img.src = logoImageUrl;
            img.alt = 'Logo Admin';
            img.style.height = '24px'; 
            img.style.verticalAlign = 'middle'; 
            img.style.marginRight = '8px';
            adminLogoIcon.appendChild(img);
        } else {
            // Se for texto ou sem imagem, mantém o ícone de engrenagem original
            adminLogoIcon.textContent = '⚙️';
        }
    }


    const footerNome = document.getElementById('footerNome');
    if (footerNome) footerNome.textContent = empresaNome;

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
    
    // NOVO: Atualizar preview do favicon no Admin
    const faviconPreview = document.getElementById('faviconPreview');
    if (faviconPreview) {
        faviconPreview.style.backgroundImage = `url(${document.getElementById('faviconImageUrl').value})`;
    }

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

// ===== PRODUTOS =====
function renderProdutos() {
    const grid = document.getElementById('produtosGrid');
    if(grid) {
        grid.innerHTML = state.produtos.map(p => `
            <div class="product-card">
                <div class="product-image" style="background-image: url(${escapeHtml(p.imagem || 'https://via.placeholder.com/400')})"></div>
                <div class="product-info">
                    <h3>${escapeHtml(p.nome)}</h3>
                    <div class="product-price">${escapeHtml(p.preco)}</div>
                    <p>${escapeHtml(p.descricao || '')}</p>
                </div>
            </div>
        `).join('');
    }
    
    const list = document.getElementById('produtosList');
    if(list) {
        list.innerHTML = state.produtos.map((p, i) => `
            <div style="background: #f8f9fa; padding: 0.8rem; border-radius: 4px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${escapeHtml(p.nome)}</strong><br>
                    <small>${escapeHtml(p.preco)}</small>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" style="width: auto; padding: 0.4rem 0.8rem; margin: 0; font-size: 0.8rem;" onclick="editarProduto(${i})">✏️ Editar</button>
                    <button class="btn btn-primary" style="width: auto; padding: 0.4rem 0.8rem; margin: 0; font-size: 0.8rem; background: #dc3545;" onclick="removerProduto(${i})">🗑️</button>
                </div>
            </div>
        `).join('');
    }
}

function openProdutoModal(index) {
    const modal = document.getElementById('produtoModal');
    const title = document.getElementById('produtoModalTitle');
    const idInput = document.getElementById('produtoId');
    const nomeInput = document.getElementById('produtoNome');
    const precoInput = document.getElementById('produtoPreco');
    const descricaoInput = document.getElementById('produtoDescricao');
    const imagemInput = document.getElementById('produtoImagem');

    title.textContent = 'Adicionar Produto';
    idInput.value = '';
    nomeInput.value = '';
    precoInput.value = '';
    descricaoInput.value = '';
    imagemInput.value = '';

    modal.style.display = 'block';
}

function editarProduto(index) {
    const modal = document.getElementById('produtoModal');
    const title = document.getElementById('produtoModalTitle');
    const idInput = document.getElementById('produtoId');
    const nomeInput = document.getElementById('produtoNome');
    const precoInput = document.getElementById('produtoPreco');
    const descricaoInput = document.getElementById('produtoDescricao');
    const imagemInput = document.getElementById('produtoImagem');

    const produto = state.produtos[index];
    
    title.textContent = 'Editar Produto';
    idInput.value = index;
    nomeInput.value = produto.nome;
    precoInput.value = produto.preco;
    descricaoInput.value = produto.descricao || '';
    imagemInput.value = produto.imagem || '';

    modal.style.display = 'block';
}

function closeProdutoModal() {
    document.getElementById('produtoModal').style.display = 'none';
}

function saveProduto() {
    const id = document.getElementById('produtoId').value;
    const nome = document.getElementById('produtoNome').value.trim();
    const preco = document.getElementById('produtoPreco').value.trim();
    const descricao = document.getElementById('produtoDescricao').value.trim();
    const imagem = document.getElementById('produtoImagem').value.trim();

    if (!nome || !preco) {
        showToast('Nome e preço são obrigatórios.', 'error');
        return;
    }

    const produto = { 
        nome, 
        preco, 
        descricao, 
        imagem: imagem || 'https://via.placeholder.com/400' 
    };

    if (id !== '') {
        state.produtos[parseInt(id)] = produto;
        showToast('Produto atualizado!', 'success');
    } else {
        state.produtos.push(produto);
        showToast('Produto adicionado!', 'success');
    }

    renderProdutos();
    markAsUnsaved();
    closeProdutoModal();
}

function removerProduto(index) {
    if (confirm('Tem certeza que deseja remover este produto?')) {
        state.produtos.splice(index, 1);
        renderProdutos();
        markAsUnsaved();
        showToast('Produto removido', 'info');
    }
}

// ===== BUSCAR ENDEREÇO =====
async function buscarEnderecoMapa() {
    const endereco = document.getElementById('endereco').value.trim();

    if (!endereco) {
        showToast('Digite um endereço primeiro', 'error');
        return;
    }

    if (endereco.length > 200) {
        showToast('Endereço muito longo', 'error');
        return;
    }

    showToast('Buscando endereço...', 'info');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1`,
            {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'SiteBuilderCMS/1.0'
                }
            }
        );
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const dados = await response.json();

        if (dados.length === 0) {
            showToast('Endereço não encontrado', 'error');
            return;
        }

        const resultado = dados[0];
        const coords = validateCoordinates(resultado.lat, resultado.lon);

        mapAdmin.setView([coords.latitude, coords.longitude], 15);
        markerAdmin.setLatLng([coords.latitude, coords.longitude]);
        atualizarCoordenadas(coords.latitude, coords.longitude);

        showToast('Localização encontrada!', 'success');

    } catch (error) {
        if (error.name === 'AbortError') {
            showToast('Busca demorou muito tempo', 'error');
        } else {
            console.error('Erro ao buscar endereço:', error);
            showToast('Erro ao buscar endereço: ' + error.message, 'error');
        }
    }
}

function usarLocalizacaoAtual() {
    if (!navigator.geolocation) {
        showToast('Geolocalização não suportada', 'error');
        return;
    }

    showToast('Obtendo sua localização...', 'info');

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            mapAdmin.setView([lat, lng], 15);
            markerAdmin.setLatLng([lat, lng]);
            atualizarCoordenadas(lat, lng);

            showToast('Localização atualizada! ✅', 'success');
        },
        function (error) {
            console.error('Erro ao obter localização:', error);
            showToast('Erro ao obter localização: ' + error.message, 'error');
        }
    );
}

function atualizarCoordenadas(lat, lng) {
    latitudeAtual = lat;
    longitudeAtual = lng;

    document.getElementById('latitude').value = lat.toFixed(4);
    document.getElementById('longitude').value = lng.toFixed(4);

    document.getElementById('latitudeDisplay').textContent = lat.toFixed(4);
    document.getElementById('longitudeDisplay').textContent = lng.toFixed(4);

    console.log(`📍 Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

    markAsUnsaved();
    update();
}

// ===== ATALHOS E EVENTOS =====
function toggleHelp() { 
    document.getElementById('shortcutsHelp').classList.toggle('show'); 
}

document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && (e.key === 's' || e.key === 'e')) {
        e.preventDefault();
        try {
            await saveConfig();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            showToast(`Erro: ${error.message}`, 'error');
        }
    }
    if (e.key === '?') { toggleHelp(); }
    if (e.key === 'Escape') { 
        document.getElementById('shortcutsHelp').classList.remove('show');
        closeProdutoModal();
    }
});

document.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('change', () => { 
        markAsUnsaved();
        update();
    });
    
    el.addEventListener('input', () => { 
        update(); 
    });
    
    el.addEventListener('input', function() { 
        this.classList.remove('error'); 
    });
});

document.querySelectorAll('.switch').forEach(sw => {
    sw.addEventListener('click', function() {
        this.classList.toggle('active');
        state.modules[this.dataset.module] = this.classList.contains('active');
        update();
        markAsUnsaved();
    });
});

// Alerta ao sair com mudanças não salvas
window.addEventListener('beforeunload', (e) => {
    if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

updateSaveStatus();