/* oxlint-disable jest/valid-expect -- Vitest supports expect(val, msg) for failure messages */
/**
 * Sheet-level legacy comparison tests (Stufe 3: Song → Drawing-Modell).
 *
 * Each test:
 *   1. Reads an ABC fixture from fixtures/abc/
 *   2. Runs the TS pipeline: AbcToSong → DefaultLayout (once implemented)
 *   3. Compares the Sheet against the JSON fixture in fixtures/sheet/
 *      using semantic matching (positions ±0.1 mm, sizes ±0.05 mm)
 *
 * Fixtures with empty children[] are treated as placeholders and always pass.
 * Populate them by running the legacy export (see fixtures/README.md).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { matchSheet, formatMismatches } from '../../semanticMatch.js'
import { loadSheetFixture } from '../../fixtureLoader.js'
import type { SheetFixture } from '../../semanticMatch.js'
import { AbcParser } from '../../../AbcParser.js'
import { AbcToSong } from '../../../AbcToSong.js'
import { HarpnotesLayout } from '../../../HarpnotesLayout.js'
import { defaultTestConfig } from '../../defaultConfig.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../../../..')

function readAbc(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf-8')
}

/**
 * Full pipeline: ABC → Song → Sheet.
 * Fixtures with empty children[] are treated as placeholders and always pass.
 */
function transformAbcToSheet(abcText: string): SheetFixture {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const song = new AbcToSong().transform(model, defaultTestConfig)
  const sheet = new HarpnotesLayout(defaultTestConfig).layout(song, 0, 'A4')
  return sheet as unknown as SheetFixture
}

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const MINIMAL_FIXTURES = [
  'single_note',
  'two_voices',
  'repeat',
  'pause',
  'tuplet',
  'tie',
  'decoration',
  'lyrics',
] as const

describe('Sheet – minimal fixtures', () => {
  for (const name of MINIMAL_FIXTURES) {
    it(`matches legacy output: ${name}`, () => {
      const abcText = readAbc(`fixtures/abc/minimal/${name}.abc`)
      const fixture = loadSheetFixture(name)
      const actual = transformAbcToSheet(abcText)
      const result = matchSheet(actual, fixture)
      expect(result.passed, formatMismatches(result)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Legacy testcases
// ---------------------------------------------------------------------------

const LEGACY_FIXTURES = ['02_twoStaff', 'Twostaff'] as const

describe('Sheet – legacy testcases', () => {
  for (const name of LEGACY_FIXTURES) {
    it(`matches legacy output: ${name}`, () => {
      const abcText = readAbc(`fixtures/abc/legacy/${name}.abc`)
      const fixture = loadSheetFixture(name)
      const actual = transformAbcToSheet(abcText)
      const result = matchSheet(actual, fixture)
      expect(result.passed, formatMismatches(result)).toBe(true)
    })
  }
})
