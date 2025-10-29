// ===== ESTADO DA APLICAÇÃO =====
// ✅ OTIMIZADO: Removida variável não utilizada expandedProductId
let state = {
    modules: { sobre: true, produtos: true, contato: true },
    produtos: []
};

let db, storage;
const clientId = 'cliente-001';

// Variável de controle para garantir que loadDataFromFirestore só é chamado uma vez
let dataLoaded = false;

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
// ✅ OTIMIZADO: Função escapeHtml melhorada com proteção completa contra XSS
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    
    // Remove scripts, eventos inline e atributos perigosos
    let cleaned = unsafe
        // Remove tags <script> e seu conteúdo
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove eventos inline (onclick, onload, etc)
        .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        // Remove javascript: URLs
        .replace(/\b(?:javascript|data|vbscript):/gi, 'invalid:')
        // Remove expressões CSS perigosas
        .replace(/expression\s*\(|behavior\s*:|[-a-z]+-binding:/gi, 'invalid:')
        // Remove meta caracteres
        .replace(/<meta\b[^>]*>/gi, '')
        // Remove comentários HTML que podem conter scripts
        .replace(/<!--[\s\S]*?-->/g, '')
        // Remove atributos base href
        .replace(/<base\b[^>]*>/gi, '');

    // Caracteres especiais para escape HTML
    const escapeChars = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    
    // Escapa caracteres especiais
    cleaned = cleaned.replace(/[&<>"'`=]/g, char => escapeChars[char]);
    
    // Sanitização final usando DOMPurify para garantir
    if (typeof DOMPurify !== 'undefined') {
        cleaned = DOMPurify.sanitize(cleaned, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'p', 'br', 'a'],
            ALLOWED_ATTR: ['href', 'target', 'class', 'id', 'style'],
            ALLOW_DATA_ATTR: false,
            ADD_ATTR: ['target="_blank"'],
            FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button'],
            FORBID_ATTR: ['onerror', 'onload', 'onmouseover', 'onclick', 'onfocus'],
            ALLOW_UNKNOWN_PROTOCOLS: false
        });
    }
    
    return cleaned;
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

        // 1. Configura o observador de autenticação
        firebase.auth().onAuthStateChanged(async function(user) {
            if (!user) {
                console.log('Usuário não autenticado, redirecionando...');
                // Se não estiver logado, não há motivo para tentar carregar dados
                // O carregamento será feito ao final da função DOMContentLoaded como fallback
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

            // 2. Carrega os dados APÓS a autenticação bem-sucedida
            if (!dataLoaded) {
                 loadDataFromFirestore();
            }
        });
        
        // CORREÇÃO CRÍTICA: Chama loadDataFromFirestore() após um pequeno atraso. 
        // Isso é necessário porque o onAuthStateChanged pode levar tempo para disparar 
        // ou falhar silenciosamente, deixando o painel vazio.
        setTimeout(() => {
             if (!dataLoaded) {
                 console.log("🔥 Tentativa de carregamento de fallback...");
                 loadDataFromFirestore();
             }
        }, 500);


    } catch (error) {
        console.error('ERRO ao inicializar:', error);
        showToast('Erro ao conectar: ' + error.message, 'error');
        
        // Último recurso: Tenta carregar o que puder com o update padrão
        loadConfig({});
    }
});

state.hasUnsavedChanges = false;

function markAsUnsaved() {
    state.hasUnsavedChanges = true;
    updateSaveStatus();
}

// ✅ OTIMIZADO: Função update() com debounce de 300ms
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

// Importa o debounce do módulo de performance
import { debounce, PerformanceCache } from './performance.js';

// Debounce da função update para otimizar performance
const debouncedUpdate = debounce(update, 300);

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
            
            // NOVO: Se o upload for de uma imagem de produto, atualiza o focuser
            if (targetInputId === 'produtoImagem') {
                 document.getElementById('imageFocuserContainer').style.backgroundImage = `url(${downloadURL})`;
                 // Re-inicializa o focuser para garantir que o ponto seja reposicionado no centro da nova imagem
                 initImageFocuser(document.getElementById('produtoFocoHidden').value); 
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
    if (dataLoaded) return; // Garante que não carregamos duas vezes
    
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
        }

        console.log('✅ Dados carregados!');
        
        let config = clientDoc.data() || {};
        
        if (coresDoc.exists) config.cores = coresDoc.data();
        if (contatoDoc.exists) config.contato = contatoDoc.data();
        if (modulesDoc.exists) config.modules = modulesDoc.data();
        if (sobreDoc.exists) config.sobre = sobreDoc.data();
        if (globalDoc.exists) config.global_settings = globalDoc.data();
        
        config.produtos = produtosSnap.docs.map(doc => doc.data());

        state.modules = config.modules || state.modules;
        state.produtos = config.produtos || state.produtos;
        
        loadConfig(config);
        dataLoaded = true; // Marca o carregamento como concluído
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
        // Uso de verificações defensivas com operador de encadeamento opcional (?)
        logoType: document.getElementById('logoType')?.value || 'text',
        logoImageUrl: document.getElementById('logoImageUrl')?.value || '',
        faviconImageUrl: document.getElementById('faviconImageUrl')?.value || '',
        empresaNome: document.getElementById('empresaNome')?.value || '',
        bannerTitulo: document.getElementById('bannerTitulo')?.value || '',
        bannerSubtitulo: document.getElementById('bannerSubtitulo')?.value || '',
        bannerImagem: document.getElementById('bannerImagem')?.value || '',
        
        global_settings: {
            fontUrl: document.getElementById('fontUrl')?.value || '',
            fontFamily: document.getElementById('fontFamily')?.value || '',
            trackingCode: document.getElementById('trackingCode')?.value || ''
        },
        cores: { 
            primaria: document.getElementById('corPrimaria')?.value || '#007bff', 
            secundaria: document.getElementById('corSecundaria')?.value || '#28a745'
        },
        modules: state.modules,
        sobre: { 
            texto: document.getElementById('sobreTexto')?.value || '', 
            imagem: document.getElementById('sobreImagem')?.value || ''
        },
        produtos: state.produtos,
        contato: {
            telefone: document.getElementById('telefone')?.value || '',
            telefone2: document.getElementById('telefone2')?.value || '',
            email: document.getElementById('email')?.value || '',
            endereco: document.getElementById('endereco')?.value || '',
            mostrarMapa: document.getElementById('mostrarMapa')?.checked || false,
            latitude: parseFloat(document.getElementById('latitude')?.value) || -23.5505,
            longitude: parseFloat(document.getElementById('longitude')?.value) || -46.6333
        }
    };
}

function loadConfig(config) {
    // CORREÇÃO: Verificação defensiva para todos os elementos
    
    const logoTypeInput = document.getElementById('logoType');
    if (!logoTypeInput) {
        console.warn("Elemento 'logoType' não encontrado. O painel pode estar incompleto.");
    }
    
    // Preenchendo campos com verificações defensivas
    if(document.getElementById('empresaNome')) document.getElementById('empresaNome').value = config.empresaNome || '';
    if(document.getElementById('bannerTitulo')) document.getElementById('bannerTitulo').value = config.bannerTitulo || '';
    if(document.getElementById('bannerSubtitulo')) document.getElementById('bannerSubtitulo').value = config.bannerSubtitulo || '';
    if(document.getElementById('bannerImagem')) document.getElementById('bannerImagem').value = config.bannerImagem || '';
    
    
    if (logoTypeInput) {
        const type = config.logoType || 'text';
        logoTypeInput.value = type;
        setLogoType(type); // Chama para atualizar o display dos botões
    }
    
    if(document.getElementById('logoImageUrl')) document.getElementById('logoImageUrl').value = config.logoImageUrl || '';
    
    const logoPreview = document.querySelector('#logoPreview');
    if (logoPreview && config.logoImageUrl) {
        logoPreview.style.backgroundImage = `url(${config.logoImageUrl})`;
    }

    if(document.getElementById('faviconImageUrl')) document.getElementById('faviconImageUrl').value = config.faviconImageUrl || '';
    
    const faviconPreview = document.querySelector('#faviconPreview');
    if (faviconPreview && config.faviconImageUrl) {
        faviconPreview.style.backgroundImage = `url(${config.faviconImageUrl})`;
    }

    if (config.global_settings) {
        if(document.getElementById('fontUrl')) document.getElementById('fontUrl').value = config.global_settings.fontUrl || '';
        if(document.getElementById('fontFamily')) document.getElementById('fontFamily').value = config.global_settings.fontFamily || '';
        if(document.getElementById('trackingCode')) document.getElementById('trackingCode').value = config.global_settings.trackingCode || '';
    }
    
    if (config.cores) {
        if(document.getElementById('corPrimaria')) document.getElementById('corPrimaria').value = config.cores.primaria || '#007bff';
        if(document.getElementById('corSecundaria')) document.getElementById('corSecundaria').value = config.cores.secundaria || '#28a745';
    }
    
    if (config.sobre) {
        if(document.getElementById('sobreTexto')) document.getElementById('sobreTexto').value = config.sobre.texto || '';
        if(document.getElementById('sobreImagem')) document.getElementById('sobreImagem').value = config.sobre.imagem || '';
    }
    
    if (config.modules) {
        Object.keys(config.modules).forEach(module => {
            const sw = document.querySelector(`[data-module="${module}"]`);
            if (sw) sw.classList.toggle('active', config.modules[module]);
        });
    }
    
    if (config.contato) {
        if(document.getElementById('telefone')) document.getElementById('telefone').value = config.contato.telefone || '';
        if(document.getElementById('telefone2')) document.getElementById('telefone2').value = config.contato.telefone2 || '';
        if(document.getElementById('email')) document.getElementById('email').value = config.contato.email || '';
        if(document.getElementById('endereco')) document.getElementById('endereco').value = config.contato.endereco || '';
        
        const mostrarMapaCheckbox = document.getElementById('mostrarMapa');
        if (mostrarMapaCheckbox) {
            mostrarMapaCheckbox.checked = config.contato.mostrarMapa !== false;
        }

        const latInput = document.getElementById('latitude');
        if (latInput) latInput.value = config.contato.latitude || -23.5505;
        
        const lonInput = document.getElementById('longitude');
        if (lonInput) lonInput.value = config.contato.longitude || -46.6333;
        
        const latDisplay = document.getElementById('latitudeDisplay');
        const lonDisplay = document.getElementById('longitudeDisplay');

        if (latDisplay) latDisplay.textContent = (config.contato.latitude || -23.5505).toFixed(4);
        if (lonDisplay) lonDisplay.textContent = (config.contato.longitude || -46.6333).toFixed(4);
        
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
    
    const fontUrl = document.getElementById('fontUrl');
    if (fontUrl && fontUrl.value) {
        let fontLink = document.getElementById('dynamic-font');
        if (!fontLink) {
            fontLink = document.createElement('link');
            fontLink.id = 'dynamic-font';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }
        fontLink.href = fontUrl.value;
    }
    
    const fontFamilyInput = document.getElementById('fontFamily');
    if (fontFamilyInput && fontFamilyInput.value) {
        const previewSite = document.querySelector('.preview .site');
        if (previewSite) previewSite.style.fontFamily = fontFamilyInput.value;
    }

    const logoContainer = document.getElementById('logo');
    const adminLogoIcon = document.getElementById('adminLogoIcon');
    const logoTypeInput = document.getElementById('logoType');
    const empresaNomeInput = document.getElementById('empresaNome');
    const logoImageUrlInput = document.getElementById('logoImageUrl');

    const logoType = logoTypeInput ? logoTypeInput.value : 'text';
    const empresaNome = empresaNomeInput ? empresaNomeInput.value : 'MinhaEmpresa';
    const logoImageUrl = logoImageUrlInput ? logoImageUrlInput.value : '';


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
    const bannerTituloInput = document.getElementById('bannerTitulo');
    if (bannerH1 && bannerTituloInput) bannerH1.textContent = bannerTituloInput.value;

    const bannerP = document.getElementById('bannerP');
    const bannerSubtituloInput = document.getElementById('bannerSubtitulo');
    if (bannerP && bannerSubtituloInput) bannerP.textContent = bannerSubtituloInput.value;

    const banner = document.querySelector('.banner');
    const bannerImagemInput = document.getElementById('bannerImagem');
    if (banner && bannerImagemInput) banner.style.backgroundImage = `url(${bannerImagemInput.value})`;

    const corPrimariaInput = document.getElementById('corPrimaria');
    const corSecundariaInput = document.getElementById('corSecundaria');

    const corPrimaria = corPrimariaInput ? corPrimariaInput.value : '';
    const corSecundaria = corSecundariaInput ? corSecundariaInput.value : '';
    
    const corPrimariaDisplay = document.querySelector('#corPrimaria + input');
    if (corPrimariaDisplay) corPrimariaDisplay.value = corPrimaria;

    const corSecundariaDisplay = document.querySelector('#corSecundaria + input');
    if (corSecundariaDisplay) corSecundariaDisplay.value = corSecundaria;
    
    // NOVO: Atualizar preview do favicon no Admin
    const faviconPreview = document.getElementById('faviconPreview');
    const faviconImageUrlInput = document.getElementById('faviconImageUrl');
    if (faviconPreview && faviconImageUrlInput) {
        faviconPreview.style.backgroundImage = `url(${faviconImageUrlInput.value})`;
    }

    document.querySelectorAll('.site-nav-links a').forEach(a => a.style.color = corPrimaria);
    document.querySelectorAll('.contact-icon').forEach(icon => icon.style.background = corPrimaria);
    
    const ctaBtn = document.querySelector('.cta-btn');
    if (ctaBtn) ctaBtn.style.background = corSecundaria;

    const sobreTextoPreview = document.getElementById('sobreTextoPreview');
    const sobreTextoInput = document.getElementById('sobreTexto');
    if (sobreTextoPreview && sobreTextoInput) sobreTextoPreview.textContent = sobreTextoInput.value;

    const sobreImagemPreview = document.getElementById('sobreImagemPreview');
    const sobreImagemInput = document.getElementById('sobreImagem');
    if (sobreImagemPreview && sobreImagemInput) sobreImagemPreview.style.backgroundImage = `url(${sobreImagemInput.value})`;

    const telPreview = document.getElementById('telPreview');
    const telInput = document.getElementById('telefone');
    if (telPreview && telInput) telPreview.textContent = telInput.value;

    const telPreview2 = document.getElementById('telPreview2');
    const telInput2 = document.getElementById('telefone2');
    if (telPreview2 && telInput2) telPreview2.textContent = telInput2.value;

    const emailPreview = document.getElementById('emailPreview');
    const emailInput = document.getElementById('email');
    if (emailPreview && emailInput) emailPreview.textContent = emailInput.value;

    const enderecoPreview = document.getElementById('enderecoPreview');
    const enderecoInput = document.getElementById('endereco');
    if (enderecoPreview && enderecoInput) enderecoPreview.textContent = enderecoInput.value;

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
                <div class="product-image" style="background-image: url(${escapeHtml(p.imagem || 'https://via.placeholder.com/400')}); background-position: ${escapeHtml(p.foco || 'center')};"></div>
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

// ===== IMAGE FOCUS DRAG LOGIC (Mantido para Contexto) =====
function initImageFocuser(initialFoco = '50% 50%') {
    const container = document.getElementById('imageFocuserContainer');
    const target = document.getElementById('focusTarget');
    const hiddenInput = document.getElementById('produtoFocoHidden');
    const display = document.getElementById('focusPositionDisplay');

    if (!container || !target || !hiddenInput || !display) return;

    let isDragging = false;
    const targetSize = 24; // Tamanho do ponto de foco

    function updateFoco(x, y) {
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // Ajusta as coordenadas para estarem dentro do contêiner, considerando o tamanho do ponto de foco
        let newX = Math.max(targetSize / 2, Math.min(x, containerWidth - targetSize / 2));
        let newY = Math.max(targetSize / 2, Math.min(y, containerHeight - targetSize / 2));
        
        // Atualiza a posição do ponto (considerando o translate(-50%, -50%) no CSS)
        target.style.left = `${newX}px`;
        target.style.top = `${newY}px`;

        // Calcula a porcentagem do foco (Background Position)
        const focusX = Math.round(((newX - targetSize / 2) / (containerWidth - targetSize)) * 100);
        const focusY = Math.round(((newY - targetSize / 2) / (containerHeight - targetSize)) * 100);
        
        const safeFocusX = Math.max(0, Math.min(100, focusX));
        const safeFocusY = Math.max(0, Math.min(100, focusY));
        
        const focoValue = `${safeFocusX}% ${safeFocusY}%`;
        
        hiddenInput.value = focoValue;
        display.textContent = focoValue;
        
        // Aplica o foco na pré-visualização do container
        container.style.backgroundPosition = focoValue;
    }

    function startDrag(e) {
        e.preventDefault();
        isDragging = true;
        target.style.cursor = 'grabbing';
    }

    function onDrag(e) {
        if (!isDragging) return;

        const containerRect = container.getBoundingClientRect();
        
        // Obtém a posição do mouse/toque relativa ao container
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        const x = clientX - containerRect.left;
        const y = clientY - containerRect.top;

        updateFoco(x, y);
    }

    function endDrag() {
        if (isDragging) {
            isDragging = false;
            target.style.cursor = 'grab';
            markAsUnsaved();
            update();
        }
    }

    // Remove listeners antigos antes de adicionar novos (para evitar duplicação)
    target.removeEventListener('mousedown', startDrag);
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    target.removeEventListener('touchstart', startDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', endDrag);

    // Eventos de Mouse
    target.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);

    // Eventos de Toque
    target.addEventListener('touchstart', startDrag);
    document.addEventListener('touchmove', onDrag);
    document.addEventListener('touchend', endDrag);
    
    // Inicializa a posição do foco (o foco é dado em X% Y%)
    const [initialX, initialY] = initialFoco.split(' ').map(v => parseFloat(v) / 100);

    // Posição inicial em pixels
    const initialContainerRect = container.getBoundingClientRect();
    const initialX_px = initialX * (initialContainerRect.width - targetSize) + targetSize / 2;
    const initialY_px = initialY * (initialContainerRect.height - targetSize) + targetSize / 2;
    
    updateFoco(initialX_px, initialY_px);
}
// FIM IMAGE FOCUS DRAG LOGIC


function openProdutoModal(index) {
    const modal = document.getElementById('produtoModal');
    const title = document.getElementById('produtoModalTitle');
    const idInput = document.getElementById('produtoId');
    const nomeInput = document.getElementById('produtoNome');
    const precoInput = document.getElementById('produtoPreco');
    const descricaoInput = document.getElementById('produtoDescricao');
    const imagemInput = document.getElementById('produtoImagem');
    const focoHidden = document.getElementById('produtoFocoHidden');
    const focuserContainer = document.getElementById('imageFocuserContainer');

    title.textContent = 'Adicionar Produto';
    idInput.value = '';
    nomeInput.value = '';
    precoInput.value = '';
    descricaoInput.value = '';
    imagemInput.value = '';
    focoHidden.value = '50% 50%'; // Define o padrão

    // Inicializa a visualização do focuser
    const placeholderUrl = 'https://via.placeholder.com/400';
    focuserContainer.style.backgroundImage = `url(${placeholderUrl})`;
    initImageFocuser('50% 50%');


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
    const focoHidden = document.getElementById('produtoFocoHidden');
    const focuserContainer = document.getElementById('imageFocuserContainer');


    const produto = state.produtos[index];
    
    // NOVO: Carrega o foco do produto, usando '50% 50%' como fallback para produtos antigos
    const produtoFoco = produto.foco || '50% 50%'; 

    title.textContent = 'Editar Produto';
    idInput.value = index;
    nomeInput.value = produto.nome;
    precoInput.value = produto.preco;
    descricaoInput.value = produto.descricao || '';
    imagemInput.value = produto.imagem || '';
    
    // Carrega o foco no campo oculto
    focoHidden.value = produtoFoco;

    // Inicializa a visualização do focuser com a imagem e foco corretos
    const imageUrl = produto.imagem || 'https://via.placeholder.com/400';
    focuserContainer.style.backgroundImage = `url(${imageUrl})`;
    initImageFocuser(produtoFoco);


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
    const foco = document.getElementById('produtoFocoHidden').value; // NOVO: Captura o foco

    if (!nome || !preco) {
        showToast('Nome e preço são obrigatórios.', 'error');
        return;
    }

    const produto = { 
        nome, 
        preco, 
        descricao, 
        imagem: imagem || 'https://via.placeholder.com/400',
        foco: foco // Salva o valor de foco
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

// ===== EXPOSIÇÃO GLOBAL (necessário para inline event handlers) =====
// Expondo funções para serem acessíveis globalmente pelo HTML
window.handleImageUpload = handleImageUpload;
window.openProdutoModal = openProdutoModal;
window.closeProdutoModal = closeProdutoModal;
window.saveProduto = saveProduto;
window.setLogoType = setLogoType;
window.logout = logout;
window.toggleHelp = toggleHelp;
window.saveConfig = saveConfig;
window.editarProduto = editarProduto;
window.removerProduto = removerProduto;
window.buscarEnderecoMapa = buscarEnderecoMapa;
window.usarLocalizacaoAtual = usarLocalizacaoAtual;