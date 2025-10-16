// ===== VALIDAÇÃO =====
function validateURL(url) {
    if (!url) return true; // URLs vazias são válidas
    
    try {
        const parsed = new URL(url);
        
        // Bloquear protocolos perigosos
        const allowedProtocols = ['http:', 'https:'];
        if (!allowedProtocols.includes(parsed.protocol)) {
            console.warn('Protocolo não permitido:', parsed.protocol);
            return false;
        }
        
        // Opcional: Whitelist de domínios confiáveis
        const trustedDomains = [
            'images.unsplash.com',
            'firebasestorage.googleapis.com',
            'via.placeholder.com',
            'cdn.jsdelivr.net',
            'fonts.googleapis.com',
            'www.googletagmanager.com'
        ];
        
        // Comentar as linhas abaixo se quiser aceitar qualquer domínio HTTPS
        // const isTrusted = trustedDomains.some(domain => 
        //     parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        // );
        // if (!isTrusted) {
        //     console.warn('Domínio não confiável:', parsed.hostname);
        //     return false;
        // }
        
        return true;
    } catch {
        return false;
    }
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm() {
    let isValid = true;
    
    // Validar campos obrigatórios
    const requiredFields = ['empresaNome', 'bannerTitulo', 'email'];
    requiredFields.forEach(id => {
        const input = document.getElementById(id);
        if (!input.value.trim()) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
        }
    });
    
    // Validar URLs
    const urlFields = ['bannerImagem', 'sobreImagem'];
    urlFields.forEach(id => {
        const input = document.getElementById(id);
        if (input.value && !validateURL(input.value)) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
        }
    });
    
    // Validar email
    const emailInput = document.getElementById('email');
    if (!validateEmail(emailInput.value)) {
        emailInput.classList.add('error');
        isValid = false;
    } else {
        emailInput.classList.remove('error');
    }
    
    return isValid;
}
