/**
 * ✅ OTIMIZADO: Sistema de sincronização em tempo real com Firebase
 * Usa Firestore subscribers para atualizações em tempo real
 * Usa Firebase Storage para uploads de imagens
 */

class FirebaseRealtimeManager {
    constructor() {
        this.db = null;
        this.storage = null;
        this.unsubscribers = [];
        this.clientId = 'cliente-001';
        this.listeners = new Map();
        this.cacheData = new Map();
    }

    /**
     * Inicializa conexões com Firebase (Firestore + Storage)
     */
    async init() {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            this.db = firebase.firestore();
            this.storage = firebase.storage();

            // Configurar persistência offline
            await this.db.enablePersistence({ synchronizeTabs: true });
            console.log('✅ Persistência offline ativada');

            return { db: this.db, storage: this.storage };
        } catch (error) {
            console.error('❌ Erro ao inicializar Firebase:', error);
            throw error;
        }
    }

    /**
     * Monitora mudanças em tempo real de uma coleção com subscriber
     * @param {string} collection - Nome da coleção
     * @param {string} docId - ID do documento
     * @param {Function} onUpdate - Callback quando dados mudam
     * @returns {Function} Função para cancelar o subscriber
     */
    subscribeToDocument(collection, docId, onUpdate) {
        if (!this.db) throw new Error('Firebase não inicializado');

        const unsubscribe = this.db
            .collection(collection)
            .doc(docId)
            .onSnapshot(
                (docSnapshot) => {
                    if (docSnapshot.exists) {
                        const data = docSnapshot.data();
                        this.cacheData.set(`${collection}:${docId}`, data);
                        
                        console.log(`📡 [${collection}/${docId}] Atualizado em tempo real`);
                        onUpdate(data);
                    } else {
                        console.warn(`⚠️ Documento ${docId} não encontrado`);
                    }
                },
                (error) => {
                    console.error(`❌ Erro ao observar ${collection}/${docId}:`, error);
                    // Tenta usar cache em caso de erro
                    const cached = this.cacheData.get(`${collection}:${docId}`);
                    if (cached) {
                        console.log(`📦 Usando cache para ${collection}/${docId}`);
                        onUpdate(cached);
                    }
                }
            );

        // Guarda referência para limpeza futura
        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Monitora mudanças em uma subcoleção com subscriber
     * @param {string} parentCollection - Coleção pai
     * @param {string} parentDocId - ID do documento pai
     * @param {string} subCollection - Subcoleção
     * @param {Function} onUpdate - Callback quando dados mudam
     * @returns {Function} Função para cancelar o subscriber
     */
    subscribeToSubcollection(parentCollection, parentDocId, subCollection, onUpdate) {
        if (!this.db) throw new Error('Firebase não inicializado');

        const unsubscribe = this.db
            .collection(parentCollection)
            .doc(parentDocId)
            .collection(subCollection)
            .onSnapshot(
                (snapshot) => {
                    const docs = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    this.cacheData.set(
                        `${parentCollection}:${parentDocId}:${subCollection}`,
                        docs
                    );

                    console.log(`📡 [${subCollection}] ${docs.length} itens atualizados`);
                    onUpdate(docs);
                },
                (error) => {
                    console.error(`❌ Erro ao observar subcoleção:`, error);
                    const cached = this.cacheData.get(
                        `${parentCollection}:${parentDocId}:${subCollection}`
                    );
                    if (cached) {
                        console.log(`📦 Usando cache para ${subCollection}`);
                        onUpdate(cached);
                    }
                }
            );

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Faz upload de imagem para Firebase Storage com otimização
     * @param {File} file - Arquivo de imagem
     * @param {string} path - Caminho de destino (ex: 'logos/banner.jpg')
     * @param {Function} onProgress - Callback com progresso (0-100)
     * @returns {Promise<string>} URL da imagem
     */
    async uploadImage(file, path, onProgress = null) {
        try {
            // Validar arquivo
            await this.validateImageFile(file);

            // Comprimir imagem
            const compressedFile = await this.compressImage(file);

            // Criar referência no Storage
            const storageRef = this.storage.ref(`site/${this.clientId}/${path}`);

            // Upload com monitoramento de progresso
            const uploadTask = storageRef.put(compressedFile);

            // Monitorar progresso
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`📤 Upload: ${Math.round(progress)}%`);
                    if (onProgress) onProgress(progress);
                },
                (error) => {
                    console.error('❌ Erro no upload:', error);
                    throw error;
                }
            );

            // Aguardar conclusão
            const snapshot = await uploadTask;

            // Obter URL de download
            const downloadUrl = await snapshot.ref.getDownloadURL();
            console.log(`✅ Upload concluído: ${downloadUrl}`);

            return downloadUrl;
        } catch (error) {
            console.error('❌ Erro ao fazer upload:', error);
            throw error;
        }
    }

    /**
     * Valida arquivo de imagem
     * @private
     */
    async validateImageFile(file) {
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB

        if (!ALLOWED_TYPES.includes(file.type)) {
            throw new Error('Tipo de arquivo não permitido');
        }

        if (file.size > MAX_SIZE) {
            throw new Error('Arquivo muito grande (máx 5MB)');
        }

        return true;
    }

    /**
     * Comprime imagem usando Canvas
     * @private
     */
    async compressImage(file, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Redimensionar se necessário
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let { width, height } = img;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = (height * MAX_WIDTH) / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = (width * MAX_HEIGHT) / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            const compressedFile = new File([blob], file.name, {
                                type: file.type,
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        },
                        file.type,
                        quality
                    );
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    }

    /**
     * Salva dados no Firestore com batch transaction
     * @param {Object} data - Dados a salvar
     * @returns {Promise<void>}
     */
    async saveData(data) {
        if (!this.db) throw new Error('Firebase não inicializado');

        try {
            const batch = this.db.batch();
            const clientDocRef = this.db
                .collection('site')
                .doc(this.clientId);

            // Documento principal
            batch.set(clientDocRef, {
                ...data.main,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: firebase.auth().currentUser?.email
            }, { merge: true });

            // Cores
            if (data.cores) {
                batch.set(
                    clientDocRef.collection('cores').doc('data'),
                    data.cores,
                    { merge: true }
                );
            }

            // Contato
            if (data.contato) {
                batch.set(
                    clientDocRef.collection('contato').doc('data'),
                    data.contato,
                    { merge: true }
                );
            }

            // Módulos
            if (data.modules) {
                batch.set(
                    clientDocRef.collection('modules').doc('data'),
                    data.modules,
                    { merge: true }
                );
            }

            // Sobre
            if (data.sobre) {
                batch.set(
                    clientDocRef.collection('sobre').doc('data'),
                    data.sobre,
                    { merge: true }
                );
            }

            // Configurações globais
            if (data.globalSettings) {
                batch.set(
                    clientDocRef.collection('global_settings').doc('data'),
                    data.globalSettings,
                    { merge: true }
                );
            }

            // Produtos
            if (data.produtos) {
                // Limpar produtos antigos
                const produtosSnap = await clientDocRef
                    .collection('produtos')
                    .get();

                produtosSnap.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });

                // Adicionar novos produtos
                data.produtos.forEach(produto => {
                    const newRef = clientDocRef.collection('produtos').doc();
                    batch.set(newRef, {
                        ...produto,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
            }

            // Redes Sociais
            if (data.socialLinks) {
                batch.set(
                    clientDocRef.collection('social_links').doc('data'),
                    { links: data.socialLinks },
                    { merge: true }
                );
            }

            await batch.commit();
            console.log('✅ Dados salvos com sucesso');
        } catch (error) {
            console.error('❌ Erro ao salvar dados:', error);
            throw error;
        }
    }

    /**
     * Carrega dados iniciais com fallback para cache
     * @returns {Promise<Object>} Dados carregados
     */
    async loadInitialData() {
        try {
            const clientDocRef = this.db.collection('site').doc(this.clientId);

            const [
                clientDoc,
                coresDoc,
                contatoDoc,
                modulesDoc,
                sobreDoc,
                globalDoc,
                produtosSnap,
                socialLinksDoc
            ] = await Promise.all([
                clientDocRef.get(),
                clientDocRef.collection('cores').doc('data').get(),
                clientDocRef.collection('contato').doc('data').get(),
                clientDocRef.collection('modules').doc('data').get(),
                clientDocRef.collection('sobre').doc('data').get(),
                clientDocRef.collection('global_settings').doc('data').get(),
                clientDocRef.collection('produtos').get(),
                clientDocRef.collection('social_links').doc('data').get()
            ]);

            const config = clientDoc.data() || {};

            if (coresDoc.exists) config.cores = coresDoc.data();
            if (contatoDoc.exists) config.contato = contatoDoc.data();
            if (modulesDoc.exists) config.modules = modulesDoc.data();
            if (sobreDoc.exists) config.sobre = sobreDoc.data();
            if (globalDoc.exists) config.globalSettings = globalDoc.data();
            if (socialLinksDoc.exists) {
                config.socialLinks = socialLinksDoc.data().links || [];
            }

            config.produtos = produtosSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Dados iniciais carregados');
            return config;
        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
            throw error;
        }
    }

    /**
     * Limpa todos os subscribers
     */
    unsubscribeAll() {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        console.log('✅ Todos os subscribers foram cancelados');
    }

    /**
     * Obtém dados do cache
     * @param {string} key - Chave do cache
     * @returns {any} Dados em cache ou undefined
     */
    getFromCache(key) {
        return this.cacheData.get(key);
    }

    /**
     * Limpa cache
     */
    clearCache() {
        this.cacheData.clear();
        console.log('✅ Cache limpo');
    }
}

// Instância global
const firebaseRealtimeManager = new FirebaseRealtimeManager();

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseRealtimeManager;
}

/**
 * EXEMPLO DE USO:
 * 
 * // Inicializar
 * await firebaseRealtimeManager.init();
 * 
 * // Carregamento inicial
 * const initialData = await firebaseRealtimeManager.loadInitialData();
 * 
 * // Subscribe para atualizações em tempo real do documento principal
 * firebaseRealtimeManager.subscribeToDocument('site', 'cliente-001', (data) => {
 *     console.log('Site atualizado:', data);
 *     updatePublicSite(data);
 *     updateAdminPreview(data);
 * });
 * 
 * // Subscribe para produtos
 * firebaseRealtimeManager.subscribeToSubcollection(
 *     'site',
 *     'cliente-001',
 *     'produtos',
 *     (produtos) => {
 *         console.log('Produtos atualizados:', produtos);
 *         renderProdutos(produtos);
 *     }
 * );
 * 
 * // Upload de imagem
 * const imageUrl = await firebaseRealtimeManager.uploadImage(
 *     file,
 *     'logos/banner.jpg',
 *     (progress) => console.log(`Upload: ${progress}%`)
 * );
 * 
 * // Salvar dados
 * await firebaseRealtimeManager.saveData({
 *     main: { empresaNome: 'Minha Empresa' },
 *     cores: { primaria: '#007bff' },
 *     produtos: [{ nome: 'Produto 1' }],
 *     // ... outros dados
 * });
 * 
 * // Limpar ao sair
 * firebaseRealtimeManager.unsubscribeAll();
 */