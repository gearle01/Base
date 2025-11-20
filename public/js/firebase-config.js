// public/js/firebase-config.js

// Função para checar conexão
async function checkOnlineStatus() {
  if (!navigator.onLine) return false;
  try {
    const response = await fetch('//google.com/favicon.ico', {
      mode: 'no-cors',
    });
    return true;
  } catch (error) {
    console.warn('⚠️ Sem conexão:', error);
    return false;
  }
}

// Inicialização do Firebase (Singleton)
window.initializeFirebase = async function (retryCount = 0) {
  try {
    // 1. Se já inicializado, reutiliza
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      return {
        db: firebase.firestore(),
        auth: firebase.auth(),
        storage: firebase.storage()
      };
    }

    // 2. Verifica se config existe
    if (typeof window.firebaseConfig === 'undefined') {
      throw new Error('firebaseConfig não encontrado.');
    }

    // 3. Inicializa
    firebase.initializeApp(window.firebaseConfig);
    const db = firebase.firestore();

    // 4. Configurações do Firestore (com try/catch para evitar erro de reconfiguração)
    try {
      db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        ignoreUndefinedProperties: true,
        merge: true
      });
    } catch (e) {
      console.log('Firestore settings já aplicadas ou erro ignorável:', e.message);
    }

    // 5. Persistência Offline
    try {
      await db.enablePersistence({ synchronizeTabs: true });
      console.log('✅ Persistência offline ativada');
    } catch (err) {
      // Ignora erros comuns de persistência
    }

    return {
      db: db,
      auth: firebase.auth(),
      storage: firebase.storage()
    };

  } catch (error) {
    console.error('❌ Erro inicializar Firebase:', error);
    if (retryCount < 3) {
      await new Promise(r => setTimeout(r, 2000));
      return window.initializeFirebase(retryCount + 1);
    }
    throw error;
  }
};