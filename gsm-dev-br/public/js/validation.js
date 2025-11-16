// ===== VALIDAÇÃO COM SEGURANÇA EXTRA =====

// Tipos de imagem permitidos
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Validar arquivo de imagem (magic bytes)
async function validateImageFile(file) {
    // Verificar tipo MIME
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error('Tipo de arquivo não permitido. Use JPG, PNG, GIF, WebP ou SVG.');
    }
    
    // Verificar tamanho
    if (file.size > MAX_FILE_SIZE) {
        throw new Error('Arquivo muito grande. Máximo: 5MB');
    }
    
    // Verificar "magic bytes" (assinatura real do arquivo)
    const buffer = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const validSignatures = {
        'ffd8ff': 'image/jpeg',      // JPEG
        '89504e47': 'image/png',      // PNG
        '47494638': 'image/gif',      // GIF
        '52494646': 'image/webp',     // WebP (começa com RIFF)
        '3c3f786d': 'image/svg+xml',  // SVG (começa com <?xml)
        '3c737667': 'image/svg+xml'   // SVG (começa com <svg)
    };
    
    const isValid = Object.keys(validSignatures).some(sig => hex.startsWith(sig));
    
    if (!isValid) {
        throw new Error('Arquivo corrompido ou tipo inválido');
    }
    
    return true;
}

// Validar coordenadas geográficas
function validateCoordinates(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Coordenadas inválidas');
    }
    
    if (latitude < -90 || latitude > 90) {
        throw new Error('Latitude deve estar entre -90 e 90');
    }
    
    if (longitude < -180 || longitude > 180) {
        throw new Error('Longitude deve estar entre -180 e 180');
    }
    
    return { latitude, longitude };
}

// Validar URL
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
        
        return true;
    } catch {
        return false;
    }
}

// Validar email
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validar formulário completo
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

// Sanitizar dados para log
function sanitizeLogData(data) {
    const sensitive = ['password', 'senha', 'token', 'apiKey', 'secret'];
    const cleaned = { ...data };
    
    Object.keys(cleaned).forEach(key => {
        if (sensitive.some(word => key.toLowerCase().includes(word))) {
            cleaned[key] = '***';
        }
    });
    
    return cleaned;
}

// Timeout para promises
function withTimeout(promise, ms = 10000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operação excedeu o tempo limite')), ms)
        )
    ]);
}