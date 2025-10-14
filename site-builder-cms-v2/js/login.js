document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    // Verifique se o firebase foi inicializado
    if (typeof firebase === 'undefined') {
        errorMessage.textContent = 'Erro: Firebase não configurado. Verifique o arquivo firebase-config.js';
        errorMessage.style.display = 'block';
        return;
    }

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Login bem-sucedido, redirecionar para o painel de admin
                window.location.href = 'admin.html';
            })
            .catch((error) => {
                // Tratar erros de login
                errorMessage.textContent = 'E-mail ou senha inválidos.';
                errorMessage.style.display = 'block';
            });
    });
});
