/**
 * ✅ OTIMIZADO: Namespace principal da aplicação
 * @namespace App
 */
const App = {
    /**
     * Estado global da aplicação
     * @memberof App
     */
    state: {
        modules: { sobre: true, produtos: true, contato: true },
        produtos: [],
        hasUnsavedChanges: false,
        dataLoaded: false
    },

    /**
     * Configurações da aplicação
     * @memberof App
     */
    config: {
        clientId: 'cliente-001',
        maxUploadSize: 5 * 1024 * 1024, // 5MB
        debounceDelay: 300,
        cacheTimeout: 5 * 60 * 1000 // 5 minutos
    },

    /**
     * Serviços Firebase
     * @memberof App
     */
    services: {
        db: null,
        storage: null,
        auth: null
    },

    /**
     * Rate limiters
     * @memberof App
     */
    rateLimiters: {
        save: {
            lastSave: 0,
            minInterval: 2000,
            
            canSave() {
                const now = Date.now();
                if (now - this.lastSave < this.minInterval) {
                    return false;
                }
                this.lastSave = now;
                return true;
            },
            
            getRemainingTime() {
                const elapsed = Date.now() - this.lastSave;
                const remaining = Math.ceil((this.minInterval - elapsed) / 1000);
                return Math.max(0, remaining);
            }
        },
        
        firestore: {
            operations: [],
            maxOps: 10,
            windowMs: 60000,
            
            canOperate() {
                const now = Date.now();
                this.operations = this.operations.filter(time => now - time < this.windowMs);
                
                if (this.operations.length >= this.maxOps) {
                    return false;
                }
                
                this.operations.push(now);
                return true;
            }
        }
    },

    /**
     * Monitor de sessão
     * @memberof App
     */
    sessionMonitor: {
        lastActivity: Date.now(),
        timeout: 30 * 60 * 1000, // 30 minutos
        
        init() {
            ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
                document.addEventListener(event, () => this.updateActivity(), true);
            });
            
            setInterval(() => this.check(), 60000);
        },
        
        updateActivity() {
            this.lastActivity = Date.now();
        },
        
        check() {
            if (Date.now() - this.lastActivity > this.timeout) {
                App.services.auth?.signOut();
                showToast('Sessão expirada por inatividade', 'warning');
                window.location.href = 'login.html';
            }
        }
    },

    /**
     * Inicializa a aplicação
     * @memberof App
     */
    async init() {
        // Proteção contra clickjacking
        if (window.self !== window.top) {
            window.top.location = window.self.location;
            return;
        }

        try {
            await this.initializeFirebase();
            this.sessionMonitor.init();
            await this.loadInitialData();
        } catch (error) {
            console.error('Erro na inicialização:', error);
            showToast('Erro ao inicializar aplicação', 'error');
        }
    },

    /**
     * Inicializa o Firebase
     * @memberof App
     */
    async initializeFirebase() {
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK não encontrado');
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        this.services.db = firebase.firestore();
        this.services.storage = firebase.storage();
        this.services.auth = firebase.auth();

        // Configura observador de autenticação
        this.services.auth.onAuthStateChanged(this.handleAuthStateChanged.bind(this));
    },

    /**
     * Handler de mudança de estado de autenticação
     * @memberof App
     */
    async handleAuthStateChanged(user) {
        if (user) {
            if (!this.state.dataLoaded) {
                await this.loadDataFromFirestore();
            }
        } else {
            console.log('Usuário não autenticado');
            // Implementar lógica de redirecionamento se necessário
        }
    },

    /**
     * Carrega dados iniciais
     * @memberof App
     */
    async loadInitialData() {
        // Implementar carregamento inicial de dados
    }
};

// Exporta o namespace
export default App;