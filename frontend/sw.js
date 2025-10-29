const CACHE_NAME = 'lugx-v1';
const urlsToCache = [
  './',
  './index.html',
  './shop.html',
  './product-details.html',
  './contact.html',
  
  // Panel de Administración
  './panel/index.html',
  './panel/login.html',
  './panel/auth.html',
  './panel/clientes.html',
  './panel/trajes.html',
  './panel/rentas.html',
  './panel/orders.html',
  './panel/products.html',
  './panel/users.html',
  './panel/notifications.html',
  './panel/css/admin-panel.css',
  './panel/js/auth.js',
  './panel/js/login.js',
  './panel/js/clientes.js',
  './panel/js/trajes.js',
  './panel/js/rentas.js',
  './panel/js/orders.js',
  './panel/js/users.js',
  
  // CSS Files
  './assets/css/templatemo-lugx-gaming.css',
  './assets/css/fontawesome.css',
  './assets/css/owl.css',
  './assets/css/animate.css',
  './assets/css/flex-slider.css',
  './vendor/bootstrap/css/bootstrap.min.css',
  
  // JavaScript Files
  './assets/js/custom.js',
  './assets/js/counter.js',
  './assets/js/isotope.min.js',
  './assets/js/owl-carousel.js',
  './vendor/bootstrap/js/bootstrap.min.js',
  './vendor/jquery/jquery.min.js',
  './vendor/jquery/jquery.js',
  
  // Images
  './assets/images/logo.svg',
  './assets/images/featured-01.png',
  './assets/images/featured-02.png',
  './assets/images/featured-03.png',
  './assets/images/featured-04.png',
  './assets/images/icon-192.svg',
  './assets/images/icon-512.svg',
  './assets/images/trajeazul.png',
  './assets/images/trajemoderno.jpg',
  './assets/images/esmoquinclasico.jpg',
  './assets/images/trajegrisajustado.jpg',
  './assets/images/esmoquinnegro.jpg',
  './assets/images/trajeformalhombre.jpg',
  './assets/images/trajeazulmarino.jpg',
  './assets/images/formaldenegocios.jpg',
  './assets/images/atuendodecoctel.jpg',
  './assets/images/atuendopareja.jpg',
  './assets/images/atuendosdeboda.jpg',
  './assets/images/vestidodealfombraroja.jpg',
  './assets/images/vestidodenoche.jpg',
  './assets/images/vestidodenocheelegante.jpg',
  './assets/images/vestidodeterciopelo.jpg',
  './assets/images/vestidoelegante.jpg',
  './assets/images/vestidofloral.jpg',
  
  // Web Fonts
  './assets/webfonts/fa-brands-400.woff2',
  './assets/webfonts/fa-regular-400.woff2',
  './assets/webfonts/fa-solid-900.woff2',
  './assets/webfonts/fa-v4compatibility.woff2',
  
  // Manifest
  './manifest.json'
];

// Install event - cache all resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: All files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Error caching files', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external requests (like Google Fonts)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if available
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }

        // Otherwise, fetch from network
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Add to cache for future use
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('Service Worker: Fetch failed', error);
            
            // If it's a navigation request and we're offline, serve the main page
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            // For other requests, you could return a fallback response
            throw error;
          });
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any background sync tasks here
      console.log('Service Worker: Performing background sync')
    );
  }
});

// Handle push notifications (optional)
self.addEventListener('push', event => {
  console.log('Service Worker: Push received');
  
  const options = {
    body: event.data ? event.data.text() : 'Nueva actualización disponible',
    icon: '/assets/images/icon-192.svg',
    badge: '/assets/images/icon-192.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Lugx Gaming', options)
  );
});