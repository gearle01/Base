console.log('📝 [app.js] Script carregado');

// ===== ESTADO DA APLICAÇÃO =====
'use strict';

// ✅ OTIMIZADO: Estado inicial da aplicação
if (typeof window.state === 'undefined') {
    window.state = {
        modules: { sobre: true, produtos: true, contato: true },
        produtos: [],
        socialLinks: []
    };
}

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
        console.log('🔄 [SessionMonitor] Inicializando...');
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
            console.warn('⚠️ [SessionMonitor] Sessão expirada por inatividade.');
            window.authManager.logout(); // Usa o authManager para logout
            showToast('Sessão expirada por inatividade', 'warning');
            // O AuthManager cuidará do redirecionamento
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
            ADD_ATTR: ['target=\"_blank\"'],
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

// Nova função para inicializar o app após autenticação
async function initializeApp(user) {
    console.log('🔄 [app.js] initializeApp chamado para usuário:', user.email);
    try {
        if (typeof firebase === 'undefined') {
            console.error('❌ [app.js] Firebase não está disponível em initializeApp.');
            showToast('Erro: Firebase não configurado.', 'error');
            return;
        }

        db = firebase.firestore();
        storage = firebase.storage();
        console.log('✅ [app.js] Firestore e Storage inicializados.');

        SessionMonitor.init();
        console.log('✅ [app.js] SessionMonitor inicializado.');

        // Tenta usar Appwrite (mantém lógica existente)
        try {
            if (typeof Appwrite === 'undefined') {
                await new Promise(resolve => {
                    window.addEventListener('appwriteReady', resolve, { once: true });
                });
            }

            const account = new Appwrite.Account(window.appwriteClient);

            try {
                await account.createAnonymousSession();
                console.log('✅ [app.js] Sessão Appwrite criada');
            } catch (error) {
                if (error.code !== 401) {
                    console.log('ℹ️ [app.js] Sessão Appwrite já existe ou outro erro:', error.message);
                }
            }
        } catch (error) {
            console.warn('⚠️ [app.js] Appwrite:', error.message);
        }

        await loadDataFromFirestore();
        console.log('✅ [app.js] Dados carregados do Firestore.');

    } catch (error) {
        console.error('❌ [app.js] ERRO ao inicializar o aplicativo:', error);
        showToast('Erro ao conectar: ' + error.message, 'error');
        loadConfig({}); // Tenta carregar o que puder com o update padrão
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 [app.js] DOM carregado');

    if (!window.authManager) {
        console.error('❌ [app.js] Auth Manager não está disponível.');
        showToast('Erro: Gerenciador de autenticação não carregado.', 'error');
        return;
    }
    console.log('✅ [app.js] Auth Manager está disponível.');

    // Aguarda o estado de autenticação ser resolvido pelo AuthManager
    const user = await window.authManager.waitUntilReady();

    if (user) {
        console.log('✅ [app.js] Usuário autenticado via AuthManager:', user.email);
        initializeApp(user); // Inicializa o restante do app

        // Attach event listener for addSocialLink button
        const addSocialLinkBtn = document.getElementById('addSocialLinkBtn');
        if (addSocialLinkBtn) {
            addSocialLinkBtn.addEventListener('click', addSocialLink);
        }

    } else {
        console.log('❌ [app.js] Usuário não autenticado, saindo...');
        // O AuthManager já cuidou do redirecionamento para login.html se necessário
        showToast('Sessão expirada ou não autenticada.', 'warning');
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

// Função de debounce local
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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

            // Atualiza e salva automaticamente se for link social
            if (window.state && window.state.socialLinks) {
                renderSocialLinks();
                saveConfig();
            }

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
    console.log('🔄 [app.js] loadDataFromFirestore chamado.');

    if (!db) {
        console.error('❌ [app.js] Firestore não inicializado!');
        showToast('Erro: Banco não conectado.', 'error');
        return;
    }

    if (!FirestoreRateLimiter.canOperate()) {
        showToast('Muitas operações. Aguarde.', 'warning');
        return;
    }

    const clientDocRef = db.collection('site').doc(clientId);
    console.log('🔄 [app.js] Carregando dados para cliente:', clientId);
    showToast('Carregando dados...', 'info');

    try {
        const [clientDoc, coresDoc, contatoDoc, modulesDoc, sobreDoc, globalDoc, produtosSnap, socialLinksDoc] = await withTimeout(
            Promise.all([
                clientDocRef.get(),
                clientDocRef.collection('cores').doc('data').get(),
                clientDocRef.collection('contato').doc('data').get(),
                clientDocRef.collection('modules').doc('data').get(),
                clientDocRef.collection('sobre').doc('data').get(),
                clientDocRef.collection('global_settings').doc('data').get(),
                clientDocRef.collection('produtos').get(),
                clientDocRef.collection('social_links').doc('data').get()
            ]),
            10000
        );

        if (!clientDoc.exists) {
            console.warn('⚠️ [app.js] Cliente não encontrado. Usando modelo padrão.');
            showToast('Usando modelo padrão.', 'info');
        }

        console.log('✅ [app.js] Dados carregados do Firestore!');

        let config = clientDoc.data() || {};

        if (coresDoc.exists) config.cores = coresDoc.data();
        if (contatoDoc.exists) config.contato = contatoDoc.data();
        if (modulesDoc.exists) config.modules = modulesDoc.data();
        if (sobreDoc.exists) config.sobre = sobreDoc.data();
        if (globalDoc.exists) config.global_settings = globalDoc.data();
        if (produtosSnap) config.produtos = produtosSnap.docs.map(doc => doc.data());
        // Carrega os dados das redes sociais
        try {
            if (socialLinksDoc && socialLinksDoc.exists) {
                const socialData = socialLinksDoc.data();
                console.log('📱 Dados de redes sociais carregados:', socialData);
                
                if (socialData && Array.isArray(socialData.links)) {
                    // Validar cada item do array
                    config.socialLinks = socialData.links.filter(link => {
                        const isValid = link && typeof link === 'object' && 
                                      typeof link.nome === 'string' && 
                                      typeof link.url === 'string';
                        
                        if (!isValid) {
                            console.warn('⚠️ Link social inválido ignorado:', link);
                        }
                        return isValid;
                    });
                    
                    if (config.socialLinks.length > 0) {
                        console.log('✅ Redes sociais configuradas:', config.socialLinks);
                    } else {
                        console.warn('⚠️ Nenhum link social válido encontrado');
                    }
                } else {
                    console.warn('⚠️ Dados de redes sociais inválidos:', socialData);
                    config.socialLinks = [];
                }
            } else {
                console.log('ℹ️ Nenhum dado de redes sociais encontrado');
                config.socialLinks = [];
            }
        } catch (error) {
            console.error('❌ Erro ao processar dados de redes sociais:', error);
            config.socialLinks = [];
        }

    state.modules = config.modules || state.modules;
    state.produtos = config.produtos || state.produtos;
    
    console.log('📥 Carregando redes sociais do config:', config.socialLinks);
    state.socialLinks = Array.isArray(config.socialLinks) ? [...config.socialLinks] : [];        loadConfig(config);
        showToast('Dados carregados!', 'success');

    } catch (error) {
        if (error.message.includes('tempo limite')) {
            showToast('Servidor demorou muito. Tente novamente.', 'error');
        } else {
            console.error("❌ [app.js] Erro ao carregar dados do Firestore:", error);
            showToast('Erro ao carregar: ' + error.message, 'error');
        }
        update();
    }
}

// ===== CORREÇÃO NA FUNÇÃO saveConfig =====

async function saveConfig() {
    try {
        // ✅ PASSO 1: Verificar autenticação ANTES de fazer qualquer coisa
        const user = window.authManager.getCurrentUser();

        if (!user) {
            console.error('❌ [app.js] Usuário não autenticado ao tentar salvar.');
            showToast('Sua sessão expirou. Faça login novamente.', 'error');
            // AuthManager cuidará do redirecionamento
            return;
        }

        console.log('✅ [app.js] Usuário autenticado para salvar:', user.email);

        // ✅ PASSO 2: Validar formulário
        if (!validateForm()) {
            showToast('Corrija os erros antes de salvar', 'error');
            return;
        }

        // ✅ PASSO 3: Verificar rate limiting
        if (!SaveRateLimiter.canSave()) {
            const remaining = SaveRateLimiter.getRemainingTime();
            showToast(`Aguarde ${remaining}s antes de salvar novamente`, 'warning');
            return;
        }

        // ✅ PASSO 4: Verificar operações Firestore
        if (!FirestoreRateLimiter.canOperate()) {
            showToast('Muitas operações. Aguarde alguns segundos.', 'warning');
            return;
        }

        // ✅ PASSO 5: Verificar se Firestore está inicializado
        if (!db) {
            console.error('❌ [app.js] Firestore não inicializado ao tentar salvar.');
            showToast('Erro: Banco de dados não conectado.', 'error');
            return;
        }

        showSaving();
        const config = getConfig();
        console.log('📝 [app.js] Configuração a salvar:', sanitizeLogData(config));

        // ✅ PASSO 6: Criar batch e salvar
        const batch = db.batch();
        const clientDocRef = db.collection('site').doc(clientId);

        // Documento principal
        batch.set(clientDocRef, {
            logoType: config.logoType,
            logoImageUrl: config.logoImageUrl,
            faviconImageUrl: config.faviconImageUrl,
            empresaNome: config.empresaNome,
            bannerTitulo: config.bannerTitulo,
            bannerSubtitulo: config.bannerSubtitulo,
            bannerImagem: config.bannerImagem,
            updatedAt: new Date(), // Adiciona timestamp
            updatedBy: user.email   // Rastreia quem atualizou
        }, { merge: true });

        // Coleções aninhadas
        const coresRef = clientDocRef.collection('cores').doc('data');
        batch.set(coresRef, config.cores, { merge: true });

        const contatoRef = clientDocRef.collection('contato').doc('data');
        batch.set(contatoRef, config.contato, { merge: true });

        const modulesRef = clientDocRef.collection('modules').doc('data');
        batch.set(modulesRef, config.modules, { merge: true });

        const sobreRef = clientDocRef.collection('sobre').doc('data');
        batch.set(sobreRef, config.sobre, { merge: true });

        const globalSettingsRef = clientDocRef.collection('global_settings').doc('data');
        batch.set(globalSettingsRef, config.global_settings, { merge: true });

        // Salva as redes sociais
        console.log('📤 Salvando redes sociais:', state.socialLinks);
        const socialLinksRef = clientDocRef.collection('social_links').doc('data');
        batch.set(socialLinksRef, { 
            links: state.socialLinks.map(link => ({
                nome: link.nome || '',
                url: link.url || ''
            }))
        });

        // Produtos - com tratamento melhorado
        const produtosCollectionRef = clientDocRef.collection('produtos');

        // Busca produtos existentes para deletar
        try {
            const produtosSnapshot = await produtosCollectionRef.get();
            produtosSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
        } catch (err) {
            console.warn('⚠️ [app.js] Aviso ao limpar produtos:', err);
        }

        // Adiciona novos produtos
        if (Array.isArray(config.produtos)) {
            config.produtos.forEach(produto => {
                const newProdRef = produtosCollectionRef.doc();
                batch.set(newProdRef, {
                    ...produto,
                    createdAt: new Date()
                });
            });
        }

        // ✅ PASSO 7: Executar batch com timeout
        console.log('💾 [app.js] Salvando no Firestore...');
        await withTimeout(batch.commit(), 15000);

        console.log('✅ [app.js] Salvo com sucesso!');
        state.hasUnsavedChanges = false;
        updateSaveStatus();
        showToast('✅ Site atualizado com sucesso!', 'success');
        showSaved();

    } catch (error) {
        console.error('❌ [app.js] Erro ao salvar:', error);

        // Tratamento específico de erros
        if (error.code === 'permission-denied') {
            showToast('❌ Erro de permissão. Verifique as regras do Firestore.', 'error');
            console.error('📋 Verifique suas regras de segurança no Firebase Console');
        } else if (error.message.includes('tempo limite')) {
            showToast('⏱️ Tempo excedido. A conexão estava muito lenta.', 'error');
        } else if (!window.authManager.isAuthenticated()) { // Usa AuthManager
            showToast('🔓 Sessão expirada. Faça login novamente.', 'error');
            // AuthManager cuidará do redirecionamento
        } else {
            showToast(`❌ Erro ao salvar: ${error.message}`, 'error');
        }
    }
}

function validateForm() {
    return true;
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

async function logout() {
    console.log('🔓 [app.js] Logout disparado.');
    try {
        await window.authManager.logout();
        showToast('Logout realizado com sucesso!', 'success');
        // AuthManager cuidará do redirecionamento
    } catch (error) {
        console.error('❌ [app.js] Erro ao fazer logout:', error);
        showToast('Erro ao fazer logout: ' + error.message, 'error');
    }
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
        },
        socialLinks: state.socialLinks || []
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
            const sw = document.querySelector(`[data-module=\"${module}\"]`);
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

    // Atualiza o estado das redes sociais
    if (Array.isArray(config.socialLinks)) {
        console.log('🔄 Atualizando estado das redes sociais:', config.socialLinks);
        state.socialLinks = [...config.socialLinks];
        renderSocialLinks();
    } else {
        console.warn('⚠️ config.socialLinks não é um array:', config.socialLinks);
        state.socialLinks = [];
        renderSocialLinks();
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

// ===== REDES SOCIAIS =====
function renderSocialLinks() {
    if (!Array.isArray(state.socialLinks)) {
        state.socialLinks = [];
    }

    console.log('🔄 Renderizando redes sociais:', state.socialLinks);

    // Renderiza no footer do site público
    const socialIconsFooter = document.querySelector(".social-icons-footer");
    if (socialIconsFooter) {
        socialIconsFooter.innerHTML = state.socialLinks.map(link => `
            <a href="${escapeHtml(link.url)}" class="social-icon" target="_blank" rel="noopener noreferrer">
                <i class="${getIconClass(link.nome)}"></i>
            </a>
        `).join('');
    }

    // Renderiza na lista do admin
    const list = document.getElementById('socialLinksList');
    if (list) {
        list.innerHTML = state.socialLinks.map((link, i) => `
            <div class="social-link-item">
                <div class="social-preview">
                    <i class="${getIconClass(link.nome)}" style="font-size: 24px;"></i>
                    <span class="social-name">${escapeHtml(link.nome)}</span>
                </div>
                <div class="social-inputs">
                    <input type="text" placeholder="Nome (ex: Facebook)" value="${escapeHtml(link.nome)}" 
                           onchange="updateSocialLink(${i}, 'nome', this.value)">
                    <input type="url" placeholder="URL do seu perfil" value="${escapeHtml(link.url)}" 
                           onchange="updateSocialLink(${i}, 'url', this.value)">
                </div>
                <button class="btn btn-danger" onclick="removeSocialLink(${i})">🗑️</button>
            </div>
        `).join('');
    }

    // Atualiza o estado vazio
    const emptyState = document.getElementById('socialEmptyState');
    if (emptyState) {
        emptyState.style.display = state.socialLinks.length === 0 ? 'flex' : 'none';
    }
}

function getIconClass(name) {
    const socialIcons = {
        'facebook': 'fab fa-facebook',
        'instagram': 'fab fa-instagram',
        'twitter': 'fab fa-twitter',
        'linkedin': 'fab fa-linkedin',
        'youtube': 'fab fa-youtube',
        'whatsapp': 'fab fa-whatsapp',
        'github': 'fab fa-github',
        'tiktok': 'fab fa-tiktok',
        'pinterest': 'fab fa-pinterest',
        'telegram': 'fab fa-telegram'
    };

    // Procura pela rede social ignorando maiúsculas/minúsculas
    const socialName = name.toLowerCase();
    for (const [key, value] of Object.entries(socialIcons)) {
        if (socialName.includes(key)) {
            return value;
        }
    }

    // Ícone padrão se não encontrar correspondência
    return 'fas fa-link';
}

function updateSocialLink(index, field, value) {
    console.log('🔄 Atualizando rede social:', { index, field, value });
    
    if (!Array.isArray(state.socialLinks)) {
        console.warn('⚠️ state.socialLinks não é um array, inicializando...');
        state.socialLinks = [];
    }
    
    if (state.socialLinks[index]) {
        const oldValue = state.socialLinks[index][field];
        state.socialLinks[index] = {
            ...state.socialLinks[index],
            [field]: value
        };
        
        console.log('✅ Rede social atualizada:', {
            index,
            oldValue,
            newValue: value,
            currentState: state.socialLinks
        });
        
        renderSocialLinks();
        markAsUnsaved();
    } else {
        console.error('❌ Índice inválido ao atualizar rede social:', index);
    }
}

function removeSocialLink(index) {
    if (!Array.isArray(state.socialLinks)) return;
    state.socialLinks.splice(index, 1);
    renderSocialLinks();
    markAsUnsaved();
}

function openSocialModal() {
    const modal = document.getElementById('socialModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Adiciona os cliques nos botões das redes sociais predefinidas
        const redesPredefinidas = [
            { nome: 'Instagram', icon: 'fab fa-instagram' },
            { nome: 'Facebook', icon: 'fab fa-facebook' },
            { nome: 'Twitter', icon: 'fab fa-twitter' },
            { nome: 'LinkedIn', icon: 'fab fa-linkedin' },
            { nome: 'YouTube', icon: 'fab fa-youtube' },
            { nome: 'WhatsApp', icon: 'fab fa-whatsapp' },
            { nome: 'TikTok', icon: 'fab fa-tiktok' },
            { nome: 'Pinterest', icon: 'fab fa-pinterest' }
        ];

        const predefinedTab = document.getElementById('predefinedTab');
        if (predefinedTab) {
            predefinedTab.innerHTML = redesPredefinidas.map(rede => `
                <button class="social-preset-btn" onclick="addPredefinedSocial('${rede.nome}')">
                    <i class="${rede.icon}"></i>
                    <span>${rede.nome}</span>
                </button>
            `).join('');
        }
    }
}

function closeSocialModal() {
    const modal = document.getElementById('socialModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function addPredefinedSocial(nome) {
    console.log('➕ Adicionando rede social:', nome);
    
    if (!Array.isArray(state.socialLinks)) {
        console.warn('⚠️ state.socialLinks não é um array, inicializando...');
        state.socialLinks = [];
    }

    // Adiciona a nova rede social
    const newSocialLink = { nome: nome, url: '' };
    state.socialLinks.push(newSocialLink);
    
    console.log('✅ Rede social adicionada. Estado atual:', state.socialLinks);
    
    // Atualiza a interface
    renderSocialLinks();
    markAsUnsaved();
    closeSocialModal();
}

function addSocialLink() {
    if (!Array.isArray(state.socialLinks)) {
        state.socialLinks = [];
    }
    state.socialLinks.push({ nome: '', url: '' });
    renderSocialLinks();
    markAsUnsaved();
}

function removeSocialLink(index) {
    if (confirm('Tem certeza que deseja remover esta rede social?')) {
        state.socialLinks.splice(index, 1);
        renderSocialLinks();
        markAsUnsaved();
    }
}

function updateSocialLink(index, field, value) {
    state.socialLinks[index][field] = value;
    markAsUnsaved();
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
window.logout = logout; // Agora usa a nova função logout
window.toggleHelp = toggleHelp;
window.saveConfig = saveConfig;
window.editarProduto = editarProduto;
window.removerProduto = removerProduto;
window.buscarEnderecoMapa = buscarEnderecoMapa;
window.usarLocalizacaoAtual = usarLocalizacaoAtual;
window.addSocialLink = addSocialLink;
window.removeSocialLink = removeSocialLink;
window.updateSocialLink = updateSocialLink;

// Inicialização
updateSaveStatus();