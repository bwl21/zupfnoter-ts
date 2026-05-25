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
import { SvgEngine } from '../SvgEngine.js'
import { extractSongConfig, mergeSongConfig } from '../extractSongConfig.js'
import { LegacyFixtureAnnotationTextMetrics } from './legacyAnnotationTextMetrics.js'
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
  /** Raw `@music_model.to_json` dump from the legacy CLI (`song.legacy-raw.json`). */
  song: unknown | null
  sheetExtracts: Record<string, SheetFixture>
  outputSvgExtracts: Record<string, string>
}

export interface FixtureCase {
  name: string
  id: string
  dir: string
  hasSongFixture: boolean
  hasSheetFixture: boolean
  hasOutputSvgFixture: boolean
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
  return resolve(dir, 'song.legacy-raw.json')
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

function listOutputSvgFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name === 'output.svg' || /^output\.extract-\d+\.svg$/.test(name))
    .sort((a, b) => a.localeCompare(b))
}

function loadOutputSvgFixtures(dir: string): Record<string, string> {
  const svgFiles = listOutputSvgFiles(dir)
  if (svgFiles.includes('output.svg')) {
    return { '0': loadText(resolve(dir, 'output.svg')) }
  }

  return Object.fromEntries(
    svgFiles.map((filename) => {
      const match = filename.match(/^output\.extract-(\d+)\.svg$/)
      if (!match) throw new Error(`Invalid svg extract fixture filename: ${filename}`)
      return [match[1], loadText(resolve(dir, filename))]
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
      hasSongFixture: existsSync(resolve(dir, 'song.legacy-raw.json')),
      hasSheetFixture: listSheetExtractFiles(dir).length > 0,
      hasOutputSvgFixture: listOutputSvgFiles(dir).length > 0,
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
  const outputSvgExtracts = loadOutputSvgFixtures(dir)
  return {
    name,
    id: name,
    dir,
    input: { abc },
    config: fixtureConfigFromAbc(abc),
    song: safeLoadJson<unknown>(resolveSongFixturePath(dir)),
    sheetExtracts,
    outputSvgExtracts,
  }
}

export function loadSongFixture(name: string): unknown {
  return loadJson<unknown>(resolveSongFixturePath(fixtureCaseDir(name)))
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
  const sheet = new HarpnotesLayout(fixture.config, {
    annotationTextMetrics: new LegacyFixtureAnnotationTextMetrics(),
  }).layout(song, target.extractNr, target.pageFormat)
  return sheetToFixture(sheet)
}

export function getSheetFixtureTargets(fixture: PipelineFixture): Array<{ extractNr: number; expected: SheetFixture }> {
  return Object.entries(fixture.sheetExtracts)
    .map(([extractNr, expected]) => ({
      extractNr: Number.parseInt(extractNr, 10),
      expected,
    }))
    .sort((a, b) => a.extractNr - b.extractNr)
}

export function getOutputSvgFixtureTargets(fixture: PipelineFixture): Array<{ extractNr: number; expected: string }> {
  return Object.entries(fixture.outputSvgExtracts)
    .map(([extractNr, expected]) => ({
      extractNr: Number.parseInt(extractNr, 10),
      expected,
    }))
    .sort((a, b) => a.extractNr - b.extractNr)
}

export function transformFixtureToSvg(
  fixture: PipelineFixture,
  extractNr: number | string = 0,
): string {
  const model = new AbcParser().parse(fixture.input.abc)
  const song = new AbcToSong().transform(model, fixture.config)
  const target = resolveFixtureSheetRenderTarget(fixture.config, extractNr)
  const sheet = new HarpnotesLayout(fixture.config, {
    annotationTextMetrics: new LegacyFixtureAnnotationTextMetrics(),
  }).layout(song, target.extractNr, target.pageFormat)
  return new SvgEngine().draw(sheet)
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
 * are omitted (not set to null). Legacy-facing identifiers like `znId` are
 * preserved so downstream comparisons can keep the same semantic anchor.
 */
export function songToFixture(song: Song): SongFixture {
  return {
    meta_data: song.metaData as Record<string, unknown>,
    harpnote_options: song.harpnoteOptions as Record<string, unknown> | undefined,
    voices: song.voices.map((v) => ({
      entities: v.entities.map((e): EntityFixture => {
        const entry: EntityFixture = {
          type: e.type,
          beat: e.beat,
          variant: e.variant,
          visible: e.visible,
          barDecorations: e.barDecorations,
          confKey: e.confKey,
          decorations: e.decorations.length > 0 ? e.decorations : undefined,
          znId: e.znId,
          time: e.time,
          startPos: e.startPos,
          endPos: e.endPos,
          measureStart: 'measureStart' in e ? e.measureStart : undefined,
          measureCount: 'measureCount' in e ? e.measureCount : undefined,
          firstInPart: 'firstInPart' in e ? e.firstInPart : undefined,
          countNote: 'countNote' in e ? e.countNote : undefined,
          lyrics: 'lyrics' in e ? (e.lyrics ?? '') : undefined,
          tuplet: 'tuplet' in e ? e.tuplet : undefined,
          tupletStart: 'tupletStart' in e && 'tuplet' in e && e.tuplet > 1 ? e.tupletStart : undefined,
          tupletEnd: 'tupletEnd' in e ? (e.tupletEnd ? true : undefined) : undefined,
          slurStarts: 'slurStarts' in e ? e.slurStarts : undefined,
          slurEnds: 'slurEnds' in e ? e.slurEnds : undefined,
          jumpStarts: 'jumpStarts' in e ? e.jumpStarts : undefined,
          jumpEnds: 'jumpEnds' in e ? e.jumpEnds : undefined,
        }
        if ('pitch' in e) entry['pitch'] = (e as { pitch: number }).pitch
        if ('duration' in e) entry['duration'] = (e as { duration: number }).duration
        if ('tieStart' in e) entry['tieStart'] = (e as { tieStart: boolean }).tieStart
        if ('tieEnd' in e) entry['tieEnd'] = (e as { tieEnd: boolean }).tieEnd
        if ('time' in e && (e as { time?: number }).time !== undefined) entry['time'] = (e as { time: number }).time
        if ('prevPitch' in e && (e as { prevPitch?: number }).prevPitch !== undefined) entry['prevPitch'] = (e as { prevPitch: number }).prevPitch
        if ('nextPitch' in e && (e as { nextPitch?: number }).nextPitch !== undefined) entry['nextPitch'] = (e as { nextPitch: number }).nextPitch
        if ('text' in e && typeof (e as { text?: string }).text === 'string') entry['text'] = (e as { text: string }).text
        if ('position' in e && Array.isArray((e as { position?: [number, number] }).position)) entry['position'] = (e as { position: [number, number] }).position
        if ('style' in e && typeof (e as { style?: string }).style === 'string') entry['style'] = (e as { style: string }).style
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
          entry['policy'] = e.policy as Record<string, unknown>
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
 * Legacy-facing identifiers like `znId` are preserved when present.
 */
export function sheetToFixture(sheet: Sheet): SheetFixture {
  return {
    children: sheet.children
      .filter((c) => c.visible !== false)
      .map((c): DrawableFixture => {
        const entry: DrawableFixture = {
          type: c.type,
          znId: c.znId,
          confKey: c.confKey,
          lineWidth: c.lineWidth,
          visible: c.visible,
        }
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
