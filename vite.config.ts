import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Single source of truth for the app version: package.json. Exposed to the
// client as the compile-time constant __APP_VERSION__ (see src/vite-env.d.ts).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    // Forward API calls to the Fastify server during development so the browser
    // sees a single same-origin app (no CORS). Run `npm run server:dev` alongside.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,   // proxy WebSocket upgrades (room real-time channel) too
      },
    },
  },
})
