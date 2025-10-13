const iframe = document.querySelector('iframe');
const iframeDoc = iframe.contentWindow.document;

function toggleAdmin() {
    window.parent.document.getElementById('adminPanel').classList.toggle('active');
}

function toggleModule(module) {
    const toggle = document.getElementById('toggle' + module.charAt(0).toUpperCase() + module.slice(1));
    toggle.classList.toggle('active');
    siteData.modules[module] = toggle.classList.contains('active');
    updateSite();
}

function updateColors() {
    const primary = document.getElementById('corPrimaria').value;
    const secondary = document.getElementById('corSecundaria').value;
    const text = document.getElementById('corTexto').value;
    const bg = document.getElementById('corFundo').value;

    // Update text inputs
    document.querySelector('#corPrimaria + input[type="text"]').value = primary;
    document.querySelector('#corSecundaria + input[type="text"]').value = secondary;
    document.querySelector('#corTexto + input[type="text"]').value = text;
    document.querySelector('#corFundo + input[type="text"]').value = bg;

    iframeDoc.documentElement.style.setProperty('--primary-color', primary);
    iframeDoc.documentElement.style.setProperty('--secondary-color', secondary);
    iframeDoc.documentElement.style.setProperty('--text-color', text);
    iframeDoc.documentElement.style.setProperty('--bg-light', bg);
}

function handleImageUpload(event, targetInputId) {
    const file = event.target.files[0];
    if (file) {
        const localUrl = URL.createObjectURL(file);
        document.getElementById(targetInputId).value = localUrl;
        updateSite();
    }
}

function updateSite() {
    // Atualizar textos
    const nome = document.getElementById('empresaNome').value;
    const logoValue = document.getElementById('empresaLogo').value;
    const logoTextElement = iframeDoc.getElementById('logoText');

    if (logoValue && (logoValue.startsWith('http') || logoValue.startsWith('blob:'))) {
        logoTextElement.innerHTML = `<img src="${logoValue}" alt="${nome}" style="height: 40px;">`; // Adjust height as needed
    } else if (logoValue) {
        logoTextElement.textContent = logoValue;
    } else {
        logoTextElement.textContent = nome;
    }

    iframeDoc.getElementById('footerNome').textContent = nome;
    
    iframeDoc.getElementById('bannerH1').textContent = document.getElementById('bannerTitulo').value;
    iframeDoc.getElementById('bannerP').textContent = document.getElementById('bannerSubtitulo').value;
    
    const homeSection = iframeDoc.getElementById('home');
    const imgUrl = document.getElementById('bannerImagem').value;
    homeSection.style.background = `linear-gradient(135deg, var(--primary-color, #3b82f6), var(--primary-dark, #1e40af)), url('${imgUrl}') center/cover`;
    homeSection.style.backgroundBlendMode = 'multiply';
    
    // Banner alerta
    const bannerAlerta = iframeDoc.getElementById('bannerAlerta');
    bannerAlerta.textContent = document.getElementById('bannerTexto').value;
    bannerAlerta.classList.toggle('hidden', !siteData.modules.banner);
    
    // Sobre
    iframeDoc.getElementById('sobreH2').textContent = document.getElementById('sobreTitulo').value;
    iframeDoc.getElementById('sobreP').textContent = document.getElementById('sobreTexto').value;
    iframeDoc.getElementById('sobreImg').style.backgroundImage = `url('${document.getElementById('sobreImagem').value}')`;
    iframeDoc.getElementById('sobre').classList.toggle('hidden', !siteData.modules.sobre);
    iframeDoc.querySelector('.nav-sobre').parentElement.classList.toggle('hidden', !siteData.modules.sobre);
    
    // Horários
    const dias = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'];
    dias.forEach(dia => {
        const horario = document.getElementById(`horario${dia}`).value;
        const fechado = document.getElementById(`fechado${dia}`).checked;
        iframeDoc.getElementById(`hor${dia}`).textContent = fechado ? 'Fechado' : horario;
    });
    iframeDoc.getElementById('horarios').classList.toggle('hidden', !siteData.modules.horarios);
    iframeDoc.querySelector('.nav-horarios').parentElement.classList.toggle('hidden', !siteData.modules.horarios);
    
    // Produtos
    iframeDoc.getElementById('produtosH2').textContent = document.getElementById('produtosTitulo').value;
    iframeDoc.getElementById('produtos').classList.toggle('hidden', !siteData.modules.produtos);
    iframeDoc.querySelector('.nav-produtos').parentElement.classList.toggle('hidden', !siteData.modules.produtos);
    renderProdutos();
    
    // Contato
    iframeDoc.getElementById('contatoTel').textContent = document.getElementById('contatoTelefone').value;
    iframeDoc.getElementById('contatoMail').textContent = document.getElementById('contatoEmail').value;
    const endereco = document.getElementById('contatoEndereco').value;
    iframeDoc.getElementById('contatoEnd').textContent = endereco;
    
    const mapaUrl = document.getElementById('contatoMapa').value;
    const mapaContainer = iframeDoc.getElementById('mapaContainer');
    if (mapaUrl) {
        mapaContainer.innerHTML = `<iframe src="${mapaUrl}" width="100%" height="300" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;
    } else {
        mapaContainer.innerHTML = '';
    }

    const enderecoLink = iframeDoc.getElementById('contatoEnd');
    enderecoLink.innerHTML = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}" target="_blank">${endereco}</a>`;

    iframeDoc.getElementById('contato').classList.toggle('hidden', !siteData.modules.contato);
    iframeDoc.querySelector('.nav-contato').parentElement.classList.toggle('hidden', !siteData.modules.contato);
}

function renderProdutos() {
    const grid = iframeDoc.getElementById('produtosGrid');
    grid.innerHTML = '';
    
    siteData.produtos.forEach(produto => {
        const card = document.createElement('div');
        card.className = 'produto-card';
        card.innerHTML = `
            <div class="produto-image" style="background-image: url('${produto.imagem}')"></div>
            <div class="produto-info">
                <h3>${produto.nome}</h3>
                <div class="produto-preco">${produto.preco}</div>
                <p>${produto.descricao}</p>
            </div>
        `;
        grid.appendChild(card);
    });
    
    // Atualizar lista no admin
    const list = document.getElementById('produtosList');
    list.innerHTML = '';
    
    siteData.produtos.forEach((produto, index) => {
        const item = document.createElement('div');
        item.className = 'produto-item';
        item.innerHTML = `
            <div>
                <strong>${produto.nome}</strong><br>
                <small>${produto.preco}</small>
            </div>
            <div>
                <button class="btn-admin btn-small" onclick="editProduto(${index})">✏️</button>
                <button class="btn-admin btn-small" onclick="changeProdutoImage(${index})">🖼️</button>
                <button class="btn-admin btn-danger btn-small" onclick="deleteProduto(${index})">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

let editingProdutoIndex = null;

function addProduto() {
    editingProdutoIndex = null;
    document.getElementById('produtoModalTitle').textContent = 'Adicionar Produto';
    document.getElementById('produtoNome').value = '';
    document.getElementById('produtoPreco').value = '';
    document.getElementById('produtoDescricao').value = '';
    document.getElementById('produtoImagem').value = '';
    document.getElementById('produtoModal').style.display = 'block';
}

function editProduto(index) {
    editingProdutoIndex = index;
    const produto = siteData.produtos[index];
    document.getElementById('produtoModalTitle').textContent = 'Editar Produto';
    document.getElementById('produtoNome').value = produto.nome;
    document.getElementById('produtoPreco').value = produto.preco;
    document.getElementById('produtoDescricao').value = produto.descricao;
    document.getElementById('produtoImagem').value = produto.imagem;
    document.getElementById('produtoModal').style.display = 'block';
}

function closeProdutoModal() {
    document.getElementById('produtoModal').style.display = 'none';
}

function saveProduto() {
    const nome = document.getElementById('produtoNome').value;
    const preco = document.getElementById('produtoPreco').value;
    const descricao = document.getElementById('produtoDescricao').value;
    const imagem = document.getElementById('produtoImagem').value;

    if (editingProdutoIndex === null) {
        // Adicionar novo produto
        siteData.produtos.push({ nome, preco, descricao, imagem });
    } else {
        // Editar produto existente
        siteData.produtos[editingProdutoIndex] = { nome, preco, descricao, imagem };
    }

    renderProdutos();
    closeProdutoModal();
}

function changeProdutoImage(index) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = event => {
        const file = event.target.files[0];
        if (file) {
            const localUrl = URL.createObjectURL(file);
            siteData.produtos[index].imagem = localUrl;
            renderProdutos();
            updateSite();
        }
    };
    fileInput.click();
}

function deleteProduto(index) {
    if (confirm('Tem certeza que deseja deletar este produto?')) {
        siteData.produtos.splice(index, 1);
        renderProdutos();
    }
}

function exportConfig() {
    const config = {
        empresaNome: document.getElementById('empresaNome').value,
        empresaLogo: document.getElementById('empresaLogo').value,
        bannerTitulo: document.getElementById('bannerTitulo').value,
        bannerSubtitulo: document.getElementById('bannerSubtitulo').value,
        bannerImagem: document.getElementById('bannerImagem').value,
        bannerTexto: document.getElementById('bannerTexto').value,
        cores: {
            primaria: document.getElementById('corPrimaria').value,
            secundaria: document.getElementById('corSecundaria').value,
            texto: document.getElementById('corTexto').value,
            fundo: document.getElementById('corFundo').value
        },
        modules: siteData.modules,
        sobre: {
            titulo: document.getElementById('sobreTitulo').value,
            texto: document.getElementById('sobreTexto').value,
            imagem: document.getElementById('sobreImagem').value
        },
        horarios: {
            segunda: { horario: document.getElementById('horarioSegunda').value, fechado: document.getElementById('fechadoSegunda').checked },
            terca: { horario: document.getElementById('horarioTerca').value, fechado: document.getElementById('fechadoTerca').checked },
            quarta: { horario: document.getElementById('horarioQuarta').value, fechado: document.getElementById('fechadoQuarta').checked },
            quinta: { horario: document.getElementById('horarioQuinta').value, fechado: document.getElementById('fechadoQuinta').checked },
            sexta: { horario: document.getElementById('horarioSexta').value, fechado: document.getElementById('fechadoSexta').checked },
            sabado: { horario: document.getElementById('horarioSabado').value, fechado: document.getElementById('fechadoSabado').checked },
            domingo: { horario: document.getElementById('horarioDomingo').value, fechado: document.getElementById('fechadoDomingo').checked },
        },
        produtosTitulo: document.getElementById('produtosTitulo').value,
        produtos: siteData.produtos,
        contato: {
            telefone: document.getElementById('contatoTelefone').value,
            email: document.getElementById('contatoEmail').value,
            endereco: document.getElementById('contatoEndereco').value,
            mapa: document.getElementById('contatoMapa').value
        }
    };
    
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'site-config.json';
    link.click();
    
    URL.revokeObjectURL(url);
    alert('Configuração exportada com sucesso!');
}

function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            
            // Aplicar configurações
            document.getElementById('empresaNome').value = config.empresaNome || '';
            document.getElementById('empresaLogo').value = config.empresaLogo || '';
            document.getElementById('bannerTitulo').value = config.bannerTitulo || '';
            document.getElementById('bannerSubtitulo').value = config.bannerSubtitulo || '';
            document.getElementById('bannerImagem').value = config.bannerImagem || '';
            document.getElementById('bannerTexto').value = config.bannerTexto || '';
            
            if (config.cores) {
                document.getElementById('corPrimaria').value = config.cores.primaria || '#3b82f6';
                document.getElementById('corSecundaria').value = config.cores.secundaria || '#f59e0b';
                document.getElementById('corTexto').value = config.cores.texto || '#1f2937';
                document.getElementById('corFundo').value = config.cores.fundo || '#f9fafb';
                updateColors();
            }
            
            if (config.modules) {
                siteData.modules = config.modules;
                Object.keys(config.modules).forEach(module => {
                    const toggle = document.getElementById('toggle' + module.charAt(0).toUpperCase() + module.slice(1));
                    if (toggle) {
                        if (config.modules[module]) {
                            toggle.classList.add('active');
                        } else {
                            toggle.classList.remove('active');
                        }
                    }
                });
            }
            
            if (config.sobre) {
                document.getElementById('sobreTitulo').value = config.sobre.titulo || '';
                document.getElementById('sobreTexto').value = config.sobre.texto || '';
                document.getElementById('sobreImagem').value = config.sobre.imagem || '';
            }
            
            if (config.horarios) {
                const dias = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'];
                dias.forEach(dia => {
                    const diaLower = dia.toLowerCase();
                    if (config.horarios[diaLower]) {
                        document.getElementById(`horario${dia}`).value = config.horarios[diaLower].horario || '';
                        document.getElementById(`fechado${dia}`).checked = config.horarios[diaLower].fechado || false;
                    }
                });
            }
            
            document.getElementById('produtosTitulo').value = config.produtosTitulo || '';
            
            if (config.produtos) {
                siteData.produtos = config.produtos;
            }
            
            if (config.contato) {
                document.getElementById('contatoTelefone').value = config.contato.telefone || '';
                document.getElementById('contatoEmail').value = config.contato.email || '';
                document.getElementById('contatoEndereco').value = config.contato.endereco || '';
                document.getElementById('contatoMapa').value = config.contato.mapa || '';
            }
            
            updateSite();
            alert('Configuração importada com sucesso!');
        } catch (error) {
            alert('Erro ao importar configuração: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Inicializar
window.parent.addEventListener('load', () => {
    renderProdutos();
    updateSite();
});
