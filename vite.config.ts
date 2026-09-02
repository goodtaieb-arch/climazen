import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_VERSION } from './src/lib/buildStamp'

/** Garde public/version.json aligné sur APP_VERSION (évite « MAJ v166 » en v167). */
function syncVersionJson(): Plugin {
  const write = () => {
    const path = resolve(__dirname, 'public/version.json')
    writeFileSync(path, `${JSON.stringify({ version: APP_VERSION }, null, 2)}\n`)
  }
  return {
    name: 'sync-version-json',
    buildStart() {
      write()
    },
    configureServer() {
      write()
    },
  }
}

export default defineConfig({
  plugins: [
    syncVersionJson(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'logo.png',
        'logo-original.png',
        'favicon.svg',
        'icons.svg',
        'icons/3d/climazen-bottle.png',
        'icons/3d/climazen-clients.png',
        'icons/3d/climazen-sites.png',
        'icons/3d/climazen-cerfa.png',
      ],
      manifest: {
        name: 'ClimaZEN by TAIEB',
        short_name: 'ClimaZEN',
        description: 'CERFA fluides & suivi chantier — utilisable hors ligne sur le terrain.',
        theme_color: '#1aa896',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'fr',
        start_url: '/app',
        scope: '/',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Bundle app ~2.1 Mo — au-dessus du défaut 2 MiB sinon le build Vercel échoue
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /version\.json$/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
        globIgnores: ['**/version.json'],
        runtimeCaching: [
          {
            urlPattern: /\/version\.json$/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-css',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
