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
            console.error('❌ Erro no manager init:', error);
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
            }, err => console.error(err));

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
            }, err => console.error(err));

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
            console.error('Upload falhou:', error);
            throw error;
        }
    }

    async saveData(data) {
        if (!this.db) throw new Error('Firebase offline');

        const batch = this.db.batch();
        const ref = this.db.collection('site').doc(this.clientId);
        const user = firebase.auth().currentUser?.email || 'system';

        // Main
        batch.set(ref, { ...data.main, updatedBy: user, updatedAt: new Date() }, { merge: true });

        // Subcollections
        if (data.cores) batch.set(ref.collection('cores').doc('data'), data.cores, { merge: true });
        if (data.contato) batch.set(ref.collection('contato').doc('data'), data.contato, { merge: true });
        if (data.modules) batch.set(ref.collection('modules').doc('data'), data.modules, { merge: true });
        if (data.sobre) batch.set(ref.collection('sobre').doc('data'), data.sobre, { merge: true });
        if (data.socialLinks) batch.set(ref.collection('social_links').doc('data'), { links: data.socialLinks }, { merge: true });

        // Produtos (Rebuild)
        if (data.produtos) {
            const prodSnap = await ref.collection('produtos').get();
            prodSnap.forEach(doc => batch.delete(doc.ref));
            data.produtos.forEach(p => {
                batch.set(ref.collection('produtos').doc(), p);
            });
        }

        await batch.commit();
    }

    async loadInitialData() {
        if (!this.db) await this.init();

        const ref = this.db.collection('site').doc(this.clientId);
        const doc = await ref.get();
        if (!doc.exists) return null;

        const data = doc.data();

        // Load subcollections in parallel
        const [cores, contato, modules, sobre, social, prods] = await Promise.all([
            ref.collection('cores').doc('data').get(),
            ref.collection('contato').doc('data').get(),
            ref.collection('modules').doc('data').get(),
            ref.collection('sobre').doc('data').get(),
            ref.collection('social_links').doc('data').get(),
            ref.collection('produtos').get()
        ]);

        data.cores = cores.data();
        data.contato = contato.data();
        data.modules = modules.data();
        data.sobre = sobre.data();
        data.socialLinks = social.data()?.links || [];
        data.produtos = prods.docs.map(d => ({ id: d.id, ...d.data() }));

        return data;
    }
}

window.firebaseManager = new FirebaseRealtimeManager();
