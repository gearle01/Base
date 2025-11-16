/**
 * @module FirebaseLoader
 * @description Carrega o Firebase SDK de forma assíncrona e sob demanda (lazy loading).
 * Otimizado para performance, carregando os componentes do Firebase apenas quando são necessários.
 *
 * @version 1.0.0
 */

// Namespace global para o loader
window.FirebaseLoader = (() => {
  // Variáveis para cache das instâncias
  let firebaseApp = null;
  let firestoreDb = null;
  let isLoading = false;
  let loadPromise = null;

  // URLs dos scripts do Firebase (use as versões mais recentes)
  const FIREBASE_APP_URL = 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
  const FIREBASE_FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

  /**
   * Carrega um script dinamicamente e retorna uma promessa.
   * @param {string} src - A URL do script a ser carregado.
   * @returns {Promise<void>}
   */
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Falha ao carregar o script: ${src}`));
      document.head.appendChild(script);
    });
  };

  /**
   * Inicializa o Firebase App e o Firestore de forma assíncrona.
   * Usa um padrão de promessa para evitar múltiplas inicializações simultâneas.
   * @private
   */
  const initialize = async () => {
    // Se já estiver carregando, retorna a promessa existente
    if (isLoading && loadPromise) {
      return loadPromise;
    }
    // Se já carregou, retorna imediatamente
    if (firebaseApp && firestoreDb) {
      return;
    }

    isLoading = true;
    loadPromise = (async () => {
      try {
        // Carrega o Firebase App e o Firestore em paralelo
        await Promise.all([
          loadScript(FIREBASE_APP_URL),
          loadScript(FIREBASE_FIRESTORE_URL)
        ]);

        // Verifica se a configuração do Firebase está disponível
        if (typeof window.firebaseConfig === 'undefined') {
          throw new Error('A configuração do Firebase (firebaseConfig) não foi encontrada.');
        }

        // Inicializa o app
        firebaseApp = firebase.initializeApp(window.firebaseConfig);
        
        // Obtém a instância do Firestore
        firestoreDb = firebase.firestore();

        // Tenta ativar a persistência offline
        try {
          await firestoreDb.enablePersistence({ synchronizeTabs: true });
        } catch (err) {
          if (err.code === 'failed-precondition') {
            // Múltiplas abas abertas, normal
          } else if (err.code === 'unimplemented') {
            // Browser não suporta
          }
        }
        
      } catch (error) {
        console.error('❌ Erro ao inicializar o Firebase SDK:', error);
        throw error; // Propaga o erro para quem chamou
      } finally {
        isLoading = false;
        loadPromise = null;
      }
    })();

    return loadPromise;
  };

  /**
   * Retorna a instância do Firestore DB.
   * Se o Firebase não estiver inicializado, ele o inicializa primeiro.
   * @public
   * @returns {Promise<object>} Uma promessa que resolve com a instância do Firestore.
   */
  const getFirestore = async () => {
    if (!firestoreDb) {
      await initialize();
    }
    return firestoreDb;
  };

  // Expõe a função pública
  return {
    getFirestore
  };
})();
