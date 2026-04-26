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

import _abc2svgModule from '../vendor/abc2svg-browser.js'

// ---------------------------------------------------------------------------
// Minimal abc2svg type shims (not exported)
// ---------------------------------------------------------------------------

interface Abc2svgUser {
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
  slur_sls?: number[]
  slur_end?: number
  rbstart?: number
  rbstop?: number
  invisible?: boolean
  invis?: boolean
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
        this._model = AbcParser._buildModel(tsfirst, voice_tb, music_types, info)
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

  // ---------------------------------------------------------------------------
  // Private: build AbcModel from abc2svg callback arguments
  // ---------------------------------------------------------------------------

  private static _buildModel(
    _tsfirst: Abc2svgSymbol | null,
    voice_tb: Abc2svgVoice[],
    music_types: string[],
    info: Record<string, string>,
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
      const symbols: AbcSymbol[] = AbcParser._collectSymbols(v.sym)

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

    return { voices, music_types, music_type_ids, info }
  }

  /** Walk the linked-list of symbols in a voice and collect them into an array */
  private static _collectSymbols(first: Abc2svgSymbol | undefined): AbcSymbol[] {
    const result: AbcSymbol[] = []
    let sym: Abc2svgSymbol | undefined = first
    while (sym) {
      result.push(sym as unknown as AbcSymbol)
      sym = sym.next
    }
    return result
  }
}
