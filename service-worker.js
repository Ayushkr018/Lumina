// Lumina AI - Service Worker
// Version: 2.1.0
// Updated: August 24, 2025

const CACHE_NAME = 'lumina-ai-v2.1.0';
const DYNAMIC_CACHE = 'lumina-ai-dynamic-v2.1.0';
const ASSETS_CACHE = 'lumina-ai-assets-v2.1.0';

// Core files to cache immediately
const CORE_FILES = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/monitor.html',
  '/analytics.html',
  '/profile.html',
  '/settings.html',
  '/manifest.json',
  '/offline.html'
];

// Assets to cache
const ASSET_FILES = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-192x192.png',
  '/icons/maskable-icon-512x512.png',
  '/screenshots/dashboard-mobile.png',
  '/screenshots/monitor-mobile.png'
];

// External resources
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
];

// Install Event - Cache core files
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache core files
      caches.open(CACHE_NAME).then((cache) => {
        console.log('📦 Service Worker: Caching core files');
        return cache.addAll(CORE_FILES);
      }),
      
      // Cache assets
      caches.open(ASSETS_CACHE).then((cache) => {
        console.log('🎨 Service Worker: Caching assets');
        return cache.addAll(ASSET_FILES);
      }),
      
      // Cache external resources
      caches.open(DYNAMIC_CACHE).then((cache) => {
        console.log('🌐 Service Worker: Caching external resources');
        return cache.addAll(EXTERNAL_RESOURCES.map(url => new Request(url, {mode: 'cors'})));
      })
    ]).then(() => {
      console.log('✅ Service Worker: Installation complete');
      // Force activation immediately
      return self.skipWaiting();
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== ASSETS_CACHE) {
              console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker: Activation complete');
      
      // Notify all clients about the update
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            message: 'Service Worker activated successfully'
          });
        });
      });
    })
  );
});

// Fetch Event - Implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests
  if (url.origin === location.origin) {
    // Same-origin requests
    event.respondWith(handleSameOriginRequest(request));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Google Fonts
    event.respondWith(handleFontRequest(request));
  } else {
    // External resources
    event.respondWith(handleExternalRequest(request));
  }
});

// Handle same-origin requests (HTML, CSS, JS)
async function handleSameOriginRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Core pages - Cache First strategy
    if (CORE_FILES.some(file => url.pathname.endsWith(file.replace('/', '')))) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('📋 Service Worker: Serving from cache:', url.pathname);
        return cachedResponse;
      }
    }
    
    // Try network first, then cache
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      console.log('🌐 Service Worker: Cached from network:', url.pathname);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('❌ Service Worker: Network failed, trying cache:', url.pathname);
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      const offlinePage = await caches.match('/offline.html');
      return offlinePage || new Response('Offline - Lumina AI Dashboard', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    throw error;
  }
}

// Handle font requests
async function handleFontRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request, {
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('', { status: 404 });
  }
}

// Handle external requests
async function handleExternalRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('', { status: 404 });
  }
}

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-eye-data') {
    event.waitUntil(syncEyeHealthData());
  } else if (event.tag === 'sync-settings') {
    event.waitUntil(syncUserSettings());
  }
});

// Sync eye health data when online
async function syncEyeHealthData() {
  try {
    console.log('👁️ Service Worker: Syncing eye health data...');
    
    // Get stored offline data
    const offlineData = await getStoredData('pending-eye-data');
    
    if (offlineData && offlineData.length > 0) {
      // Send data to server
      for (const data of offlineData) {
        await fetch('/api/eye-health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      
      // Clear stored data
      await clearStoredData('pending-eye-data');
      console.log('✅ Service Worker: Eye health data synced successfully');
      
      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'DATA_SYNCED',
          message: 'Eye health data synchronized'
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Service Worker: Failed to sync eye health data:', error);
  }
}

// Sync user settings
async function syncUserSettings() {
  try {
    console.log('⚙️ Service Worker: Syncing user settings...');
    
    const settings = await getStoredData('pending-settings');
    
    if (settings) {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      await clearStoredData('pending-settings');
      console.log('✅ Service Worker: Settings synced successfully');
    }
    
  } catch (error) {
    console.error('❌ Service Worker: Failed to sync settings:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('📢 Service Worker: Push notification received');
  
  const options = {
    body: 'Time for your eye health break!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'eye-health-reminder',
    data: {
      url: '/dashboard.html?notification=break-reminder'
    },
    actions: [
      {
        action: 'take-break',
        title: 'Take Break Now',
        icon: '/icons/action-break.png'
      },
      {
        action: 'remind-later',
        title: 'Remind Later',
        icon: '/icons/action-later.png'
      }
    ],
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: true
  };
  
  if (event.data) {
    const data = event.data.json();
    options.body = data.message || options.body;
    options.data = { ...options.data, ...data };
  }
  
  event.waitUntil(
    self.registration.showNotification('Lumina AI - Eye Health', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Service Worker: Notification clicked:', event.action);
  
  event.notification.close();
  
  const action = event.action;
  const url = event.notification.data?.url || '/dashboard.html';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Check if app is already open
      const client = clients.find(c => c.url.includes('lumina'));
      
      if (client) {
        // Focus existing window
        client.focus();
        client.postMessage({
          type: 'NOTIFICATION_ACTION',
          action: action,
          data: event.notification.data
        });
      } else {
        // Open new window
        self.clients.openWindow(url + `?action=${action}`);
      }
    })
  );
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('💬 Service Worker: Message received:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'STORE_DATA':
      storeData(data.key, data.value);
      break;
      
    case 'GET_CACHE_STATUS':
      event.ports[0].postMessage({
        cached: true,
        version: CACHE_NAME
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
  }
});

// Utility functions
async function getStoredData(key) {
  try {
    const cache = await caches.open('lumina-ai-data');
    const response = await cache.match(`/data/${key}`);
    return response ? await response.json() : null;
  } catch (error) {
    console.error('Failed to get stored data:', error);
    return null;
  }
}

async function storeData(key, value) {
  try {
    const cache = await caches.open('lumina-ai-data');
    const response = new Response(JSON.stringify(value));
    await cache.put(`/data/${key}`, response);
  } catch (error) {
    console.error('Failed to store data:', error);
  }
}

async function clearStoredData(key) {
  try {
    const cache = await caches.open('lumina-ai-data');
    await cache.delete(`/data/${key}`);
  } catch (error) {
    console.error('Failed to clear stored data:', error);
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'eye-health-check') {
    event.waitUntil(performHealthCheck());
  }
});

async function performHealthCheck() {
  console.log('🏥 Service Worker: Performing health check...');
  
  try {
    // Check app health and sync data
    const response = await fetch('/api/health-check');
    const data = await response.json();
    
    if (data.updateAvailable) {
      // Notify about updates
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          message: 'New version available!'
        });
      });
    }
    
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

console.log('🎯 Lumina AI Service Worker loaded successfully!');
console.log(`📦 Cache version: ${CACHE_NAME}`);
console.log('🚀 Ready for offline eye health monitoring!');
