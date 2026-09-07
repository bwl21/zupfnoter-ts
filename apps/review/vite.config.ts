import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { readBuildMetadata } from '../../tools/build-metadata.mjs'

const buildInfo = readBuildMetadata(
  fileURLToPath(new URL('./package.json', import.meta.url)),
  fileURLToPath(new URL('../..', import.meta.url)),
)

export default defineConfig({
  define: {
    'globalThis.__ZUPFNOTER_BUILD_INFO__': JSON.stringify(buildInfo),
  },
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
