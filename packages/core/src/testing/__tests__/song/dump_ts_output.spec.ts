/* oxlint-disable jest/expect-expect -- dev helper: tests write files, no assertions needed */
/**
 * Dumps the TS pipeline output for all fixture cases to fixtures/cases/<area>/<name>/_ts_output/.
 *
 * Development helper — not a regression test.
 * Run once to see what the TS pipeline currently produces:
 *
 *   cd packages/core
 *   npx vitest run --reporter=verbose src/testing/__tests__/song/dump_ts_output.spec.ts
 *
 * Output: fixtures/cases/<area>/<name>/_ts_output/song.json
 * Compare with the legacy Ruby export to identify discrepancies before populating
 * the real fixtures in fixtures/cases/<area>/<name>/song.json.
 */
import { describe, it } from 'vitest'

import { AbcParser } from '../../../AbcParser.js'
import { loadFixture, saveFixtureOutput, scanFixtureCases, transformFixtureToSong } from '../../fixtureLoader.js'
import type { FixtureCase } from '../../fixtureLoader.js'

function serializeAbcVoiceElement(symbol: Record<string, unknown>): Record<string, unknown> {
  const entry: Record<string, unknown> = {}
  const keys = [
    'type',
    'fname',
    'stem',
    'multi',
    'nhd',
    'xmx',
    'istart',
    'dur_orig',
    'dur',
    'v',
    'st',
    'time',
    'iend',
    'seqst',
    'ptim',
    'pdur',
    'instr',
    'start_pos',
    'end_pos',
    'bar_type',
    'text',
    'ti1',
    'slur_sls',
    'slur_end',
    'rbstart',
    'rbstop',
    'invisible',
    'invis',
  ] as const

  for (const key of keys) {
    if (key in symbol) entry[key] = symbol[key]
  }

  const notes = symbol.notes
  if (Array.isArray(notes)) {
    entry.notes = notes.map((note) => {
      if (!note || typeof note !== 'object' || Array.isArray(note)) return note
      const record = note as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const key of ['midi', 'dur', 'pit', 'shhd', 'shac', 'acc', 'b40'] as const) {
        if (key in record) out[key] = record[key]
      }
      return out
    })
  }

  const pos = symbol.pos
  if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
    const record = pos as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of ['dyn', 'gch', 'gst', 'orn', 'stm', 'voc', 'vol'] as const) {
      if (key in record) out[key] = record[key]
    }
    entry.pos = out
  }

  const aDd = symbol.a_dd
  if (Array.isArray(aDd)) {
    entry.a_dd = aDd.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item
      const record = item as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const key of ['name', 'func', 'glyph', 'h', 'wl', 'wr', 'str'] as const) {
        if (key in record) out[key] = record[key]
      }
      return out
    })
  }

  const aGch = symbol.a_gch
  if (Array.isArray(aGch)) {
    entry.a_gch = aGch.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item
      const record = item as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const key of ['type', 'text', 'func', 'glyph', 'lang'] as const) {
        if (key in record) out[key] = record[key]
      }
      return out
    })
  }

  return entry
}

function dump(testCase: FixtureCase) {
  const fixture = loadFixture(testCase)
  const abcModel = new AbcParser().parse(fixture.input.abc)
  const song = transformFixtureToSong(fixture)
  const abcRawVoiceElements = abcModel.voices.map((voice) =>
    voice.symbols.map((symbol) => serializeAbcVoiceElement(symbol as Record<string, unknown>)),
  )

  saveFixtureOutput(fixture, 'song', {
    ...song,
    abc_raw_voice_elements: abcRawVoiceElements,
  })
  console.log(`Written: ${testCase.id}/_ts_output/song.json`)
}

describe('dump TS song output (dev helper)', () => {
  for (const testCase of scanFixtureCases()) {
    it(`writes ${testCase.id}`, () => dump(testCase))
  }
})
