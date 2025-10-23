// Histórico para Undo/Redo
let history = [];
let historyIndex = -1;

// ===== UNDO/REDO =====
function saveToHistory() {
    const currentState = JSON.stringify(getConfig());
    
    // Remover estados futuros se estamos no meio do histórico
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    
    // Adicionar novo estado
    history.push(currentState);
    historyIndex = history.length - 1;
    
    // Limitar histórico a 50 estados
    if (history.length > 50) {
        history.shift();
        historyIndex--;
    }
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        loadConfig(JSON.parse(history[historyIndex]));
        showToast('Desfeito', 'info');
    } else {
        showToast('Nada para desfazer', 'info');
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        loadConfig(JSON.parse(history[historyIndex]));
        showToast('Refeito', 'info');
    } else {
        showToast('Nada para refazer', 'info');
    }
}
