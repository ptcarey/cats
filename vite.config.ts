import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    cssTarget: 'safari15',
sourcemap: true,
  },
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      cleanupOutdatedCaches: true,
      navigateFallback: '/index.html',
    },
    manifest: {
      name: 'Cat Soccer',
      short_name: 'Cat Soccer',
      description: 'Build a team of three cats and play soccer.',
      theme_color: '#1f7a43',
      background_color: '#1f7a43',
      display: 'fullscreen',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      categories: ['games', 'kids'],
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  }), cloudflare()],
});