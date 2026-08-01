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
import type { ExtractConfig } from '@zupfnoter/types'
import type { Confstack } from './Confstack.js'

// ---------------------------------------------------------------------------
// Hilfsfunktion: Saitennamen für Instrument-Presets
// ---------------------------------------------------------------------------

/**
 * Erzeugt Saitennamen-Text für ein Instrument.
 * Port von `cut_string_names()` aus `init_conf.rb`.
 */
function cutStringNames(stringNames: string, from: number, to: number): string {
  return stringNames
    .split(' ')
    .map((value, index) => (index >= from && index <= to ? value : '~'))
    .join(' ')
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
  const extract0 = {
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
    images: {},
    notebound: {
      minc: {},
    },
    sortmark: { size: [2, 4], fill: true, show: false },
    nonflowrest: false,
    tuplets: { text: '{{tuplet}}', style: 'small' },
    chords: {
      voices: [],
      pos: [3, -2],
      autopos: true,
      apbase: [1, -0.5],
      apanchor: 'box',
      style: 'large',
    },
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
      a3_offset: [0, 0],
      a4_offset: [-5, 0],
      a4_pages: [0, 1, 2],
      show_border: false,
    },
    layout: {
      limit_a3: true,
      bottomup: false,
      beams: false,
      jumpline_anchor: [3, 1],
      color: {
        color_default: 'black',
        color_variant1: 'grey',
        color_variant2: 'dimgrey',
      },
      LINE_THIN: 0.1,
      LINE_MEDIUM: 0.3,
      LINE_THICK: 0.5,
      PITCH_OFFSET: -43,
      X_SPACING: 11.5,
      X_OFFSET: 2.8,
      ELLIPSE_SIZE: [3.5, 1.7],
      REST_SIZE: [4, 2],
      DRAWING_AREA_SIZE: [400, 282],
      instrument: '37-strings-g-g',
      tuning: 'fixed',
      packer: {
        pack_method: 0,
        pack_max_spreadfactor: 2,
        pack_min_increment: 0.2,
      },
    },
  } as ExtractConfig
  const extract1 = {
    title: 'Sopran, Alt',
    voices: [1, 2],
  } as ExtractConfig
  const extract2 = {
    title: 'Tenor, Bass',
    voices: [3, 4],
  } as ExtractConfig
  const extract3 = {
    title: 'Melodie',
    voices: [1],
  } as ExtractConfig

  return {
    abc_parser: 'ABC2SVG',
    template: {
      filebase: '-no-template-',
      title: '- no template -',
    },
    neatjson: {
      wrap: 60,
      aligned: true,
      after_comma: 1,
      after_colon_1: 1,
      after_colon_n: 1,
      before_colon_n: 1,
      sorted: false,
      explicit_sort: {},
    },
    wrap: 60,
    produce: [0],
    restposition: {
      default: 'center',
      repeatstart: 'next',
      repeatend: 'default',
    },
    defaults: {
      notebound: {
        annotation: { pos: [5, -7] },
        chord: { pos: [0, 0] },
        partname: { pos: [-4, -7] },
        variantend: { pos: [-4, -7] },
        tuplet: {
          cp1: [5, 2],
          cp2: [5, -2],
          shape: ['c'],
          show: true,
        },
        flowline: {
          cp1: [0, 10],
          cp2: [0, -10],
          shape: ['c'],
          show: true,
        },
      },
    },
    annotations: {
      vl: { text: 'v', pos: [-5, -5] },
      vt: { text: 'v', pos: [-1, -5] },
      vb: { text: 'v', pos: [-1, 2] },
      vr: { text: 'v', pos: [2, -5] },
      rit: { text: 'rit', pos: [2, -5], style: 'italic' },
    },
    templates: {
      notes: { pos: [320, 6], text: 'ENTER_NOTE', style: 'large' },
      lyrics: { verses: [1], pos: [350, 70], style: 'regular' },
      images: { imagename: '', show: true, pos: [10, 10], height: 100 },
      tuplet: { cp1: [5, 2], cp2: [5, -2], shape: ['c'], show: true },
      annotations: { text: '_vorlage_', pos: [-5, -6] },
      extracts: {
        title: '',
        filenamepart: '-',
        notes: { T01_number_extract: { text: '{{extract_filename}}' } },
      },
    },
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
        bold:         { label: 'Fett', description: 'Text wird **fett** gesetzt.', textColor: [0, 0, 0], fontSize: 12, fontStyle: 'bold' },
        italic:       { label: 'Kursiv', description: 'Text wird *kursiv* gesetzt.', textColor: [0, 0, 0], fontSize: 12, fontStyle: 'italic' },
        large:        { label: 'Groß', description: 'Große, **fette** Schrift.', textColor: [0, 0, 0], fontSize: 20, fontStyle: 'bold' },
        regular:      { label: 'Standard', description: 'Normale Standardschrift.', textColor: [0, 0, 0], fontSize: 12, fontStyle: 'normal' },
        small_bold:   { label: 'Klein fett', description: 'Kleine, **fette** Schrift.', textColor: [0, 0, 0], fontSize: 9,  fontStyle: 'bold' },
        small_italic: { label: 'Klein kursiv', description: 'Kleine, *kursive* Schrift.', textColor: [0, 0, 0], fontSize: 9,  fontStyle: 'italic' },
        small:        { label: 'Klein', description: 'Kleine Standardschrift.', textColor: [0, 0, 0], fontSize: 9,  fontStyle: 'normal' },
        smaller:      { label: 'Sehr klein', description: 'Besonders kleine Standardschrift.', textColor: [0, 0, 0], fontSize: 6,  fontStyle: 'normal' },
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

      // Teil der vollständigen Default-Konfiguration; bei layout.beams=true
      // wird diese Tabelle später anstelle von DURATION_TO_STYLE verwendet.
      DURATION_TO_BEAMS: {
        err: [1, 'filled', false],
        d96: [1, 'empty', false],
        d64: [1, 'empty', false],
        d48: [1, 'empty', true, 0],
        d32: [1, 'empty', false, 0],
        d24: [1, 'filled', true, 0],
        d16: [1, 'filled', false, 0],
        d12: [1, 'filled', true, 1],
        d8:  [1, 'filled', false, 1],
        d6:  [1, 'filled', true, 2],
        d4:  [1, 'filled', false, 2],
        d3:  [1, 'filled', true, 3],
        d2:  [1, 'filled', false, 3],
        d1:  [1, 'filled', false, 4],
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
      SHOW_SLUR: false,
      bottomup: false,
      jumpline_anchor: [3, 1],
      jumpline_vcut: 0,
    },

    extract: {
      '0': extract0,
      '1': extract1,
      '2': extract2,
      '3': extract3,
    },

    printer: {
      a3_offset: [0, 0],
      a4_offset: [-5, 0],
      a4_pages: [0, 1, 2],
      show_border: false,
    },

    // -------------------------------------------------------------------------
    // Presets – Schnelleinstellungen für den Konfigurations-Editor (addconf)
    // Port von `presets` in `init_conf.rb`.
    // Closures über `conf` werden lazy ausgewertet (nach conf.push(songConfig)).
    // -------------------------------------------------------------------------
    presets: {
      barnumbers_countnotes: {
        anchor_at_box: {
          barnumbers: { apanchor: 'box', apbase: [1, 1] },
          countnotes: { apanchor: 'box', apbase: [1, -0.5] },
        },
        anchor_at_center: {
          barnumbers: { apanchor: 'center', apbase: [1, 0.3] },
          countnotes: { apanchor: 'center', apbase: [1, 0] },
        },
        countnotes_with_lyrics: {
          countnotes: {
            cntextleft: '{lyrics} {countnote}',
            cntextright: '{countnote} {lyrics}',
          },
        },
      },
      stdextract: {},
      layout: {
        notes_small: {
          LINE_MEDIUM: 0.2,
          LINE_THICK: 0.3,
          ELLIPSE_SIZE: [3.5, 1.3],
          REST_SIZE: [4, 1.5],
          beams: false,
        },
        notes_regular: {
          LINE_MEDIUM: () => conf.get('extract.0.layout.LINE_MEDIUM'),
          LINE_THICK: () => conf.get('extract.0.layout.LINE_THICK'),
          ELLIPSE_SIZE: () => conf.get('extract.0.layout.ELLIPSE_SIZE'),
          REST_SIZE: () => conf.get('extract.0.layout.REST_SIZE'),
          beams: false,
        },
        notes_large: {
          LINE_MEDIUM: 0.3,
          LINE_THICK: 0.7,
          ELLIPSE_SIZE: [4, 2],
          REST_SIZE: [4, 2],
          beams: false,
        },
        notes_with_beams: {
          LINE_THIN: 0.1,
          LINE_MEDIUM: 0.2,
          LINE_THICK: 0.5,
          ELLIPSE_SIZE: [1.3, 1],
          REST_SIZE: [2, 1.3],
          beams: true,
        },
        '-': {},
        packer_compact: {
          packer: {
            pack_method: 1,
            pack_max_spreadfactor: 2,
            pack_min_increment: 0.2,
          },
        },
        packer_regular: {
          packer: () => conf.get('extract.0.layout.packer'),
        },
        '--': {},
        color_on: {
          color: {
            color_default: 'black',
            color_variant1: 'grey',
            color_variant2: 'darkgrey',
          },
        },
        color_off: {
          color: {
            color_default: 'black',
            color_variant1: 'black',
            color_variant2: 'black',
          },
        },
        '---': {},
        jumpline_anchor_close: { jumpline_anchor: [3, 1] },
        jumpline_anchor_medium: { jumpline_anchor: [5, 1] },
        jumpline_anchor_wide: { jumpline_anchor: [10, 1] },
        jumpline_open: { jumpline_vcut: 3 },
        jumpline_close: { jumpline_vcut: 0 },
      },
      images: {
        player_qr: {
          player_qr: {
            imagename: '$player_qr',
            show: true,
            pos: [10, 10],
            height: 100,
          },
        },
      },
      instrument: {
        '37-strings-g-g': {
          layout: {
            instrument: '37-strings-g-g',
            tuning: 'fixed',
            limit_a3: true,
            beams: false,
            bottomup: false,
            PITCH_OFFSET: () => conf.get('extract.0.layout.PITCH_OFFSET'),
            X_SPACING: () => conf.get('extract.0.layout.X_SPACING'),
            X_OFFSET: () => conf.get('extract.0.layout.X_OFFSET'),
          },
          stringnames: {
            text: () => conf.get('extract.0.stringnames.text'),
            marks: { hpos: [43, 79] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [0, 1, 2],
            a4_offset: () => conf.get('extract.0.printer.a4_offset'),
            a3_offset: () => conf.get('extract.0.printer.a3_offset'),
          },
        },
        '25-strings-g-g': {
          layout: {
            instrument: '25-strings-g-g',
            tuning: 'fixed',
            limit_a3: false,
            beams: false,
            bottomup: false,
            PITCH_OFFSET: () => conf.get('extract.0.layout.PITCH_OFFSET'),
            X_SPACING: () => conf.get('extract.0.layout.X_SPACING'),
            X_OFFSET: () => conf.get('extract.0.layout.X_OFFSET'),
          },
          stringnames: {
            text: () => cutStringNames(String(conf.get('extract.0.stringnames.text')), 12, 36),
            marks: { hpos: [55, 79] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [1, 2],
            a3_offset: [-5, 0],
            a4_offset: () => conf.get('extract.0.printer.a4_offset'),
          },
        },
        '25-strings-G-g Bass': {
          layout: {
            instrument: '25-strings-g-g',
            tuning: 'fixed',
            limit_a3: false,
            beams: false,
            bottomup: false,
            PITCH_OFFSET: () => -31,
            X_SPACING: () => conf.get('extract.0.layout.X_SPACING'),
            X_OFFSET: () => conf.get('extract.0.layout.X_OFFSET'),
          },
          stringnames: {
            text: () => cutStringNames(String(conf.get('extract.0.stringnames.text')), 12, 36),
            marks: { hpos: [43, 67] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [1, 2],
            a3_offset: [-5, 0],
            a4_offset: () => conf.get('extract.0.printer.a4_offset'),
          },
        },
        '21-strings-a-f': {
          layout: {
            instrument: '21-strings-a-f',
            tuning: 'fixed',
            limit_a3: false,
            beams: false,
            bottomup: false,
            PITCH_OFFSET: () => conf.get('extract.0.layout.PITCH_OFFSET'),
            X_SPACING: () => conf.get('extract.0.layout.X_SPACING'),
            X_OFFSET: 23,
          },
          stringnames: {
            text: () => cutStringNames(String(conf.get('extract.0.stringnames.text')), 14, 34),
            marks: { hpos: [57, 77] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [1, 2],
            a3_offset: [-5, 0],
            a4_offset: () => conf.get('extract.0.printer.a4_offset'),
          },
        },
        '18-strings-b-e': {
          layout: {
            instrument: '18-strings-b-e',
            tuning: 'fixed',
            limit_a3: false,
            beams: false,
            bottomup: false,
            PITCH_OFFSET: () => conf.get('extract.0.layout.PITCH_OFFSET'),
            X_SPACING: () => conf.get('extract.0.layout.X_SPACING'),
            X_OFFSET: 28.5,
          },
          stringnames: {
            text: () => cutStringNames(String(conf.get('extract.0.stringnames.text')), 16, 33),
            marks: { hpos: [59, 76] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [2],
            a3_offset: [0, 0],
            a4_offset: [40, 0],
          },
        },
        '14-strings-b-d': {
          layout: {
            instrument: 'klein-a4',
            tuning: 'open',
            limit_a3: false,
            beams: false,
            bottomup: false,
            PITCH_OFFSET: 0,
            X_SPACING: 15,
            X_OFFSET: 0,
          },
          stringnames: {
            text: ' ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~ B c c# d e f f# g a a# b c\' c#\' d\' ~ ~',
            marks: { hpos: [71] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [2],
            a3_offset: [0, 0],
            a4_offset: [45, 0],
          },
        },
        'kleine Bauerharfe': {
          layout: {
            instrument: 'klein-a4',
            tuning: 'open',
            limit_a3: false,
            beams: false,
            bottomup: false,
            PITCH_OFFSET: 0,
            X_SPACING: 15,
            X_OFFSET: 70,
          },
          stringnames: {
            text: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ C D E F G A H c d e',
            marks: { hpos: [] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [2],
            a3_offset: [0, 0],
            a4_offset: [40, 0],
          },
        },
        saitenspiel: {
          layout: {
            instrument: 'saitenspiel',
            limit_a3: false,
            beams: false,
            bottomup: false,
            PITCH_OFFSET: -24,
            X_SPACING: 14.5,
            X_OFFSET: 240,
          },
          stringnames: {
            text: 'G C D E F G A B C D  ~ ~ ~ ~ ~ ~ ~',
            marks: { hpos: [55, 74] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [2],
            a3_offset: [0, 0],
            a4_offset: [35, 0],
          },
        },
        Zipino: {
          layout: {
            instrument: 'Zipino',
            limit_a3: true,
            beams: true,
            bottomup: false,
            PITCH_OFFSET: 0,
            X_SPACING: 12.5,
            X_OFFSET: 230,
            ELLIPSE_SIZE: [2, 2],
            REST_SIZE: [2, 2],
          },
          stringnames: {
            text: 'F# G A B C D E F# G A B C D E F# ~ ~ ~ ~ ~ ~  ~',
            marks: { hpos: [54] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [2],
            a3_offset: [0, 0],
            a4_offset: [35, 0],
          },
        },
        'Okon-Harfe': {
          layout: {
            instrument: 'okon-f',
            beams: true,
            bottomup: true,
            limit_a3: false,
            PITCH_OFFSET: 0,
            X_SPACING: 15,
            X_OFFSET: 50,
          },
          stringnames: {
            text: 'G, A, BB, C D E F G A BB c d e f g a bb c\' ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
            marks: { hpos: [55, 74] },
          },
          instrument_shape: null,
          printer: {
            a4_pages: [1, 2],
            a3_offset: [-35, 0],
            a4_offset: [70, 0],
          },
        },
        Akkordzither: {
          layout: {
            instrument: 'akkordzither',
            tuning: 'open',
            beams: true,
            bottomup: false,
            limit_a3: false,
            PITCH_OFFSET: 0,
            X_SPACING: 8.9,
            X_OFFSET: 140,
          },
          stringnames: {
            text: 'C C# D E F F# G G# A B C\' C#\' D\' E\' F\' F#\' G\' G#\' A\' B\' C\'\'  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ',
            marks: { hpos: [60] },
          },
          instrument_shape: '[["M", 228, 0], ["L",  335, 185], ["L", 335,297]]',
          printer: {
            a4_pages: [1, 2, 3],
            a3_offset: [0, 0],
            a4_offset: [108, 0],
          },
        },
      },
      notes: {
        T01_number: {
          value: {
            pos: [410, 17],
            text: 'XXX-{{number}}',
            style: 'bold',
            align: 'l',
          },
        },
        T01_number_extract: {
          value: {
            pos: [411, 17],
            text: '{{extract_filename}}',
            style: 'bold',
          },
        },
        T01_number_extract_value: {
          key: 'T01_number_extract',
          value: {
            text: '{{extract_filename}}',
          },
        },
        T02_copyright_music: {
          value: {
            pos: [340, 251],
            text: () => `© ${new Date().getFullYear()}\nPrivatkopie`,
            style: 'small',
          },
        },
        T03_copyright_harpnotes: {
          value: {
            pos: [340, 260],
            text: () => `© ${new Date().getFullYear()} Notenbild: zupfnoter.de`,
            style: 'small',
          },
        },
        T04_to_order: {
          value: {
            pos: [340, 242],
            text: () => 'Bereitgestellt von\n',
            style: 'small',
          },
        },
        T05_printed_extracts: {
          value: {
            pos: [410, 22],
            text: '{{printed_extracts}}',
            style: 'smaller',
            align: 'l',
          },
        },
        T06_legend: {
          value: {
            pos: [360, 30],
            text: '{{extract_title}}\n{{composer}}\nTakt: {{meter}} ({{tempo}})\nTonart: {{key}}',
            style: 'small',
          },
        },
        T99_do_not_copy: {
          value: {
            pos: [380, 284],
            text: () => 'Bitte nicht kopieren',
            style: 'small_bold',
          },
        },
        T01_T99: {
          value: {},
        },
      },
      printer: {
        printer_left: {
          printer: {
            a3_offset: [-10, 0],
            a4_offset: [-5, 0],
            show_border: false,
          },
          layout: { limit_a3: false },
        },
        printer_centric: {
          printer: {
            a3_offset: [0, 0],
            a4_offset: [5, 0],
            show_border: false,
          },
          layout: { limit_a3: true },
        },
        printer_right: {
          printer: {
            a3_offset: [10, 0],
            a4_offset: [5, 0],
            show_border: false,
          },
          layout: { limit_a3: false },
        },
      },
    },
  }
}
