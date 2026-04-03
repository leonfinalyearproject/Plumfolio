// src/utils/registerSW.js
// Unregister service worker and clear caches — fixes stale cache issues
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // Unregister any existing service workers
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for (var i = 0; i < registrations.length; i++) {
        registrations[i].unregister().then(function() {
          console.log('SW unregistered');
        });
      }
    });

    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (var i = 0; i < names.length; i++) {
          caches.delete(names[i]);
        }
        if (names.length > 0) {
          console.log('Caches cleared:', names);
        }
      });
    }
  }
}
