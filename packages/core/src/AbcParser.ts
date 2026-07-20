/**
 * AbcParser – the single point of contact with abc2svg.
 *
 * No other file in @zupfnoter/core may import abc2svg-1.js directly.
 * All abc2svg internals are translated into the AbcModel interface before
 * leaving this module.
 */

import type { AbcModel, AbcVoice, AbcSymbol } from './AbcModel.js'
import { ABC_TYPE } from './AbcModel.js'
import { abc2svgTextrans } from './localization/de-de.js'

// ---------------------------------------------------------------------------
// Load the vendored abc2svg module directly. The vendor file exposes ESM
// bindings as well as its original CommonJS-compatible globals, so the same
// parser module can be used by Vite and by the Node CLI.
// ---------------------------------------------------------------------------

import * as abc2svgModule from '../vendor/abc2svg-1.js'

// ---------------------------------------------------------------------------
// Minimal abc2svg type shims (not exported)
// ---------------------------------------------------------------------------

interface Abc2svgUser {
  keep_remark?: boolean
  img_out?: (svg: string) => void
  errbld?: (severity: number, msg: string, fname: string | undefined, line: number | undefined, col: number | undefined) => void
  errmsg?: (msg: string, line?: number, column?: number) => void
  anno_start?: (type: string, start: number, stop: number, x: number, y: number, w: number, h: number) => void
  anno_stop?: (type: string, start: number, stop: number, x: number, y: number, w: number, h: number) => void
  textrans?: Record<string, string>
  read_file: (name: string) => string | null
}

interface Abc2svgExports {
  abc2svg: { C: Record<string, number>; sym_name: string[]; version: string }
  Abc: new (user: Abc2svgUser) => {
    tosvg: (fname: string, source: string) => void
    out_svg: (fragment: string) => void
    out_sxsy: (x: number, infix: string, y: number) => void
    tunes?: Abc2svgTune[]
  }
}

type Abc2svgTune = [
  tsfirst: Abc2svgSymbol | null,
  voice_tb: Abc2svgVoice[],
  info: Record<string, string>,
  cfmt: Record<string, unknown>,
]

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
  sls?: Abc2svgSlur[]
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

interface Abc2svgSlur {
  ty?: number
  ss?: Abc2svgSymbol
  se?: Abc2svgSymbol
  nts?: { midi: number; dur: number; [key: string]: unknown }
  nte?: { midi: number; dur: number; [key: string]: unknown }
  loc?: 'i' | 'o'
  rep?: number
  grace?: unknown
  slr?: Abc2svgSlur
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

/**
 * Binds a hook function following the abc2svg plugin pattern:
 *
 *   fn = bindHook(target, original, function(of) {
 *     // 'this' === target
 *     // of   === original
 *     of()
 *   })
 *
 * The returned function has the same signature as `original`.
 */
function bindHook<TThis, TArgs extends unknown[], TReturn>(
  target: TThis,
  original: (this: TThis, ...args: TArgs) => TReturn,
  hook: (this: TThis, of: (...args: TArgs) => TReturn) => TReturn,
): (...args: TArgs) => TReturn {
  return hook.bind(target, original) as (...args: TArgs) => TReturn
}

const ABC2SVG_MESSAGE_PREFIXES = [
  { prefix: 'Warning: ', severity: 0 as const },
  { prefix: 'Error: ', severity: 1 as const },
  { prefix: 'Internal bug: ', severity: 2 as const },
] as const

/** Legacy abc2svg defaults applied before parsing and score preview rendering. */
const ABC2SVG_ZUPFNOTER_DEFAULTS = `
I:titletrim 0
I:measurenb 1
I:contbarnb 1
I:linewarn 0
I:staffnonote 2
I:stretchlast 1
`

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

const _abc2svgModule: Abc2svgExports = {
  Abc: abc2svgModule.Abc as Abc2svgExports['Abc'],
  abc2svg: abc2svgModule.abc2svg as Abc2svgExports['abc2svg'],
}

function normalizeAbc2svgErrmsg(message: string): { severity: 0 | 1 | 2, message: string } {
  for (const entry of ABC2SVG_MESSAGE_PREFIXES) {
    const index = message.indexOf(entry.prefix)
    if (index < 0) continue
    return {
      severity: entry.severity,
      message: message.slice(index + entry.prefix.length),
    }
  }

  return {
    severity: 1,
    message,
  }
}

function createScoreAnnotationId(type: string, startOffset: number, endOffset: number): string {
  return `zn-score-${type}-${startOffset}-${endOffset}`
}

function readPrimaryTune(abc: InstanceType<Abc2svgExports['Abc']>): Abc2svgTune | null {
  const tunes = abc.tunes
  if (!Array.isArray(tunes) || tunes.length === 0) {
    return null
  }

  const firstTune = tunes[0]
  if (!Array.isArray(firstTune) || firstTune.length < 3) {
    return null
  }

  const tsfirst = firstTune[0]
  const voice_tb = firstTune[1]
  const info = firstTune[2]
  const cfmt = firstTune[3]

  if (!Array.isArray(voice_tb) || typeof info !== 'object' || info === null) {
    return null
  }

  return [
    tsfirst instanceof Object || tsfirst === null ? tsfirst as Abc2svgSymbol | null : null,
    voice_tb,
    info as Record<string, string>,
    typeof cfmt === 'object' && cfmt !== null ? cfmt as Record<string, unknown> : {},
  ]
}

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
      textrans: abc2svgTextrans,
      // Suppress SVG output — we only need the model
      img_out: (_svg: string) => { /* no-op */ },
      errmsg: (msg, line, column) => {
        const normalized = normalizeAbc2svgErrmsg(msg)
        const err: AbcParseError = {
          severity: normalized.severity,
          message: normalized.message,
        }
        if (line !== undefined) err.line = line + 1
        if (column !== undefined) err.column = column + 1
        this._errors.push(err)
      },

      // No %%abc-include support in Phase 2
      read_file: (_name: string) => null,
    }

    const abc = new _abc2svgModule.Abc(user) as InstanceType<Abc2svgExports['Abc']> & {
      output_music?: () => void
      get_voice_tb?: () => Abc2svgVoice[]
    }
    let capturedModel: AbcModel | null = null
    const originalOutputMusic = abc.output_music
    if (typeof originalOutputMusic === 'function') {
      // Captures voice_tb BEFORE output_music adds SVG layout artifacts.
      abc.output_music = bindHook(abc, originalOutputMusic, function (this: typeof abc, of) {
        if (capturedModel === null && typeof this.get_voice_tb === 'function') {
          const voiceTb = this.get_voice_tb()
          if (Array.isArray(voiceTb)) {
            capturedModel = AbcParser._buildModel(
              voiceTb,
              _abc2svgModule.abc2svg.sym_name,
              {},
              computeLegacyChecksum(abcText),
              abcText,
            )
          }
        }
        of()
      })
    }

    abc.tosvg('my_parameters', ABC2SVG_ZUPFNOTER_DEFAULTS)
    abc.tosvg('zupfnoter', abcText)

    if (capturedModel !== null) {
      const model: AbcModel = capturedModel
      const primaryTune = readPrimaryTune(abc)
      if (primaryTune !== null) {
        model.info = primaryTune[2]
      }
      this._model = model
    }

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
      textrans: abc2svgTextrans,
      img_out: (svg: string) => {
        chunks.push(svg)
      },
      errmsg: (msg, line, column) => {
        const normalized = normalizeAbc2svgErrmsg(msg)
        const err: AbcParseError = {
          severity: normalized.severity,
          message: normalized.message,
        }
        if (line !== undefined) err.line = line + 1
        if (column !== undefined) err.column = column + 1
        this._errors.push(err)
      },
      anno_start: (type, start, stop) => {
        void type
        void start
        void stop
      },
      anno_stop: (type, start, stop, x, y, w, h) => {
        const id = createScoreAnnotationId(type, start, stop)
        abc.out_svg(
          `<rect id="${id}" class="zn-score-annotation zn-score-hitbox" data-start-char="${start}" data-end-char="${stop}" x="`,
        )
        abc.out_sxsy(x, '" y="', y)
        abc.out_svg(
          `" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="#fff" fill-opacity="0.001" stroke="none" pointer-events="all"/>\n`,
        )
      },

      read_file: (_name: string) => null,
    }

    const abc = new _abc2svgModule.Abc(user)
    abc.tosvg('my_parameters', ABC2SVG_ZUPFNOTER_DEFAULTS)
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

    const stavesType = music_type_ids['staves']
    const spaceType = music_type_ids['space']

    const voices: AbcVoice[] = voice_tb.map((v) => {
      let symbols: AbcSymbol[] = AbcParser._collectSymbols(v.sym, source)

      // Drop SVG layout symbols (staff lines, spacing) that output_music() adds
      symbols = symbols.filter(s => s.type !== stavesType && s.type !== spaceType)

      // Strip trailing SVG artifacts: symbols appended after the last real bar.
      // output_music() appends bar/rest symbols with the same source position
      // as the preceding symbol. Walk backwards dropping trailing duplicates.
      while (symbols.length > 1) {
        const last = symbols[symbols.length - 1]
        const prev = symbols[symbols.length - 2]
        if (last === undefined || prev === undefined) {
          break
        }
        if (last.istart !== undefined && last.istart === prev.istart) {
          symbols = symbols.slice(0, -1)
        } else {
          break
        }
      }

      // Drop symbols whose istart already appeared earlier in the same voice.
      // output_music() duplicates section-internal symbols (clef/key changes)
      // when repeating sections. Each ABC source position maps to exactly one
      // symbol before output_music() runs.
      //
      // Bar symbols have two patterns after output_music():
      // 1. output_music() repositions bars to the preceding note's end time,
      //    changing their istart to match the note. These are real bars that
      //    exist in the callback — keep them.
      // 2. output_music() synthesizes new bars at measure boundaries where no
      //    bar exists in the callback. These are artifacts that share istart
      //    with the immediately preceding non-bar — drop them.
      //
      // Also drop artifact duplicate bars that share istart with OTHER BARS
      // (same bar from a repeated section).
      const barType = music_type_ids['bar']
      const seenIstarts = new Set<number>()
      const seenBarIstarts = new Set<number>()
      let lastNonBarIstart: number | undefined
      symbols = symbols.filter(s => {
        if (s.istart === undefined) return true
        if (s.type === barType) {
          if (s.istart === lastNonBarIstart) return false
          if (seenBarIstarts.has(s.istart)) return false
          seenBarIstarts.add(s.istart)
          return true
        }
        if (seenIstarts.has(s.istart)) return false
        seenIstarts.add(s.istart)
        lastNonBarIstart = s.istart
        return true
      })

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
