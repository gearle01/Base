
class AuthManager {
    constructor() {
        this.user = null;
        this.isReady = false;
        this.isListening = false;
        this.redirecting = false;
        this.pageType = this.detectPageType();
        console.log(`🔄 [AuthManager] Instanciado na página tipo: ${this.pageType}`);
    }

    detectPageType() {
        const pathname = window.location.pathname;
        if (pathname.includes('login.html')) {
            return 'login';
        }
        if (pathname.includes('admin.html')) {
            return 'admin';
        }
        return 'public';
    }

    async waitForFirebase() {
        console.log('🔄 [AuthManager] Aguardando Firebase...');
        return new Promise((resolve) => {
            const timeout = 10000;
            const interval = 50;
            let elapsedTime = 0;

            const checkFirebase = () => {
                if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                    console.log('✅ [AuthManager] Firebase está pronto.');
                    resolve();
                } else if (elapsedTime >= timeout) {
                    console.warn('⚠️ [AuthManager] Timeout esperando pelo Firebase. Resolvendo mesmo assim.');
                    resolve();
                } else {
                    elapsedTime += interval;
                    setTimeout(checkFirebase, interval);
                }
            };
            checkFirebase();
        });
    }

    async init() {
        console.log('🔄 [AuthManager] Método init chamado');
        await this.waitForFirebase();
        if (!this.isListening) {
            this.setupAuthListener();
        } else {
            console.log('✅ [AuthManager] Listener de autenticação já configurado.');
        }
    }

    setupAuthListener() {
        if (this.isListening) {
            console.warn('⚠️ [AuthManager] Tentativa de configurar múltiplos listeners de autenticação. Ignorando.');
            return;
        }
        console.log('🔄 [AuthManager] Configurando listener de autenticação...');
        this.isListening = true;

        firebase.auth().onAuthStateChanged(user => {
            console.log('🔄 [AuthManager] onAuthStateChanged disparado.');
            this.user = user;
            this.isReady = true;

            if (this.redirecting) {
                console.log('🟡 [AuthManager] Redirecionamento em progresso, ignorando onAuthStateChanged.');
                return;
            }
            
            document.dispatchEvent(new CustomEvent('authReady', { detail: { user } }));
            this.handleAuthState();
        });
    }

    handleAuthState() {
        console.log('🔄 [AuthManager] Lidando com o estado de autenticação...');
        const isAuthenticated = !!this.user;

        if (isAuthenticated) {
            console.log(`✅ [AuthManager] Usuário autenticado: ${this.user.email}`);
            if (this.pageType === 'login') {
                this.redirect('admin.html');
            }
        } else {
            console.log('❌ [AuthManager] Usuário não autenticado.');
            if (this.pageType === 'admin') {
                this.redirect('login.html');
            }
        }
    }

    redirect(url) {
        if (this.redirecting) {
            console.warn(`⚠️ [AuthManager] Tentativa de redirecionamento duplo para ${url} ignorada.`);
            return;
        }
        console.log(`📍 [AuthManager] Redirecionando para ${url}...`);
        this.redirecting = true;
        
        // Adiciona um pequeno delay para garantir que o estado seja propagado
        setTimeout(() => {
            window.location.href = url;
        }, 500);
    }

    async login(email, password) {
        console.log(`🔄 [AuthManager] Tentando login para ${email}`);
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            console.log(`✅ [AuthManager] Login bem-sucedido para ${email}`);
            return userCredential;
        } catch (error) {
            console.error('❌ [AuthManager] Erro no login:', error);
            throw error;
        }
    }

    async logout() {
        console.log('🔄 [AuthManager] Tentando logout...');
        try {
            await firebase.auth().signOut();
            console.log('✅ [AuthManager] Logout bem-sucedido.');
        } catch (error) {
            console.error('❌ [AuthManager] Erro no logout:', error);
            throw error;
        }
    }

    getCurrentUser() {
        return this.user;
    }

    isAuthenticated() {
        return this.user !== null;
    }

    async waitUntilReady() {
        console.log('🔄 [AuthManager] Aguardando autenticação estar pronta...');
        return new Promise((resolve) => {
            const timeout = 10000;
            const interval = 100;
            let elapsedTime = 0;

            const checkReady = () => {
                if (this.isReady) {
                    console.log('✅ [AuthManager] Autenticação pronta.');
                    resolve(this.user);
                } else if (elapsedTime >= timeout) {
                    console.warn('⚠️ [AuthManager] Timeout esperando pela autenticação. Resolvendo com estado atual.');
                    resolve(this.user);
                } else {
                    elapsedTime += interval;
                    setTimeout(checkReady, interval);
                }
            };
            checkReady();
        });
    }
}

console.log('✅ [AuthManager] Classe AuthManager definida.');

if (window.authManager) {
    console.warn('⚠️ [AuthManager] Instância global de authManager já existe. Sobrescrevendo...');
}

window.authManager = new AuthManager();
console.log('✅ [AuthManager] Instância global window.authManager criada com sucesso.');
