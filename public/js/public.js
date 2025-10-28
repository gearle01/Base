// ✅ OTIMIZADO: Usando módulos e sistema de cache global
const { debounce, cache, vdom, imageLoader, loading, error } = window.SiteModules;

// ✅ OTIMIZADO: Skeleton loading com Virtual DOM
function showLoadingSkeleton() {
  const produtosGrid = document.getElementById("produtosGrid");
  if (!produtosGrid) return;

  // Criar cards de skeleton usando Virtual DOM
  const skeletons = Array(3).fill(null).map(() => 
    vdom.createElement('div', { 
      className: 'skeleton-card',
      style: `
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 8px;
        height: 200px;
        margin-bottom: 16px;
      `
    })
  );

  // Adicionar animação de shimmer ao CSS se não existir
  if (!document.getElementById('skeleton-style')) {
    const style = document.createElement('style');
    style.id = 'skeleton-style';
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Limpar e adicionar skeletons
  produtosGrid.innerHTML = '';
  skeletons.forEach(skeleton => {
    produtosGrid.appendChild(vdom.createRealElement(skeleton));
  });
}

// ✅ OTIMIZADO: Inicialização do Firebase
async function initializeFirebase() {
  try {
    if (typeof firebase === "undefined") {
      console.log("⏳ Aguardando Firebase SDK...");
      setTimeout(initializeFirebase, 100);
      return;
    }

    if (firebase.apps.length > 0) {
      console.log("✅ Firebase já inicializado");
      await loadDataFromFirestore();
      return;
    }

    if (typeof firebaseConfig === "undefined") {
      console.log("⏳ Aguardando firebaseConfig...");
      setTimeout(initializeFirebase, 100);
      return;
    }

    console.log("🔥 Inicializando Firebase...");
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase inicializado com sucesso!");

    await loadDataFromFirestore();

  } catch (err) {
    console.error('❌ Erro ao inicializar Firebase:', err);
    error.show('Erro ao inicializar o sistema. Por favor, recarregue a página.', 'error');
    loading.hide('site');
  }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", function () {
  console.log("🔥 public.js: DOM carregado");
  loading.show('site', 'Carregando site...');
  initializeFirebase().catch(err => {
    console.error('❌ Erro na inicialização:', err);
    error.show('Erro ao carregar o site. Por favor, recarregue a página.', 'error');
    loading.hide('site');
  });
});

// ✅ OTIMIZAÇÃO: Carregar dados com suporte a modo offline
async function loadDataFromFirestore() {
  try {
    // Verifica se temos dados em cache
    const cachedData = cache.get('site', 'data');
    const cacheTimestamp = cache.get('site', 'timestamp');
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

    if (cachedData && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
      console.log("📦 Usando cache do site");
      updatePublicSite(cachedData);
      return;
    }

    showLoadingSkeleton();
    console.log("🔍 Buscando dados do Firestore...");

    const db = firebase.firestore();
    const clientId = "cliente-001";

    // ✅ OTIMIZADO: Sistema de Timeout
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 10000)
    );

    // ✅ OTIMIZADO: Função para buscar dados com retry
    async function fetchWithRetry(promise, retries = 3) {
      try {
        return await Promise.race([promise, timeout]);
      } catch (error) {
        if (retries > 0 && error.message === 'Timeout') {
          console.log(`🔄 Tentando novamente... (${retries} tentativas restantes)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchWithRetry(promise, retries - 1);
        }
        throw error;
      }
    }

    const clientDocRef = db.collection("site").doc(clientId);

    // ✅ OTIMIZADO: Carregar dados com retry
    const [
      clientDoc,
      coresDoc,
      contatoDoc,
      modulesDoc,
      sobreDoc,
      globalDoc,
      produtosSnap,
    ] = await Promise.all([
      fetchWithRetry(clientDocRef.get({ source: 'server' }).catch(() => clientDocRef.get({ source: 'cache' }))),
      fetchWithRetry(clientDocRef.collection("cores").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("contato").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("modules").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("sobre").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("global_settings").doc("data").get()),
      fetchWithRetry(clientDocRef.collection("produtos").get()),
    ]);

    if (!clientDoc.exists) {
      console.error("❌ ERRO CRÍTICO: Documento do cliente não encontrado em '/site/cliente-001'. Verifique se os dados existem neste caminho no seu banco de dados Firestore.");
      const produtosGrid = document.getElementById("produtosGrid");
      if (produtosGrid) produtosGrid.innerHTML = "<p>Nenhum dado encontrado para este site.</p>";
      return;
    }

    console.log("✅ Documento principal encontrado!", clientDoc.data());
    let config = clientDoc.data();

    // Adicionar subcoleções
    if (coresDoc.exists) {
      config.cores = coresDoc.data();
      console.log("✅ cores carregado");
    }
    if (contatoDoc.exists) {
      config.contato = contatoDoc.data();
      console.log("✅ contato carregado");
    }
    if (modulesDoc.exists) {
      config.modules = modulesDoc.data();
      console.log("✅ modules carregado");
    }
    if (sobreDoc.exists) {
      config.sobre = sobreDoc.data();
      console.log("✅ sobre carregado");
    }
    if (globalDoc.exists) {
      config.global_settings = globalDoc.data();
      console.log("✅ global_settings carregado");
    }

    console.log(`ℹ️ Snapshot de produtos contém ${produtosSnap.docs.length} documento(s).`);
    config.produtos = produtosSnap.docs.map((doc) => doc.data());
    console.log(`✅ ${config.produtos.length} produtos carregados`);

    // Atualizar cache
    cache.set('site', 'data', config);
    cache.set('site', 'timestamp', Date.now());

    console.log("🎉 Todos os dados carregados! Objeto de configuração final:", config);
    console.log("🎨 Atualizando site...");
    updatePublicSite(config);
  } catch (error) {
    console.error("❌ Erro ao buscar dados do site:", error);
  }
}

// ✅ OTIMIZADO: Função para criar Virtual DOM dos produtos
function createProductVNode(produto) {
    return vdom.createElement('div', { className: 'product-card', 'data-id': produto.id },
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

// ✅ OTIMIZADO: Renderização otimizada de produtos com Virtual DOM e cache
function renderProdutos(produtos, container) {
    // Verifica cache
    const cachedProducts = cache.get('produtos', 'list');
    const lastProductsHash = cache.get('produtos', 'hash');
    const currentHash = JSON.stringify(produtos);

    if (cachedProducts && lastProductsHash === currentHash) {
        console.log('📦 Usando produtos em cache');
        container.innerHTML = cachedProducts;
    imageLoader.init();
        return;
    }

    // Criar novo Virtual DOM
    const newVirtualProducts = produtos.map(createProductVNode);
    const virtualContainer = vdom.createElement('div', { className: 'products-grid' }, 
        ...newVirtualProducts
    );

    // Se existir DOM anterior, fazer diff e update
    if (container.firstChild) {
        const oldVirtualContainer = container._virtualDOM;
        if (oldVirtualContainer) {
            vdom.updateElement(container, virtualContainer, oldVirtualContainer);
        } else {
            container.innerHTML = '';
            container.appendChild(vdom.createRealElement(virtualContainer));
        }
    } else {
        container.appendChild(vdom.createRealElement(virtualContainer));
    }

    // Salvar referência do Virtual DOM atual
    container._virtualDOM = virtualContainer;

    // Atualizar cache
    cache.set('produtos', 'list', container.innerHTML);
    cache.set('produtos', 'hash', currentHash);

    // Iniciar lazy loading das imagens
    imageLoader.init();
}

// ✅ OTIMIZADO: Função principal de atualização do site
function updatePublicSite(data) {
    console.log("🎨 Atualizando interface do site...");

    // ✅ Aplicar Configurações Globais de Fonte com Virtual DOM
  if (data.global_settings) {
    if (data.global_settings.fontUrl) {
      let fontLink = document.getElementById("dynamic-font");
      if (!fontLink) {
        fontLink = document.createElement("link");
        fontLink.id = "dynamic-font";
        fontLink.rel = "stylesheet";
        document.head.appendChild(fontLink);
      }
      fontLink.href = data.global_settings.fontUrl;
    }

    if (data.global_settings.fontFamily) {
      document.body.style.fontFamily = data.global_settings.fontFamily;
    }

    // ✅ SEGURANÇA: Código de rastreamento validado
    if (data.global_settings.trackingCode) {
      const code = data.global_settings.trackingCode;

      const isGoogleAnalytics =
        code.includes("googletagmanager.com") ||
        code.includes("analytics.google.com");
      const isFacebookPixel = code.includes("facebook.net/en_US/fbevents.js");
      const isHotjar = code.includes("static.hotjar.com");

      // ✅ OTIMIZADO: Sanitização segura do tracking code usando DOMPurify
      if (isGoogleAnalytics || isFacebookPixel || isHotjar) {
        // Lista de domínios permitidos para scripts
        const allowedDomains = [
          'www.googletagmanager.com',
          'analytics.google.com',
          'connect.facebook.net',
          'static.hotjar.com'
        ];

        // Sanitizar o código com DOMPurify
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
          // Verificar se o domínio do script é permitido
          if (scriptSrc && allowedDomains.some(domain => scriptSrc.includes(domain))) {
            const newScript = document.createElement('script');
            newScript.src = scriptSrc;
            if (script.async) newScript.async = true;
            document.body.appendChild(newScript);
          } else if (!scriptSrc && isGoogleAnalytics) {
            // Para GA4, permitir apenas código inline do Google Analytics
            const gaCode = script.textContent;
            if (gaCode && gaCode.includes('gtag') && !gaCode.includes('<') && !gaCode.includes('>')) {
              const newScript = document.createElement('script');
              newScript.textContent = gaCode;
              document.body.appendChild(newScript);
            }
          }
        });
      } else {
        console.warn("⚠️ Código de rastreamento não reconhecido foi bloqueado");
        // TODO: Implementar no servidor (Firebase Functions) - Log de tentativas bloqueadas
      }
    }
  }

  // ✅ Atualizar Logo (com suporte a imagem)
  const logoContainer = document.getElementById("logo");
  if (logoContainer) {
    logoContainer.innerHTML = "";

    if (data.logoType === "image" && data.logoImageUrl) {
      const img = document.createElement("img");
      img.src = data.logoImageUrl;
      img.style.maxHeight = "50px";
      img.alt = data.empresaNome || "Logo";
      logoContainer.appendChild(img);
      console.log("✅ Logo (imagem) atualizado");
    } else {
      logoContainer.textContent = data.empresaNome || "MinhaEmpresa";
      console.log("✅ Logo (texto) atualizado");
    }
  }

  // Atualizar título da página e footer
  document.title = data.empresaNome || "Minha Empresa";
  const footerNome = document.getElementById("footerNome");
  if (footerNome) footerNome.textContent = data.empresaNome || "MinhaEmpresa";

  // NOVO: Atualizar Favicon (Ícone do Site)
  const faviconLink = document.getElementById("faviconLink");
  const iconUrl = data.faviconImageUrl || data.logoImageUrl; // Prioriza Favicon, usa Logo como fallback

  if (faviconLink && iconUrl) {
      faviconLink.href = iconUrl;
      console.log("✅ Favicon atualizado");
  } else if (faviconLink) {
      // Caso não haja URL, define um fallback ou remove o link
      faviconLink.href = ''; 
  }

  // Atualizar banner
  const bannerH1 = document.getElementById("bannerH1");
  if (bannerH1) {
    bannerH1.textContent = data.bannerTitulo || "";
    console.log("✅ Banner título atualizado");
  }

  const bannerP = document.getElementById("bannerP");
  if (bannerP) bannerP.textContent = data.bannerSubtitulo || "";

  const banner = document.querySelector(".banner");
  if (banner && data.bannerImagem) {
    banner.style.backgroundImage = `url(${data.bannerImagem})`;
    console.log("✅ Banner imagem atualizada");
  }

  // ✅ Aplicar cores
  if (data.cores) {
    document.documentElement.style.setProperty(
      "--primary-color",
      data.cores.primaria
    );
    document.documentElement.style.setProperty(
      "--secondary-color",
      data.cores.secundaria
    );

    document.querySelectorAll(".site-nav-links a").forEach((a) => {
      a.style.color = data.cores.primaria;
    });

    document.querySelectorAll(".contact-icon").forEach((icon) => {
      icon.style.background = data.cores.primaria;
    });

    const ctaBtn = document.querySelector(".cta-btn");
    if (ctaBtn) ctaBtn.style.background = data.cores.secundaria;

    console.log("✅ Cores aplicadas");
  }

  // Atualizar seção Sobre
  if (data.sobre) {
    const sobreTexto = document.getElementById("sobreTextoPreview");
    if (sobreTexto) sobreTexto.textContent = data.sobre.texto || "";

    const sobreImagem = document.getElementById("sobreImagemPreview");
    if (sobreImagem && data.sobre.imagem) {
      sobreImagem.style.backgroundImage = `url(${data.sobre.imagem})`;
    }
    console.log("✅ Seção Sobre atualizada");
  }

  // ✅ ATUALIZAR MAPA COM COORDENADAS
  if (data.contato) {
    const latitude = data.contato.latitude || -23.5505;
    const longitude = data.contato.longitude || -46.6333;
    const mostrarMapa = data.contato.mostrarMapa !== false;
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

      if (mapContainer) {
        mapContainer.style.display = "flex";
      }

      console.log(
        `✅ Mapa carregado com coordenadas: ${latitude}, ${longitude}`
      );
    } else {
      if (mapContainer) {
        mapContainer.style.display = "none"; // Esconde completamente
      }
    }

    const enderecoLink = document.getElementById("enderecoLink");
    if (enderecoLink) {
      const endereco = data.contato.endereco || "";
      if (endereco) {
        const enderecoEncoded = encodeURIComponent(endereco);
        enderecoLink.href = `https://www.google.com/maps/search/?api=1&query=${enderecoEncoded}`;
      }
    }
  }

  // ✅ Atualizar contato com telefones
  if (data.contato) {
    const tel1 = data.contato.telefone || "";
    const tel2 = data.contato.telefone2 || "";
    const cleanTel1 = tel1.replace(/\D/g, "");
    const cleanTel2 = tel2.replace(/\D/g, "");

    const whatsappFab = document.getElementById("whatsapp-fab");
    if (whatsappFab && cleanTel1 && cleanTel1.length >= 10) {
      const whatsappNumber = cleanTel1.startsWith("55")
        ? cleanTel1
        : `55${cleanTel1}`;
      whatsappFab.href = `https://wa.me/${whatsappNumber}`;
      whatsappFab.style.display = "flex";
      console.log("✅ WhatsApp link:", whatsappFab.href);
    } else {
      if (whatsappFab) whatsappFab.style.display = "none";
    }

    const telPreview = document.getElementById("telPreview");
    const telLink1 = document.getElementById("telLink1");
    if (telPreview) telPreview.textContent = tel1;
    if (telLink1) telLink1.href = `tel:+55${cleanTel1}`;

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

    const emailPreview = document.getElementById("emailPreview");
    if (emailPreview) emailPreview.textContent = data.contato.email || "";

    const enderecoPreview = document.getElementById("enderecoPreview");
    if (enderecoPreview)
      enderecoPreview.textContent = data.contato.endereco || "";

    console.log("✅ Contato atualizado");
  }

  // ✅ Mostrar/ocultar módulos
  if (data.modules) {
    const sobreSection = document.querySelector(".sobre-section");
    if (sobreSection)
      sobreSection.classList.toggle("hidden", !data.modules.sobre);

    const navSobre = document.querySelector(".nav-sobre");
    if (navSobre) navSobre.classList.toggle("hidden", !data.modules.sobre);

    const produtosSection = document.querySelector(".produtos-section");
    if (produtosSection)
      produtosSection.classList.toggle("hidden", !data.modules.produtos);

    const navProdutos = document.querySelector(".nav-produtos");
    if (navProdutos)
      navProdutos.classList.toggle("hidden", !data.modules.produtos);

    const contatoSection = document.querySelector(".contato-section");
    if (contatoSection)
      contatoSection.classList.toggle("hidden", !data.modules.contato);

    const navContato = document.querySelector(".nav-contato");
    if (navContato)
      navContato.classList.toggle("hidden", !data.modules.contato);
  }

        // Renderizar produtos
        if (data.produtos) {
            const produtosGrid = document.getElementById("produtosGrid");
            if (produtosGrid) {
                renderProdutos(data.produtos, produtosGrid);
            }
        }

        console.log("🎉 Site público atualizado completamente!");
        loading.hide('site');

}