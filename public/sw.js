/**
 * Service Worker com melhor tratamento de CORS
 * Arquivo: public/sw.js
 * * ✅ CORRIGIDO:
 * 1. A ordem das linhas no 'fetch' listener foi corrigida para evitar o 'ReferenceError'.
 */

const CACHE_NAME = 'site-cache-v3';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/main.css',
    '/js/modules.js',
    '/js/public.js',
    '/js/config-manager.js',
    '/js/helpers.js',
    '/js/smart-cache.js',
    '/js/firebase-config.js',
    '/js/purify.min.js',
];

// URLs externas que NÃO devem ser cacheadas (CORS issues)
const EXTERNAL_DOMAINS = [
    'cdnjs.cloudflare.com',
    'gstatic.com',
    'googleapis.com',
    'firebaseapp.com',
    'firebasestorage.googleapis.com',
    'appwrite.io'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
    console.log('[SW] Install iniciado...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cache aberto');

                return Promise.allSettled(
                    URLS_TO_CACHE.map(url =>
                        cache.add(url).catch(() => {
                            console.warn(`[SW] ⚠️ Falha ao cachear: ${url}`);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[SW] ❌ Erro no install:', error);
            })
    );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate iniciado...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[SW] Removendo cache antigo: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
    // Ignorar requisições POST
    if (event.request.method !== 'GET') {
        return;
    }

    // --- CORREÇÃO DE ORDEM AQUI ---
    // 1. Defina 'request' primeiro, a partir do 'event'
    const { request } = event;

    // 2. Agora pode usar 'request' para verificar a URL
    if (!request.url.startsWith('http')) {
        return; // Ignora 'chrome-extension://' e outras
    }
    // --- FIM DA CORREÇÃO ---

    const url = new URL(request.url);

    // ✅ NÃO CACHEAR: Domínios externos com CORS
    const isExternalDomain = EXTERNAL_DOMAINS.some(domain =>
        url.hostname.includes(domain)
    );

    if (isExternalDomain) {
        console.log(`[SW] Ignorando cache para: ${url.hostname}`);
        return;
    }

    // ✅ CACHEAR: Recursos locais
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Não cachear respostas com erro
                if (response.status !== 200) {
                    return response;
                }

                const responseClone = response.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseClone);
                });

                return response;
            })
            .catch(() => {
                // Se falhar, tenta o cache
                return caches.match(request)
                    .then((response) => {
                        return response || caches.match('/index.html');
                    })
                    .catch(() => {
                        console.warn(`[SW] ⚠️ Falha ao buscar: ${request.url}`);
                    });
            })
    );
});

// ===== MENSAGENS =====
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[SW] Service Worker carregado');