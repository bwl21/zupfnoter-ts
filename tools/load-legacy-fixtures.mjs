#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, globSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const defaultLegacyCliPath = resolve(
  repoRoot,
  '../200_zupfnoter/30_sources/SRC_Zupfnoter/src/zupfnoter-cli.js',
)
const defaultGlobPatterns = [
  'fixtures/cases/public/*/input.abc',
  'fixtures/cases/protected/*/input.abc',
]

const usage = [
  'Usage:',
  '  npm run test:loadsample',
  '  npm run test:recreateLegacy',
  `  npm run test:loadsample -- "<glob>"  (default: ${defaultGlobPatterns.join(', ')})`,
  '',
  `Default legacy CLI: ${defaultLegacyCliPath}`,
  '',
  'Optional environment variables:',
  '  ZUPFNOTER_LEGACY_CLI      Absolute or repo-relative path to zupfnoter-cli(.min).js',
  '  ZUPFNOTER_FIXTURE_OUTDIR  Output directory for exported fixtures',
  '',
  'Optional positional arguments:',
  '  npm run test:loadsample -- "<glob>" "<legacy-cli-path>"',
  '  npm run test:recreateLegacy -- "<legacy-cli-path>"',
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

const [globPatternArg, cliArg] = process.argv.slice(2)
const globPatterns = globPatternArg === undefined ? defaultGlobPatterns : [globPatternArg]

if (globPatternArg === '--help' || globPatternArg === '-h') {
  printUsageAndExit('', 0)
}

const legacyCliPath = resolveLegacyCliPath(cliArg)
if (!legacyCliPath) {
  printUsageAndExit(
    'Legacy CLI not found. Check the default path, set ZUPFNOTER_LEGACY_CLI, or pass the CLI path as the second argument.',
  )
}

const fixtureOutDirOverride = process.env.ZUPFNOTER_FIXTURE_OUTDIR
const fixtureOutDir = fixtureOutDirOverride === undefined ? null : resolveFromRepo(fixtureOutDirOverride)

// ---------------------------------------------------------------------------
// Legacy-raw song enrichment
//
// The legacy Ruby parser fills @slur_starts / @slur_ends from
// `voice_element[:slur_sls]` (an old abc2svg bitmask field). The bundled
// abc2svg version no longer exposes that field — it only emits the modern
// `sls` array (one entry per slur start) and a `slur_end` count. As a result
// the raw `to_json` dump always shows empty slur arrays.
//
// This post-processing step reconstructs `@slur_starts` and `@slur_ends`
// from `raw_voice_element.sls` / `raw_voice_element.slur_end`, replicating
// `_parse_slur` + `_push_slur` / `_pop_slur` from
// abc2svg_to_harpnotes.rb#L481-L483 / #L975-L984. A single slur stack is
// kept per voice (matching the parser's per-transform `@slurstack` state).
// The legacy application code is intentionally not modified — only the
// exporter (this tool) enriches the JSON used as a fixture.
// ---------------------------------------------------------------------------

function enrichLegacyRawSong(rawSongJson) {
  const song = JSON.parse(rawSongJson)
  const voices = song?.voices
  if (!Array.isArray(voices)) return rawSongJson

  for (const voice of voices) {
    if (!Array.isArray(voice)) continue
    const state = { slurstack: 0 }
    for (const entity of voice) {
      enrichEntitySlurs(entity, state)
    }
  }

  return `${JSON.stringify(song, null, 2)}\n`
}

function enrichEntitySlurs(entity, state) {
  if (!entity || typeof entity !== 'object') return

  const rawElement = entity?.['@origin']?.raw_voice_element
  if (rawElement && typeof rawElement === 'object') {
    const sls = Array.isArray(rawElement.sls) ? rawElement.sls : []
    const slurStarts = []
    for (let i = 0; i < sls.length; i += 1) {
      state.slurstack += 1
      slurStarts.push(state.slurstack)
    }

    const slurEndCount = typeof rawElement.slur_end === 'number' ? rawElement.slur_end : 0
    const slurEnds = []
    for (let i = 0; i < slurEndCount; i += 1) {
      slurEnds.push(state.slurstack)
      state.slurstack -= 1
      if (state.slurstack < 0) state.slurstack = 0
    }

    if ('@slur_starts' in entity) entity['@slur_starts'] = slurStarts
    if ('@slur_ends' in entity) entity['@slur_ends'] = slurEnds
  }

  // SynchPoint contains nested notes — recurse so they share the slur stack.
  const nestedNotes = entity['@notes']
  if (Array.isArray(nestedNotes)) {
    for (const note of nestedNotes) enrichEntitySlurs(note, state)
  }
}

function extractPdfVariants(inputFile) {
  const documentText = readFileSync(inputFile, 'utf-8')
  const configPart = documentText
    .split('%%%%zupfnoter')
    .find((part) => part.startsWith('.config'))
  if (configPart === undefined) return []

  const config = JSON.parse(configPart.slice('.config'.length).trim())
  if (!config || typeof config !== 'object' || Array.isArray(config)) return []
  const produce = config.produce
  const extracts = config.extract
  if (!Array.isArray(produce) || !extracts || typeof extracts !== 'object' || Array.isArray(extracts)) return []

  return produce.map((extractNr) => {
    if (typeof extractNr !== 'number') throw new Error('Legacy PDF export: produce must contain extract numbers.')
    const extract = extracts[String(extractNr)]
    if (!extract || typeof extract !== 'object' || Array.isArray(extract)) {
      throw new Error(`Legacy PDF export: missing extract.${String(extractNr)} configuration.`)
    }
    const filenamepart = extract.filenamepart
    if (typeof filenamepart !== 'string') {
      throw new Error(`Legacy PDF export: extract.${String(extractNr)} is missing filenamepart.`)
    }
    return { extractNr, filenamepart }
  })
}

function clearLegacyPdfFixtures(fixtureDir) {
  for (const filename of readdirSync(fixtureDir)) {
    if (/^output\.extract-\d+_a3\.pdf$/.test(filename)) {
      rmSync(resolve(fixtureDir, filename))
    }
  }
}

function exportLegacyPdfs(inputFile, fixtureDir) {
  const variants = extractPdfVariants(inputFile)
  clearLegacyPdfFixtures(fixtureDir)
  if (variants.length === 0) return

  const temporaryOutputDir = mkdtempSync(resolve(tmpdir(), 'zupfnoter-legacy-pdf-'))
  try {
    console.log(`Exporting ${String(variants.length)} A3 PDF(s)`)
    execFileSync(process.execPath, [legacyCliPath, inputFile, temporaryOutputDir], { stdio: 'inherit' })
    const pdfFilenames = readdirSync(temporaryOutputDir).filter((filename) => filename.endsWith('_a3.pdf'))
    for (const variant of variants) {
      const sourceFilename = pdfFilenames.find((filename) => filename.endsWith(`_${variant.filenamepart}_a3.pdf`))
      if (sourceFilename === undefined) {
        throw new Error(`Legacy CLI did not write an A3 PDF for extract ${String(variant.extractNr)}.`)
      }
      copyFileSync(
        resolve(temporaryOutputDir, sourceFilename),
        resolve(fixtureDir, `output.extract-${String(variant.extractNr)}_a3.pdf`),
      )
    }
  } finally {
    rmSync(temporaryOutputDir, { recursive: true, force: true })
  }
}

const expandedGlobPatterns = globPatterns.map((pattern) => expandHome(pattern))
const matches = [...new Set(
  expandedGlobPatterns.flatMap((pattern) => globSync(pattern, { nodir: true }).map((match) => resolve(match))),
)].sort((a, b) => a.localeCompare(b))

if (matches.length === 0) {
  console.error(`No ABC files matched glob: ${expandedGlobPatterns.join(', ')}`)
  process.exit(1)
}

console.log(`Legacy CLI: ${legacyCliPath}`)
console.log(`ABC files: ${matches.length}`)
console.log(`ABC glob: ${expandedGlobPatterns.join(', ')}`)
console.log(`Output dir: ${fixtureOutDir ?? 'source fixture root (public/protected)'}`)

try {
  for (const inputFile of matches) {
    const caseName = basename(dirname(inputFile))
    const outputRoot = fixtureOutDir ?? dirname(dirname(inputFile))
    const args = [

      legacyCliPath,
      '--export-fixtures',
      inputFile,
      outputRoot,
    ]

    console.log(`Exporting: ${inputFile}`)
    execFileSync(process.execPath, args, { stdio: 'inherit' })

    // FixtureExporter writes <case>/song.legacy-raw.json directly. We still
    // post-process it to reconstruct @slur_starts / @slur_ends from the
    // raw_voice_element data (see enrichLegacyRawSong above for details).
    const rawSongPath = resolve(outputRoot, caseName, 'song.legacy-raw.json')
    const rawSong = readFileSync(rawSongPath, 'utf-8')
    const enriched = enrichLegacyRawSong(rawSong)
    writeFileSync(rawSongPath, enriched, 'utf-8')

    exportLegacyPdfs(inputFile, resolve(outputRoot, caseName))
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
