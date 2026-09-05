import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    conditions: ['source', 'import', 'module', 'browser', 'default'],
  },
  optimizeDeps: {
    exclude: [
      '@zupfnoter/core',
      '@zupfnoter/design-system',
      '@zupfnoter/playback',
      '@zupfnoter/playback-audio',
      '@zupfnoter/storage',
      '@zupfnoter/types',
    ],
  },
  server: {
    allowedHosts: true,
  },
})
