// Inicialização do Appwrite
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
            .setEndpoint('https://sfo.cloud.appwrite.io/v1') // Your Appwrite Endpoint
            .setProject('68f04b740016e7f878b3'); // Your project ID

        window.appwriteStorage = new Appwrite.Storage(client);
        window.appwriteClient = client;
        
        console.log('Appwrite inicializado com sucesso!');
        
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