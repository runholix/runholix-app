import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { APP_VERSION } from './lib/version.js';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(APP_VERSION)}`)
            .then(registration => {
                // Poll for updates every 60 seconds (PWA doesn't navigate, so browser won't auto-check)
                setInterval(() => registration.update(), 60_000);
            })
            .catch(() => {});

        // Listen for SW_UPDATED message from the new service worker
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data?.type === 'SW_UPDATED') {
                // Don't reload if user is actively typing
                const isInteracting = document.activeElement?.matches('input, textarea, select, [contenteditable]');
                if (!isInteracting) {
                    window.location.reload();
                } else {
                    // Re-check once they leave the field
                    document.addEventListener('focusout', () => window.location.reload(), { once: true });
                }
            }
        });
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
