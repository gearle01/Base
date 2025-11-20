console.log('📝 [login.js] Script carregado');

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializa o AuthManager também aqui para verificar se já não está logado
    if (window.authManager) {
        await window.authManager.init();
        // Se já estiver logado, o AuthManager vai redirecionar para admin.html
        // Não precisamos fazer nada aqui.
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            errorMessage.style.display = 'none';
            const btn = loginForm.querySelector('button');
            btn.textContent = 'Entrando...';
            btn.disabled = true;

            await window.authManager.login(email, password);

            // Sucesso! O AuthManager detectará a mudança de estado e redirecionará.
            // Apenas mostramos feedback visual.
            btn.textContent = 'Sucesso!';

        } catch (error) {
            console.error(error);
            errorMessage.textContent = 'Erro: Verifique e-mail e senha.';
            errorMessage.style.display = 'block';
            const btn = loginForm.querySelector('button');
            btn.textContent = 'Entrar';
            btn.disabled = false;
        }
    });
});