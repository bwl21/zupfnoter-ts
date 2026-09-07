import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { readBuildMetadata } from '../../tools/build-metadata.mjs'

const buildInfo = readBuildMetadata(
  fileURLToPath(new URL('./package.json', import.meta.url)),
  fileURLToPath(new URL('../..', import.meta.url)),
)

// https://vite.dev/config/
export default defineConfig({
  define: {
    'globalThis.__ZUPFNOTER_BUILD_INFO__': JSON.stringify(buildInfo),
  },
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      buffer: fileURLToPath(new URL('./node_modules/buffer/index.js', import.meta.url)),
    },
    // Resolve workspace packages via their TypeScript source in dev mode
    conditions: ['source', 'import', 'module', 'browser', 'default'],
  },
  optimizeDeps: {
    // Don't pre-bundle workspace packages — resolve them from source
    exclude: ['@zupfnoter/core', '@zupfnoter/types'],
  },
  worker: {
    format: 'es',
  },
  server: {
    allowedHosts: true,
    fs: {
      allow: [
        resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..'),
      ],
    },
  },
})
