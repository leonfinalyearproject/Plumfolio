// src/utils/registerSW.js
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = '/Plumfolio/service-worker.js';
      navigator.serviceWorker
        .register(swUrl, { scope: '/Plumfolio/' })
        .then((reg) => console.log('SW registered:', reg.scope))
        .catch((err) => console.log('SW failed:', err));
    });
  }
}
