// CogniBook Service Worker
const CACHE_VERSION = "v1";
const STATIC_CACHE = `cognibook-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `cognibook-dynamic-${CACHE_VERSION}`;
const CHAPTER_CACHE = `cognibook-chapters-${CACHE_VERSION}`;

// Статические ресурсы для прекэширования
const STATIC_ASSETS = [
    "/",
    "/library",
    "/quizzes",
    "/manifest.json",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
];

// Установка Service Worker
self.addEventListener("install", (event) => {
    console.log("[SW] Installing...");
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log("[SW] Precaching static assets");
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Активация и очистка старых кэшей
self.addEventListener("activate", (event) => {
    console.log("[SW] Activating...");
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => {
                        return (
                            key.startsWith("cognibook-") &&
                            key !== STATIC_CACHE &&
                            key !== DYNAMIC_CACHE &&
                            key !== CHAPTER_CACHE
                        );
                    })
                    .map((key) => {
                        console.log("[SW] Removing old cache:", key);
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// Стратегии кэширования
async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            console.log("[SW] Serving from cache:", request.url);
            return cached;
        }
        throw error;
    }
}

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        throw error;
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                caches.open(cacheName).then((cache) => {
                    cache.put(request, response.clone());
                });
            }
            return response;
        })
        .catch(() => cached);

    return cached || fetchPromise;
}

// Обработка запросов
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Пропускаем не-GET запросы
    if (request.method !== "GET") {
        return;
    }

    // Пропускаем запросы к другим доменам
    if (url.origin !== location.origin) {
        return;
    }

    // API запросы глав — NetworkFirst (главное для офлайн-чтения!)
    if (url.pathname.match(/\/api\/sources\/\d+\/chapters\/\d+/)) {
        event.respondWith(networkFirst(request, CHAPTER_CACHE));
        return;
    }

    // Другие API запросы — NetworkFirst
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
        return;
    }

    // Изображения — CacheFirst
    if (request.destination === "image") {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // Статические ресурсы (JS/CSS) — StaleWhileRevalidate
    if (
        request.destination === "script" ||
        request.destination === "style" ||
        url.pathname.startsWith("/_next/static/")
    ) {
        event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
        return;
    }

    // Навигация (HTML страницы) — NetworkFirst
    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
        return;
    }

    // Всё остальное — NetworkFirst
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

console.log("[SW] Service Worker loaded");
