// Estado da aplicação
let state = {
    modules: { sobre: true, produtos: true, contato: true },
    produtos: []
};

// Referências do Firebase
let db;
const clientId = 'cliente-001';

// ===== INICIALIZAÇÃO E CARREGAMENTO DE DADOS =====
document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        showToast('Firebase não configurado.', 'error');
        return;
    }
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    loadDataFromFirestore();
});

async function loadDataFromFirestore() {
    const clientDocRef = db.collection('site').doc(clientId);
    showToast('Carregando dados...', 'info');

    try {
        const clientDoc = await clientDocRef.get();
        if (!clientDoc.exists) {
            showToast('Cliente não encontrado. Usando modelo padrão.', 'info');
            update();
            saveToHistory();
            return;
        }

        let config = clientDoc.data();

        const subcollections = ['cores', 'contato', 'modules', 'sobre', 'global_settings'];
        const promises = subcollections.map(async (sub) => {
            const subDoc = await clientDocRef.collection(sub).doc('data').get();
            if (subDoc.exists) config[sub] = subDoc.data();
        });

        const produtosPromise = clientDocRef.collection('produtos').get().then(snap => {
            config.produtos = snap.docs.map(doc => doc.data());
        });

        await Promise.all([...promises, produtosPromise]);

        state.modules = config.modules || state.modules;
        state.produtos = config.produtos || state.produtos;
        loadConfig(config);
        showToast('Dados carregados com sucesso!', 'success');

    } catch (error) {
        showToast('Erro ao carregar dados.', 'error');
        console.error("Error loading data: ", error);
        update();
    }
}

// ===== LÓGICA DE SALVAMENTO =====
async function saveConfig() {
    if (!validateForm()) {
        showToast('Corrija os erros antes de salvar', 'error');
        return;
    }

    showSaving();
    const config = getConfig();
    const batch = db.batch();
    const clientDocRef = db.collection('site').doc(clientId);

    batch.set(clientDocRef, {
        empresaNome: config.empresaNome,
        bannerTitulo: config.bannerTitulo,
        bannerSubtitulo: config.bannerSubtitulo,
        bannerImagem: config.bannerImagem
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
        showSaved();
        showToast('Site atualizado com sucesso!', 'success');

    } catch (error) {
        showToast('Erro ao salvar os dados.', 'error');
        console.error("Error writing batch: ", error);
    }
}

// ===== FUNÇÕES DE UI E ESTADO =====

function logout() {
    firebase.auth().signOut().then(() => {
        showToast('Saindo...', 'info');
        window.location.href = 'login.html';
    });
}

function getConfig() {
    return {
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
        contato: { telefone: document.getElementById('telefone').value, email: document.getElementById('email').value, endereco: document.getElementById('endereco').value }
    };
}

function loadConfig(config) {
    document.getElementById('empresaNome').value = config.empresaNome || '';
    document.getElementById('bannerTitulo').value = config.bannerTitulo || '';
    document.getElementById('bannerSubtitulo').value = config.bannerSubtitulo || '';
    document.getElementById('bannerImagem').value = config.bannerImagem || '';
    
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
    // Atualizar fonte dinâmica no preview
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
        document.querySelector('.preview .site').style.fontFamily = fontFamily;
    }

    const empresaNome = document.getElementById('empresaNome').value;
    document.getElementById('logo').textContent = empresaNome;
    document.getElementById('footerNome').textContent = empresaNome;
    document.getElementById('bannerH1').textContent = document.getElementById('bannerTitulo').value;
    document.getElementById('bannerP').textContent = document.getElementById('bannerSubtitulo').value;
    document.getElementById('banner').style.backgroundImage = `url(${document.getElementById('bannerImagem').value})`;
    const corPrimaria = document.getElementById('corPrimaria').value;
    const corSecundaria = document.getElementById('corSecundaria').value;
    document.querySelector('#corPrimaria + input').value = corPrimaria;
    document.querySelector('#corSecundaria + input').value = corSecundaria;
    document.getElementById('logo').style.color = corPrimaria;
    document.querySelectorAll('.site-nav-links a').forEach(a => a.style.color = corPrimaria);
    document.querySelectorAll('.contact-icon').forEach(icon => icon.style.background = corPrimaria);
    document.querySelector('.cta-btn').style.background = corSecundaria;
    document.getElementById('sobreTextoPreview').textContent = document.getElementById('sobreTexto').value;
    document.getElementById('sobreImagemPreview').style.backgroundImage = `url(${document.getElementById('sobreImagem').value})`;
    document.getElementById('telPreview').textContent = document.getElementById('telefone').value;
    document.getElementById('emailPreview').textContent = document.getElementById('email').value;
    document.getElementById('enderecoPreview').textContent = document.getElementById('endereco').value;
    if(state.modules) {
        document.querySelector('.sobre-section').classList.toggle('hidden', !state.modules.sobre);
        document.querySelector('.nav-sobre').classList.toggle('hidden', !state.modules.sobre);
        document.querySelector('.produtos-section').classList.toggle('hidden', !state.modules.produtos);
        document.querySelector('.nav-produtos').classList.toggle('hidden', !state.modules.produtos);
        document.querySelector('.contato-section').classList.toggle('hidden', !state.modules.contato);
        document.querySelector('.nav-contato').classList.toggle('hidden', !state.modules.contato);
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
            <button class="btn btn-primary" style="width: auto; padding: 0.4rem 0.8rem; margin: 0; font-size: 0.8rem;" onclick="removeProduto(${i})">🗑️</button>
        </div>
    `).join('');
}

function addProduto() {
    const nome = prompt('Nome do produto:');
    if (!nome) return;
    const preco = prompt('Preço:');
    if (!preco) return;
    const descricao = prompt('Descrição:');
    const imagem = prompt('URL da imagem:');
    state.produtos.push({ nome, preco, descricao: descricao || '', imagem: imagem || 'https://via.placeholder.com/400' });
    update();
    autoSave();
    showToast('Produto adicionado!', 'success');
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
    saveTimeout = setTimeout(() => {
        saveToHistory(); 
        saveConfig();
    }, 1500);
}

function toggleHelp() { document.getElementById('shortcutsHelp').classList.toggle('show'); }

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 's' || e.key === 'e')) { e.preventDefault(); saveConfig(); }
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.shiftKey && (e.key === 'Z' || e.key === 'y')) { e.preventDefault(); redo(); }
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
