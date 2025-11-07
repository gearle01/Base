console.log('📝 [login.js] Script carregado');

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 [login.js] DOM carregado');

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    if (!window.authManager) {
        console.error('❌ [login.js] Auth Manager não está disponível.');
        errorMessage.textContent = 'Erro: Gerenciador de autenticação não carregado.';
        errorMessage.style.display = 'block';
        return;
    }
    console.log('✅ [login.js] Auth Manager está disponível.');

    // Rate limiting
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos

    function checkLockout() {
        const lockoutEnd = localStorage.getItem('lockoutEnd');
        const attempts = parseInt(localStorage.getItem('loginAttempts') || '0');

        if (lockoutEnd && Date.now() < parseInt(lockoutEnd)) {
            const remaining = Math.ceil((parseInt(lockoutEnd) - Date.now()) / 60000);
            errorMessage.textContent = `Muitas tentativas. Tente novamente em ${remaining} minutos.`;
            errorMessage.style.display = 'block';
            return true;
        }

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

    // EVENT LISTENER: Formulário de login
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        console.log('🔐 [login.js] Form enviado');

        // Verificar lockout
        if (checkLockout()) {
            console.log('⏸️ [login.js] Conta bloqueada');
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        console.log('📝 [login.js] Email:', email);

        // Validação básica
        if (!email || !password) {
            errorMessage.textContent = 'Preencha todos os campos.';
            errorMessage.style.display = 'block';
            console.warn('⚠️ [login.js] Campos vazios');
            return;
        }

        console.log('🔐 [login.js] Tentando login via AuthManager...');

        try {
            await window.authManager.login(email, password);
            console.log('✅ [login.js] Login realizado com sucesso via AuthManager!');

            // Limpar tentativas falhadas
            localStorage.removeItem('loginAttempts');
            localStorage.removeItem('lockoutEnd');

            // Mostrar mensagem de sucesso
            errorMessage.style.color = 'green';
            errorMessage.textContent = '✅ Login realizado! Redirecionando...';
            errorMessage.style.display = 'block';

            // AuthManager cuidará do redirecionamento
            console.log('📍 [login.js] AuthManager cuidará do redirecionamento.');

        } catch (error) {
            console.error('❌ [login.js] Erro no login via AuthManager:', error.code, error.message);

            // Incrementar tentativas
            let attempts = parseInt(localStorage.getItem('loginAttempts') || '0');
            attempts++;
            localStorage.setItem('loginAttempts', attempts.toString());

            if (attempts >= MAX_ATTEMPTS) {
                const lockoutEnd = Date.now() + LOCKOUT_TIME;
                localStorage.setItem('lockoutEnd', lockoutEnd.toString());
                errorMessage.textContent = 'Conta temporariamente bloqueada por 15 minutos.';
                loginForm.querySelector('button').disabled = true;
                console.warn('🚫 [login.js] Conta bloqueada');
            } else {
                const remaining = MAX_ATTEMPTS - attempts;
                errorMessage.textContent = `E-mail ou senha inválidos. ${remaining} tentativa(s) restante(s).`;
                console.warn(`⚠️ [login.js] Tentativa ${attempts}/${MAX_ATTEMPTS}`);
            }

            errorMessage.style.color = 'red';
            errorMessage.style.display = 'block';
        }
    });
});