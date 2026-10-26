import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// The optional relay (config.json → relayUrl) is baked in at build time, so an edit
// to config.json on GitHub takes effect with the automatic redeploy.
// The site lives at https://<user>.github.io/<repo>/ — derive the path from the
// repository name in CI so renaming the repo just works.
const repoName = (process.env.GITHUB_REPOSITORY ?? '').split('/')[1] || 'fpl-edge';
const BASE = `/${repoName}/`;

let relayUrl = '';
try { relayUrl = String(JSON.parse(readFileSync('config.json', 'utf8')).relayUrl || ''); } catch { /* none */ }

export default defineConfig({
  base: BASE,
  define: { __FPL_RELAY__: JSON.stringify(relayUrl) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'ARKILO',
        short_name: 'ARKILO',
        description: 'مساعد فانتازي الدوري الإنجليزي — توقعات ومحاكاة واستراتيجية دوري مصغر',
        lang: 'ar',
        dir: 'rtl',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#04110c',
        theme_color: '#04110c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['data/**'],
        navigateFallback: `${BASE}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fpl-data',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
});
