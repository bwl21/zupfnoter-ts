import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Song } from '@zupfnoter/types'
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { exportSongToAbc, formatAbcSource } from '../../SongToAbc.js'
import { defaultTestConfig } from '../defaultConfig.js'

const SHIFTED_ABC = `X:1
T:Materialize shift
M:4/4
L:1/4
K:C shift=DC
C D [E,G]2 |: F G :|
`

const SHIFTED_KEY_ABC = `X:1
T:Materialize key shift
M:4/4
L:1/4
K:Bb shift=CD
V:1 treble-8
V:1
C D E F |
`

const SHIFTED_CLEF_ABC = `X:1
T:Materialize clef octave
M:4/4
L:1/4
K:C
V:1 treble-8
C D E F |
`

const SHIFTED_BRACKET_ABC = `X:1
T:Materialize bracket notes
M:4/4
L:1/4
K:Bb shift=EA
V:1 bass
V:1
[E,,] [F,,] |
`

const CHROMATIC_SHIFT_TARGETS = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B']

const EXPLICIT_BREAK_ABC = `X:1
T:Breaks
M:4/4
L:1/4
I:linebreak $
K:C
V:1
C D |$ E F |]
V:2
G, A, |$ B, C |]

%%%%zupfnoter.config
{"$schema":"test"}
`

const WRAPPING_ABC = `X:1
T:Wrapping
M:4/4
L:1/4
K:C
C D E F | G A B c | d e f g | C D E F | G A B c | d e f g | C D E F | G A B c | d e f g | C D E F |]
`

const WHITESPACE_ABC = `X:1
T:Whitespace
M:4/4
L:1/4
K:C
C   D\tE  "keep  this"   F |
`

const CHROMATIC_FIXTURE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/abc-export-chromatic',
)
const CHROMATIC_GENERATED_DIR = resolve(CHROMATIC_FIXTURE_DIR, '_generated')

function chromaticFixture(name: string): string {
  return readFileSync(resolve(CHROMATIC_FIXTURE_DIR, name), 'utf8')
}

function transform(source: string): Song {
  const model = new AbcParser().parse(source)
  return new AbcToSong().transform(model, defaultTestConfig)
}

function pitches(song: Song): number[][] {
  return song.voices.slice(1).map((voice) => voice.entities
    .flatMap((entity): number[] => {
      if (entity.type === 'Note') return [entity.pitch]
      if (entity.type === 'SynchPoint') return entity.notes.map((note) => note.pitch)
      return []
    }))
}

describe('exportSongToAbc', () => {
  it('materializes effective pitches and removes source shifts', () => {
    const originalSong = transform(SHIFTED_ABC)
    const exported = exportSongToAbc(SHIFTED_ABC, originalSong)
    const exportedSong = transform(exported)

    expect(exported).not.toContain('shift=')
    expect(exported).toContain('|:')
    expect(pitches(exportedSong)).toEqual(pitches(originalSong))
  })

  it('changes only mapped note tokens, preserving headers and repeat syntax', () => {
    const originalSong = transform(SHIFTED_ABC)
    const exported = exportSongToAbc(SHIFTED_ABC, originalSong)

    expect(exported).toContain('X:1\nT:Materialize shift\nM:4/4\nL:1/4\n')
    expect(exported).toMatch(/\|: E F :\|/)
    expect(exported).toContain('[D,F]2')
  })

  it('materializes an effective shifted key signature', () => {
    const formatted = formatAbcSource(SHIFTED_KEY_ABC)
    const formattedToEb = formatAbcSource(SHIFTED_KEY_ABC.replace('shift=CD', 'shift=EA'))

    expect(formatted).toContain('K:C\n')
    expect(formatted).not.toContain('K:Bb')
    expect(formatted).not.toContain('shift=')
    expect(formattedToEb).toContain('K:Eb\n')
  })

  it('materializes octave-transposing clefs', () => {
    const formatted = formatAbcSource(SHIFTED_CLEF_ABC)

    expect(formatted).toContain('V:1 treble\n')
    expect(formatted).not.toContain('treble-8')
    expect(pitches(transform(formatted))).toEqual(pitches(transform(SHIFTED_CLEF_ABC)))
  })

  it('materializes notes inside bracketed note tokens against the effective key', () => {
    const formatted = formatAbcSource(SHIFTED_BRACKET_ABC)

    expect(pitches(transform(formatted))).toEqual(pitches(transform(SHIFTED_BRACKET_ABC)))
  })

  it.each(CHROMATIC_SHIFT_TARGETS)('round-trips the chromatic shift to %s', (target) => {
    const source = chromaticFixture('source.abc').replace('K:C\n', `K:C shift=C${target}\n`)
    const formatted = formatAbcSource(source)

    expect(pitches(transform(formatted))).toEqual(pitches(transform(source)))
  })

  it('spells enharmonic pitches according to the effective key', () => {
    const source = chromaticFixture('enharmonic-source.abc')
    const formatted = exportSongToAbc(source, transform(source))

    expect(formatted).toContain('C ^C D ^D D')
    expect(formatted).not.toContain('_E')
  })

  it('matches the checked-in chromatic ABC exports', () => {
    const source = chromaticFixture('source.abc')
    mkdirSync(CHROMATIC_GENERATED_DIR, { recursive: true })

    for (const target of CHROMATIC_SHIFT_TARGETS) {
      const shiftedSource = source.replace('K:C\n', `K:C shift=C${target}\n`)
      const expected = chromaticFixture(`shift-C${target.replaceAll('^', 'sharp')}.abc`)
      const generated = exportSongToAbc(shiftedSource, transform(shiftedSource))

      writeFileSync(
        resolve(CHROMATIC_GENERATED_DIR, `shift-C${target.replaceAll('^', 'sharp')}.abc`),
        generated,
      )
      expect(generated).toBe(expected)
    }
  })

  it('uses flat spelling when transposing into B-flat', () => {
    const source = chromaticFixture('source.abc').replace('K:C\n', 'K:C shift=C_B,\n')
    const exported = exportSongToAbc(source, transform(source))

    expect(exported).toContain('K:Bb\n')
    expect(exported).toContain('B,, =B,, C, _D, =D, E, =E, F, | _G, =G, _A, =A,')
    expect(exported).not.toContain('^')
  })

  it('preserves explicit source linebreak markers', () => {
    const exported = exportSongToAbc(EXPLICIT_BREAK_ABC, transform(EXPLICIT_BREAK_ABC))

    expect(exported).toContain('I:linebreak $')
    expect(exported).toContain('|$ E F')
    expect(exported).toContain('"$schema":"test"')
  })

  it('adds a timestamped formatter comment at the beginning', () => {
    const formatted = formatAbcSource(SHIFTED_ABC)

    expect(formatted).toMatch(/^% Von Zupfnoter-TS formatiert am \d{4}-\d{2}-\d{2}T[^\r\n]+ content-hash=[0-9a-f]+\r?\nX:1\n/)
    expect(formatAbcSource(formatted).match(/^% Von Zupfnoter-TS formatiert am /gm)).toHaveLength(1)

    const changed = formatted.replace('T:Materialize shift', 'T:Changed after formatting')
    expect(formatAbcSource(changed).match(/^% Von Zupfnoter-TS formatiert am /gm)).toHaveLength(2)
  })

  it('keeps the original music line boundaries', () => {
    const formatted = formatAbcSource(WRAPPING_ABC)

    expect(formatted).toContain('C D E F | G A B c | d e f g | C D E F |')
  })

  it('collapses insignificant music whitespace but preserves quoted text whitespace', () => {
    const formatted = formatAbcSource(WHITESPACE_ABC)

    expect(formatted).toContain('C D E "keep  this" F |')
  })
})
