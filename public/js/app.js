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

function renderProdutos() {
  const list = document.getElementById("produtosList");
  if (list) {
    list.innerHTML = state.produtos.map((p, i) => `
    <div class="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
        <div class="w-16 h-16 bg-gray-100 rounded-lg bg-cover bg-center flex-shrink-0" 
             style="background-image: url('${p.imagem || ''}')"></div>
        
        <div class="flex-1 min-w-0">
            <h4 class="font-bold text-gray-900 truncate">${escapeHtml(p.nome)}</h4>
            <p class="text-sm text-gray-500 truncate">${escapeHtml(p.preco)}</p>
        </div>
        
        <div class="flex gap-2">
            <button onclick="editarProduto(${i})" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button onclick="removerProduto(${i})" class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                <i class="fas fa-trash"></i>
            </button>
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
  console.log("📥 Carregando configurações...", config);
  if (!config) return;

  // Helper para definir valores nos inputs
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = (val !== undefined && val !== null) ? val : '';
  };

  // 1. Dados Principais (root)
  // Se saveData salvou espalhado (flat), aqui pegamos direto.
  // Se salvou aninhado em 'main', tentamos essa fallback.
  const mainData = config.main || config;

  setVal('empresaNome', mainData.empresaNome);
  setVal('logoType', mainData.logoType || 'text');
  setVal('logoImageUrl', mainData.logoImageUrl);
  setVal('faviconImageUrl', mainData.faviconImageUrl);
  setVal('bannerTitulo', mainData.bannerTitulo);
  setVal('bannerSubtitulo', mainData.bannerSubtitulo);
  setVal('bannerImagem', mainData.bannerImagem);

  // Atualiza visibilidade do upload de logo baseada no tipo
  const logoType = mainData.logoType || 'text';
  document.getElementById('logoImageInputGroup')?.classList.toggle('hidden', logoType !== 'image');

  // 2. Configurações Globais
  const globalSettings = mainData.global_settings || {};
  setVal('fontUrl', globalSettings.fontUrl);
  setVal('fontFamily', globalSettings.fontFamily);

  // 3. Cores
  if (config.cores) {
    setVal('corPrimaria', config.cores.primaria || '#007bff');
    setVal('corSecundaria', config.cores.secundaria || '#28a745');
  }

  // 4. Seção Sobre
  if (config.sobre) {
    setVal('sobreTexto', config.sobre.texto);
    setVal('sobreImagem', config.sobre.imagem);
    if (config.sobre.imagem) document.getElementById('sobrePreview').style.backgroundImage = `url(${config.sobre.imagem})`;
  }

  // Previews principais
  if (mainData.logoImageUrl) document.getElementById('logoPreview').style.backgroundImage = `url(${mainData.logoImageUrl})`;
  if (mainData.faviconImageUrl) document.getElementById('faviconPreview').style.backgroundImage = `url(${mainData.faviconImageUrl})`;
  if (mainData.bannerImagem) document.getElementById('bannerPreview').style.backgroundImage = `url(${mainData.bannerImagem})`;

  // 5. Contato
  if (config.contato) {
    setVal('telefone', config.contato.telefone);
    setVal('telefone2', config.contato.telefone2);
    setVal('email', config.contato.email);
    setVal('endereco', config.contato.endereco);
    setVal('latitude', config.contato.latitude);
    setVal('longitude', config.contato.longitude);
    const mapCheck = document.getElementById('mostrarMapa');
    if (mapCheck) mapCheck.checked = !!config.contato.mostrarMapa;
  }

  // 6. Atualizar Estado Local
  if (config.modules) state.modules = { ...state.modules, ...config.modules }; // Merge com defaults
  if (config.produtos) state.produtos = config.produtos;
  if (config.socialLinks) state.socialLinks = config.socialLinks;

  // 7. Atualizar UI dos Switches
  Object.keys(state.modules).forEach(mod => {
    updateSwitchVisual(mod, state.modules[mod]);
  });

  // 8. Renderizar Listas
  renderProdutos();
  renderSocialLinks();

  // 9. Atualizar Preview
  update();
}

// ===== PREVIEW MODE =====
window.setPreviewMode = (mode) => {
  const container = document.getElementById('preview-card'); // Agora usamos ID direto
  const btnDesktop = document.getElementById('btn-desktop');
  const btnMobile = document.getElementById('btn-mobile');

  if (!container) return;

  if (mode === 'mobile') {
    container.style.maxWidth = '393px'; // iPhone 15/16 width
    container.style.height = '852px'; // Height constraint for better realism
    container.style.maxHeight = '90vh'; // Ensure it fits in viewport
    container.style.border = '12px solid #1f2937'; // Darker, sleeker bezel
    container.style.borderRadius = '50px'; // More rounded corners like modern iPhones

    btnMobile.classList.add('bg-white', 'shadow-sm', 'text-gray-700');
    btnMobile.classList.remove('text-gray-400');

    btnDesktop.classList.remove('bg-white', 'shadow-sm', 'text-gray-700');
    btnDesktop.classList.add('text-gray-400');
  } else {
    container.style.maxWidth = '100%';
    container.style.height = '100%'; // Reset height
    container.style.maxHeight = '100%';
    container.style.border = '1px solid #e5e7eb'; // Default light border
    container.style.borderRadius = '16px'; // Standard card radius

    btnDesktop.classList.add('bg-white', 'shadow-sm', 'text-gray-700');
    btnDesktop.classList.remove('text-gray-400');

    btnMobile.classList.remove('bg-white', 'shadow-sm', 'text-gray-700');
    btnMobile.classList.add('text-gray-400');
  }
};

// ===== SWITCHES LOGIC =====
window.toggleModule = (mod) => {
  state.modules[mod] = !state.modules[mod];
  updateSwitchVisual(mod, state.modules[mod]);
  markAsUnsaved();
  update();
};

function updateSwitchVisual(mod, isActive) {
  const btn = document.querySelector(`.module-switch[data-module="${mod}"]`);
  if (!btn) return;

  const thumb = btn.querySelector('.switch-thumb');

  if (isActive) {
    btn.classList.remove('bg-gray-300');
    btn.classList.add('bg-blue-600');
    thumb.classList.remove('translate-x-0');
    thumb.classList.add('translate-x-6');
  } else {
    btn.classList.add('bg-gray-300');
    btn.classList.remove('bg-blue-600');
    thumb.classList.add('translate-x-0');
    thumb.classList.remove('translate-x-6');
  }
}

// ===== FIREBASE =====
async function initializeFirebaseWithRealtimeUpdates() {
  if (!window.firebaseManager) {
    if (typeof FirebaseRealtimeManager === 'undefined') {
      console.error("FirebaseRealtimeManager class not found. Check load order.");
      return;
    }
    window.firebaseManager = new FirebaseRealtimeManager();
  }

  await window.firebaseManager.init();

  const data = await window.firebaseManager.loadInitialData();
  if (data) loadConfig(data);

  // Subscribers
  window.firebaseManager.subscribeToDocument("site", "cliente-001", (d) => {
    console.log("🔄 Atualização recebida do Firebase:", d);
    loadConfig(d);
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
    const url = await window.firebaseManager.uploadImage(file, `uploads / ${Date.now()}_${file.name} `);
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
window.toggleModal = (modalId, show) => {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  if (show) {
    modal.classList.remove('hidden');
    // Pequeno delay para permitir a transição
    setTimeout(() => {
      modal.classList.remove('opacity-0');
      modal.querySelector('div').classList.remove('scale-95');
    }, 10);
  } else {
    modal.classList.add('opacity-0');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300); // Tempo da transição
  }
}

window.openProdutoModal = (idx) => {
  document.getElementById('produtoId').value = idx === -1 ? '' : idx;

  if (idx === -1) {
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
  window.toggleModal('produtoModal', true);
};

window.closeProdutoModal = () => window.toggleModal('produtoModal', false);

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

  window.toggleModal('socialLinkModal', true);
};

window.closeSocialModal = () => window.toggleModal('socialLinkModal', false);

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