// Inicialização do Appwrite com suporte CORS dinâmico
(function() {
    // Aguardar o carregamento do SDK do Appwrite
    function initAppwrite() {
        if (typeof Appwrite === 'undefined') {
            console.log('Aguardando Appwrite SDK...');
            setTimeout(initAppwrite, 100);
            return;
        }

       console.log('Inicializando Appwrite...');
    
    const client = new Appwrite.Client();

    client
        .setEndpoint('https://sfo.cloud.appwrite.io/v1')
        .setProject('6912877f003a515c3062'); // ✅ NOVO PROJECT ID

    window.appwriteStorage = new Appwrite.Storage(client);
    window.appwriteClient = client;
    
    console.log('Appwrite inicializado com sucesso!');
    console.log('🌐 Origem atual:', window.location.origin);
    
    // ⚠️ AVISO: Plataformas já configuradas
    console.log('✅ Plataformas configuradas:');
    console.log('   - gsm.dev.br');
    console.log('   - www.gsm.dev.br');
    
    // Disparar evento customizado para avisar que Appwrite está pronto
    window.dispatchEvent(new Event('appwriteReady'));
}

// Iniciar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppwrite);
} else {
    initAppwrite();
}
})();