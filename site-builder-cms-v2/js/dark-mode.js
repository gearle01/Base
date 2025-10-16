function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');

    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);

    // Change button icon
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (isDarkMode) {
        darkModeToggle.innerHTML = '☀️'; // Sun icon
        darkModeToggle.title = 'Modo Claro';
    } else {
        darkModeToggle.innerHTML = '🌙'; // Moon icon
        darkModeToggle.title = 'Modo Escuro';
    }
}

// Apply dark mode on page load if saved in localStorage
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        const darkModeToggle = document.getElementById('darkModeToggle');
        darkModeToggle.innerHTML = '☀️'; // Sun icon
        darkModeToggle.title = 'Modo Claro';
    }
});
