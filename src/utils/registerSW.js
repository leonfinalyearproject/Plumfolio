// src/utils/registerSW.js
// Register the service worker for PWA support

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(process.env.PUBLIC_URL + '/service-worker.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);

          // Check for updates every 30 minutes
          setInterval(() => {
            registration.update();
          }, 30 * 60 * 1000);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    });
  }
}
