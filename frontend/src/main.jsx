import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
    const updateSW = registerSW({
        onNeedRefresh() {
            // Don't reload if user is actively typing
            const isInteracting = document.activeElement?.matches('input, textarea, select, [contenteditable]');
            if (!isInteracting) {
                updateSW(true);
            } else {
                // Re-check once they leave the field
                document.addEventListener('focusout', () => updateSW(true), { once: true });
            }
        },
        onOfflineReady() {},
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
