/**
 * AbcParser – the single point of contact with abc2svg.
 *
 * No other file in @zupfnoter/core may import abc2svg-1.js directly.
 * All abc2svg internals are translated into the AbcModel interface before
 * leaving this module.
 */

import type { AbcModel, AbcVoice, AbcSymbol } from './AbcModel.js'
import { ABC_TYPE } from './AbcModel.js'

// ---------------------------------------------------------------------------
// Load abc2svg via browser-compatible ESM wrapper (vendored)
// abc2svg-1.js is executed inside a Function scope that provides a fake
// module/exports object — works in both browser and Node.js (no vm/fs needed).
// ---------------------------------------------------------------------------

import abc2svgSource from '../vendor/abc2svg-1.js?raw'

// ---------------------------------------------------------------------------
// Minimal abc2svg type shims (not exported)
// ---------------------------------------------------------------------------

interface Abc2svgUser {
  keep_remark?: boolean
  img_out?: (svg: string) => void
  errbld?: (severity: number, msg: string, fname: string | undefined, line: number | undefined, col: number | undefined) => void
  read_file: (name: string) => string | null
  get_abcmodel?: (
    tsfirst: Abc2svgSymbol | null,
    voice_tb: Abc2svgVoice[],
    music_types: string[],
    info: Record<string, string>,
  ) => void
}

interface Abc2svgExports {
  abc2svg: { C: Record<string, number>; sym_name: string[]; version: string }
  Abc: new (user: Abc2svgUser) => { tosvg: (fname: string, source: string) => void }
}

interface Abc2svgVoice {
  id?: string
  nm?: string
  sym?: Abc2svgSymbol
  meter?: { wmeasure: number; a_meter: Array<{ bot: number; top: number }> }
  key?: { k_mode?: number; k_sf?: number }
  okey?: { k_mode?: number; k_sf?: number }
  [key: string]: unknown
}

interface Abc2svgSymbol {
  type: number
  time: number
  dur?: number
  istart: number
  iend: number
  notes?: Array<{ midi: number; dur: number; [key: string]: unknown }>
  bar_type?: string
  text?: string
  ti1?: number
  sls?: Array<{ ty?: number; [key: string]: unknown }>
  slur_sls?: number[]
  slur_end?: number
  rbstart?: number
  rbstop?: number
  invisible?: boolean
  invis?: boolean
  a_dd?: Array<{ name?: string; [key: string]: unknown }>
  a_gch?: Array<{ type: string; text?: string; [key: string]: unknown }>
  next?: Abc2svgSymbol
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AbcParseError {
  severity: 0 | 1 | 2
  message: string
  line?: number
  column?: number
}

function countSlurStartsFromSource(source: string, startOffset: number): number[] {
  if (startOffset <= 0) return []

  let index = startOffset - 1
  const skipDecorationsBackward = (): void => {
    while (index >= 0) {
      if (source[index] !== '!') return

      let left = index - 1
      while (left >= 0 && source[left] !== '!') {
        left -= 1
      }
      if (left < 0) return

      index = left - 1
      while (index >= 0 && /\s/.test(source[index] ?? '')) {
        index -= 1
      }
    }
  }

  while (index >= 0) {
    while (index >= 0 && /\s/.test(source[index] ?? '')) {
      index -= 1
    }
    skipDecorationsBackward()
    if (source[index] !== '!') break
  }

  let count = 0
  while ((source[index] ?? '') === '(') {
    count += 1
    index -= 1
  }

  return Array.from({ length: count }, (_value, arrayIndex) => arrayIndex + 1)
}

function normalizeSymbol(
  liveSymbol: Abc2svgSymbol,
  source: string,
  nextSymbol?: AbcSymbol,
): AbcSymbol {
  const normalized = {
    ...liveSymbol,
    next: nextSymbol,
  } as AbcSymbol

  const normalizedNotes = normalizeChordNoteOrder(liveSymbol, source)
  if (normalizedNotes !== undefined) {
    normalized.notes = normalizedNotes
  }

  const slurStarts = Array.isArray(liveSymbol.slur_sls)
    ? liveSymbol.slur_sls.filter((value): value is number => typeof value === 'number')
    : countSlurStartsFromSource(source, liveSymbol.istart)
  if (slurStarts.length > 0) {
    normalized.slur_sls = slurStarts
  }

  return normalized
}

function diatonicStepForLetter(letter: string): number | null {
  switch (letter.toUpperCase()) {
    case 'C': return 0
    case 'D': return 1
    case 'E': return 2
    case 'F': return 3
    case 'G': return 4
    case 'A': return 5
    case 'B': return 6
    default: return null
  }
}

function semitoneOffsetForStep(step: number): number | null {
  switch (step) {
    case 0: return 0
    case 1: return 2
    case 2: return 4
    case 3: return 5
    case 4: return 7
    case 5: return 9
    case 6: return 11
    default: return null
  }
}

function normalizeChordNoteOrder(liveSymbol: Abc2svgSymbol, source: string): Abc2svgSymbol['notes'] | undefined {
  const liveNotes = liveSymbol.notes
  if (!Array.isArray(liveNotes) || liveNotes.length <= 1) return liveNotes

  const sourceSlice = source.slice(liveSymbol.istart, liveSymbol.iend)
  const openIndex = sourceSlice.indexOf('[')
  const closeIndex = sourceSlice.indexOf(']', openIndex + 1)
  if (openIndex < 0 || closeIndex < 0) return liveNotes

  const chordSource = sourceSlice.slice(openIndex + 1, closeIndex)
  const liveMidis = liveNotes.map((note) => note.midi)
  const sourceMidis = parseChordSourceMidis(chordSource, liveMidis)
  if (sourceMidis === null || sourceMidis.length !== liveNotes.length) return liveNotes

  const notesByMidi = new Map<number, typeof liveNotes>()
  for (const note of liveNotes) {
    const bucket = notesByMidi.get(note.midi)
    if (bucket === undefined) {
      notesByMidi.set(note.midi, [note])
    } else {
      bucket.push(note)
    }
  }

  const reordered: typeof liveNotes = new Array(liveNotes.length)
  for (const [index, midi] of sourceMidis.entries()) {
    const bucket = notesByMidi.get(midi)
    const liveNote = bucket?.shift()
    if (liveNote === undefined) return liveNotes
    reordered[index] = liveNote
  }

  return reordered.every((note) => note !== undefined) ? reordered : liveNotes
}

function parseChordSourceMidis(chordSource: string, liveMidis: number[]): number[] | null {
  const sortedLiveMidis = [...liveMidis].sort((left, right) => left - right)

  const parse = (index: number, remainingMidis: number[]): number[] | null => {
    let cursor = index
    while (cursor < chordSource.length) {
      const char = chordSource[cursor]
      if (char !== ',' && char !== ' ' && char !== '\t') break
      cursor += 1
    }

    if (cursor >= chordSource.length) {
      return remainingMidis.length === 0 ? [] : null
    }

    let accidental = 0
    while (cursor < chordSource.length) {
      const char = chordSource[cursor]
      if (char === '^') {
        accidental += 1
      } else if (char === '_') {
        accidental -= 1
      } else if (char === '=') {
        accidental = 0
      } else {
        break
      }
      cursor += 1
    }

    const letter = chordSource[cursor]
    if (letter === undefined) return null
    const step = diatonicStepForLetter(letter)
    if (step === null) return null
    cursor += 1

    let markEnd = cursor
    while (markEnd < chordSource.length) {
      const char = chordSource[markEnd]
      if (char !== '\'' && char !== ',') break
      markEnd += 1
    }

    for (let split = cursor; split <= markEnd; split += 1) {
      const midi = abcPitchToMidi(letter, chordSource.slice(cursor, split), accidental, step)
      const midiIndex = remainingMidis.indexOf(midi)
      if (midiIndex < 0) continue

      const nextRemaining = remainingMidis.slice()
      nextRemaining.splice(midiIndex, 1)
      const tail = parse(split, nextRemaining)
      if (tail !== null) return [midi, ...tail]
    }

    return null
  }

  return parse(0, sortedLiveMidis)
}

function abcPitchToMidi(letter: string, octaveMarks: string, accidental: number, step: number): number {
  const semitoneOffset = semitoneOffsetForStep(step)
  if (semitoneOffset === null) return 48 + accidental

  let midi = 48 + semitoneOffset

  if (letter >= 'a' && letter <= 'g') midi += 12
  for (const char of octaveMarks) {
    if (char === '\'') midi += 12
    if (char === ',') midi -= 12
  }

  return midi + accidental
}

function computeLegacyChecksum(abcText: string): string {
  const markerIndex = abcText.indexOf('%%%%zupfnoter.config')

  const relevantText = markerIndex >= 0 ? abcText.slice(0, markerIndex) : abcText

  let checksum = 0x12345678
  const text = relevantText.trim()

  for (let index = 0; index < text.length; index += 1) {
    checksum += text.charCodeAt(index) * (index + 1)
  }

  const groups = checksum.toString().match(/.{1,3}/g)
  return groups === null ? '' : groups.join(' ')
}

function buildLineStarts(source: string): number[] {
  const lineStarts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      lineStarts.push(index + 1)
    }
  }
  return lineStarts
}

function loadAbc2svg(): Abc2svgExports {
  const mod = { exports: {} as Record<string, unknown> }
  const fn = new Function('module', 'exports', abc2svgSource)
  fn(mod, mod.exports)

  if (!mod.exports['Abc'] || !mod.exports['abc2svg']) {
    const g = globalThis as unknown as Record<string, unknown>
    if (g['Abc'] && g['abc2svg']) {
      return { Abc: g['Abc'] as Abc2svgExports['Abc'], abc2svg: g['abc2svg'] as Abc2svgExports['abc2svg'] }
    }
    throw new Error('abc2svg failed to load: neither CJS exports nor globals found')
  }

  return mod.exports as unknown as Abc2svgExports
}

const _abc2svgModule = loadAbc2svg()

// ---------------------------------------------------------------------------
// AbcParser
// ---------------------------------------------------------------------------

/**
 * Parses ABC text using abc2svg and returns an AbcModel.
 *
 * This is the only class in @zupfnoter/core that imports abc2svg-1.js.
 */
export class AbcParser {
  private _errors: AbcParseError[] = []
  private _model: AbcModel | null = null

  /** Errors and warnings from the last parse() call */
  get errors(): AbcParseError[] {
    return this._errors
  }

  /**
   * Parse ABC text and return the internal AbcModel.
   *
   * @throws Error if abc2svg reports a fatal error or produces no model
   */
  parse(abcText: string): AbcModel {
    this._errors = []
    this._model = null

    const user: Abc2svgUser = {
      keep_remark: true,
      // Suppress SVG output — we only need the model
      img_out: (_svg: string) => { /* no-op */ },

      errbld: (severity, msg, _fname, line, col) => {
        const err: AbcParseError = {
          severity: (severity > 1 ? 2 : severity) as 0 | 1 | 2,
          message: msg,
          line: line,
          column: col,
        }
        this._errors.push(err)
      },

      // No %%abc-include support in Phase 2
      read_file: (_name: string) => null,

      get_abcmodel: (tsfirst, voice_tb, music_types, info) => {
        this._model = AbcParser._buildModel(
          tsfirst,
          voice_tb,
          music_types,
          info,
          computeLegacyChecksum(abcText),
          abcText,
        )
      },
    }

    const abc = new _abc2svgModule.Abc(user)
    abc.tosvg('zupfnoter', abcText)

    if (this._model === null) {
      const fatalErrors = this._errors.filter((e) => e.severity >= 1)
      if (fatalErrors.length > 0) {
        throw new Error(`abc2svg parse error: ${fatalErrors.map((e) => e.message).join('; ')}`)
      }
      throw new Error('abc2svg produced no model — check ABC syntax')
    }

    return this._model
  }

  /**
   * Render ABC text with abc2svg and return the emitted classical score SVG.
   *
   * This keeps direct abc2svg access inside AbcParser while allowing the UI to
   * show the conventional notation preview.
   */
  renderSvg(abcText: string): string {
    this._errors = []
    this._model = null

    const chunks: string[] = []
    const user: Abc2svgUser = {
      keep_remark: true,
      img_out: (svg: string) => {
        chunks.push(svg)
      },

      errbld: (severity, msg, _fname, line, col) => {
        const err: AbcParseError = {
          severity: (severity > 1 ? 2 : severity) as 0 | 1 | 2,
          message: msg,
          line: line,
          column: col,
        }
        this._errors.push(err)
      },

      read_file: (_name: string) => null,
    }

    const abc = new _abc2svgModule.Abc(user)
    abc.tosvg('zupfnoter', abcText)

    if (chunks.length === 0) {
      const fatalErrors = this._errors.filter((e) => e.severity >= 1)
      if (fatalErrors.length > 0) {
        throw new Error(`abc2svg render error: ${fatalErrors.map((e) => e.message).join('; ')}`)
      }
      throw new Error('abc2svg produced no SVG — check ABC syntax')
    }

    return chunks.join('\n')
  }

  // ---------------------------------------------------------------------------
  // Private: build AbcModel from abc2svg callback arguments
  // ---------------------------------------------------------------------------

  private static _buildModel(
    _tsfirst: Abc2svgSymbol | null,
    voice_tb: Abc2svgVoice[],
    music_types: string[],
    info: Record<string, string>,
    checksum: string,
    source: string,
  ): AbcModel {
    // Build reverse map: type name → numeric id
    const music_type_ids: Record<string, number> = {}
    music_types.forEach((name, idx) => {
      if (name) music_type_ids[name] = idx
    })

    // Also add the well-known constants from abc2svg.C for robustness
    const C = _abc2svgModule.abc2svg.C
    Object.entries(ABC_TYPE).forEach(([key, val]) => {
      const name = key.toLowerCase()
      music_type_ids[name] = val
      // abc2svg uses 'note' not 'NOTE'
    })
    // Override with abc2svg.C values if available
    if (C) {
      Object.entries(C).forEach(([key, val]) => {
        if (typeof val === 'number') {
          music_type_ids[key.toLowerCase()] = val
        }
      })
    }

    const voices: AbcVoice[] = voice_tb.map((v) => {
      const symbols: AbcSymbol[] = AbcParser._collectSymbols(v.sym, source)

      return {
        voice_properties: {
          id: v.id ?? '',
          name: v.nm,
          meter: v.meter ?? { wmeasure: 1536, a_meter: [{ bot: 4, top: 4 }] },
          key: v.key ?? {},
          okey: v.okey,
        },
        symbols,
      }
    })

    return {
      voices,
      music_types,
      music_type_ids,
      info,
      checksum,
      sourceLineStarts: buildLineStarts(source),
      source,
    }
  }

  /** Walk the linked-list of symbols in a voice and collect them into an array */
  private static _collectSymbols(first: Abc2svgSymbol | undefined, source: string): AbcSymbol[] {
    const liveSymbols: Abc2svgSymbol[] = []
    let sym: Abc2svgSymbol | undefined = first
    while (sym) {
      liveSymbols.push(sym)
      sym = sym.next
    }

    return liveSymbols.map((liveSymbol, index) =>
      normalizeSymbol(liveSymbol, source, liveSymbols[index + 1] as unknown as AbcSymbol | undefined),
    )
  }
}
