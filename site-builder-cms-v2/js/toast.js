// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== SAVE STATUS INDICATOR =====
function showSaving() {
    const saveStatus = document.getElementById('saveStatus');
    const saveText = document.getElementById('saveText');
    
    if (saveStatus && saveText) {
        saveStatus.className = 'save-status saving';
        saveText.innerHTML = '<span class="spinner"></span> Salvando...';
    }
}

function showSaved() {
    const saveStatus = document.getElementById('saveStatus');
    const saveText = document.getElementById('saveText');
    
    if (saveStatus && saveText) {
        saveStatus.className = 'save-status saved';
        saveText.textContent = '✓ Salvo';
        
        // Volta para o estado normal após 2 segundos
        setTimeout(() => {
            saveStatus.className = 'save-status';
            saveText.textContent = 'Salvo';
        }, 2000);
    }
}