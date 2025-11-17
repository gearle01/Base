/**
 * ✅ OTIMIZADO: Sistema de sincronização em tempo real com Firebase
 *
 * ✅ MELHORIA:
 * - Removida a função `validateImageFile` duplicada.
 * - Agora usa a função `validateImageFile` global (carregada de validation.js).
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
            // Usa o 'firebase-loader.js' para garantir que o SDK esteja pronto
            // (Assumindo que firebase-loader.js é carregado antes e expõe 'loadFirebase')
            if (typeof loadFirebase === 'function') {
                await loadFirebase();
            } else if (typeof firebase === 'undefined') {
                 throw new Error("Firebase SDK não encontrado e loader indisponível.");
            }

            if (firebase.apps.length === 0) {
                 if (typeof firebaseConfig === 'undefined') {
                    throw new Error("firebaseConfig não está definida.");
                 }
                 firebase.initializeApp(firebaseConfig);
            }
            
            this.db = firebase.firestore();
            this.storage = firebase.storage();

            // Configurar persistência offline
            try {
                 await this.db.enablePersistence({ synchronizeTabs: true });
                 console.log('✅ Persistência offline ativada');
            } catch (err) {
                if (err.code == 'failed-precondition') console.warn('⚠️ Persistência falhou (múltiplas abas).');
                else if (err.code == 'unimplemented') console.warn('⚠️ Persistência não suportada.');
            }

            return { db: this.db, storage: this.storage };
        } catch (error) {
            console.error('❌ Erro ao inicializar Firebase:', error);
            // Tenta inicializar sem persistência como fallback
            if (!this.db && typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                 this.db = firebase.firestore();
                 this.storage = firebase.storage();
                 console.warn('⚠️ Firebase inicializado SEM persistência offline.');
                 return { db: this.db, storage: this.storage };
            }
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
        if (!this.db) {
            console.error('Firebase não inicializado ao tentar subscribeToDocument');
            return () => {};
        }

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
                    const cached = this.cacheData.get(`${collection}:${docId}`);
                    if (cached) {
                        console.log(`📦 Usando cache para ${collection}:${docId}`);
                        onUpdate(cached);
                    }
                }
            );

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
        if (!this.db) {
             console.error('Firebase não inicializado ao tentar subscribeToSubcollection');
            return () => {};
        }

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
            // ✅ MELHORIA: Usa a função global 'validateImageFile' (de validation.js)
            if (typeof validateImageFile !== 'function') {
                throw new Error("Função 'validateImageFile' não encontrada. Verifique se validation.js está carregado.");
            }
            await validateImageFile(file);
            // --- Fim da Melhoria ---

            let fileToUpload = file;
            let uploadMimeType = file.type;

            if (file.type !== 'image/svg+xml') {
                console.log('🖼️ Imagem não-SVG, comprimindo...');
                fileToUpload = await this.compressImage(file);
                uploadMimeType = fileToUpload.type;
            } else {
                console.log('🖋️ Ficheiro SVG detetado, não comprimindo.');
            }

            const storageRef = this.storage.ref(`site/${this.clientId}/${path}`);
            const uploadTask = storageRef.put(fileToUpload, {
                contentType: uploadMimeType 
            });

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

            const snapshot = await uploadTask;
            const downloadUrl = await snapshot.ref.getDownloadURL();
            console.log(`✅ Upload concluído: ${downloadUrl}`);

            return downloadUrl;
        } catch (error) {
            console.error('❌ Erro ao fazer upload:', error);
            throw error;
        }
    }
    
    // ✅ MELHORIA: Esta função foi removida pois estava duplicada.
    // async validateImageFile(file) { ... }

    /**
     * Comprime imagem usando Canvas (sempre para JPEG)
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

                    const targetMimeType = 'image/jpeg';
                    canvas.toBlob(
                        (blob) => {
                            const compressedFile = new File([blob], file.name, {
                                type: targetMimeType,
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        },
                        targetMimeType,
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
                
            const userEmail = firebase.auth().currentUser ? firebase.auth().currentUser.email : 'system';

            // Documento principal
            batch.set(clientDocRef, {
                ...data.main,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: userEmail
            }, { merge: true });

            if (data.cores) batch.set(clientDocRef.collection('cores').doc('data'), data.cores, { merge: true });
            if (data.contato) batch.set(clientDocRef.collection('contato').doc('data'), data.contato, { merge: true });
            if (data.modules) batch.set(clientDocRef.collection('modules').doc('data'), data.modules, { merge: true });
            if (data.sobre) batch.set(clientDocRef.collection('sobre').doc('data'), data.sobre, { merge: true });
            if (data.globalSettings) batch.set(clientDocRef.collection('global_settings').doc('data'), data.globalSettings, { merge: true });
            if (data.socialLinks) batch.set(clientDocRef.collection('social_links').doc('data'), { links: data.socialLinks }, { merge: true });

            // Produtos
            if (data.produtos) {
                const produtosSnap = await clientDocRef.collection('produtos').get();
                produtosSnap.docs.forEach(doc => batch.delete(doc.ref));
                data.produtos.forEach(produto => {
                    const newRef = clientDocRef.collection('produtos').doc();
                    batch.set(newRef, {
                        ...produto,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
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
        if (!this.db) {
            console.warn('DB não inicializado, tentando inicializar agora...');
            await this.init();
            if (!this.db) {
                 console.error('Falha crítica: DB não pôde ser inicializado.');
                 return null;
            }
        }
        
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

            const config = clientDoc.exists ? clientDoc.data() : {};

            if (coresDoc.exists) config.cores = coresDoc.data();
            if (contatoDoc.exists) config.contato = contatoDoc.data();
            if (modulesDoc.exists) config.modules = modulesDoc.data();
            if (sobreDoc.exists) config.sobre = sobreDoc.data();
            if (globalDoc.exists) config.globalSettings = globalDoc.data();
            if (socialLinksDoc.exists) config.socialLinks = socialLinksDoc.data().links || [];

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
}

// Instância global
const firebaseManager = new FirebaseRealtimeManager();

// Exportar para uso (se necessário, mas é principalmente global)
window.firebaseManager = firebaseManager;