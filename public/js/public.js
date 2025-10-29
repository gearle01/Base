/**
 * ✅ OTIMIZADO: Script público do site com carregamento eficiente
 * @version 2.0.0
 */

// Desestruturação dos módulos necessários
const { debounce, cache, vdom, imageLoader, loading, error } = window.SiteModules;

// Estado global do carregamento
let isLoading = false;
let loadPromise = null;

/**
 * Cria skeleton loading usando Virtual DOM
 */
function showLoadingSkeleton() {
  const produtosGrid = document.getElementById("produtosGrid");
  if (!produtosGrid) return;

  // Criar cards de skeleton usando Virtual DOM
  const skeletons = Array(3).fill(null).map(() => 
    vdom.createElement('div', { 
      className: 'skeleton-card'
    })
  );

  // Limpar e adicionar skeletons
  produtosGrid.innerHTML = '';
  skeletons.forEach(skeleton => {
    produtosGrid.appendChild(vdom.createRealElement(skeleton));
  });
}

/**
 * Inicialização do Firebase com retry
 */
async function initializeFirebase() {
  try {
    // Verifica se Firebase está disponível
    if (typeof firebase === "undefined") {
      console.log("⏳ Aguardando Firebase SDK...");
      await new Promise(resolve => setTimeout(resolve, 100));
      return initializeFirebase(); // Retry
    }

    // Se já inicializado, carrega dados
    if (firebase.apps.length > 0) {
      console.log("✅ Firebase já inicializado");
      await loadDataFromFirestore();
      return;
    }

    // Verifica configuração
    if (typeof firebaseConfig === "undefined") {
      console.log("⏳ Aguardando firebaseConfig...");
      await new Promise(resolve => setTimeout(resolve, 100));
      return initializeFirebase(); // Retry
    }

    console.log("🔥 Inicializando Firebase...");
    firebase.initializeApp(firebaseConfig);
    
    // Configura persistência offline
    const db = firebase.firestore();
    try {
      await db.enablePersistence({ synchronizeTabs: true });
      console.log("✅ Persistência offline ativada");
    } catch (err) {
      if (err.code === 'failed-precondition') {
        console.warn("⚠️ Múltiplas abas abertas");
      } else if (err.code === 'unimplemented') {
        console.warn("⚠️ Browser não suporta persistência");
      }
    }
    
    console.log("✅ Firebase inicializado com sucesso!");
    await loadDataFromFirestore();

  } catch (err) {
    console.error('❌ Erro ao inicializar Firebase:', err);
    error.show('Erro ao carregar o site. Recarregando...', 'error');
    
    // Retry após 2 segundos
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }
}

/**
 * Carrega dados do Firestore com cache inteligente
 */
async function loadDataFromFirestore() {
  // Evita múltiplas chamadas simultâneas
  if (isLoading && loadPromise) {
    console.log("📦 Já está carregando, aguardando...");
    return loadPromise;
  }

  try {
    isLoading = true;
    
    // Verifica cache primeiro
    const cachedData = cache.get('site', 'data');
    const cacheTimestamp = cache.get('site', 'timestamp');
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

    if (cachedData && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
      console.log("📦 Usando cache do site");
      updatePublicSite(cachedData);
      isLoading = false;
      return;
    }

    // Mostra skeleton enquanto carrega
    showLoadingSkeleton();
    console.log("🔍 Buscando dados do Firestore...");

    const db = firebase.firestore();
    const clientId = "cliente-001";
    const clientDocRef = db.collection("site").doc(clientId);

    // Timeout para operações
    const createTimeout = (ms) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    );

    // Função para buscar com retry
    const fetchWithRetry = async (promise, retries = 2) => {
      try {
        return await Promise.race([promise, createTimeout(10000)]);
      } catch (error) {
        if (retries > 0 && error.message === 'Timeout') {
          console.log(`🔄 Tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchWithRetry(promise, retries - 1);
        }
        throw error;
      }
    };

    // Carrega dados em paralelo
    loadPromise = Promise.all([
      fetchWithRetry(clientDocRef.get()),
      fetchWithRetry(clientDocRef.collection("cores").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("contato").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("modules").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("sobre").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("global_settings").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("produtos").get()),
    ]);

    const [
      clientDoc,
      coresDoc,
      contatoDoc,
      modulesDoc,
      sobreDoc,
      globalDoc,
      produtosSnap,
    ] = await loadPromise;

    // Verifica se documento principal existe
    if (!clientDoc.exists) {
      console.error("❌ Documento do cliente não encontrado");
      error.show("Nenhum dado encontrado para este site.", "error");
      return;
    }

    console.log("✅ Documento principal encontrado!");
    let config = clientDoc.data();

    // Adicionar subcoleções
    if (coresDoc.exists) {
      config.cores = coresDoc.data();
      console.log("✅ Cores carregadas");
    }
    if (contatoDoc.exists) {
      config.contato = contatoDoc.data();
      console.log("✅ Contato carregado");
    }
    if (modulesDoc.exists) {
      config.modules = modulesDoc.data();
      console.log("✅ Módulos carregados");
    }
    if (sobreDoc.exists) {
      config.sobre = sobreDoc.data();
      console.log("✅ Sobre carregado");
    }
    if (globalDoc.exists) {
      config.global_settings = globalDoc.data();
      console.log("✅ Configurações globais carregadas");
    }

    // Produtos
    config.produtos = produtosSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log(`✅ ${config.produtos.length} produtos carregados`);

    // Atualizar cache
    cache.set('site', 'data', config);
    cache.set('site', 'timestamp', Date.now());

    console.log("🎉 Todos os dados carregados!");
    updatePublicSite(config);

  } catch (error) {
    console.error("❌ Erro ao buscar dados:", error);
    error.show('Erro ao carregar dados. Tentando usar cache...', 'error');
    
    // Tenta usar cache antigo se disponível
    const cachedData = cache.get('site', 'data');
    if (cachedData) {
      console.log("📦 Usando cache antigo");
      updatePublicSite(cachedData);
    } else {
      error.show('Não foi possível carregar o site.', 'error');
    }
  } finally {
    isLoading = false;
    loadPromise = null;
    loading.hide('site');
  }
}

/**
 * Cria Virtual DOM para um produto
 */
function createProductVNode(produto) {
  return vdom.createElement('div', { 
    className: 'product-card', 
    'data-id': produto.id 
  },
    vdom.createElement('div', { 
      className: 'product-image',
      style: `background-image: url(${produto.imagem || 'https://via.placeholder.com/400'}); background-position: ${produto.foco || 'center'};`
    }),
    vdom.createElement('div', { className: 'product-info' },
      vdom.createElement('h3', {}, produto.nome),
      vdom.createElement('div', { className: 'product-price' }, produto.preco),
      produto.descricao ? vdom.createElement('p', {}, produto.descricao) : null
    )
  );
}

/**
 * Renderiza produtos com Virtual DOM e cache
 */
function renderProdutos(produtos, container) {
  if (!container) return;
  
  // Verifica cache de renderização
  const cachedProducts = cache.get('produtos', 'rendered');
  const lastProductsHash = cache.get('produtos', 'hash');
  const currentHash = JSON.stringify(produtos.map(p => ({ id: p.id, nome: p.nome, preco: p.preco })));

  // Se nada mudou, não re-renderiza
  if (cachedProducts && lastProductsHash === currentHash) {
    console.log('📦 Produtos já renderizados, pulando...');
    return;
  }

  console.log('🎨 Renderizando produtos...');

  // Criar novo Virtual DOM
  const newVirtualProducts = produtos.map(createProductVNode);
  
  // Se não há nada no container, adiciona tudo
  if (!container.firstChild || !container._virtualDOM) {
    container.innerHTML = '';
    newVirtualProducts.forEach(vnode => {
      container.appendChild(vdom.createRealElement(vnode));
    });
    container._virtualDOM = newVirtualProducts;
  } else {
    // Faz diff e atualiza apenas o necessário
    const oldVirtualProducts = container._virtualDOM;
    const maxLength = Math.max(newVirtualProducts.length, oldVirtualProducts.length);
    
    for (let i = 0; i < maxLength; i++) {
      vdom.updateElement(container, newVirtualProducts[i], oldVirtualProducts[i], i);
    }
    
    container._virtualDOM = newVirtualProducts;
  }

  // Atualizar cache
  cache.set('produtos', 'rendered', true);
  cache.set('produtos', 'hash', currentHash);

  // Iniciar lazy loading
  imageLoader.init();
}

/**
 * Atualiza o site com os dados carregados
 */
function updatePublicSite(data) {
  console.log("🎨 Atualizando interface do site...");

  try {
    // Aplicar fonte personalizada
    if (data.global_settings?.fontUrl) {
      let fontLink = document.getElementById("dynamic-font");
      if (!fontLink) {
        fontLink = document.createElement("link");
        fontLink.id = "dynamic-font";
        fontLink.rel = "stylesheet";
        document.head.appendChild(fontLink);
      }
      fontLink.href = data.global_settings.fontUrl;
    }

    if (data.global_settings?.fontFamily) {
      document.body.style.fontFamily = data.global_settings.fontFamily;
    }

    // Código de rastreamento (sanitizado)
    if (data.global_settings?.trackingCode) {
      applyTrackingCode(data.global_settings.trackingCode);
    }

    // Atualizar logo
    updateLogo(data);

    // Atualizar título e footer
    document.title = data.empresaNome || "Minha Empresa";
    const footerNome = document.getElementById("footerNome");
    if (footerNome) footerNome.textContent = data.empresaNome || "MinhaEmpresa";

    // Atualizar favicon
    updateFavicon(data);

    // Atualizar banner
    updateBanner(data);

    // Aplicar cores
    applyColors(data.cores);

    // Atualizar seção Sobre
    updateAboutSection(data.sobre);

    // Atualizar contato e mapa
    updateContactSection(data.contato);

    // Atualizar módulos visíveis
    updateModuleVisibility(data.modules);

    // Renderizar produtos
    if (data.produtos) {
      const produtosGrid = document.getElementById("produtosGrid");
      if (produtosGrid) {
        renderProdutos(data.produtos, produtosGrid);
      }
    }

    console.log("🎉 Site atualizado com sucesso!");

  } catch (err) {
    console.error("❌ Erro ao atualizar site:", err);
    error.show('Erro ao atualizar interface', 'error');
  }
}

/**
 * Aplica código de rastreamento de forma segura
 */
function applyTrackingCode(code) {
  const isGoogleAnalytics = code.includes("googletagmanager.com") || 
                           code.includes("analytics.google.com");
  const isFacebookPixel = code.includes("facebook.net/en_US/fbevents.js");
  const isHotjar = code.includes("static.hotjar.com");

  if (!(isGoogleAnalytics || isFacebookPixel || isHotjar)) {
    console.warn("⚠️ Código de rastreamento não reconhecido");
    return;
  }

  const allowedDomains = [
    'www.googletagmanager.com',
    'analytics.google.com',
    'connect.facebook.net',
    'static.hotjar.com'
  ];

  // Sanitizar com DOMPurify
  const cleanCode = DOMPurify.sanitize(code, {
    ALLOWED_TAGS: ['script'],
    ALLOWED_ATTR: ['src', 'async', 'defer'],
    ADD_TAGS: ['script'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
    RETURN_DOM: true
  });

  const scripts = cleanCode.querySelectorAll('script');
  scripts.forEach((script) => {
    const scriptSrc = script.src;
    if (scriptSrc && allowedDomains.some(domain => scriptSrc.includes(domain))) {
      const newScript = document.createElement('script');
      newScript.src = scriptSrc;
      if (script.async) newScript.async = true;
      document.body.appendChild(newScript);
    }
  });
}

/**
 * Atualiza o logo
 */
function updateLogo(data) {
  const logoContainer = document.getElementById("logo");
  if (!logoContainer) return;

  logoContainer.innerHTML = "";

  if (data.logoType === "image" && data.logoImageUrl) {
    const img = document.createElement("img");
    img.src = data.logoImageUrl;
    img.style.maxHeight = "50px";
    img.alt = data.empresaNome || "Logo";
    logoContainer.appendChild(img);
  } else {
    logoContainer.textContent = data.empresaNome || "MinhaEmpresa";
  }
}

/**
 * Atualiza o favicon
 */
function updateFavicon(data) {
  const faviconLink = document.getElementById("faviconLink");
  const iconUrl = data.faviconImageUrl || data.logoImageUrl;

  if (faviconLink && iconUrl) {
    faviconLink.href = iconUrl;
  }
}

/**
 * Atualiza o banner
 */
function updateBanner(data) {
  const bannerH1 = document.getElementById("bannerH1");
  if (bannerH1) bannerH1.textContent = data.bannerTitulo || "";

  const bannerP = document.getElementById("bannerP");
  if (bannerP) bannerP.textContent = data.bannerSubtitulo || "";

  const banner = document.querySelector(".banner");
  if (banner && data.bannerImagem) {
    banner.style.backgroundImage = `url(${data.bannerImagem})`;
  }
}

/**
 * Aplica cores do tema
 */
function applyColors(cores) {
  if (!cores) return;

  document.documentElement.style.setProperty("--primary-color", cores.primaria);
  document.documentElement.style.setProperty("--secondary-color", cores.secundaria);

  document.querySelectorAll(".site-nav-links a").forEach(a => {
    a.style.color = cores.primaria;
  });

  document.querySelectorAll(".contact-icon").forEach(icon => {
    icon.style.background = cores.primaria;
  });

  const ctaBtn = document.querySelector(".cta-btn");
  if (ctaBtn) ctaBtn.style.background = cores.secundaria;
}

/**
 * Atualiza seção Sobre
 */
function updateAboutSection(sobre) {
  if (!sobre) return;

  const sobreTexto = document.getElementById("sobreTextoPreview");
  if (sobreTexto) sobreTexto.textContent = sobre.texto || "";

  const sobreImagem = document.getElementById("sobreImagemPreview");
  if (sobreImagem && sobre.imagem) {
    sobreImagem.style.backgroundImage = `url(${sobre.imagem})`;
  }
}

/**
 * Atualiza seção de contato
 */
function updateContactSection(contato) {
  if (!contato) return;

  // Telefones
  const tel1 = contato.telefone || "";
  const tel2 = contato.telefone2 || "";
  const cleanTel1 = tel1.replace(/\D/g, "");
  const cleanTel2 = tel2.replace(/\D/g, "");

  // WhatsApp
  const whatsappFab = document.getElementById("whatsapp-fab");
  if (whatsappFab && cleanTel1 && cleanTel1.length >= 10) {
    const whatsappNumber = cleanTel1.startsWith("55") ? cleanTel1 : `55${cleanTel1}`;
    whatsappFab.href = `https://wa.me/${whatsappNumber}`;
    whatsappFab.style.display = "flex";
  } else if (whatsappFab) {
    whatsappFab.style.display = "none";
  }

  // Telefone 1
  const telPreview = document.getElementById("telPreview");
  const telLink1 = document.getElementById("telLink1");
  if (telPreview) telPreview.textContent = tel1;
  if (telLink1) telLink1.href = `tel:+55${cleanTel1}`;

  // Telefone 2
  const contactTel2 = document.getElementById("contact-tel2");
  const telPreview2 = document.getElementById("telPreview2");
  const telLink2 = document.getElementById("telLink2");

  if (tel2 && contactTel2) {
    if (telPreview2) telPreview2.textContent = tel2;
    if (telLink2) telLink2.href = `tel:+55${cleanTel2}`;
    contactTel2.classList.remove("hidden");
  } else if (contactTel2) {
    contactTel2.classList.add("hidden");
  }

  // Email e endereço
  const emailPreview = document.getElementById("emailPreview");
  if (emailPreview) emailPreview.textContent = contato.email || "";

  const enderecoPreview = document.getElementById("enderecoPreview");
  if (enderecoPreview) enderecoPreview.textContent = contato.endereco || "";

  // Mapa
  updateMap(contato);
}

/**
 * Atualiza o mapa
 */
function updateMap(contato) {
  const latitude = contato.latitude || -23.5505;
  const longitude = contato.longitude || -46.6333;
  const mostrarMapa = contato.mostrarMapa !== false;
  const mapContainer = document.getElementById("mapContainer");
  const mapEmbed = document.getElementById("googleMapEmbed");

  if (mostrarMapa && mapEmbed) {
    const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${latitude},${longitude}&zoom=15&center=${latitude},${longitude}`;

    mapEmbed.innerHTML = `
      <iframe 
        width="100%" 
        height="100%" 
        style="border:0; min-height: 350px; border-radius: 8px;" 
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        src="${mapUrl}">
      </iframe>
    `;

    if (mapContainer) mapContainer.style.display = "flex";
  } else if (mapContainer) {
    mapContainer.style.display = "none";
  }

  // Link do endereço
  const enderecoLink = document.getElementById("enderecoLink");
  if (enderecoLink && contato.endereco) {
    const enderecoEncoded = encodeURIComponent(contato.endereco);
    enderecoLink.href = `https://www.google.com/maps/search/?api=1&query=${enderecoEncoded}`;
  }
}

/**
 * Atualiza visibilidade dos módulos
 */
function updateModuleVisibility(modules) {
  if (!modules) return;

  const toggleModule = (moduleClass, enabled) => {
    const section = document.querySelector(`.${moduleClass}-section`);
    const nav = document.querySelector(`.nav-${moduleClass}`);
    
    if (section) section.classList.toggle("hidden", !enabled);
    if (nav) nav.classList.toggle("hidden", !enabled);
  };

  toggleModule('sobre', modules.sobre);
  toggleModule('produtos', modules.produtos);
  toggleModule('contato', modules.contato);
}

// Inicialização quando DOM estiver pronto
document.addEventListener("DOMContentLoaded", function () {
  console.log("🔥 public.js: DOM carregado");
  loading.show('site', 'Carregando site...');
  
  initializeFirebase().catch(err => {
    console.error('❌ Erro na inicialização:', err);
    error.show('Erro ao carregar o site.', 'error');
    loading.hide('site');
  });
});