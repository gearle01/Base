/**
 * ✅ OTIMIZADO: Sistema de sincronização em tempo real com Firebase
 */

class FirebaseRealtimeManager {
    constructor() {
        this.db = null;
        this.storage = null;
        this.unsubscribers = [];
        this.clientId = 'cliente-001';
        this.cacheData = new Map();
    }

    /**
     * Inicializa conexões com Firebase
     */
    async init() {
        try {
            // Chama a função global definida em firebase-config.js
            if (typeof window.initializeFirebase !== 'function') {
                throw new Error('initializeFirebase não encontrado (verifique firebase-config.js)');
            }
            const firebaseServices = await window.initializeFirebase();
            this.db = firebaseServices.db;
            this.storage = firebaseServices.storage;
            return firebaseServices;
        } catch (error) {
            // Silent fail or rethrow for caller
            throw error;
        }
    }

    subscribeToDocument(collection, docId, onUpdate) {
        if (!this.db) return () => { };

        const unsubscribe = this.db.collection(collection).doc(docId)
            .onSnapshot(snapshot => {
                if (snapshot.exists) {
                    const data = snapshot.data();
                    this.cacheData.set(`${collection}:${docId}`, data);
                    onUpdate(data);
                }
            }, () => { /* Silent error */ });

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    subscribeToSubcollection(parentCollection, parentDocId, subCollection, onUpdate) {
        if (!this.db) return () => { };

        const unsubscribe = this.db.collection(parentCollection).doc(parentDocId).collection(subCollection)
            .onSnapshot(snapshot => {
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.cacheData.set(`${parentCollection}:${parentDocId}:${subCollection}`, docs);
                onUpdate(docs);
            }, () => { /* Silent error */ });

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    async uploadImage(file, path) {
        try {
            if (typeof validateImageFile === 'function') {
                await validateImageFile(file);
            }

            const storageRef = this.storage.ref(`site/${this.clientId}/${path}`);
            const uploadTask = storageRef.put(file);

            const snapshot = await uploadTask;
            return await snapshot.ref.getDownloadURL();
        } catch (error) {
            throw error;
        }
    }

    async saveData(data) {
        if (!this.db) throw new Error('Firebase offline');

        const ref = this.db.collection('site').doc(this.clientId);
        const user = firebase.auth().currentUser?.email || 'system';

        // Primeiro, salvar dados principais e subcoleções simples
        const batch = this.db.batch();

        // Main
        batch.set(ref, { ...data.main, updatedBy: user, updatedAt: new Date() }, { merge: true });

        // Subcollections simples
        if (data.cores) batch.set(ref.collection('cores').doc('data'), data.cores, { merge: true });
        if (data.contato) batch.set(ref.collection('contato').doc('data'), data.contato, { merge: true });
        if (data.modules) batch.set(ref.collection('modules').doc('data'), data.modules, { merge: true });
        if (data.sobre) batch.set(ref.collection('sobre').doc('data'), data.sobre, { merge: true });
        if (data.socialLinks !== undefined) {
            batch.set(ref.collection('social_links').doc('data'), { links: data.socialLinks || [] }, { merge: false });
        }

        await batch.commit();

        // Produtos: Tratar separadamente para garantir exclusão correta
        if (data.produtos !== undefined) {
            // 1. Buscar todos os produtos existentes
            const prodSnap = await ref.collection('produtos').get();

            // 2. Deletar todos os produtos existentes
            const deletePromises = prodSnap.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);

            // 3. Adicionar os novos produtos (se houver)
            if (data.produtos && data.produtos.length > 0) {
                const addPromises = data.produtos.map(p =>
                    ref.collection('produtos').add(p)
                );
                await Promise.all(addPromises);
            }
        }
    }

    async loadInitialData() {
        if (!this.db) await this.init();

        const ref = this.db.collection('site').doc(this.clientId);

        // No admin, forçar busca do servidor (não do cache)
        const isAdmin = window.location.pathname.includes('admin');
        const getOptions = isAdmin ? { source: 'server' } : {};

        const doc = await ref.get(getOptions);
        // Return default structure if doc doesn't exist, to prevent null errors
        const data = doc.exists ? doc.data() : {};

        // Load subcollections in parallel
        const [cores, contato, modules, sobre, social, prods] = await Promise.all([
            ref.collection('cores').doc('data').get(getOptions),
            ref.collection('contato').doc('data').get(getOptions),
            ref.collection('modules').doc('data').get(getOptions),
            ref.collection('sobre').doc('data').get(getOptions),
            ref.collection('social_links').doc('data').get(getOptions),
            ref.collection('produtos').get(getOptions)
        ]);

        data.cores = cores.exists ? cores.data() : null;
        data.contato = contato.exists ? contato.data() : null;
        data.modules = modules.exists ? modules.data() : null;
        data.sobre = sobre.exists ? sobre.data() : null;
        data.socialLinks = social.exists ? (social.data()?.links || []) : [];
        data.produtos = prods.empty ? [] : prods.docs.map(d => ({ id: d.id, ...d.data() }));

        if (isAdmin) {
            console.log(`📡 Dados carregados do SERVIDOR: ${data.produtos?.length || 0} produtos`);
        }

        return data;
    }
}

window.firebaseManager = new FirebaseRealtimeManager();
