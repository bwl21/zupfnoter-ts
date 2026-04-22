/**
 * Internal types for the abc2svg data model.
 *
 * These types describe the structure delivered by abc2svg's `get_abcmodel`
 * callback. They are NOT part of the public API of @zupfnoter/core — only
 * AbcParser.ts may import this file.
 *
 * Reference: abc2svg-1.js, abc2svg.C constants and voice/symbol structure
 * from abc2svg_to_harpnotes.rb (legacy).
 */

// ---------------------------------------------------------------------------
// abc2svg type constants (from abc2svg.C)
// ---------------------------------------------------------------------------

export const ABC_TYPE = {
  BAR: 0,
  CLEF: 1,
  CUSTOS: 2,
  SM: 3,
  GRACE: 4,
  KEY: 5,
  METER: 6,
  MREST: 7,
  NOTE: 8,
  PART: 9,
  REST: 10,
  SPACE: 11,
  STAVES: 12,
  STBRK: 13,
  TEMPO: 14,
  BLOCK: 16,
  REMARK: 17,
} as const

export type AbcTypeValue = (typeof ABC_TYPE)[keyof typeof ABC_TYPE]

// ---------------------------------------------------------------------------
// Symbol-level types
// ---------------------------------------------------------------------------

export interface AbcNote {
  /** MIDI pitch (0–127) */
  midi: number
  /** Duration in abc2svg units (1536 = whole note) */
  dur: number
  [key: string]: unknown
}

export interface AbcExtra {
  type: number
  text?: string
  [key: string]: unknown
}

/**
 * A single symbol in a voice (note, rest, bar, part marker, etc.).
 * Corresponds to elements in voice.symbols[] from abc2svg.
 */
export interface AbcSymbol {
  /** Symbol type — matches ABC_TYPE constants */
  type: number
  /** Time position in abc2svg units */
  time: number
  /** Duration in abc2svg units (notes/rests only) */
  dur?: number
  /** Start offset in ABC source text */
  istart: number
  /** End offset in ABC source text */
  iend: number
  /** Notes array (single note: length 1, chord: length > 1) */
  notes?: AbcNote[]
  /** Bar type string e.g. '|', '||', '|:', ':|', ':|:' */
  bar_type?: string
  /** Text label (volta brackets, part names) */
  text?: string
  /** Tie start flag */
  ti1?: number
  /** Slur start IDs */
  slur_sls?: number[]
  /** Number of slurs ending here */
  slur_end?: number
  /** Volta bracket start (2 = new volta group) */
  rbstart?: number
  /** Volta bracket end (2 = end of volta) */
  rbstop?: number
  /** Symbol is invisible */
  invisible?: boolean
  invis?: boolean
  /** Extra elements (chord symbols, annotations) */
  extra?: AbcExtra[]
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Voice-level types
// ---------------------------------------------------------------------------

export interface AbcMeter {
  /** Total duration of one measure in abc2svg units */
  wmeasure: number
  a_meter: Array<{ bot: number; top: number }>
}

export interface AbcKey {
  /** Mode: 0=major, 1=dorian, 2=phrygian, 3=lydian, 4=mixolydian, 5=minor, 6=locrian */
  k_mode?: number
  /** Key signature: number of sharps (positive) or flats (negative) */
  k_sf?: number
}

export interface AbcVoiceProperties {
  id: string
  name?: string
  meter: AbcMeter
  key: AbcKey
  okey?: AbcKey
}

export interface AbcVoice {
  voice_properties: AbcVoiceProperties
  symbols: AbcSymbol[]
}

// ---------------------------------------------------------------------------
// Top-level model
// ---------------------------------------------------------------------------

/**
 * The complete abc2svg internal model, as delivered by the get_abcmodel callback.
 * tsfirst / voice_tb arguments are mapped into this structure by AbcParser.
 */
export interface AbcModel {
  voices: AbcVoice[]
  /**
   * Maps numeric type values to human-readable names.
   * Index matches ABC_TYPE constants.
   * e.g. music_types[8] === 'note'
   */
  music_types: string[]
  /** Reverse map: type name → numeric id */
  music_type_ids: Record<string, number>
  /** ABC header fields: T, C, M, K, Q, etc. (newline-separated if multiple) */
  info: Record<string, string>
}
