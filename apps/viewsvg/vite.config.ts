import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

type ViewSvgSource = 'legacy' | 'ts'

interface ViewSvgCaseSummary {
  id: string
  legacyExtracts: number[]
  tsExtracts: number[]
  legacySvgCount: number
  tsSvgCount: number
}

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const fixturesCasesRoot = resolve(repoRoot, 'fixtures/cases')

function listExtractNumbers(dir: string, prefix: string): number[] {
  if (!existsSync(dir)) return []
  const values = readdirSync(dir)
    .map((name) => {
      if (name === `${prefix}.svg`) return 0
      const match = name.match(new RegExp(`^${prefix}\\.extract-(\\d+)\\.svg$`))
      return match?.[1] !== undefined ? Number.parseInt(match[1], 10) : Number.NaN
    })
    .filter((value) => Number.isInteger(value))
  return [...new Set(values)]
    .sort((left, right) => left - right)
}

function scanCases(): ViewSvgCaseSummary[] {
  if (!existsSync(fixturesCasesRoot)) return []
  return readdirSync(fixturesCasesRoot)
    .map((id) => {
      const dir = resolve(fixturesCasesRoot, id)
      return { id, dir }
    })
    .filter(({ dir }) => statSync(dir).isDirectory())
    .filter(({ dir }) => existsSync(resolve(dir, 'input.abc')))
    .map(({ id, dir }) => {
      const legacyExtracts = listExtractNumbers(dir, 'output')
      const tsDir = resolve(dir, '_ts_output')
      const tsExtracts = listExtractNumbers(tsDir, 'output')
      return {
        id,
        legacyExtracts,
        tsExtracts,
        legacySvgCount: legacyExtracts.length,
        tsSvgCount: tsExtracts.length,
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

function readSvg(caseId: string, source: ViewSvgSource, extractNr: number): string {
  const baseDir = resolve(fixturesCasesRoot, caseId)
  const targetDir = source === 'legacy' ? baseDir : resolve(baseDir, '_ts_output')
  const preferredNames = extractNr === 0
    ? ['output.svg', 'output.extract-0.svg']
    : [`output.extract-${extractNr}.svg`]

  for (const filename of preferredNames) {
    const path = resolve(targetDir, filename)
    if (existsSync(path)) return readFileSync(path, 'utf-8')
  }

  throw new Error(`Missing ${source} SVG for ${caseId} [extract ${extractNr}]`)
}

function viewSvgPlugin() {
  return {
    name: 'viewsvg-dev-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/viewsvg/cases', (_req, res, next) => {
        if (_req.method !== 'GET') {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(scanCases()))
      })

      server.middlewares.use('/api/viewsvg/svg', (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }

        const requestUrl = new URL(req.url ?? '', 'http://localhost')
        const caseId = requestUrl.searchParams.get('case')
        const source = requestUrl.searchParams.get('source') as ViewSvgSource | null
        const extractParam = requestUrl.searchParams.get('extract')
        const extractNr = extractParam === null ? NaN : Number.parseInt(extractParam, 10)

        if (caseId === null || source === null || (source !== 'legacy' && source !== 'ts') || !Number.isInteger(extractNr)) {
          res.statusCode = 400
          res.end('Invalid viewsvg request.')
          return
        }

        try {
          const svg = readSvg(caseId, source, extractNr)
          res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(svg)
        } catch (error) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(error instanceof Error ? error.message : String(error))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    viewSvgPlugin(),
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
