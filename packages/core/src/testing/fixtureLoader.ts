/**
 * Loads JSON fixtures from the fixtures/ directory at the repository root.
 *
 * In Vitest (Node environment) we use fs.readFileSync.
 * The path is resolved relative to the project root via import.meta.url.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Song, Sheet, ZupfnoterConfig } from '@zupfnoter/types'
import { AbcParser } from '../AbcParser.js'
import { AbcToSong } from '../AbcToSong.js'
import { HarpnotesLayout } from '../HarpnotesLayout.js'
import { extractSongConfig, mergeSongConfig } from '../extractSongConfig.js'
import type { SongFixture, SheetFixture, DrawableFixture, EntityFixture } from './semanticMatch.js'
import { defaultTestConfig } from './defaultConfig.js'

// Resolve the repo root: packages/core/src/testing/ → ../../../../
const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../..')
const FIXTURE_CASES_ROOT = resolve(REPO_ROOT, 'fixtures/cases')

export type FixtureStage = 'song' | 'sheet' | 'output_svg'

export interface PipelineFixture {
  name: string
  id: string
  dir: string
  input: {
    abc: string
  }
  config: ZupfnoterConfig
  song: SongFixture | null
  sheet: SheetFixture | null
  sheetExtracts: Record<string, SheetFixture>
  output_svg: string | null
}

export interface FixtureCase {
  name: string
  id: string
  dir: string
  hasSongFixture: boolean
  hasSheetFixture: boolean
}

function loadJson<T>(path: string): T {
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as T
}

function safeLoadJson<T>(path: string): T | null {
  try {
    return loadJson<T>(path)
  } catch {
    return null
  }
}

function loadText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function safeLoadText(path: string): string | null {
  try {
    return loadText(path)
  } catch {
    return null
  }
}

function fixtureCaseDir(name: string): string {
  return resolve(FIXTURE_CASES_ROOT, name)
}

function resolveSongFixturePath(dir: string): string {
  return resolve(dir, 'song.extract-0.json')
}

function listSheetExtractFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => /^sheet\.extract-\d+\.json$/.test(name))
    .sort((a, b) => a.localeCompare(b))
}

function loadSheetExtractFixtures(dir: string): Record<string, SheetFixture> {
  const extractFiles = listSheetExtractFiles(dir)
  return Object.fromEntries(
    extractFiles.map((filename) => {
      const match = filename.match(/^sheet\.extract-(\d+)\.json$/)
      if (!match) throw new Error(`Invalid sheet extract fixture filename: ${filename}`)
      return [match[1], loadJson<SheetFixture>(resolve(dir, filename))]
    }),
  )
}

function toRepoRelativePath(path: string): string {
  return relative(REPO_ROOT, path)
}

export function scanFixtureCases(): FixtureCase[] {
  if (!existsSync(FIXTURE_CASES_ROOT)) return []

  return readdirSync(FIXTURE_CASES_ROOT)
    .map((name) => {
      const dir = fixtureCaseDir(name)
      return { name, dir }
    })
    .filter(({ dir }) => statSync(dir).isDirectory())
    .filter(({ dir }) => existsSync(resolve(dir, 'input.abc')))
    .map(({ name, dir }) => ({
      name,
      id: name,
      dir,
      hasSongFixture: existsSync(resolve(dir, 'song.extract-0.json')),
      hasSheetFixture: existsSync(resolve(dir, 'sheet.json')) || listSheetExtractFiles(dir).length > 0,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function fixtureAbcPath(name: string): string {
  return toRepoRelativePath(resolve(fixtureCaseDir(name), 'input.abc'))
}

export function readFixtureAbc(name: string): string {
  return loadText(resolve(fixtureCaseDir(name), 'input.abc'))
}

/**
 * Build the effective test config from defaults plus an optional
 * `%%%%zupfnoter.config` block embedded in the ABC fixture.
 */
export function fixtureConfigFromAbc(abcText: string): ZupfnoterConfig {
  return mergeSongConfig(defaultTestConfig, extractSongConfig(abcText))
}

export function loadFixture(testCase: FixtureCase): PipelineFixture
export function loadFixture(name: string): PipelineFixture
export function loadFixture(testCaseOrName: FixtureCase | string): PipelineFixture {
  const name = typeof testCaseOrName === 'string' ? testCaseOrName : testCaseOrName.name
  const dir = fixtureCaseDir(name)
  const abc = loadText(resolve(dir, 'input.abc'))
  const sheetExtracts = loadSheetExtractFixtures(dir)
  return {
    name,
    id: name,
    dir,
    input: { abc },
    config: fixtureConfigFromAbc(abc),
    song: safeLoadJson<SongFixture>(resolveSongFixturePath(dir)),
    sheet: safeLoadJson<SheetFixture>(resolve(dir, 'sheet.json')),
    sheetExtracts,
    output_svg: safeLoadText(resolve(dir, 'output.svg')),
  }
}

export function loadSongFixture(name: string): SongFixture {
  return loadJson<SongFixture>(resolveSongFixturePath(fixtureCaseDir(name)))
}

export function loadSheetFixture(name: string): SheetFixture {
  return loadJson<SheetFixture>(resolve(fixtureCaseDir(name), 'sheet.json'))
}

export function loadSheetExtractFixture(name: string, extractNr: number | string): SheetFixture {
  return loadJson<SheetFixture>(
    resolve(fixtureCaseDir(name), `sheet.extract-${String(extractNr)}.json`),
  )
}

export function transformFixtureToSong(fixture: PipelineFixture): SongFixture {
  const model = new AbcParser().parse(fixture.input.abc)
  const song = new AbcToSong().transform(model, fixture.config)
  return songToFixture(song)
}

export function resolveFixtureSheetRenderTarget(
  _config: ZupfnoterConfig,
  extractNr: number | string = 0,
): { extractNr: number; pageFormat: 'A4' } {
  const normalizedExtractNr = typeof extractNr === 'number' ? extractNr : Number.parseInt(String(extractNr), 10)
  return {
    extractNr: Number.isFinite(normalizedExtractNr) ? normalizedExtractNr : 0,
    pageFormat: 'A4',
  }
}

export function transformFixtureToSheet(
  fixture: PipelineFixture,
  extractNr: number | string = 0,
): SheetFixture {
  const model = new AbcParser().parse(fixture.input.abc)
  const song = new AbcToSong().transform(model, fixture.config)
  const target = resolveFixtureSheetRenderTarget(fixture.config, extractNr)
  const sheet = new HarpnotesLayout(fixture.config).layout(song, target.extractNr, target.pageFormat)
  return sheetToFixture(sheet)
}

export function getSheetFixtureTargets(fixture: PipelineFixture): Array<{ extractNr: number; expected: SheetFixture }> {
  const extractEntries = Object.entries(fixture.sheetExtracts)
  if (extractEntries.length > 0) {
    return extractEntries
      .map(([extractNr, expected]) => ({
        extractNr: Number.parseInt(extractNr, 10),
        expected,
      }))
      .sort((a, b) => a.extractNr - b.extractNr)
  }

  if (fixture.sheet !== null) {
    return [{ extractNr: 0, expected: fixture.sheet }]
  }

  return []
}

export function saveFixtureOutput(fixture: PipelineFixture, stage: FixtureStage, data: unknown): void {
  const dir = resolve(fixture.dir, '_ts_output')
  const filename = stage === 'output_svg' ? 'output.svg' : `${stage}.json`
  const content = typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`

  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, filename), content, 'utf-8')
}

/**
 * Converts a Song domain object into the SongFixture format used for comparison.
 *
 * All entity types are included (Note, Pause, SynchPoint, MeasureStart, NewPart,
 * Goto, Chordsymbol, NoteBoundAnnotation). Fields not present on a given type
 * are omitted (not set to null).
 */
export function songToFixture(song: Song): SongFixture {
  return {
    meta_data: song.metaData as Record<string, unknown>,
    voices: song.voices.map((v) => ({
      entities: v.entities.map((e): EntityFixture => {
        const entry: EntityFixture = {
          type: e.type,
          beat: e.beat,
          variant: e.variant,
          visible: e.visible,
        }
        if ('pitch' in e) entry['pitch'] = (e as { pitch: number }).pitch
        if ('duration' in e) entry['duration'] = (e as { duration: number }).duration
        if ('tieStart' in e) entry['tieStart'] = (e as { tieStart: boolean }).tieStart
        if ('tieEnd' in e) entry['tieEnd'] = (e as { tieEnd: boolean }).tieEnd
        if (
          entry.duration === undefined &&
          'companion' in e &&
          e.companion &&
          typeof e.companion === 'object' &&
          'duration' in e.companion &&
          typeof e.companion.duration === 'number'
        ) {
          entry.duration = e.companion.duration
        }
        if (e.type === 'Goto') {
          entry['from'] = e.from.beat
          entry['to'] = e.to.beat
        }
        return entry
      }),
    })),
    beat_maps: song.beatMaps.map((bm) =>
      Object.fromEntries(
        Object.entries(bm.entries).map(([k, v]) => [k, (v as { beat: number }).beat]),
      ),
    ),
  }
}

/**
 * Converts a Sheet domain object into the SheetFixture format used for comparison.
 *
 * Only fields relevant for semantic comparison are included.
 * Excluded: confKey, lineWidth, origin, draginfo, visible (invisible elements filtered out).
 */
export function sheetToFixture(sheet: Sheet): SheetFixture {
  return {
    children: sheet.children
      .filter((c) => c.visible !== false)
      .map((c): DrawableFixture => {
        const entry: DrawableFixture = { type: c.type }
        if ('center'    in c && c.center    !== undefined) entry.center    = c.center
        if ('size'      in c && c.size      !== undefined) entry.size      = c.size
        if ('fill'      in c && c.fill      !== undefined) entry.fill      = c.fill as DrawableFixture['fill']
        if ('from'      in c && c.from      !== undefined) entry.from      = c.from
        if ('to'        in c && c.to        !== undefined) entry.to        = c.to
        if ('style'     in c && c.style     !== undefined) entry.style     = c.style
        if ('glyphName' in c && c.glyphName !== undefined) entry.glyphName = c.glyphName
        if ('text'      in c && c.text      !== undefined) entry.text      = c.text
        if ('color'     in c && c.color     !== undefined) entry.color     = c.color
        return entry
      }),
  }
}
