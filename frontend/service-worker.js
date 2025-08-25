// Lumina AI - Eye Exercise Trainer Service Worker
// Version: 2.5.0
// Updated: August 24, 2025
// Optimized for Eye Trainer with Medical Guidelines

const APP_VERSION = '2.5.0';
const CACHE_NAME = `lumina-ai-trainer-v${APP_VERSION}`;
const STATIC_CACHE = `lumina-static-v${APP_VERSION}`;
const DYNAMIC_CACHE = `lumina-dynamic-v${APP_VERSION}`;
const RUNTIME_CACHE = `lumina-runtime-v${APP_VERSION}`;
const ASSETS_CACHE = `lumina-assets-v${APP_VERSION}`;

// Core files to cache immediately for exercises
const CORE_FILES = [
  '/',
  '/index.html',
  '/exercises.html',
  '/dashboard.html',
  '/monitor.html',
  '/analytics.html',
  '/profile.html',
  '/settings.html',
  '/manifest.json'
];

// Exercise-specific assets
const EXERCISE_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon-192.png',
  '/icons/maskable-icon-512.png',
  '/screenshots/exercises-mobile.png',
  '/screenshots/trainer-mobile.png'
];

// External resources (fonts for UI)
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
];

// URLs that should always be fresh (API endpoints)
const NETWORK_FIRST_URLS = [
  '/api/',
  '/health-check',
  '/sync'
];

// Install Event - Precache core resources
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing Lumina AI Exercise Trainer...');
  
  event.waitUntil(
    Promise.all([
      // Cache core exercise files
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 Service Worker: Caching core exercise files');
        return cache.addAll(CORE_FILES);
      }),
      
      // Cache exercise assets
      caches.open(ASSETS_CACHE).then((cache) => {
        console.log('🎨 Service Worker: Caching exercise assets');
        return cache.addAll(EXERCISE_ASSETS);
      }),
      
      // Cache external resources with CORS
      caches.open(DYNAMIC_CACHE).then((cache) => {
        console.log('🌐 Service Worker: Caching external resources');
        return Promise.all(
          EXTERNAL_RESOURCES.map(url => 
            cache.add(new Request(url, { 
              mode: 'cors', 
              credentials: 'omit' 
            }))
          )
        );
      })
    ]).then(() => {
      console.log('✅ Service Worker: Installation complete - Eye Trainer ready offline!');
      return self.skipWaiting(); // Activate immediately
    }).catch(error => {
      console.error('❌ Service Worker: Installation failed:', error);
    })
  );
});

// Activate Event - Clean old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating Eye Exercise Trainer...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        const validCacheNames = [CACHE_NAME, STATIC_CACHE, DYNAMIC_CACHE, RUNTIME_CACHE, ASSETS_CACHE];
        
        return Promise.all(
          cacheNames
            .filter(cacheName => 
              cacheName.startsWith('lumina-') && 
              !validCacheNames.includes(cacheName)
            )
            .map(cacheName => {
              console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      
      // Claim all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker: Activation complete - Eye Trainer active!');
      
      // Notify all clients about activation
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION,
            message: 'Lumina AI Eye Trainer is ready offline!'
          });
        });
      });
    })
  );
});

// Fetch Event - Smart caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Route requests based on origin and type
  if (url.origin === location.origin) {
    event.respondWith(handleSameOriginRequest(request));
  } else if (isFontRequest(url)) {
    event.respondWith(handleFontRequest(request));
  } else {
    event.respondWith(handleExternalRequest(request));
  }
});

// Handle same-origin requests with different strategies
async function handleSameOriginRequest(request) {
  const url = new URL(request.url);
  
  // Network-first for API endpoints
  if (NETWORK_FIRST_URLS.some(path => url.pathname.startsWith(path))) {
    return handleNetworkFirst(request);
  }
  
  // Cache-first for static exercise files
  if (isStaticAsset(url.pathname)) {
    return handleCacheFirst(request);
  }
  
  // Stale-while-revalidate for HTML pages
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    return handleStaleWhileRevalidate(request);
  }
  
  // Default to cache-first for other resources
  return handleCacheFirst(request);
}

// Cache-first strategy for static assets
async function handleCacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📱 Service Worker: Serving from cache:', request.url);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('🌐 Service Worker: Cached from network:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('❌ Service Worker: Cache-first failed:', request.url);
    
    // Return offline page for HTML requests
    if (request.destination === 'document') {
      return createOfflineExercisePage();
    }
    
    throw error;
  }
}

// Network-first strategy for dynamic content
async function handleNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📱 Service Worker: Network failed, serving from cache:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

// Stale-while-revalidate for frequently changing content
async function handleStaleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.status === 200) {
      const cache = caches.open(RUNTIME_CACHE);
      cache.then(c => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
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
    
    if (networkResponse.status === 200 && shouldCacheExternal(request.url)) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('', { status: 404 });
  }
}

// Utility functions
function isStaticAsset(pathname) {
  return pathname.includes('/icons/') || 
         pathname.includes('/screenshots/') || 
         pathname.endsWith('.css') || 
         pathname.endsWith('.js') || 
         pathname.endsWith('.png') || 
         pathname.endsWith('.svg') || 
         pathname.endsWith('.jpg') || 
         pathname.endsWith('.jpeg') || 
         pathname.endsWith('.webp');
}

function isFontRequest(url) {
  return url.hostname === 'fonts.googleapis.com' || 
         url.hostname === 'fonts.gstatic.com';
}

function shouldCacheExternal(url) {
  return url.includes('fonts.googleapis.com') || 
         url.includes('fonts.gstatic.com') ||
         url.includes('api.') && url.includes('static');
}

// Create offline page for exercise trainer
function createOfflineExercisePage() {
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lumina AI - Offline Eye Trainer</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          text-align: center;
          padding: 2rem;
        }
        .offline-container {
          max-width: 500px;
          background: rgba(255,255,255,0.1);
          padding: 3rem;
          border-radius: 20px;
          backdrop-filter: blur(20px);
        }
        .eye-icon {
          width: 120px;
          height: 120px;
          margin: 0 auto 2rem;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        h1 { margin: 0 0 1rem; font-size: 2.5rem; font-weight: 900; }
        p { opacity: 0.9; line-height: 1.6; margin: 0 0 2rem; font-size: 1.1rem; }
        button {
          background: rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.3);
          color: white;
          padding: 1rem 2rem;
          border-radius: 12px;
          cursor: pointer;
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0.5rem;
          transition: all 0.3s ease;
        }
        button:hover { 
          background: rgba(255,255,255,0.3); 
          transform: translateY(-2px);
        }
        .features {
          margin-top: 2rem;
          text-align: left;
        }
        .feature {
          margin: 1rem 0;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .feature-icon { 
          width: 40px; 
          height: 40px; 
          background: rgba(255,255,255,0.2); 
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="eye-icon">👁️</div>
        <h1>Lumina AI Eye Trainer</h1>
        <p>You're currently offline, but you can still practice basic eye exercises! Connect to the internet to access the full holographic trainer experience with voice guidance.</p>
        
        <div class="features">
          <div class="feature">
            <div class="feature-icon">📋</div>
            <div>Medical guidelines cached and available</div>
          </div>
          <div class="feature">
            <div class="feature-icon">⏰</div>
            <div>20-20-20 rule timer works offline</div>
          </div>
          <div class="feature">
            <div class="feature-icon">👁️</div>
            <div>Basic exercises available without internet</div>
          </div>
        </div>
        
        <button onclick="window.location.reload()">Try Again</button>
        <button onclick="window.location.href='/exercises.html'">Basic Exercises</button>
      </div>
    </body>
    </html>
  `;
  
  return new Response(offlineHTML, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}

// Background Sync for exercise data
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'sync-exercise-data':
      event.waitUntil(syncExerciseData());
      break;
    case 'sync-eye-health':
      event.waitUntil(syncEyeHealthData());
      break;
    case 'sync-user-settings':
      event.waitUntil(syncUserSettings());
      break;
  }
});

// Sync exercise progress and data
async function syncExerciseData() {
  try {
    console.log('🏋️‍♂️ Service Worker: Syncing exercise data...');
    
    const exerciseData = await getStoredData('pending-exercise-data');
    
    if (exerciseData && exerciseData.length > 0) {
      for (const data of exerciseData) {
        await fetch('/api/exercises/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      
      await clearStoredData('pending-exercise-data');
      console.log('✅ Service Worker: Exercise data synced successfully');
      
      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'EXERCISE_DATA_SYNCED',
          message: 'Exercise progress synchronized'
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Service Worker: Failed to sync exercise data:', error);
  }
}

// Sync eye health metrics
async function syncEyeHealthData() {
  try {
    console.log('👁️ Service Worker: Syncing eye health data...');
    
    const healthData = await getStoredData('pending-health-data');
    
    if (healthData && healthData.length > 0) {
      for (const data of healthData) {
        await fetch('/api/eye-health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      
      await clearStoredData('pending-health-data');
      console.log('✅ Service Worker: Eye health data synced successfully');
    }
    
  } catch (error) {
    console.error('❌ Service Worker: Failed to sync eye health data:', error);
  }
}

// Sync user settings and preferences
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

// Push notifications for exercise reminders
self.addEventListener('push', (event) => {
  console.log('📢 Service Worker: Push notification received');
  
  const defaultOptions = {
    body: 'Time for your 20-20-20 eye exercise break!',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'eye-exercise-reminder',
    data: {
      url: '/exercises.html?notification=break-reminder',
      exerciseType: '20-20-20'
    },
    actions: [
      {
        action: 'start-exercise',
        title: '👁️ Start Exercise',
        icon: '/icons/action-exercise.png'
      },
      {
        action: 'remind-later',
        title: '⏰ Remind Later',
        icon: '/icons/action-later.png'
      },
      {
        action: 'view-guidelines',
        title: '📋 View Guidelines',
        icon: '/icons/action-guidelines.png'
      }
    ],
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
    requireInteraction: true
  };
  
  if (event.data) {
    const pushData = event.data.json();
    Object.assign(defaultOptions, pushData);
  }
  
  event.waitUntil(
    self.registration.showNotification('Lumina AI - Eye Exercise Reminder', defaultOptions)
  );
});

// Handle notification clicks and actions
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Service Worker: Notification clicked:', event.action);
  
  event.notification.close();
  
  const { action } = event;
  const { url = '/exercises.html', exerciseType = '20-20-20' } = event.notification.data || {};
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Check if app is already open
      const existingClient = clients.find(c => c.url.includes('lumina'));
      
      if (existingClient) {
        // Focus existing window and send action
        existingClient.focus();
        existingClient.postMessage({
          type: 'NOTIFICATION_ACTION',
          action: action,
          exerciseType: exerciseType,
          data: event.notification.data
        });
      } else {
        // Open new window with specific action
        let targetUrl = url;
        
        switch (action) {
          case 'start-exercise':
            targetUrl = `/exercises.html?quick=${exerciseType}&source=notification`;
            break;
          case 'view-guidelines':
            targetUrl = '/exercises.html?section=guidelines&source=notification';
            break;
          case 'remind-later':
            // Schedule another reminder (handled by client)
            targetUrl = '/exercises.html?action=remind-later';
            break;
          default:
            targetUrl = url + '?source=notification';
        }
        
        self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('💬 Service Worker: Message received:', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'STORE_EXERCISE_DATA':
      storeData(data.key, data.value);
      break;
      
    case 'GET_CACHE_STATUS':
      event.ports[0].postMessage({
        cached: true,
        version: APP_VERSION,
        caches: {
          static: STATIC_CACHE,
          dynamic: DYNAMIC_CACHE,
          runtime: RUNTIME_CACHE,
          assets: ASSETS_CACHE
        }
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then((success) => {
        event.ports[0].postMessage({ success });
      });
      break;
      
    case 'SCHEDULE_EXERCISE_REMINDER':
      scheduleExerciseReminder(data);
      break;
  }
});

// Schedule exercise reminders
async function scheduleExerciseReminder(data) {
  const { exerciseType = '20-20-20', intervalMinutes = 20 } = data;
  
  try {
    // Register for background sync
    await self.registration.sync.register('exercise-reminder');
    
    // Store reminder data
    await storeData('exercise-reminder-config', {
      exerciseType,
      intervalMinutes,
      lastReminder: Date.now()
    });
    
    console.log(`⏰ Service Worker: Exercise reminder scheduled for ${exerciseType} every ${intervalMinutes} minutes`);
    
  } catch (error) {
    console.error('❌ Service Worker: Failed to schedule exercise reminder:', error);
  }
}

// Utility functions for data storage
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
    const response = new Response(JSON.stringify(value), {
      headers: { 'Content-Type': 'application/json' }
    });
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
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('lumina-'))
        .map(name => caches.delete(name))
    );
    return true;
  } catch (error) {
    console.error('Failed to clear all caches:', error);
    return false;
  }
}

// Periodic background sync for exercise reminders
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'exercise-health-check') {
    event.waitUntil(performExerciseHealthCheck());
  }
});

async function performExerciseHealthCheck() {
  console.log('🏥 Service Worker: Performing exercise health check...');
  
  try {
    // Check if it's time for an exercise reminder
    const reminderConfig = await getStoredData('exercise-reminder-config');
    
    if (reminderConfig) {
      const { lastReminder, intervalMinutes } = reminderConfig;
      const timeSinceLastReminder = Date.now() - lastReminder;
      const intervalMs = intervalMinutes * 60 * 1000;
      
      if (timeSinceLastReminder >= intervalMs) {
        // Trigger exercise reminder notification
        await self.registration.showNotification('Lumina AI - Exercise Break Time!', {
          body: 'It\'s time for your regular eye exercise break. Take care of your vision!',
          icon: '/icons/icon-192.png',
          tag: 'periodic-exercise-reminder',
          data: {
            url: '/exercises.html?type=periodic-reminder',
            exerciseType: reminderConfig.exerciseType
          },
          actions: [
            { action: 'start-exercise', title: '👁️ Start Now' },
            { action: 'remind-later', title: '⏰ 5 Min Later' }
          ]
        });
        
        // Update last reminder time
        await storeData('exercise-reminder-config', {
          ...reminderConfig,
          lastReminder: Date.now()
        });
      }
    }
    
  } catch (error) {
    console.error('Exercise health check failed:', error);
  }
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker: Error occurred:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker: Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

console.log('👁️ Lumina AI Eye Exercise Trainer Service Worker loaded successfully!');
console.log(`📦 Cache version: ${APP_VERSION}`);
console.log('🏋️‍♂️ Ready for offline eye exercises with holographic trainer!');
console.log('📋 Medical guidelines cached and ready!');
console.log('🔊 Voice guidance support enabled!');
