/**
 * ✅ APP.JS - Versão Corrigida (Sem Loop de Redirect)
 */
console.log("📝 [app.js] Script carregado");

("use strict");

// Estado Inicial
if (typeof window.state === "undefined") {
  window.state = {
    modules: { sobre: true, produtos: true, contato: true },
    produtos: [],
    socialLinks: [],
    hasUnsavedChanges: false,
  };
}

const clientId = "cliente-001";

// ===== FUNÇÕES AUXILIARES =====
function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function update() {
  const iframe = document.getElementById("preview-iframe");
  if (iframe) {
    iframe.contentWindow.postMessage({ type: "updateConfig", data: getConfig() }, "*");
  }
}

function markAsUnsaved() {
  state.hasUnsavedChanges = true;
  updateSaveStatus();
}

function updateSaveStatus() {
  const saveStatus = document.getElementById("saveStatus");
  const saveText = document.getElementById("saveText");
  if (saveStatus && saveText) {
    if (state.hasUnsavedChanges) {
      saveStatus.className = "save-status unsaved";
      saveText.innerHTML = "⚫ Não salvo";
    } else {
      saveStatus.className = "save-status saved";
      saveText.textContent = "✓ Salvo";
    }
  }
}

// ===== RENDERIZAÇÃO =====
function renderProdutos() {
  const list = document.getElementById("produtosList");
  if (!list) return;

  list.innerHTML = state.produtos.map((p, i) => `
    <div style="background: #f8f9fa; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
        <div>
            <strong>${escapeHtml(p.nome)}</strong><br>
            <small class="text-muted">${escapeHtml(p.preco)}</small>
        </div>
        <div class="btn-group">
            <button class="btn btn-secondary btn-sm" onclick="editarProduto(${i})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="removerProduto(${i})">🗑️</button>
        </div>
    </div>
  `).join("");
}

function renderSocialLinks() {
  if (!Array.isArray(state.socialLinks)) state.socialLinks = [];
  const list = document.getElementById("socialLinksList");
  const empty = document.getElementById("socialEmptyState");

  if (!list) return;

  if (state.socialLinks.length === 0) {
    list.innerHTML = "";
    if (empty) empty.style.display = "block";
  } else {
    if (empty) empty.style.display = "none";
    list.innerHTML = state.socialLinks.map((link, i) => `
            <div class="social-link-item">
                <div class="social-preview">
                    <span class="social-name">${escapeHtml(link.name)}</span>
                </div>
                <div class="social-url">
                    <a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.url)}</a>
                </div>
                <div class="social-actions">
                    <button class="btn btn-primary" onclick="editSocialLink(${i})">Editar</button>
                    <button class="btn btn-danger" onclick="removeSocialLink(${i})">Remover</button>
                </div>
            </div>
        `).join("");
  }
}

// ===== CARREGAR E SALVAR CONFIGURAÇÕES =====
function getConfig() {
  return {
    logoType: document.getElementById("logoType")?.value || "text",
    logoImageUrl: document.getElementById("logoImageUrl")?.value || "",
    faviconImageUrl: document.getElementById("faviconImageUrl")?.value || "",
    empresaNome: document.getElementById("empresaNome")?.value || "",
    bannerTitulo: document.getElementById("bannerTitulo")?.value || "",
    bannerSubtitulo: document.getElementById("bannerSubtitulo")?.value || "",
    bannerImagem: document.getElementById("bannerImagem")?.value || "",

    global_settings: {
      fontUrl: document.getElementById("fontUrl")?.value || "",
      fontFamily: document.getElementById("fontFamily")?.value || ""
    },
    cores: {
      primaria: document.getElementById("corPrimaria")?.value || "#007bff",
      secundaria: document.getElementById("corSecundaria")?.value || "#28a745",
    },
    modules: state.modules,
    sobre: {
      texto: document.getElementById("sobreTexto")?.value || "",
      imagem: document.getElementById("sobreImagem")?.value || "",
    },
    produtos: state.produtos,
    contato: {
      telefone: document.getElementById("telefone")?.value || "",
      telefone2: document.getElementById("telefone2")?.value || "",
      email: document.getElementById("email")?.value || "",
      endereco: document.getElementById("endereco")?.value || "",
      mostrarMapa: document.getElementById("mostrarMapa")?.checked || false,
      latitude: parseFloat(document.getElementById("latitude")?.value) || -23.5505,
      longitude: parseFloat(document.getElementById("longitude")?.value) || -46.6333,
    },
    socialLinks: state.socialLinks,
  };
}

function loadConfig(config) {
  console.log("📥 Carregando configurações...");
  if (!config) return;

  // Campos simples
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

  setVal('empresaNome', config.empresaNome);
  setVal('logoType', config.logoType);
  setVal('logoImageUrl', config.logoImageUrl);
  setVal('faviconImageUrl', config.faviconImageUrl);
  setVal('bannerTitulo', config.bannerTitulo);
  setVal('bannerSubtitulo', config.bannerSubtitulo);
  setVal('bannerImagem', config.bannerImagem);

  if (config.global_settings) {
    setVal('fontUrl', config.global_settings.fontUrl);
    setVal('fontFamily', config.global_settings.fontFamily);
  }

  if (config.cores) {
    setVal('corPrimaria', config.cores.primaria);
    setVal('corSecundaria', config.cores.secundaria);
  }

  if (config.sobre) {
    setVal('sobreTexto', config.sobre.texto);
    setVal('sobreImagem', config.sobre.imagem);
  }

  if (config.contato) {
    setVal('telefone', config.contato.telefone);
    setVal('telefone2', config.contato.telefone2);
    setVal('email', config.contato.email);
    setVal('endereco', config.contato.endereco);
    setVal('latitude', config.contato.latitude);
    setVal('longitude', config.contato.longitude);
    const mapCheck = document.getElementById('mostrarMapa');
    if (mapCheck) mapCheck.checked = config.contato.mostrarMapa;
  }

  if (config.modules) state.modules = config.modules;
  if (config.produtos) state.produtos = config.produtos;
  if (config.socialLinks) state.socialLinks = config.socialLinks;

  // Switches
  Object.keys(state.modules).forEach(mod => {
    const sw = document.querySelector(`.switch[data-module="${mod}"]`);
    if (sw) sw.classList.toggle('active', state.modules[mod]);
  });

  renderProdutos();
  renderSocialLinks();
  update();
}

// ===== FIREBASE =====
async function initializeFirebaseWithRealtimeUpdates() {
  if (!window.firebaseManager) window.firebaseManager = new FirebaseRealtimeManager();
  await window.firebaseManager.init();

  const data = await window.firebaseManager.loadInitialData();
  if (data) loadConfig(data);

  // Subscribers
  window.firebaseManager.subscribeToDocument("site", "cliente-001", (d) => {
    if (d.empresaNome) document.getElementById('empresaNome').value = d.empresaNome;
    update();
  });
  // Adicione outros subscribers conforme necessário...
}

async function saveConfig() {
  if (!window.authManager.getCurrentUser()) {
    showToast("Você não está logado.", "error");
    return;
  }

  showSaving();
  try {
    const config = getConfig();

    // Estrutura os dados corretamente para o saveData
    await window.firebaseManager.saveData({
      main: {
        logoType: config.logoType,
        logoImageUrl: config.logoImageUrl,
        faviconImageUrl: config.faviconImageUrl,
        empresaNome: config.empresaNome,
        bannerTitulo: config.bannerTitulo,
        bannerSubtitulo: config.bannerSubtitulo,
        bannerImagem: config.bannerImagem,
        global_settings: config.global_settings
      },
      cores: config.cores,
      modules: config.modules,
      sobre: config.sobre,
      produtos: config.produtos,
      contato: config.contato,
      socialLinks: config.socialLinks
    });

    state.hasUnsavedChanges = false;
    updateSaveStatus();
    showSaved();
    showToast("Salvo com sucesso!", "success");
  } catch (e) {
    console.error(e);
    showToast("Erro ao salvar.", "error");
  }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 App Iniciado");

  try {
    // 1. Inicia Firebase
    if (typeof window.initializeFirebase === 'function') {
      await window.initializeFirebase();
    }

    // 2. Inicia Auth
    if (window.authManager) {
      await window.authManager.init();
    }

    // 3. Verifica usuário e carrega dados
    const user = await window.authManager.waitUntilReady();
    if (user) {
      console.log("✅ Usuário detectado:", user.email);
      await initializeFirebaseWithRealtimeUpdates();
    } else {
      console.log("🚫 Nenhum usuário ativo. Aguardando AuthManager redirecionar...");
      // NÃO REDIRECIONAR AQUI MANUALMENTE PARA EVITAR LOOP
      // O AuthManager já fará isso se for necessário.
    }

    // 4. Mapa é inicializado pelo script inline no admin.html

  } catch (e) {
    console.error("Erro fatal:", e);
  }
});

// Funções Globais para o HTML
window.saveConfig = saveConfig;
window.logout = () => window.authManager.logout();
window.markAsUnsaved = markAsUnsaved;
window.update = update;
window.setLogoType = (type) => {
  document.getElementById('logoType').value = type;
  document.getElementById('logoImageInputGroup').classList.toggle('hidden', type !== 'image');
  markAsUnsaved(); update();
};
window.handleImageUpload = async (e, targetId, previewId) => {
  const file = e.target.files[0];
  if (!file) return;

  showToast("Enviando...", "info");
  try {
    const url = await window.firebaseManager.uploadImage(file, `uploads/${Date.now()}_${file.name}`);
    document.getElementById(targetId).value = url;

    const prev = document.querySelector(previewId);
    if (prev) prev.style.backgroundImage = `url(${url})`;

    markAsUnsaved();
    update();
    showToast("Imagem enviada!", "success");
  } catch (err) {
    showToast("Erro no upload.", "error");
  }
};

// Modais e CRUD
window.openProdutoModal = (idx) => {
  // Lógica simplificada para abrir modal limpo ou com dados
  const modal = document.getElementById('produtoModal');
  document.getElementById('produtoId').value = idx === -1 ? '' : idx;

  if (idx === -1) {
    // Limpar campos...
    document.getElementById('produtoNome').value = '';
    document.getElementById('produtoPreco').value = '';
    document.getElementById('produtoDescricao').value = '';
    document.getElementById('produtoImageUrl').value = '';
    document.getElementById('produtoPreview').style.backgroundImage = '';
  } else {
    const p = state.produtos[idx];
    document.getElementById('produtoNome').value = p.nome;
    document.getElementById('produtoPreco').value = p.preco;
    document.getElementById('produtoDescricao').value = p.descricao;
    document.getElementById('produtoImageUrl').value = p.imagem || '';
    if (p.imagem) document.getElementById('produtoPreview').style.backgroundImage = `url(${p.imagem})`;
  }
  modal.style.display = 'block';
};

window.closeProdutoModal = () => document.getElementById('produtoModal').style.display = 'none';

window.saveProduto = () => {
  const idx = document.getElementById('produtoId').value;
  const novo = {
    nome: document.getElementById('produtoNome').value,
    preco: document.getElementById('produtoPreco').value,
    descricao: document.getElementById('produtoDescricao').value,
    imagem: document.getElementById('produtoImageUrl').value
  };

  if (idx === '') state.produtos.push(novo);
  else state.produtos[idx] = novo;

  renderProdutos();
  window.closeProdutoModal();
  markAsUnsaved();
  update(); // Atualiza o preview
};

window.removerProduto = (index) => {
  if (confirm("Tem certeza que deseja remover este produto?")) {
    state.produtos.splice(index, 1);
    renderProdutos();
    markAsUnsaved();
    update(); // Atualiza o preview
  }
};

window.editarProduto = (index) => {
  window.openProdutoModal(index);
};

// ===== REDES SOCIAIS (INJETADO) =====

window.addSocialLink = () => {
  editSocialLink(-1);
};

window.editSocialLink = (index) => {
  const modal = document.getElementById("socialLinkModal");
  if (!modal) return;

  const indexInput = document.getElementById("currentSocialLinkIndex");
  const nameInput = document.getElementById("socialLinkName");
  const urlInput = document.getElementById("socialLinkUrl");

  if (index === -1) {
    indexInput.value = "";
    nameInput.value = "";
    urlInput.value = "";
  } else {
    const link = state.socialLinks[index];
    indexInput.value = index;
    nameInput.value = link.name || link.nome || "";
    urlInput.value = link.url || "";
  }

  modal.style.display = "block";
};

window.closeSocialModal = () => {
  const modal = document.getElementById("socialLinkModal");
  if (modal) modal.style.display = "none";
};

window.saveSocialLinkChanges = () => {
  const indexInput = document.getElementById("currentSocialLinkIndex");
  const nameInput = document.getElementById("socialLinkName");
  const urlInput = document.getElementById("socialLinkUrl");

  const index = indexInput.value ? parseInt(indexInput.value) : -1;
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name || !url) {
    showToast("Preencha todos os campos", "error");
    return;
  }

  const newLink = {
    id: index !== -1 ? state.socialLinks[index].id : Date.now(),
    name,
    url,
  };

  if (index !== -1) {
    state.socialLinks[index] = newLink;
  } else {
    state.socialLinks.push(newLink);
  }

  renderSocialLinks();
  markAsUnsaved();
  closeSocialModal();
  showToast("Rede social salva!", "success");
};

window.removeSocialLink = (index) => {
  if (confirm("Remover?")) {
    state.socialLinks.splice(index, 1);
    renderSocialLinks();
    markAsUnsaved();
  }
};