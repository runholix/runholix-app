import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',   // use your own sw.js
      srcDir: 'public',
      filename: 'sw.js',
      manifest: false,          // ← don't generate or inject a manifest
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,ico,woff,woff2}'],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ical': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
});
