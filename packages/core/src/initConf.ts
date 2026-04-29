/**
 * initConf – Default-Konfiguration für Zupfnoter.
 *
 * Port von `InitConf.init_conf()` aus `init_conf.rb` (Legacy-System).
 * Liefert die vollständige Default-Konfiguration, die beim App-Start als
 * unterste Schicht auf den Confstack gepusht wird.
 *
 * Beat-Parameter (Legacy-kompatibel):
 *   BEAT_RESOLUTION=192, SHORTEST_NOTE=64, BEAT_PER_DURATION=3
 *   Y_SCALE=4; Layout rechnet wie Legacy mit Y_SCALE / BEAT_RESOLUTION.
 *
 * Initialisierungssequenz:
 *   const conf = new Confstack()
 *   conf.push(initConf(conf))   // Closures schließen über conf — lazy evaluation
 *   conf.push(songConfig)        // Layer 2: Song-JSON
 */

import type { ZupfnoterConfig } from '@zupfnoter/types'
import type { Confstack } from './Confstack.js'

// ---------------------------------------------------------------------------
// Hilfsfunktion: Saitennamen für Instrument-Presets
// ---------------------------------------------------------------------------

/**
 * Erzeugt Saitennamen-Text für ein Instrument.
 * Port von `cut_string_names()` aus `init_conf.rb`.
 */
function cutStringNames(strings: string[]): string {
  return strings.join('\n')
}

// ---------------------------------------------------------------------------
// initConf
// ---------------------------------------------------------------------------

/**
 * Erzeugt die vollständige Default-Konfiguration.
 * Entspricht `InitConf.init_conf()` in `init_conf.rb`.
 *
 * @param conf  Die Confstack-Instanz, über die Preset-Closures auflösen.
 *              Closures werden erst bei Zugriff ausgewertet (lazy).
 */
export function initConf(conf: Confstack): ZupfnoterConfig {
  return {
    layout: {
      // Ellipsen- und Pausengrößen
      ELLIPSE_SIZE: [3.5, 1.7],
      REST_SIZE: [4, 2],

      // Linienbreiten
      LINE_THIN: 0.1,
      LINE_MEDIUM: 0.3,
      LINE_THICK: 0.5,

      // Koordinatensystem
      Y_SCALE: 4,
      X_SPACING: 11.5,
      X_OFFSET: 2.8,
      PITCH_OFFSET: -43,
      DRAWING_AREA_SIZE: [400, 282],

      // Beat-Auflösung (Legacy-kompatibel)
      BEAT_RESOLUTION: 192,
      SHORTEST_NOTE: 64,
      BEAT_PER_DURATION: 3,

      // Ausgabe
      MM_PER_POINT: 0.3,

      // Farben
      color: {
        color_default: 'black',
        color_variant1: 'grey',
        color_variant2: 'dimgrey',
      },

      // Schriftstile
      FONT_STYLE_DEF: {
        bold:         { textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' },
        italic:       { textColor: [0, 0, 0], fontSize: 12, fontStyle: 'italic' },
        large:        { textColor: [0, 0, 0], fontSize: 20, fontStyle: 'bold' },
        regular:      { textColor: [0, 0, 0], fontSize: 12, fontStyle: 'normal' },
        small_bold:   { textColor: [0, 0, 0], fontSize: 9,  fontStyle: 'bold' },
        small_italic: { textColor: [0, 0, 0], fontSize: 9,  fontStyle: 'italic' },
        small:        { textColor: [0, 0, 0], fontSize: 9,  fontStyle: 'normal' },
        smaller:      { textColor: [0, 0, 0], fontSize: 6,  fontStyle: 'normal' },
      },

      // Notendauer → Darstellungsstil (SHORTEST_NOTE=64-Skala)
      // d64=ganze, d32=halbe, d16=viertel, d8=achtel, d4=16tel, d2=32tel, d1=64tel
      DURATION_TO_STYLE: {
        err: { sizeFactor: 2,    fill: 'filled', dotted: false },
        d96: { sizeFactor: 1,     fill: 'empty',  dotted: true  },
        d64: { sizeFactor: 1,     fill: 'empty',  dotted: false },
        d48: { sizeFactor: 0.75,  fill: 'empty',  dotted: true  },
        d32: { sizeFactor: 0.75,  fill: 'empty',  dotted: false },
        d24: { sizeFactor: 0.75,  fill: 'filled', dotted: true  },
        d16: { sizeFactor: 0.75,  fill: 'filled', dotted: false },
        d12: { sizeFactor: 0.5,  fill: 'filled', dotted: true  },
        d8:  { sizeFactor: 0.5,  fill: 'filled', dotted: false },
        d6:  { sizeFactor: 0.3,  fill: 'filled', dotted: true  },
        d4:  { sizeFactor: 0.3,  fill: 'filled', dotted: false },
        d3:  { sizeFactor: 0.1,  fill: 'filled', dotted: true  },
        d2:  { sizeFactor: 0.1,  fill: 'filled', dotted: false },
        d1:  { sizeFactor: 0.05, fill: 'filled', dotted: false },
      },

      // Pausendauer → Glyph-Stil (Werte aus Legacy init_conf.rb, NICHT harpnotes.rb)
      REST_TO_GLYPH: {
        err: { scale: [2,   2  ], glyphName: 'rest_1',  dotted: false },
        d96: { scale: [1,   0.8], glyphName: 'rest_1',  dotted: true  },
        d64: { scale: [1,   0.8], glyphName: 'rest_1',  dotted: false },
        d48: { scale: [0.5, 0.4], glyphName: 'rest_1',  dotted: true  },
        d32: { scale: [0.5, 0.4], glyphName: 'rest_1',  dotted: false },
        d24: { scale: [0.4, 0.75], glyphName: 'rest_4',  dotted: true  },
        d16: { scale: [0.4, 0.75], glyphName: 'rest_4',  dotted: false },
        d12: { scale: [0.4, 0.5], glyphName: 'rest_8',  dotted: true  },
        d8:  { scale: [0.4, 0.5], glyphName: 'rest_8',  dotted: false },
        d6:  { scale: [0.4, 0.3], glyphName: 'rest_16', dotted: true  },
        d4:  { scale: [0.3, 0.3], glyphName: 'rest_16', dotted: false },
        d3:  { scale: [0.3, 0.5], glyphName: 'rest_32', dotted: true  },
        d2:  { scale: [0.3, 0.5], glyphName: 'rest_32', dotted: false },
        d1:  { scale: [0.3, 0.5], glyphName: 'rest_64', dotted: false },
      },

      DECORATIIONS_AS_ANNOTATIONS: {
        '<(':          { text: 'cresc',       pos: [5, 0],   style: 'small_italic' },
        '<)':          { text: '/cresc',      pos: [5, 0],   style: 'small_italic' },
        '>(':          { text: 'dimin',       pos: [5, 0],   style: 'small_italic' },
        '>)':          { text: '/dimin',      pos: [5, 0],   style: 'small_italic' },
        arpeggio:      { text: 'arpeggio ',   pos: [-20, 0], style: 'small_italic' },
        coda:          { text: 'Coda',        pos: [0, -5],  style: 'bold', align: 'center', show: 'all' },
        'crescendo(':  { text: 'cresc',       pos: [5, 0],   style: 'small_italic' },
        'crescendo)':  { text: '/cresc',      pos: [5, 0],   style: 'small_italic' },
        'D.C.':        { text: 'D.C.',        pos: [5, 5],   style: 'bold' },
        'D.C.alfine':  { text: 'D.C. al Fine', pos: [5, 5],  style: 'bold' },
        'D.S.':        { text: 'D.S.',        pos: [5, 5],   style: 'bold' },
        dacapo:        { text: 'da Capo',     pos: [5, 5],   style: 'bold' },
        dacoda:        { text: 'da Coda',     pos: [5, 5],   style: 'bold' },
        dasegno:       { text: 'da Segno',    pos: [5, 5],   style: 'bold' },
        'diminuendo(': { text: 'dimin',       pos: [5, 0],   style: 'small_italic' },
        'diminuendo)': { text: '/dimin',      pos: [5, 0],   style: 'small_italic' },
        f:             { text: 'f',           pos: [3, 0],   style: 'small_italic' },
        ff:            { text: 'ff',          pos: [3, 0],   style: 'small_italic' },
        fff:           { text: 'fff',         pos: [3, 0],   style: 'small_italic' },
        ffff:          { text: 'ffff',        pos: [3, 0],   style: 'small_italic' },
        fine:          { text: 'Fine',        pos: [10, 5],  style: 'bold', align: 'center', show: 'all' },
        p:             { text: 'p',           pos: [3, 0],   style: 'small_italic' },
        pp:            { text: 'pp',          pos: [3, 0],   style: 'small_italic' },
        ppp:           { text: 'ppp',         pos: [3, 0],   style: 'small_italic' },
        pppp:          { text: 'pppp',        pos: [3, 0],   style: 'small_italic' },
        segno:         { text: 'Segno',       pos: [0, -5],  style: 'bold', align: 'center', show: 'all' },
      },

      // Instrument und Packer
      instrument: '37-strings-g-g',
      packer: {
        pack_method: 0,
        pack_max_spreadfactor: 2,
        pack_min_increment: 0.2,
      },
      limit_a3: true,
      grid: false,
      bottomup: false,
      jumpline_anchor: [3, 1],
      jumpline_vcut: 0,
    },

    extract: {
      '0': {
        title: 'alle Stimmen',
        startpos: 15,
        voices: [1, 2, 3, 4],
        synchlines: [[1, 2], [3, 4]],
        flowlines: [1, 3],
        subflowlines: [2, 4],
        jumplines: [1, 3],
        repeatsigns: {
          voices: [],
          left: { pos: [-7, -2], text: '|:', style: 'bold' },
          right: { pos: [5, -2], text: ':|', style: 'bold' },
        },
        layoutlines: [1, 2, 3, 4],
        legend: { spos: [320, 27], pos: [320, 7], tstyle: 'large', align: 'r', style: 'regular' },
        lyrics: {},
        nonflowrest: false,
        barnumbers: {
          voices: [],
          pos: [6, -4],
          autopos: true,
          apanchor: 'box',
          apbase: [1, 1],
          style: 'small_bold',
          prefix: '',
        },
        countnotes: {
          voices: [],
          pos: [3, -2],
          autopos: true,
          apbase: [1, -0.5],
          apanchor: 'box',
          style: 'smaller',
        },
        stringnames: {
          text: 'G G# A A# B C C# D D# E F F# G G# A A# B C C# D D# E F F# G G# A A# B C C# D D# E F F# G',
          vpos: [],
          style: 'small',
          marks: { vpos: [11], hpos: [43, 55, 79] },
        },
        notes: {},
        printer: {
          a3Offset: [0, 0],
          a4Offset: [-5, 0],
          a4Pages: [0, 1, 2],
          showBorder: false,
        },
      },
      '1': {
        title: 'Sopran, Alt',
        voices: [1, 2],
        flowlines: [1, 3],
        subflowlines: [2, 4],
        jumplines: [1, 3],
        synchlines: [[1, 2], [3, 4]],
        layoutlines: [1, 2, 3, 4],
        startpos: 15,
      },
      '2': {
        title: 'Tenor, Bass',
        voices: [3, 4],
        flowlines: [1, 3],
        subflowlines: [2, 4],
        jumplines: [1, 3],
        synchlines: [[1, 2], [3, 4]],
        layoutlines: [1, 2, 3, 4],
        startpos: 15,
      },
      '3': {
        title: 'Melodie',
        voices: [1],
        flowlines: [1, 3],
        subflowlines: [2, 4],
        jumplines: [1, 3],
        synchlines: [[1, 2], [3, 4]],
        layoutlines: [1, 2, 3, 4],
        startpos: 15,
      },
      '4': {
        title: 'Extract 4',
        voices: [1],
        flowlines: [1, 3],
        subflowlines: [2, 4],
        jumplines: [1, 3],
        synchlines: [[1, 2], [3, 4]],
        layoutlines: [1, 2, 3, 4],
        startpos: 15,
      },
      '5': {
        title: 'Extract 5',
        voices: [1],
        flowlines: [1, 3],
        subflowlines: [2, 4],
        jumplines: [1, 3],
        synchlines: [[1, 2], [3, 4]],
        layoutlines: [1, 2, 3, 4],
        startpos: 15,
      },
    },

    printer: {
      a3Offset: [0, 0],
      a4Offset: [-5, 0],
      a4Pages: [0, 1, 2],
      showBorder: false,
    },

    // -------------------------------------------------------------------------
    // Presets – Schnelleinstellungen für den Konfigurations-Editor (addconf)
    // Port von `presets` in `init_conf.rb`.
    // Closures über `conf` werden lazy ausgewertet (nach conf.push(songConfig)).
    // -------------------------------------------------------------------------
    presets: {
      layout: {
        notes_regular: {
          LINE_MEDIUM:  () => conf.get('extract.0.layout.LINE_MEDIUM'),
          LINE_THICK:   () => conf.get('extract.0.layout.LINE_THICK'),
          ELLIPSE_SIZE: () => conf.get('extract.0.layout.ELLIPSE_SIZE'),
          REST_SIZE:    () => conf.get('extract.0.layout.REST_SIZE'),
          beams: false,
        },
        notes_small: {
          LINE_MEDIUM:  0.1,
          LINE_THICK:   0.3,
          ELLIPSE_SIZE: [2.8, 1.4],
          REST_SIZE:    [3.2, 1.6],
          beams: false,
        },
        notes_large: {
          LINE_MEDIUM:  0.5,
          LINE_THICK:   0.7,
          ELLIPSE_SIZE: [4.2, 2.0],
          REST_SIZE:    [4.8, 2.4],
          beams: false,
        },
        packer_compact: {
          pack_method: 1,
          pack_max_spreadfactor: 1,
          pack_min_increment: 0.1,
        },
        packer_spread: {
          pack_method: 0,
          pack_max_spreadfactor: 3,
          pack_min_increment: 0.3,
        },
      },
      instrument: {
        '37-strings-g-g': {
          layout: {
            PITCH_OFFSET: () => conf.get('extract.0.layout.PITCH_OFFSET'),
            X_SPACING:    () => conf.get('extract.0.layout.X_SPACING'),
            X_OFFSET:     () => conf.get('extract.0.layout.X_OFFSET'),
          },
          stringnames: {
            text: () => cutStringNames([
              'G,', 'A,', 'B,', 'C', 'D', 'E', 'F', 'G', 'A', 'B',
              'c', 'd', 'e', 'f', 'g', 'a', 'b',
              "c'", "d'", "e'", "f'", "g'", "a'", "b'",
              "c''", "d''", "e''", "f''", "g''", "a''", "b''",
              "c'''", "d'''", "e'''", "f'''", "g'''", "a'''",
            ]),
          },
          printer: {
            a4_offset: () => conf.get('extract.0.printer.a4_offset'),
            a3_offset: () => conf.get('extract.0.printer.a3_offset'),
          },
        },
        '25-strings-g-g': {
          layout: {
            PITCH_OFFSET: -43,
            X_SPACING:    11.5,
            X_OFFSET:     2.8,
          },
          stringnames: {
            text: () => cutStringNames([
              'G,', 'A,', 'B,', 'C', 'D', 'E', 'F', 'G', 'A', 'B',
              'c', 'd', 'e', 'f', 'g', 'a', 'b',
              "c'", "d'", "e'", "f'", "g'", "a'", "b'", "c''",
            ]),
          },
        },
        '25-strings-G-g Bass': {
          layout: {
            PITCH_OFFSET: -55,
            X_SPACING:    11.5,
            X_OFFSET:     2.8,
          },
          stringnames: {
            text: () => cutStringNames([
              'G,,', 'A,,', 'B,,', 'C,', 'D,', 'E,', 'F,', 'G,', 'A,', 'B,',
              'C', 'D', 'E', 'F', 'G', 'A', 'B',
              'c', 'd', 'e', 'f', 'g', 'a', 'b', "c'",
            ]),
          },
        },
        '21-strings-a-f': {
          layout: {
            PITCH_OFFSET: -40,
            X_SPACING:    13.5,
            X_OFFSET:     2.8,
          },
          stringnames: {
            text: () => cutStringNames([
              'A,', 'B,', 'C', 'D', 'E', 'F', 'G', 'A', 'B',
              'c', 'd', 'e', 'f', 'g', 'a', 'b',
              "c'", "d'", "e'", "f'", "g'",
            ]),
          },
        },
        '18-strings-b-e': {
          layout: {
            PITCH_OFFSET: -38,
            X_SPACING:    15.5,
            X_OFFSET:     2.8,
          },
          stringnames: {
            text: () => cutStringNames([
              'B,', 'C', 'D', 'E', 'F', 'G', 'A', 'B',
              'c', 'd', 'e', 'f', 'g', 'a', 'b',
              "c'", "d'", "e'",
            ]),
          },
        },
        saitenspiel: {
          layout: {
            PITCH_OFFSET: -43,
            X_SPACING:    11.5,
            X_OFFSET:     2.8,
          },
          stringnames: {
            text: () => cutStringNames([
              'G,', 'A,', 'B,', 'C', 'D', 'E', 'F', 'G', 'A', 'B',
              'c', 'd', 'e', 'f', 'g', 'a', 'b',
              "c'", "d'", "e'", "f'", "g'", "a'", "b'",
              "c''", "d''", "e''", "f''", "g''", "a''", "b''",
              "c'''", "d'''", "e'''", "f'''", "g'''", "a'''",
            ]),
          },
        },
      },
      notes: {
        T02_copyright_music: {
          value: {
            pos:   [340, 251],
            text:  () => `© ${new Date().getFullYear()}\nPrivatkopie`,
            style: 'small',
          },
        },
        T03_copyright_harpnotes: {
          value: {
            pos:   [340, 260],
            text:  () => `© ${new Date().getFullYear()} Notenbild: zupfnoter.de`,
            style: 'small',
          },
        },
        T04_to_order: {
          value: {
            pos:   [340, 269],
            text:  () => 'Bereitgestellt von\n',
            style: 'small',
          },
        },
        T99_do_not_copy: {
          value: {
            pos:   [340, 278],
            text:  () => 'Bitte nicht kopieren',
            style: 'small',
          },
        },
      },
    },
  }
}
