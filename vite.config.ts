import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_BUILD, APP_VERSION } from './src/lib/buildStamp'

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
    transformIndexHtml(html) {
      return html
        .replace(
          /<meta name="climazen-build" content="[^"]*"\s*\/?>/,
          `<meta name="climazen-build" content="${APP_BUILD}" />`,
        )
        .replace(
          /<meta name="climazen-version" content="[^"]*"\s*\/?>/,
          `<meta name="climazen-version" content="${APP_VERSION}" />`,
        )
    },
  }
}

export default defineConfig({
  plugins: [
    syncVersionJson(),
    react(),
    tailwindcss(),
    VitePWA({
      // Kill-switch : /sw.js se désinscrit et vide les caches (anciens navigateurs bloqués
      // sur une page hors ligne / agenda en cache). Ne plus enregistrer de SW dans main.tsx.
      injectRegister: false,
      selfDestroying: true,
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
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
