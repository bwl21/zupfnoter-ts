import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

function readBuildMetadata(): { appVersion: string; commitHash: string; buildTime: string } {
  const now = new Date().toISOString()
  let appVersion = 'unknown'
  try {
    const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as { version?: string }
    if (typeof packageJson.version === 'string' && packageJson.version !== '') {
      appVersion = packageJson.version
    }
  } catch {
    // keep fallback version
  }
  try {
    const commitHash = execSync('git rev-parse --short=12 HEAD', {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return { appVersion, commitHash, buildTime: now }
  } catch {
    return { appVersion, commitHash: 'unknown', buildTime: now }
  }
}

const buildInfo = readBuildMetadata()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __ZUPFNOTER_BUILD_INFO__: JSON.stringify(buildInfo),
  },
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
