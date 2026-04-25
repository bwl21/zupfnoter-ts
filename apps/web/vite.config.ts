import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    // Resolve workspace packages via their TypeScript source in dev mode
    conditions: ['source', 'import', 'module', 'browser', 'default'],
  },
  optimizeDeps: {
    // Don't pre-bundle workspace packages — resolve them from source
    exclude: ['@zupfnoter/core', '@zupfnoter/types'],
  },
  server: {
    allowedHosts: true,
  },
})
