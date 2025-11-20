class AuthManager {
    constructor() {
        this.user = null;
        this.isReady = false;
        this.redirecting = false;
        this.pageType = this.detectPageType();
        console.log(`🔄 [AuthManager] Página atual: ${this.pageType}`);
    }

    detectPageType() {
        const path = window.location.pathname;
        if (path.includes('login.html')) return 'login';
        if (path.includes('admin.html')) return 'admin';
        return 'public';
    }

    async init() {
        // Aguarda o Firebase estar disponível globalmente
        await this.waitForFirebase();

        // Força a persistência para LOCAL (sobrevive ao refresh)
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (e) {
            console.warn('Aviso de persistência:', e);
        }

        // Ouve mudanças de estado
        firebase.auth().onAuthStateChanged((user) => {
            console.log('👤 [Auth] Estado mudou:', user ? user.email : 'Deslogado');
            this.user = user;
            this.isReady = true;
            this.decideRedirect();
        });
    }

    waitForFirebase() {
        return new Promise(resolve => {
            if (typeof firebase !== 'undefined' && firebase.apps.length) return resolve();
            const i = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.apps.length) {
                    clearInterval(i);
                    resolve();
                }
            }, 100);
        });
    }

    decideRedirect() {
        if (this.redirecting) return;

        // Lógica centralizada de redirecionamento
        if (this.user) {
            // USUÁRIO LOGADO
            if (this.pageType === 'login') {
                console.log('✅ Logado. Indo para Admin.');
                this.doRedirect('admin.html');
            }
        } else {
            // USUÁRIO DESLOGADO
            if (this.pageType === 'admin') {
                console.warn('⛔ Não logado. Indo para Login.');
                // Pequeno delay para garantir que não é apenas lentidão do Firebase
                setTimeout(() => {
                    if (!this.user) this.doRedirect('login.html');
                }, 500);
            }
        }
    }

    doRedirect(url) {
        this.redirecting = true;
        window.location.replace(url);
    }

    // Métodos públicos
    async login(email, password) {
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        return firebase.auth().signInWithEmailAndPassword(email, password);
    }

    async logout() {
        await firebase.auth().signOut();
        this.doRedirect('login.html');
    }

    getCurrentUser() {
        return this.user;
    }

    // Promessa que resolve apenas quando o estado de auth for confirmado (não nulo por loading)
    waitUntilReady() {
        if (this.isReady) return Promise.resolve(this.user);
        return new Promise(resolve => {
            const i = setInterval(() => {
                if (this.isReady) {
                    clearInterval(i);
                    resolve(this.user);
                }
            }, 100);
            // Timeout de segurança de 5s
            setTimeout(() => { clearInterval(i); resolve(null); }, 5000);
        });
    }
}

// Singleton
if (!window.authManager) {
    window.authManager = new AuthManager();
}
