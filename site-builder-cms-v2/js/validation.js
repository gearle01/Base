// ===== VALIDAÇÃO =====
function validateURL(url) {
    if (!url) return true; // URLs vazias são válidas (opcionais)
    try {
        new URL(url);
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
