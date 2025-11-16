/**
 * ✅ CORRIGIDO FINAL: app.js com todas as funções definidas
 *
 * ✅ CORREÇÃO (handleImageUpload):
 * - O nome do ficheiro no Storage agora usa a extensão original (ex: .svg, .png).
 */

console.log("📝 [app.js] Script carregado");

("use strict");

// ✅ ESTADO INICIAL
if (typeof window.state === "undefined") {
  window.state = {
    modules: { sobre: true, produtos: true, contato: true },
    produtos: [],
    socialLinks: [],
    hasUnsavedChanges: false,
  };
}

let db, storage;
let firebaseManager = null;
const clientId = "cliente-001";

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
  },
};

// ===== HELPER FUNCTIONS =====
function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return unsafe;

  let cleaned = unsafe
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(?:javascript|data|vbscript):/gi, "invalid:")
    .replace(/expression\s*\(|behavior\s*:|[-a-z]+-binding:/gi, "invalid:")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const escapeChars = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };

  cleaned = cleaned.replace(/[&<>"'`=]/g, (char) => escapeChars[char]);

  if (typeof DOMPurify !== "undefined") {
    cleaned = DOMPurify.sanitize(cleaned, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "span", "p", "br", "a"],
      ALLOWED_ATTR: ["href", "target", "class", "id", "style"],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ["script", "style", "iframe", "form", "input", "button"],
      FORBID_ATTR: ["onerror", "onload", "onmouseover", "onclick", "onfocus"],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
  }

  return cleaned;
}

// ✅ FUNÇÕES DE UI - DEFINIDAS AQUI ANTES DE TUDO

/**
 * Atualiza o preview do iframe
 */
function update() {
  const iframe = document.getElementById("preview-iframe");
  if (!iframe) return;

  try {
    iframe.contentWindow.postMessage(
      { type: "updateConfig", data: getConfig() },
      "*"
    );
  } catch (error) {
    console.warn("[update] Erro ao comunicar com iframe:", error);
  }
}

/**
 * Renderiza lista de produtos
 */
function renderProdutos() {
  const list = document.getElementById("produtosList");
  if (!list) return;

  list.innerHTML = state.produtos
    .map(
      (p, i) => `
    <div style="background: #f8f9fa; padding: 0.8rem; border-radius: 4px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
            <strong>${escapeHtml(p.nome)}</strong><br>
            <small>${escapeHtml(p.preco)}</small>
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary" style="width: auto; padding: 0.4rem 0.8rem; margin: 0; font-size: 0.8rem;" onclick="editarProduto(${i})">✏️</button>
            <button class="btn btn-primary" style="width: auto; padding: 0.4rem 0.8rem; margin: 0; font-size: 0.8rem; background: #dc3545;" onclick="removerProduto(${i})">🗑️</button>
        </div>
    </div>
  `
    )
    .join("");
}

/**
 * Renderiza lista de redes sociais
 */
function renderSocialLinks() {
  if (!Array.isArray(state.socialLinks)) {
    state.socialLinks = [];
  }

  const list = document.getElementById("socialLinksList");
  const emptyState = document.getElementById("socialEmptyState");

  if (!list) return;

  if (state.socialLinks.length === 0) {
    list.innerHTML = "";
    if (emptyState) emptyState.style.display = "flex";
  } else {
    if (emptyState) emptyState.style.display = "none";

    list.innerHTML = state.socialLinks
      .map(
        (link, i) => `
        <div class="social-link-item">
            <div class="social-preview">
                <span class="social-name">${escapeHtml(link.name || link.nome)}</span>
            </div>
            <div class="social-url">
                <a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.url)}</a>
            </div>
            <div class="social-actions">
                <button class="btn btn-primary" onclick="editSocialLink(${i})">✏️</button>
                <button class="btn btn-danger" onclick="removeSocialLink(${i})">🗑️</button>
            </div>
        </div>
      `
      )
      .join("");
  }
}

/**
 * Carrega configurações nos inputs
 */
function loadConfig(config) {
  console.log("📥 [loadConfig] Carregando...");

  try {
    // Informações básicas
    if (config.empresaNome)
      document.getElementById("empresaNome").value = config.empresaNome;
    if (config.bannerTitulo)
      document.getElementById("bannerTitulo").value = config.bannerTitulo;
    if (config.bannerSubtitulo)
      document.getElementById("bannerSubtitulo").value = config.bannerSubtitulo;
    if (config.bannerImagem)
      document.getElementById("bannerImagem").value = config.bannerImagem;
    if (config.logoType)
      document.getElementById("logoType").value = config.logoType;
    if (config.logoImageUrl)
      document.getElementById("logoImageUrl").value = config.logoImageUrl;
    if (config.faviconImageUrl)
      document.getElementById("faviconImageUrl").value = config.faviconImageUrl;

    // Cores
    if (config.cores) {
      if (config.cores.primaria)
        document.getElementById("corPrimaria").value = config.cores.primaria;
      if (config.cores.secundaria)
        document.getElementById("corSecundaria").value = config.cores.secundaria;
    }

    // Sobre
    if (config.sobre) {
      if (config.sobre.texto)
        document.getElementById("sobreTexto").value = config.sobre.texto;
      if (config.sobre.imagem)
        document.getElementById("sobreImagem").value = config.sobre.imagem;
    }

    // Contato
    if (config.contato) {
      if (config.contato.telefone)
        document.getElementById("telefone").value = config.contato.telefone;
      if (config.contato.telefone2)
        document.getElementById("telefone2").value = config.contato.telefone2;
      if (config.contato.email)
        document.getElementById("email").value = config.contato.email;
      if (config.contato.endereco)
        document.getElementById("endereco").value = config.contato.endereco;
      if (config.contato.latitude)
        document.getElementById("latitude").value = config.contato.latitude;
      if (config.contato.longitude)
        document.getElementById("longitude").value = config.contato.longitude;
    }

    // Módulos
    if (config.modules) {
      state.modules = config.modules;
      Object.keys(config.modules).forEach((module) => {
        const sw = document.querySelector(`[data-module="${module}"]`);
        if (sw) sw.classList.toggle("active", config.modules[module]);
      });
    }

    // Produtos
    if (Array.isArray(config.produtos)) {
      state.produtos = config.produtos;
      renderProdutos();
    }

    // Redes Sociais
    if (Array.isArray(config.socialLinks)) {
      state.socialLinks = config.socialLinks;
      renderSocialLinks();
    }

    console.log("✅ [loadConfig] Configurações carregadas");
    update();
  } catch (error) {
    console.error("❌ [loadConfig] Erro:", error);
  }
}

/**
 * Obtém configurações dos inputs
 */
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
      fontFamily: document.getElementById("fontFamily")?.value || "",
      trackingCode: document.getElementById("trackingCode")?.value || "",
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
      latitude:
        parseFloat(document.getElementById("latitude")?.value) || -23.5505,
      longitude:
        parseFloat(document.getElementById("longitude")?.value) || -46.6333,
    },
    socialLinks: state.socialLinks || [],
  };
}

/**
 * Inicializa Firebase Realtime
 */
async function initializeFirebaseWithRealtimeUpdates() {
  try {
    console.log("🔄 [initializeFirebase] Iniciando Firebase Realtime...");

    if (typeof firebase === "undefined") {
      throw new Error("Firebase SDK não carregou");
    }

    if (!firebaseManager) {
      firebaseManager = new FirebaseRealtimeManager();
      await firebaseManager.init();
      console.log("✅ Firebase Realtime Manager inicializado");
    }

    const initialData = await firebaseManager.loadInitialData();
    loadConfig(initialData);

    // ===== SUBSCRIBERS =====

    // Documento principal
    firebaseManager.subscribeToDocument("site", "cliente-001", (data) => {
      console.log("📡 Site atualizado em tempo real");
      if (data.empresaNome) {
        document.getElementById("empresaNome").value = data.empresaNome;
      }
      if (data.bannerTitulo) {
        document.getElementById("bannerTitulo").value = data.bannerTitulo;
      }
      update();
    });

    // Cores
    firebaseManager.subscribeToSubcollection(
      "site",
      "cliente-001",
      "cores",
      (docs) => {
        console.log("📡 Cores atualizadas:", docs);
        if (docs.length > 0) {
          const coresData = docs[0];
          if (coresData.primaria) {
            document.getElementById("corPrimaria").value = coresData.primaria;
          }
          if (coresData.secundaria) {
            document.getElementById("corSecundaria").value =
              coresData.secundaria;
          }
          update();
        }
      }
    );

    // Contato
    firebaseManager.subscribeToSubcollection(
      "site",
      "cliente-001",
      "contato",
      (docs) => {
        console.log("📡 Contato atualizado:", docs);
        if (docs.length > 0) {
          const contatoData = docs[0];
          if (contatoData.telefone) {
            document.getElementById("telefone").value = contatoData.telefone;
          }
          if (contatoData.email) {
            document.getElementById("email").value = contatoData.email;
          }
          update();
        }
      }
    );

    // Módulos
    firebaseManager.subscribeToSubcollection(
      "site",
      "cliente-001",
      "modules",
      (docs) => {
        console.log("📡 Módulos atualizados:", docs);
        if (docs.length > 0) {
          const modulesData = docs[0];
          state.modules = modulesData;

          Object.entries(modulesData).forEach(([module, enabled]) => {
            const sw = document.querySelector(`[data-module="${module}"]`);
            if (sw) {
              sw.classList.toggle("active", enabled);
            }
          });

          update();
        }
      }
    );

    // Sobre
    firebaseManager.subscribeToSubcollection(
      "site",
      "cliente-001",
      "sobre",
      (docs) => {
        console.log("📡 Sobre atualizado:", docs);
        if (docs.length > 0) {
          const sobreData = docs[0];
          if (sobreData.texto) {
            document.getElementById("sobreTexto").value = sobreData.texto;
          }
          if (sobreData.imagem) {
            document.getElementById("sobreImagem").value = sobreData.imagem;
          }
          update();
        }
      }
    );

    // Produtos
    firebaseManager.subscribeToSubcollection(
      "site",
      "cliente-001",
      "produtos",
      (produtos) => {
        console.log("📡 Produtos atualizados:", produtos);
        state.produtos = produtos;
        renderProdutos();
        update();
      }
    );

    // Redes Sociais
    firebaseManager.subscribeToSubcollection(
      "site",
      "cliente-001",
      "social_links",
      (docs) => {
        console.log("📡 Redes Sociais atualizadas:", docs);
        if (docs.length > 0 && docs[0].links) {
          state.socialLinks = docs[0].links;
          renderSocialLinks();
          update();
        }
      }
    );

    console.log("✅ Todos os subscribers configurados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao inicializar Firebase realtime:", error);
    showToast("Erro ao conectar em tempo real", "error");
  }
}

/**
 * Salva configurações no Firestore
 */
async function saveConfig() {
  try {
    const user = window.authManager.getCurrentUser();
    if (!user) {
      showToast("Sessão expirada", "error");
      return;
    }

    if (!firebaseManager) {
      showToast("Firebase não inicializado", "error");
      return;
    }

    showSaving();
    const config = getConfig();

    const dataToSave = {
      main: {
        logoType: config.logoType,
        logoImageUrl: config.logoImageUrl,
        faviconImageUrl: config.faviconImageUrl,
        empresaNome: config.empresaNome,
        bannerTitulo: config.bannerTitulo,
        bannerSubtitulo: config.bannerSubtitulo,
        bannerImagem: config.bannerImagem,
      },
      cores: config.cores,
      contato: config.contato,
      modules: state.modules,
      sobre: config.sobre,
      globalSettings: config.global_settings,
      produtos: state.produtos,
      socialLinks: state.socialLinks,
    };

    await firebaseManager.saveData(dataToSave);

    state.hasUnsavedChanges = false;
    updateSaveStatus();
    showToast("✅ Site atualizado!", "success");
    showSaved();
  } catch (error) {
    console.error("❌ Erro ao salvar:", error);
    showToast(`Erro: ${error.message}`, "error");
  }
}

/**
 * Status de salvamento
 */
function markAsUnsaved() {
  state.hasUnsavedChanges = true;
  updateSaveStatus();
}

function updateSaveStatus() {
  const saveStatus = document.getElementById("saveStatus");
  const saveText = document.getElementById("saveText");

  if (!saveStatus || !saveText) return;

  if (state.hasUnsavedChanges) {
    saveStatus.className = "save-status unsaved";
    saveText.innerHTML = "⚫ Não salvo";
  } else {
    saveStatus.className = "save-status saved";
    saveText.textContent = "✓ Salvo";
  }
}

// ===== FUNÇÕES DE INTERFACE =====

function setLogoType(type) {
  const imageGroup = document.getElementById("logoImageInputGroup");
  const logoTypeInput = document.getElementById("logoType");

  if (imageGroup && logoTypeInput) {
    logoTypeInput.value = type;
    imageGroup.classList.toggle("hidden", type === "text");
  }

  markAsUnsaved();
  update();
}

async function logout() {
  try {
    await window.authManager.logout();
    showToast("Logout realizado!", "success");
  } catch (error) {
    console.error("❌ Erro ao fazer logout:", error);
    showToast(`Erro: ${error.message}`, "error");
  }
}

function validateForm() {
  return true;
}

async function handleImageUpload(event, targetInputId, previewSelector) {
  const file = event.target.files[0];
  if (!file || !firebaseManager) return;

  // ✅ CORREÇÃO: Obter a extensão original do arquivo
  const fileExtension = file.name.split('.').pop();
  if (!fileExtension) {
      showToast("Nome de ficheiro inválido. Certifique-se que tem uma extensão (ex: .svg, .png).", "error");
      return;
  }

  try {
    showToast("Fazendo upload...", "info");

    let storagePath = "images/";
    
    // ✅ CORREÇÃO: Usar a extensão original para o caminho
    if (targetInputId === "logoImageUrl") storagePath += `logo.${fileExtension}`;
    else if (targetInputId === "faviconImageUrl") storagePath += `favicon.${fileExtension}`;
    else if (targetInputId === "bannerImagem") storagePath += `banner.${fileExtension}`;
    else if (targetInputId === "sobreImagem") storagePath += `sobre.${fileExtension}`;
    else storagePath += `${Date.now()}.${fileExtension}`;

    const downloadUrl = await firebaseManager.uploadImage(file, storagePath);

    document.getElementById(targetInputId).value = downloadUrl;

    if (previewSelector) {
      const previewEl = document.querySelector(previewSelector);
      if (previewEl) {
        // Para SVGs, é melhor usar <img> para preservar a proporção
        if (file.type === 'image/svg+xml') {
            previewEl.style.backgroundImage = 'none';
            previewEl.innerHTML = `<img src="${downloadUrl}" style="width: 100%; height: 100%; object-fit: contain;">`;
        } else {
            previewEl.innerHTML = '';
            previewEl.style.backgroundImage = `url(${downloadUrl})`;
        }
      }
    }

    showToast("✅ Upload concluído!", "success");
    markAsUnsaved();
    update();
  } catch (error) {
    console.error("❌ Erro no upload:", error);
    showToast(`Erro: ${error.message}`, "error");
    event.target.value = "";
  }
}

// ===== PRODUTOS =====

function openProdutoModal(index) {
  const modal = document.getElementById("produtoModal");
  document.getElementById("produtoModalTitle").textContent = "Adicionar Produto";
  document.getElementById("produtoId").value = "";
  document.getElementById("produtoNome").value = "";
  document.getElementById("produtoPreco").value = "";
  document.getElementById("produtoDescricao").value = "";
  modal.style.display = "block";
}

function editarProduto(index) {
  const modal = document.getElementById("produtoModal");
  const produto = state.produtos[index];
  document.getElementById("produtoModalTitle").textContent = "Editar Produto";
  document.getElementById("produtoId").value = index;
  document.getElementById("produtoNome").value = produto.nome;
  document.getElementById("produtoPreco").value = produto.preco;
  document.getElementById("produtoDescricao").value = produto.descricao || "";
  modal.style.display = "block";
}

function closeProdutoModal() {
  document.getElementById("produtoModal").style.display = "none";
}

function saveProduto() {
  const id = document.getElementById("produtoId").value;
  const nome = document.getElementById("produtoNome").value.trim();
  const preco = document.getElementById("produtoPreco").value.trim();
  const descricao = document.getElementById("produtoDescricao").value.trim();

  if (!nome || !preco) {
    showToast("Nome e preço obrigatórios", "error");
    return;
  }

  const produto = { nome, preco, descricao };

  if (id !== "") {
    state.produtos[parseInt(id)] = produto;
  } else {
    state.produtos.push(produto);
  }

  renderProdutos();
  markAsUnsaved();
  closeProdutoModal();
  showToast("Produto salvo!", "success");
}

function removerProduto(index) {
  if (confirm("Remover?")) {
    state.produtos.splice(index, 1);
    renderProdutos();
    markAsUnsaved();
  }
}

// ===== REDES SOCIAIS =====

function addSocialLink() {
  editSocialLink(-1);
}

function editSocialLink(index) {
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
}

function closeSocialModal() {
  const modal = document.getElementById("socialLinkModal");
  if (modal) modal.style.display = "none";
}

function saveSocialLinkChanges() {
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
}

function removeSocialLink(index) {
  if (confirm("Remover?")) {
    state.socialLinks.splice(index, 1);
    renderSocialLinks();
    markAsUnsaved();
  }
}

// ===== INICIALIZAÇÃO =====

if (window.self !== window.top) {
  window.top.location = window.self.location;
}

document.addEventListener("DOMContentLoaded", async function () {
  console.log("📄 DOM carregado");

  if (!window.authManager) {
    showToast("Erro: Auth Manager não carregado", "error");
    return;
  }

  const user = await window.authManager.waitUntilReady();

  if (user) {
    console.log("✅ Usuário autenticado:", user.email);
    try {
      await initializeFirebaseWithRealtimeUpdates();
    } catch (error) {
      console.error("❌ Erro Firebase:", error);
      showToast("Erro ao conectar", "error");
    }
  } else {
    showToast("Não autenticado", "warning");
  }
});

// ===== EXPOSIÇÃO GLOBAL =====

window.handleImageUpload = handleImageUpload;
window.openProdutoModal = openProdutoModal;
window.closeProdutoModal = closeProdutoModal;
window.saveProduto = saveProduto;
window.setLogoType = setLogoType;
window.logout = logout;
window.saveConfig = saveConfig;
window.editarProduto = editarProduto;
window.removerProduto = removerProduto;
window.editSocialLink = editSocialLink;
window.saveSocialLinkChanges = saveSocialLinkChanges;
window.closeSocialModal = closeSocialModal;
window.removeSocialLink = removeSocialLink;
window.addSocialLink = addSocialLink;
window.update = update;
window.renderProdutos = renderProdutos;
window.renderSocialLinks = renderSocialLinks;

updateSaveStatus();
console.log("✅ [app.js] Inicialização concluída");