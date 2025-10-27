// Função para escapar HTML e prevenir XSS
function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return unsafe;
  const div = document.createElement("div");
  div.textContent = unsafe;
  return div.innerHTML;
}

// ✅ OTIMIZAÇÃO: Cache aumentado para 5 minutos
const cache = {
  data: null,
  timestamp: 0,
  isValid: function () {
    return this.data && Date.now() - this.timestamp < 300000; // 5 min cache
  },
};

function showLoadingSkeleton() {
  const produtosGrid = document.getElementById("produtosGrid");
  if (produtosGrid) {
    produtosGrid.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("🔥 public.js: DOM carregado");

  function initializeFirebase() {
    if (typeof firebase === "undefined") {
      console.log("⏳ Aguardando Firebase SDK...");
      setTimeout(initializeFirebase, 100);
      return;
    }

    if (firebase.apps.length > 0) {
      console.log("✅ Firebase já inicializado (pelo init.js).");
      loadDataFromFirestore();
      return;
    }

    if (typeof firebaseConfig === "undefined") {
      console.log("⏳ Aguardando firebaseConfig... (local env)");
      setTimeout(initializeFirebase, 100);
      return;
    }

    console.log("🔥 Inicializando Firebase no public.js... (local env)");
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase inicializado com sucesso! (local env)");

    loadDataFromFirestore();
  }

  initializeFirebase();
});

// ✅ OTIMIZAÇÃO: Carregar dados com Promise.all
async function loadDataFromFirestore() {
  if (cache.isValid()) {
    console.log("📦 Usando cache");
    updatePublicSite(cache.data);
    return;
  }

  showLoadingSkeleton();
  console.log("🔍 Buscando dados do Firestore...");

  const db = firebase.firestore();
  const clientId = "cliente-001";

  try {
    const clientDocRef = db.collection("site").doc(clientId);

    // ✅ OTIMIZAÇÃO CRÍTICA: Carregar tudo em paralelo
    const [
      clientDoc,
      coresDoc,
      contatoDoc,
      modulesDoc,
      sobreDoc,
      globalDoc,
      produtosSnap,
    ] = await Promise.all([
      clientDocRef.get(),
      clientDocRef.collection("cores").doc("data").get(),
      clientDocRef.collection("contato").doc("data").get(),
      clientDocRef.collection("modules").doc("data").get(),
      clientDocRef.collection("sobre").doc("data").get(),
      clientDocRef.collection("global_settings").doc("data").get(),
      clientDocRef.collection("produtos").get(),
    ]);

    if (!clientDoc.exists) {
      console.warn(
        "⚠️ Cliente não encontrado no Firestore. Usando conteúdo padrão."
      );
      const produtosGrid = document.getElementById("produtosGrid");
      if (produtosGrid) produtosGrid.innerHTML = "";
      return;
    }

    console.log("✅ Documento principal encontrado!");
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

    config.produtos = produtosSnap.docs.map((doc) => doc.data());
    console.log(`✅ ${config.produtos.length} produtos carregados`);

    // Cache dos dados
    cache.data = config;
    cache.timestamp = Date.now();

    console.log("🎉 Todos os dados carregados! Atualizando site...");
    updatePublicSite(config);
  } catch (error) {
    console.error("❌ Erro ao buscar dados do site:", error);
  }
}

function updatePublicSite(data) {
  console.log("🎨 Atualizando interface do site...");

  // ✅ Aplicar Configurações Globais de Fonte
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

      if (isGoogleAnalytics || isFacebookPixel || isHotjar) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(code, "text/html");

        const scripts = doc.querySelectorAll("script");
        scripts.forEach((script) => {
          const newScript = document.createElement("script");
          if (script.src) {
            newScript.src = script.src;
          } else {
            newScript.textContent = script.textContent;
          }
          if (script.async) newScript.async = true;
          document.body.appendChild(newScript);
        });
      } else {
        console.warn("⚠️ Código de rastreamento não reconhecido foi bloqueado");
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

  // ✅ Renderizar produtos com proteção XSS
  if (data.produtos) {
    const produtosGrid = document.getElementById("produtosGrid");
    if (produtosGrid) {
      produtosGrid.innerHTML = data.produtos
        .map(
          (p) => `
                <div class="product-card">
                    <div class="product-image" style="background-image: url(${escapeHtml(
                      p.imagem || "https://via.placeholder.com/400"
                    )}); background-position: ${escapeHtml(p.foco || "center")};"></div>
                    <div class="product-info">
                        <h3>${escapeHtml(p.nome)}</h3>
                        <div class="product-price">${escapeHtml(p.preco)}</div>
                        <p>${escapeHtml(p.descricao || "")}</p>
                    </div>
                </div>
            `
        )
        .join("");
      console.log(`✅ ${data.produtos.length} produtos renderizados`);
    }
  }

  console.log("🎉 Site público atualizado completamente!");
}