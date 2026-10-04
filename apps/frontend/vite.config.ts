import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = path.dirname(fileURLToPath(import.meta.url))

// Optional local photos for dev: put files in
//   apps/frontend/public/gallery-local/<year>/<event>/<file>
// e.g. public/gallery-local/26-27/ztfc/ztfc-001.webp
const LOCAL_DIR = path.join(configDir, 'public', 'gallery-local')
const CDN_PREFIX = '/api/gallery-cdn/'

// The live site, where the worker route (180dcvitc.org/api/*) is served.
const API_TARGET = 'https://180dcvitc.org'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: true,
        // If the photo exists locally, serve it from there instead.
        bypass(req) {
          const url = req.url ?? ''
          if (!url.startsWith(CDN_PREFIX)) return undefined
          const rel = decodeURIComponent(url.slice(CDN_PREFIX.length).split('?')[0])
          if (rel.includes('..')) return undefined
          if (fs.existsSync(path.join(LOCAL_DIR, rel))) {
            return '/gallery-local/' + rel
          }
          return undefined
        },
        configure: (proxy) => {
          proxy.on('error', (err, req) => {
            console.log('[proxy error]', req.url, err.message)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            if (req.url?.includes('gallery-cdn')) {
              console.log('[gallery]', proxyRes.statusCode, req.url)
            }
          })
        },
      },
    },
  },
  build: {
    sourcemap: false,
  },
})