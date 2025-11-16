/**
 * ✅ OTIMIZADO: Configuração do Firebase com suporte offline
 */

window.firebaseConfig = {
  apiKey: "AIzaSyB9KwQm9eZqqkOh8S4hSBiy3RLlNFyQ4fk",
  authDomain: "base-5488a.firebaseapp.com",
  projectId: "base-5488a",
  storageBucket: "base-5488a.firebasestorage.app",  // ← Verifique se é este
  messagingSenderId: "399469780607",
  appId: "1:399469780607:web:39690561538a9e9a0a694a",
  measurementId: "G-JJ259S5NTX"
};

// Constantes de retry e cache
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const CACHE_DURATION = 5 * 60 * 1000;

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

// Inicialização do Firebase com suporte a modo offline
window.initializeFirebase = async function(retryCount = 0) {
  try {
    // Verifica se o SDK foi carregado
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK não carregado');
    }

    // Se já inicializado, retorna a instância
    if (firebase.apps.length > 0) {
      return {
        db: firebase.firestore(),
        auth: firebase.auth(),
        storage: firebase.storage()
      };
    }

    // Verifica conexão antes de inicializar
    const isOnline = await checkOnlineStatus();
    console.log(isOnline ? '✅ Online' : '⚠️ Offline');

    // Inicializa o app
    firebase.initializeApp(window.firebaseConfig);
    const db = firebase.firestore();
    
    // Configurações otimizadas para modo offline
    db.settings({
      cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
      ignoreUndefinedProperties: true,
      // experimentalForceLongPolling: true, // Melhor suporte offline
      // experimentalAutoDetectLongPolling: true // Adaptação automática
    });

    // Tenta habilitar persistência
    try {
      await db.enablePersistence({
        synchronizeTabs: true
      });
      console.log('✅ Persistência offline ativada');
    } catch (err) {
      if (err.code === 'failed-precondition') {
        console.warn('⚠️ Múltiplas abas abertas - modo offline limitado');
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Browser não suporta persistência offline');
      }
    }

    // Gerencia estado da rede
    if (isOnline) {
      await db.enableNetwork();
    } else {
      await db.disableNetwork();
    }

    // Monitora mudanças de conexão
    window.addEventListener('online', async () => {
      console.log('🌐 Conexão recuperada');
      const db = firebase.firestore();
      await db.enableNetwork();
    });

    window.addEventListener('offline', async () => {
      console.log('⚠️ Conexão perdida');
      const db = firebase.firestore();
      await db.disableNetwork();
    });

    // Retorna as instâncias
    return {
      db: firebase.firestore(),
      auth: firebase.auth(),
      storage: firebase.storage()
    };
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);

    // Sistema de retry
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Tentando novamente (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return initializeFirebase(retryCount + 1);
    }

    // Notifica o usuário
    if (window.SiteModules && window.SiteModules.error) {
      window.SiteModules.error.show(
        'Tentando usar dados offline. Algumas funcionalidades podem estar limitadas.',
        'warning'
      );
    }

    // Se já temos uma instância, usa ela mesmo com erro
    if (firebase.apps.length) {
      return {
        db: firebase.firestore(),
        auth: firebase.auth(),
        storage: firebase.storage()
      };
    }

    throw error;
  }
};