document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    // Inicializar o Firebase
    try {
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
    } catch (e) {
        console.error('Erro ao inicializar o Firebase: ', e);
        errorMessage.textContent = 'Erro na configuração do Firebase.';
        errorMessage.style.display = 'block';
        return;
    }
    
    // Rate limiting
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos
    
    // Verificar se o firebase foi inicializado
    if (typeof firebase === 'undefined') {
        errorMessage.textContent = 'Erro: Firebase não configurado.';
        errorMessage.style.display = 'block';
        return;
    }

    // Verificar se está bloqueado
    function checkLockout() {
        const lockoutEnd = localStorage.getItem('lockoutEnd');
        const attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
        
        if (lockoutEnd && Date.now() < parseInt(lockoutEnd)) {
            const remaining = Math.ceil((parseInt(lockoutEnd) - Date.now()) / 60000);
            errorMessage.textContent = `Muitas tentativas. Tente novamente em ${remaining} minutos.`;
            errorMessage.style.display = 'block';
            return true;
        }
        
        // Resetar contador se passou o tempo
        if (lockoutEnd && Date.now() >= parseInt(lockoutEnd)) {
            localStorage.removeItem('loginAttempts');
            localStorage.removeItem('lockoutEnd');
        }
        
        return false;
    }
    
    // Verificar ao carregar
    if (checkLockout()) {
        loginForm.querySelector('button').disabled = true;
    }

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Verificar lockout
        if (checkLockout()) return;
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Validação básica
        if (!email || !password) {
            errorMessage.textContent = 'Preencha todos os campos.';
            errorMessage.style.display = 'block';
            return;
        }

        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Login bem-sucedido
                localStorage.removeItem('loginAttempts');
                localStorage.removeItem('lockoutEnd');
                window.location.href = 'admin.html';
            })
            .catch((error) => {
                // Incrementar tentativas
                let attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
                attempts++;
                localStorage.setItem('loginAttempts', attempts.toString());
                
                if (attempts >= MAX_ATTEMPTS) {
                    const lockoutEnd = Date.now() + LOCKOUT_TIME;
                    localStorage.setItem('lockoutEnd', lockoutEnd.toString());
                    errorMessage.textContent = 'Conta temporariamente bloqueada por 15 minutos devido a múltiplas tentativas falhas.';
                    loginForm.querySelector('button').disabled = true;
                } else {
                    const remaining = MAX_ATTEMPTS - attempts;
                    errorMessage.textContent = `E-mail ou senha inválidos. ${remaining} tentativa(s) restante(s).`;
                }
                
                errorMessage.style.display = 'block';
            });
    });
});