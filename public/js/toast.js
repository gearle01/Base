// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Configurações por tipo
    const config = {
        success: { icon: 'fa-check-circle', bg: '#10B981', label: 'Sucesso' },
        error: { icon: 'fa-times-circle', bg: '#EF4444', label: 'Erro' },
        warning: { icon: 'fa-exclamation-triangle', bg: '#F59E0B', label: 'Atenção' },
        info: { icon: 'fa-info-circle', bg: '#3B82F6', label: 'Info' }
    };

    const { icon, bg, label } = config[type] || config.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
        margin-bottom: 12px;
        transform: translateX(120%);
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 360px;
        border-left: 4px solid ${bg};
    `;

    toast.innerHTML = `
        <div style="width: 36px; height: 36px; border-radius: 50%; background: ${bg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="fas ${icon}" style="color: white; font-size: 16px;"></i>
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #111827; font-size: 14px; margin-bottom: 2px;">${label}</div>
            <div style="color: #6B7280; font-size: 13px; line-height: 1.4;">${message}</div>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; padding: 4px; color: #9CA3AF; transition: color 0.2s;">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Animar entrada
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    // Auto-remover após 4 segundos
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
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