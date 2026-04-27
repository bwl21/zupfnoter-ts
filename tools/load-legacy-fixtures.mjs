#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, globSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const defaultLegacyCliPath = resolve(
  repoRoot,
  '../200_zupfnoter/30_sources/SRC_Zupfnoter/src/zupfnoter-cli.js',
)

const usage = [
  'Usage:',
  '  npm run test:loadsample -- "<glob>"',
  '',
  `Default legacy CLI: ${defaultLegacyCliPath}`,
  '',
  'Optional environment variables:',
  '  ZUPFNOTER_LEGACY_CLI      Absolute or repo-relative path to zupfnoter-cli(.min).js',
  '  ZUPFNOTER_FIXTURE_OUTDIR  Output directory for exported fixtures',
  '',
  'Optional positional arguments:',
  '  npm run test:loadsample -- "<glob>" "<legacy-cli-path>"',
].join('\n')

function expandHome(pathValue) {
  if (!pathValue) return pathValue
  if (pathValue === '~') return homedir()
  if (pathValue.startsWith('~/')) return resolve(homedir(), pathValue.slice(2))
  return pathValue
}

function resolveFromRepo(pathValue) {
  const expanded = expandHome(pathValue)
  if (!expanded) return expanded
  return isAbsolute(expanded) ? expanded : resolve(repoRoot, expanded)
}

function resolveLegacyCliPath(cliArg) {
  const candidates = [
    cliArg,
    process.env.ZUPFNOTER_LEGACY_CLI,
    defaultLegacyCliPath,
  ]

  for (const candidate of candidates) {
    const resolved = resolveFromRepo(candidate)
    if (resolved && existsSync(resolved)) return resolved
  }

  return null
}

function printUsageAndExit(message, exitCode = 1) {
  if (message) console.error(message)
  console.error(usage)
  process.exit(exitCode)
}

const [globPattern, cliArg] = process.argv.slice(2)

if (!globPattern || globPattern === '--help' || globPattern === '-h') {
  printUsageAndExit(globPattern ? '' : 'Missing ABC glob pattern.', globPattern ? 0 : 1)
}

const legacyCliPath = resolveLegacyCliPath(cliArg)
if (!legacyCliPath) {
  printUsageAndExit(
    'Legacy CLI not found. Check the default path, set ZUPFNOTER_LEGACY_CLI, or pass the CLI path as the second argument.',
  )
}

const fixtureOutDir = resolveFromRepo(
  process.env.ZUPFNOTER_FIXTURE_OUTDIR ?? 'fixtures/cases',
)

const expandedGlobPattern = expandHome(globPattern)
const matches = globSync(expandedGlobPattern, { nodir: true })
  .map((match) => resolve(match))
  .sort((a, b) => a.localeCompare(b))

if (matches.length === 0) {
  console.error(`No ABC files matched glob: ${globPattern}`)
  process.exit(1)
}

console.log(`Legacy CLI: ${legacyCliPath}`)
console.log(`ABC files: ${matches.length}`)
console.log(`ABC glob: ${expandedGlobPattern}`)
console.log(`Output dir: ${fixtureOutDir}`)

try {
  for (const inputFile of matches) {
    const args = [

      legacyCliPath,
      '--export-fixtures',
      inputFile,
      fixtureOutDir,
    ]

    console.log(`Exporting: ${inputFile}`)
    execFileSync(process.execPath, args, { stdio: 'inherit' })
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error('\nLegacy fixture export failed.')
  console.error(
    'Expected legacy CLI call shape: node zupfnoter-cli.min.js --export-fixtures <input.abc> <target-dir>',
  )
  console.error(`Reason: ${message}`)
  process.exit(1)
}
