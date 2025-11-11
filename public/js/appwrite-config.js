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
            .setProject('691287dd003bc7260e15');

        window.appwriteStorage = new Appwrite.Storage(client);
        window.appwriteClient = client;
        
        console.log('Appwrite inicializado com sucesso!');
        console.log('🌐 Origem atual:', window.location.origin);
        
        // ⚠️ AVISO: Adicione esta origem no Console do Appwrite
        if (!window.location.origin.includes('localhost')) {
            console.warn(`
⚠️ ATENÇÃO: Configure o Appwrite para aceitar esta origem!

1. Acesse: https://cloud.appwrite.io
2. Vá em: Settings → Platforms → Add Platform → Web App
3. Adicione: ${window.location.origin}
4. Salve e recarregue a página
            `);
        }
        
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