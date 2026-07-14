import { CONFIG_EDITOR_OPTION_DOCUMENTATION } from './generated/configEditorDocumentation.js'
import type { Markdown } from '@zupfnoter/types'

/**
 * Zentrale Schema-Quelle fuer die eingebettete `%%%%zupfnoter.config`.
 *
 * Diese Datei ist der erste TS-Port der Legacy-Rolle von `opal-ajv.rb`.
 * Sie beschreibt bewusst nur den fachlich kritischen Kern:
 *
 * - Top-Level-Bereiche
 * - offene `extract.<nr>`-Struktur
 * - Kernschluessel fuer `layout` und `printer`
 *
 * Die Vollportierung des Legacy-Schemas erfolgt schrittweise.
 */

type JsonSchemaType =
  | 'array'
  | 'boolean'
  | 'integer'
  | 'number'
  | 'object'
  | 'string'

export interface JsonSchemaNode {
  [key: string]: unknown
  $ref?: string
  $schema?: string
  additionalProperties?: boolean | JsonSchemaNode
  description?: string
  definitions?: Record<string, JsonSchemaNode>
  enforceRequired?: boolean
  enum?: readonly string[]
  items?: JsonSchemaNode | JsonSchemaNode[]
  minItems?: number
  patternProperties?: Record<string, JsonSchemaNode>
  properties?: Record<string, JsonSchemaNode>
  required?: readonly string[]
  requiredx?: readonly string[]
  ref?: string
  type?: JsonSchemaType | readonly JsonSchemaType[]
  uniqueItems?: boolean
  /** Nicht-validierende Metadaten für den Konfigurationseditor. */
  'x-zupfnoter-editor'?: ConfigEditorSchemaMetadata
}

/** Sichtbare Auswahl eines Konfigurationswerts im Editor. */
export interface ConfigEditorOption {
  /** Gespeicherter Konfigurationswert. */
  value: string
  /** Fachliche Beschriftung aus der User-Dokumentation. */
  label: string
  /** Kurzbeschreibung aus der User-Dokumentation. */
  description: Markdown
}

/** Darstellungsstrategie eines Konfigurationswerts im Editor. */
export type ConfigEditorStrategy = 'textarea' | 'json-modal' | 'voice-selector' | 'font-style-select'

/** Nicht-validierende UI-Metadaten eines Schemafelds. */
export interface ConfigEditorSchemaMetadata {
  /** Schlüssel des zugehörigen Hilfeabschnitts, falls Auswahlwerte dokumentiert sind. */
  helpKey?: string
  /** Statische, im Editor als Auswahl darzustellende Werte. */
  options?: readonly ConfigEditorOption[]
  /** Spezialisierte Bearbeitungsoberfläche für diesen Wert. */
  strategy?: ConfigEditorStrategy
}

export interface ConfigSchemaValidationOptions {
  enforceRequired?: boolean
}

export const ZUPFNOTER_CONFIG_SCHEMA_URI = 'https://zupfnoter.weichel21.de/schema/zupfnoter-config_1.0.json'
export const ZUPFNOTER_CONFIG_SCHEMA_DRAFT = 'http://json-schema.org/draft-04/schema#'
export const ZUPFNOTER_EXTRACT_KEY_PATTERN = '^\\d+$'

export const ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS = [
  'produce',
  'abc_parser',
  'restposition',
  'wrap',
  'defaults',
  'templates',
  'annotations',
  'extract',
  'layout',
  'neatjson',
] as const

export const ZUPFNOTER_EXTRACT_REQUIRED_KEYS = [
  'title',
  'filenamepart',
  'startpos',
  'voices',
  'synchlines',
  'flowlines',
  'subflowlines',
  'jumplines',
  'repeatsigns',
  'layoutlines',
  'legend',
  'lyrics',
  'layout',
  'nonflowrest',
  'notes',
  'barnumbers',
  'countnotes',
  'chords',
  'stringnames',
  'printer',
] as const

export const ZUPFNOTER_LAYOUT_CORE_KEYS = [
  'limit_a3',
  'beams',
  'bottomup',
  'jumpline_anchor',
  'jumpline_vcut',
  'LINE_THIN',
  'LINE_MEDIUM',
  'LINE_THICK',
  'PITCH_OFFSET',
  'X_SPACING',
  'X_OFFSET',
  'instrument',
  'tuning',
  'DRAWING_AREA_SIZE',
  'ELLIPSE_SIZE',
  'REST_SIZE',
  'grid',
  'color',
  'packer',
] as const

export const LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES = [
  'layout.LINE_THIN',
  'layout.LINE_MEDIUM',
  'layout.LINE_THICK',
  'layout.ELLIPSE_SIZE',
  'layout.REST_SIZE',
  'layout.limit_a3',
  'layout.DRAWING_AREA_SIZE',
  'layout.packer.pack_method',
  'layout.packer.pack_max_spreadfactor',
  'layout.packer.pack_min_increment',
  'layout.jumpline_anchor',
  'layout.jumpline_vcut',
  'layout.color.color_default',
  'layout.color.color_variant1',
  'layout.color.color_variant2',
  'layout.bottomup',
  'layout.beams',
] as const

export const LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES = [
  'layout.packer.pack_method',
  'layout.packer.pack_max_spreadfactor',
  'layout.packer.pack_min_increment',
] as const

export const ZUPFNOTER_PRINTER_REQUIRED_KEYS = [
  'a3_offset',
  'a4_offset',
  'show_border',
] as const

export const ZUPFNOTER_PRINTER_KEYS = [
  'a3_offset',
  'a4_offset',
  'a4_pages',
  'show_border',
] as const

export const LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES = [
  'printer.show_border',
  'printer.a3_offset',
  'printer.a4_offset',
  'printer.a4_pages',
] as const

export const LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES = [
  'barnumbers.voices',
  'barnumbers.pos',
  'barnumbers.autopos',
  'barnumbers.apanchor',
  'barnumbers.apbase',
  'barnumbers.style',
] as const

export const LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES = [
  'countnotes.voices',
  'countnotes.pos',
  'countnotes.autopos',
  'countnotes.apanchor',
  'countnotes.apbase',
  'countnotes.style',
  'countnotes.cntextleft',
  'countnotes.cntextright',
] as const

export const LEGACY_NOTES_EXTRACT_PATH_SUFFIXES = [
  'legend.pos',
  'legend.align',
  'legend.spos',
  'notes',
] as const

export const LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS = [
  'lyrics.*.verses',
  'lyrics.*.pos',
  'lyrics.*.style',
] as const

export const LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES = [
  'stringnames',
  'stringnames.text',
  'stringnames.vpos',
  'stringnames.marks.hpos',
  'stringnames.marks.vpos',
] as const

export const LEGACY_SELECTABLE_CONFIG_PATH_SEGMENTS = [
  'notebound',
  'notes',
  'annotations',
] as const

export const LEGACY_CONFIG_MENU_PATH_SEGMENTS = [
  'layout',
  'printer',
  'notebound',
  'notes',
  'lyrics',
  'stringnames',
  'annotations',
] as const

export type ConfigMenuKind =
  | 'default'
  | 'layout'
  | 'printer'
  | 'notebound'
  | 'notes'
  | 'lyrics'
  | 'stringnames'
  | 'annotations'

export interface ConfigPathActionProfile {
  canDelete: boolean
  canFill: boolean
  canSelect: boolean
  menuKind: ConfigMenuKind
}

const POSITION_SCHEMA: JsonSchemaNode = {
  type: 'array',
  minItems: 2,
  items: { type: 'number' },
}

const STRING_ARRAY_SCHEMA: JsonSchemaNode = {
  type: 'array',
  items: { type: 'string' },
}

const INTEGER_ARRAY_SCHEMA: JsonSchemaNode = {
  type: 'array',
  items: { type: 'integer' },
}

const NUMBER_ARRAY_SCHEMA: JsonSchemaNode = {
  type: 'array',
  items: { type: 'number' },
}

const NOTES_ENTRY_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ['pos', 'text', 'style'],
  additionalProperties: false,
  properties: {
    pos: POSITION_SCHEMA,
    text: multilineTextSchema(),
    style: fontStyleSchema(),
    align: { type: 'string', enum: ['l', 'r', 'auto'], ...editorSelection('align', ['l', 'r', 'auto']) },
  },
}

const ANNOTATED_BEZIER_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cp1: POSITION_SCHEMA,
    cp2: POSITION_SCHEMA,
    pos: POSITION_SCHEMA,
    shape: STRING_ARRAY_SCHEMA,
    show: { type: 'boolean' },
    style: fontStyleSchema(),
  },
}

const NOTEBOUND_TIMED_ENTRY_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pos: POSITION_SCHEMA,
    align: { type: 'string', enum: ['l', 'r', 'auto'] },
    show: { type: 'boolean' },
    text: multilineTextSchema(),
    style: fontStyleSchema(),
  },
}

const NOTEBOUND_NESTED_ENTRY_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pos: POSITION_SCHEMA,
    align: { type: 'string', enum: ['l', 'r', 'auto'] },
    show: { type: 'boolean' },
    text: multilineTextSchema(),
    style: fontStyleSchema(),
  },
  patternProperties: {
    '^\\d+$': NOTEBOUND_TIMED_ENTRY_SCHEMA,
  },
}

const NOTEBOUND_POS_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  patternProperties: {
    '^v_\\d+$': {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^(t_\\d+|\\d+)$': NOTEBOUND_NESTED_ENTRY_SCHEMA,
      },
    },
  },
}

const MINC_ENTRY_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    minc_f: { type: 'number' },
  },
}

const NCONF_ENTRY_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  patternProperties: {
    '^t_\\d+$': {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^n_\\d+$': {
          type: 'object',
          additionalProperties: false,
          properties: {
            nshift: { type: 'number' },
          },
        },
      },
    },
  },
}

const C_JUMPLINES_ENTRY_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    p_repeat: { type: 'number' },
    p_begin: { type: 'number' },
    p_end: { type: 'number' },
    p_follow: { type: 'number' },
  },
  patternProperties: {
    '^\\d+$': {
      type: 'object',
      additionalProperties: false,
      properties: {
        p_begin: { type: 'number' },
      },
    },
  },
}

const VOICE_INDEXED_BEZIER_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  patternProperties: {
    '^v_\\d+$': {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^\\d+$': ANNOTATED_BEZIER_SCHEMA,
      },
    },
  },
}

const TUPLET_VOICE_INDEXED_BEZIER_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  patternProperties: {
    '^v_\\d+$': {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^.+$': ANNOTATED_BEZIER_SCHEMA,
      },
    },
  },
}

const NOTEBOUND_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    annotation: NOTEBOUND_POS_SCHEMA,
    chord: NOTEBOUND_POS_SCHEMA,
    barnumber: NOTEBOUND_POS_SCHEMA,
    c_jumplines: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^v_\\d+$': {
          type: 'object',
          additionalProperties: false,
          patternProperties: {
            '^\\d+$': C_JUMPLINES_ENTRY_SCHEMA,
          },
        },
      },
    },
    countnote: NOTEBOUND_POS_SCHEMA,
    decoration: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^\\d+$': NOTEBOUND_POS_SCHEMA,
      },
    },
    flowline: VOICE_INDEXED_BEZIER_SCHEMA,
    minc: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^\\d+$': MINC_ENTRY_SCHEMA,
      },
    },
    nconf: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        '^v_\\d+$': NCONF_ENTRY_SCHEMA,
      },
    },
    partname: NOTEBOUND_POS_SCHEMA,
    repeat_begin: NOTEBOUND_POS_SCHEMA,
    repeat_end: NOTEBOUND_POS_SCHEMA,
    tuplet: TUPLET_VOICE_INDEXED_BEZIER_SCHEMA,
    variantend: NOTEBOUND_POS_SCHEMA,
  },
}

const POSITIONED_TEXT_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pos: POSITION_SCHEMA,
    text: multilineTextSchema(),
    style: fontStyleSchema(),
  },
}

const FONT_STYLE_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['textColor', 'fontSize', 'fontStyle'],
  properties: {
    label: { type: 'string' },
    description: { type: 'string' },
    textColor: {
      type: 'array',
      minItems: 3,
      items: { type: 'integer' },
    },
    fontSize: { type: 'number' },
    fontStyle: { type: 'string', enum: ['normal', 'bold', 'italic'] },
  },
}

const DURATION_STYLE_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['sizeFactor', 'fill', 'dotted'],
  properties: {
    sizeFactor: { type: 'number' },
    fill: { type: 'string', enum: ['filled', 'empty'] },
    dotted: { type: 'boolean' },
  },
}

const BEAM_STYLE_SCHEMA: JsonSchemaNode = {
  type: 'array',
  minItems: 3,
  items: {
    type: ['number', 'string', 'boolean'],
  },
}

const REST_STYLE_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['scale', 'glyphName', 'dotted'],
  properties: {
    scale: NUMBER_ARRAY_SCHEMA,
    glyphName: { type: 'string' },
    dotted: { type: 'boolean' },
  },
}

const DECORATION_ANNOTATION_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'pos', 'style'],
  properties: {
    text: multilineTextSchema(),
    pos: POSITION_SCHEMA,
    style: fontStyleSchema(),
    align: { type: 'string', enum: ['left', 'right', 'center'] },
    show: { type: 'string' },
  },
}

const REPEATSIGN_SIDE_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pos: POSITION_SCHEMA,
    text: multilineTextSchema(),
    style: fontStyleSchema(),
  },
}

const REPEATSIGNS_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    voices: INTEGER_ARRAY_SCHEMA,
    left: REPEATSIGN_SIDE_SCHEMA,
    right: REPEATSIGN_SIDE_SCHEMA,
  },
}

const IMAGE_ENTRY_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    imagename: { type: 'string' },
    show: { type: 'boolean' },
    pos: POSITION_SCHEMA,
    height: { type: 'number' },
  },
}

const SORTMARK_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    show: { type: 'boolean' },
    size: NUMBER_ARRAY_SCHEMA,
    fill: { type: 'boolean' },
  },
}

const STRINGNAMES_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: multilineTextSchema(),
    vpos: INTEGER_ARRAY_SCHEMA,
    style: fontStyleSchema(),
    marks: {
      type: 'object',
      additionalProperties: false,
      properties: {
        vpos: INTEGER_ARRAY_SCHEMA,
        hpos: INTEGER_ARRAY_SCHEMA,
      },
    },
  },
}

const BARNUMBERS_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    voices: INTEGER_ARRAY_SCHEMA,
    pos: POSITION_SCHEMA,
    autopos: { type: 'boolean' },
    apanchor: { type: 'string', enum: ['manual', 'box', 'center'], ...editorSelection('apanchor', ['box', 'center']) },
    apbase: POSITION_SCHEMA,
    style: fontStyleSchema(),
    prefix: { type: 'string' },
  },
}

const COUNTNOTES_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    voices: INTEGER_ARRAY_SCHEMA,
    pos: POSITION_SCHEMA,
    autopos: { type: 'boolean' },
    apanchor: { type: 'string', enum: ['manual', 'box', 'center'] },
    apbase: POSITION_SCHEMA,
    style: fontStyleSchema(),
    cntextleft: { type: 'string' },
    cntextright: { type: 'string' },
  },
}

const NB_ANNOTATION_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    voices: INTEGER_ARRAY_SCHEMA,
    pos: POSITION_SCHEMA,
    autopos: { type: 'boolean' },
    apanchor: { type: 'string', enum: ['manual', 'box', 'center'] },
    apbase: POSITION_SCHEMA,
    style: fontStyleSchema(),
  },
}

const LEGEND_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    spos: POSITION_SCHEMA,
    pos: POSITION_SCHEMA,
    tstyle: fontStyleSchema(),
    align: { type: 'string', enum: ['l', 'r', 'auto'], ...editorSelection('align', ['l', 'r', 'auto']) },
    style: fontStyleSchema(),
    salign: { type: 'string', enum: ['l', 'r', 'auto'] },
  },
}

const LYRICS_ENTRY_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verses: INTEGER_ARRAY_SCHEMA,
    pos: POSITION_SCHEMA,
    style: fontStyleSchema(),
  },
}

const DEFAULTS_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['notebound'],
  properties: {
    notebound: {
      type: 'object',
      additionalProperties: false,
      required: ['annotation', 'chord', 'partname', 'variantend', 'tuplet'],
      properties: {
        annotation: POSITIONED_TEXT_SCHEMA,
        chord: POSITIONED_TEXT_SCHEMA,
        partname: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pos: POSITION_SCHEMA,
            style: fontStyleSchema(),
            show: { type: 'boolean' },
          },
        },
        variantend: POSITIONED_TEXT_SCHEMA,
        tuplet: ANNOTATED_BEZIER_SCHEMA,
        flowline: ANNOTATED_BEZIER_SCHEMA,
      },
    },
  },
}

const TEMPLATES_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: true,
  required: ['notes', 'lyrics', 'tuplet', 'annotations'],
  properties: {
    notes: NOTES_ENTRY_SCHEMA,
    lyrics: LYRICS_ENTRY_SCHEMA,
    images: IMAGE_ENTRY_SCHEMA,
    tuplet: ANNOTATED_BEZIER_SCHEMA,
    annotations: POSITIONED_TEXT_SCHEMA,
    extracts: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        filenamepart: { type: 'string' },
        notes: {
          type: 'object',
          patternProperties: {
            '.*': {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
    },
  },
}

const ANNOTATIONS_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['vl', 'vt', 'vr'],
  patternProperties: {
    '.*': POSITIONED_TEXT_SCHEMA,
  },
}

const LAYOUT_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: [
    'grid',
    'limit_a3',
    'SHOW_SLUR',
    'LINE_THIN',
    'LINE_MEDIUM',
    'LINE_THICK',
    'ELLIPSE_SIZE',
    'REST_SIZE',
    'X_SPACING',
    'X_OFFSET',
    'Y_SCALE',
    'DRAWING_AREA_SIZE',
    'BEAT_RESOLUTION',
    'SHORTEST_NOTE',
    'BEAT_PER_DURATION',
    'PITCH_OFFSET',
    'FONT_STYLE_DEF',
    'MM_PER_POINT',
    'DURATION_TO_STYLE',
    'DURATION_TO_BEAMS',
    'REST_TO_GLYPH',
    'DECORATIIONS_AS_ANNOTATIONS',
    'instrument',
    'packer',
  ],
  properties: {
    limit_a3: { type: 'boolean' },
    beams: { type: 'boolean' },
    bottomup: { type: 'boolean' },
    jumpline_anchor: POSITION_SCHEMA,
    jumpline_vcut: { type: 'number' },
    LINE_THIN: { type: 'number' },
    LINE_MEDIUM: { type: 'number' },
    LINE_THICK: { type: 'number' },
    PITCH_OFFSET: { type: 'integer' },
    X_SPACING: { type: 'number' },
    X_OFFSET: { type: 'number' },
    instrument: { type: 'string', ...editorSelection('instrument', ['37-strings-g-g', '25-strings-g-g', '21-strings-a-f', '18-strings-b-e', 'saitenspiel', 'Zipino', 'okon-f', 'okon-g', 'okon-c', 'okon-d', 'akkordzither', 'klein-a4']) },
    tuning: { type: 'string', ...editorSelection('tuning', ['fixed', 'open']) },
    DRAWING_AREA_SIZE: NUMBER_ARRAY_SCHEMA,
    ELLIPSE_SIZE: NUMBER_ARRAY_SCHEMA,
    REST_SIZE: NUMBER_ARRAY_SCHEMA,
    grid: { type: 'boolean' },
    color: {
      type: 'object',
      additionalProperties: false,
      properties: {
        color_default: { type: 'string', ...editorSelection('layout.color', ['black', 'grey', 'darkgrey', 'dimgrey']) },
        color_variant1: { type: 'string', ...editorSelection('layout.color', ['black', 'grey', 'darkgrey', 'dimgrey']) },
        color_variant2: { type: 'string', ...editorSelection('layout.color', ['black', 'grey', 'darkgrey', 'dimgrey']) },
      },
    },
    packer: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pack_method: { type: 'integer' },
        pack_max_spreadfactor: { type: 'number' },
        pack_min_increment: { type: 'number' },
      },
    },
    SHOW_SLUR: { type: 'boolean' },
    Y_SCALE: { type: 'integer' },
    BEAT_RESOLUTION: { type: 'integer' },
    SHORTEST_NOTE: { type: 'integer' },
    BEAT_PER_DURATION: { type: 'integer' },
    MM_PER_POINT: { type: 'number' },
    FONT_STYLE_DEF: {
      type: 'object',
      patternProperties: {
        '.*': FONT_STYLE_SCHEMA,
      },
    },
    DURATION_TO_STYLE: {
      type: 'object',
      patternProperties: {
        '.*': DURATION_STYLE_SCHEMA,
      },
    },
    DURATION_TO_BEAMS: {
      type: 'object',
      patternProperties: {
        '.*': BEAM_STYLE_SCHEMA,
      },
    },
    REST_TO_GLYPH: {
      type: 'object',
      patternProperties: {
        '.*': REST_STYLE_SCHEMA,
      },
    },
    DECORATIIONS_AS_ANNOTATIONS: {
      type: 'object',
      patternProperties: {
        '.*': DECORATION_ANNOTATION_SCHEMA,
      },
    },
  },
}

const PRINTER_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ZUPFNOTER_PRINTER_REQUIRED_KEYS,
  additionalProperties: false,
  properties: {
    a3_offset: POSITION_SCHEMA,
    a4_offset: POSITION_SCHEMA,
    a4_pages: INTEGER_ARRAY_SCHEMA,
    show_border: { type: 'boolean' },
  },
}

const EXTRACT_SCHEMA: JsonSchemaNode = {
  type: 'object',
  enforceRequired: false,
  additionalProperties: true,
  required: ZUPFNOTER_EXTRACT_REQUIRED_KEYS,
  properties: {
    title: { type: 'string' },
    filenamepart: {},
    startpos: { type: 'integer' },
    voices: INTEGER_ARRAY_SCHEMA,
    synchlines: {
      type: 'array',
      items: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: { type: 'integer' },
      },
    },
    flowlines: INTEGER_ARRAY_SCHEMA,
    subflowlines: INTEGER_ARRAY_SCHEMA,
    jumplines: INTEGER_ARRAY_SCHEMA,
    layoutlines: INTEGER_ARRAY_SCHEMA,
    legend: {
      ...LEGEND_SCHEMA,
      enforceRequired: false,
      required: ['spos', 'pos'],
    },
    lyrics: {
      type: 'object',
      enforceRequired: false,
      patternProperties: {
        '.*': {
          ...LYRICS_ENTRY_SCHEMA,
          enforceRequired: false,
          required: ['verses', 'pos'],
        },
      },
    },
    layout: {
      ...LAYOUT_SCHEMA,
      enforceRequired: false,
    },
    nonflowrest: { type: 'boolean' },
    notes: {
      type: 'object',
      enforceRequired: false,
      patternProperties: {
        '.*': {
          ...NOTES_ENTRY_SCHEMA,
          enforceRequired: false,
        },
      },
    },
    repeatsigns: {
      ...REPEATSIGNS_SCHEMA,
      enforceRequired: false,
    },
    barnumbers: {
      ...BARNUMBERS_SCHEMA,
      enforceRequired: false,
    },
    countnotes: {
      ...COUNTNOTES_SCHEMA,
      enforceRequired: false,
    },
    chords: {
      ...NB_ANNOTATION_SCHEMA,
      enforceRequired: false,
    },
    tuplets: {
      type: 'object',
      enforceRequired: false,
      additionalProperties: false,
      properties: {
        text: multilineTextSchema(),
        style: fontStyleSchema(),
      },
    },
    stringnames: {
      ...STRINGNAMES_SCHEMA,
      enforceRequired: false,
    },
    instrument_shape: { type: 'string' },
    sortmark: {
      ...SORTMARK_SCHEMA,
      enforceRequired: false,
    },
    printer: {
      ...PRINTER_SCHEMA,
      enforceRequired: false,
    },
    images: {
      type: 'object',
      enforceRequired: false,
      patternProperties: {
        '^\\d+$': IMAGE_ENTRY_SCHEMA,
      },
    },
    notebound: NOTEBOUND_SCHEMA,
  },
}

function cloneSchemaNode(schema: JsonSchemaNode): JsonSchemaNode {
  return structuredClone(schema)
}

function cloneSchemaMap(schemaMap: Record<string, JsonSchemaNode>): Record<string, JsonSchemaNode> {
  return structuredClone(schemaMap)
}

function refTo(path: string): JsonSchemaNode {
  return { $ref: path }
}

function legacyPosRef(): JsonSchemaNode {
  return refTo('#/definitions/pos')
}

function legacyAlignRef(): JsonSchemaNode {
  return refTo('#/definitions/align')
}

function legacyApanchorRef(): JsonSchemaNode {
  return refTo('#/definitions/apanchor')
}

function multilineTextSchema(): JsonSchemaNode {
  return {
    type: 'string',
    'x-zupfnoter-editor': { strategy: 'textarea' },
  }
}

function fontStyleSchema(): JsonSchemaNode {
  return {
    type: 'string',
    'x-zupfnoter-editor': { strategy: 'font-style-select' },
  }
}

function editorSelection(helpKey: string, values: readonly string[]): Pick<JsonSchemaNode, 'x-zupfnoter-editor'> {
  const documentedOptions = CONFIG_EDITOR_OPTION_DOCUMENTATION[helpKey] ?? {}
  const findDocumentation = (value: string) => documentedOptions[value]
    ?? Object.entries(documentedOptions).find(([pattern]) => matchesDocumentedValuePattern(pattern, value))?.[1]
  const missingOptions = values.filter((value) => findDocumentation(value) === undefined)
  if (missingOptions.length > 0) {
    throw new Error(`Missing configuration help for ${helpKey}: ${missingOptions.join(', ')}`)
  }

  return {
    'x-zupfnoter-editor': {
      helpKey,
      options: values.map((value) => {
        const documentation = findDocumentation(value)
        if (documentation === undefined) {
          throw new Error(`Missing configuration help for ${helpKey}: ${value}`)
        }
        return { value, ...documentation }
      }),
    },
  }
}

function matchesDocumentedValuePattern(pattern: string, value: string): boolean {
  if (!pattern.includes('*')) return false
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')
  return new RegExp(`^${escapedPattern}$`).test(value)
}

function integerArraySchema(itemsSchema: JsonSchemaNode = { type: 'integer' }, minItems?: number): JsonSchemaNode {
  const schema: JsonSchemaNode = {
    type: 'array',
    uniqueItems: true,
    items: itemsSchema,
  }
  if (minItems !== undefined) schema.minItems = minItems
  return schema
}

function numberArraySchema(minItems?: number, itemType: JsonSchemaType = 'number'): JsonSchemaNode {
  const schema: JsonSchemaNode = {
    type: 'array',
    items: { type: itemType },
  }
  if (minItems !== undefined) schema.minItems = minItems
  return schema
}

function legacyNotesEntrySchema(): JsonSchemaNode {
  return {
    type: 'object',
    required: ['pos', 'text', 'style'],
    properties: {
      pos: legacyPosRef(),
      text: multilineTextSchema(),
      align: legacyAlignRef(),
      style: fontStyleSchema(),
    },
  }
}

function legacyPositionedTextSchema(required: readonly string[] = ['text', 'pos']): JsonSchemaNode {
  return {
    type: 'object',
    required,
    properties: {
      text: multilineTextSchema(),
      pos: legacyPosRef(),
      style: fontStyleSchema(),
    },
  }
}

function legacyAnnotatedBezierSchema(): JsonSchemaNode {
  return {
    type: 'object',
    properties: {
      cp1: legacyPosRef(),
      cp2: legacyPosRef(),
      pos: legacyPosRef(),
      shape: {
        type: 'array',
        minItems: 0,
        uniqueItems: true,
        items: { type: 'string' },
      },
      show: { type: 'boolean' },
      style: fontStyleSchema(),
    },
  }
}

function legacyNoteboundPosSchema(): JsonSchemaNode {
  const timedEntry: JsonSchemaNode = {
    type: 'object',
    additionalProperties: false,
    properties: {
      pos: legacyPosRef(),
      align: legacyAlignRef(),
      show: { type: 'boolean' },
      text: multilineTextSchema(),
      style: fontStyleSchema(),
    },
  }
  return {
    type: 'object',
    additionalProperties: false,
    patternProperties: {
      'v_d*': {
        type: 'object',
        additionalProperties: false,
        patternProperties: {
          't_\\d*|\\d*': {
            type: 'object',
            additionalProperties: false,
            properties: cloneSchemaMap(timedEntry.properties as Record<string, JsonSchemaNode>),
            patternProperties: {
              '\\d+': timedEntry,
            },
          },
        },
      },
    },
  }
}

function legacyExtractLayoutSchema(): JsonSchemaNode {
  return {
    type: 'object',
    requiredx: ['limit_a3', 'LINE_THIN', 'LINE_MEDIUM', 'LINE_THICK', 'ELLIPSE_SIZE', 'REST_SIZE', 'grid'],
    additionalProperties: false,
    properties: {
      limit_a3: { type: 'boolean' },
      beams: { type: 'boolean' },
      bottomup: { type: 'boolean' },
      jumpline_anchor: legacyPosRef(),
      jumpline_vcut: { type: 'number' },
      LINE_THIN: { type: 'number' },
      LINE_MEDIUM: { type: 'number' },
      LINE_THICK: { type: 'number' },
      PITCH_OFFSET: { type: 'integer' },
      X_SPACING: { type: 'number' },
      X_OFFSET: { type: 'number' },
      instrument: { type: 'string', ...editorSelection('instrument', ['37-strings-g-g', '25-strings-g-g', '21-strings-a-f', '18-strings-b-e', 'saitenspiel', 'Zipino', 'okon-f', 'okon-g', 'okon-c', 'okon-d', 'akkordzither', 'klein-a4']) },
      tuning: { type: 'string', ...editorSelection('tuning', ['fixed', 'open']) },
      DRAWING_AREA_SIZE: numberArraySchema(2),
      ELLIPSE_SIZE: numberArraySchema(2),
      REST_SIZE: numberArraySchema(2),
      grid: { type: 'boolean' },
      color: {
        type: 'object',
        properties: {
          color_default: { type: 'string', ...editorSelection('layout.color', ['black', 'grey', 'darkgrey', 'dimgrey']) },
          color_variant1: { type: 'string', ...editorSelection('layout.color', ['black', 'grey', 'darkgrey', 'dimgrey']) },
          color_variant2: { type: 'string', ...editorSelection('layout.color', ['black', 'grey', 'darkgrey', 'dimgrey']) },
        },
      },
      packer: {
        type: 'object',
        properties: {
          pack_method: { type: 'integer' },
          pack_max_spread_factor: { type: 'number' },
          pack_min_increment: { type: 'number' },
        },
      },
    },
  }
}

function legacyDefinitions(): Record<string, JsonSchemaNode> {
  return {
    apanchor: { type: 'string', enum: ['manual', 'box', 'center'] },
    pos: { type: 'array', minItems: 2, uniqueItems: false, items: { type: 'number' } },
    notes_entry: legacyNotesEntrySchema(),
    nb_annotation_xx: {
      type: 'object',
      required: ['voices', 'pos', 'autopos', 'style'],
      properties: {
        voices: integerArraySchema({}, 0),
        pos: legacyPosRef(),
        autopos: { type: 'boolean' },
        apanchor: legacyApanchorRef(),
        style: fontStyleSchema(),
      },
    },
    minc_entry: {
      type: 'object',
      required: ['minc_f'],
      additionalProperties: false,
      properties: { minc_f: { type: 'number' } },
    },
    nconf_entry: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        't_d*': {
          type: 'object',
          additionalProperties: false,
          patternProperties: {
            'n_d*': {
              type: 'object',
              additionalProperties: false,
              properties: { nshift: { type: 'number' } },
            },
          },
        },
      },
    },
    align: { type: 'string', enum: ['l', 'r', 'auto'], ...editorSelection('align', ['l', 'r', 'auto']) },
    notebound_pos: legacyNoteboundPosSchema(),
    notebound_repeat_outdated: {
      type: 'object',
      additionalProperties: false,
      patternProperties: {
        'v_d*': {
          text: 'integer',
          style: fontStyleSchema(),
          pos: legacyPosRef(),
        },
      },
    },
    annotated_bezier: legacyAnnotatedBezierSchema(),
    extract_layout: legacyExtractLayoutSchema(),
  }
}

function legacyDefaultsSchema(): JsonSchemaNode {
  return {
    type: 'object',
    required: ['notebound'],
    properties: {
      notebound: {
        type: 'object',
        required: ['annotation', 'partname', 'variantend', 'tuplet', 'chord'],
        properties: {
          annotation: {
            type: 'object',
            required: ['pos'],
            properties: { pos: legacyPosRef(), style: fontStyleSchema() },
          },
          chord: {
            type: 'object',
            required: ['pos'],
            properties: { pos: legacyPosRef(), style: fontStyleSchema() },
          },
          partname: {
            type: 'object',
            required: ['pos'],
            properties: { pos: legacyPosRef(), style: fontStyleSchema(), show: { type: 'boolean' } },
          },
          variantend: {
            type: 'object',
            required: ['pos'],
            properties: { pos: legacyPosRef(), style: fontStyleSchema() },
          },
          tuplet: { $ref: '#/definitions/annotated_bezier', required: ['cp1', 'cp2', 'shape'] },
        },
      },
    },
  }
}

function legacyTemplatesSchema(): JsonSchemaNode {
  return {
    type: 'object',
    required: ['notes', 'lyrics', 'tuplet', 'annotations'],
    properties: {
      notes: refTo('#/definitions/notes_entry'),
      lyrics: {
        type: 'object',
        required: ['verses', 'pos'],
        properties: {
          verses: integerArraySchema({ type: 'integer' }, 1),
          pos: legacyPosRef(),
          style: fontStyleSchema(),
        },
      },
      tuplet: {
        type: 'object',
        required: ['cp1', 'cp2', 'shape'],
        properties: {
          cp1: legacyPosRef(),
          cp2: legacyPosRef(),
          shape: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } },
        },
      },
      annotations: legacyPositionedTextSchema(),
    },
  }
}

function legacyAnnotationsSchema(): JsonSchemaNode {
  return {
    type: 'object',
    required: ['vl', 'vt', 'vr'],
    properties: {
      vl: { type: 'object', required: ['text', 'pos'], properties: { text: multilineTextSchema(), pos: legacyPosRef() } },
      vt: { type: 'object', required: ['text', 'pos'], properties: { text: multilineTextSchema(), pos: legacyPosRef() } },
      vr: { type: 'object', required: ['text', 'pos'], properties: { text: multilineTextSchema(), pos: legacyPosRef() } },
    },
  }
}

function legacyExtractPatternSchema(): JsonSchemaNode {
  return {
    type: 'object',
    additionalProperties: false,
    requiredx: [
      'title', 'filenamepart', 'startpos', 'voices', 'synchlines', 'flowlines', 'subflowlines',
      'jumplines', 'repeatsigns', 'layoutlines', 'legend', 'lyrics', 'layout', 'nonflowrest',
      'notes', 'barnumbers', 'countnotes', 'chords', 'stringnames', 'printer',
    ],
    properties: {
      title: { type: 'string' },
      filenamepart: {},
      startpos: { type: 'integer' },
      voices: integerArraySchema({ type: 'integer' }, 1),
      synchlines: {
        type: 'array',
        minItems: 0,
        uniqueItems: true,
        items: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'integer' } },
      },
      flowlines: integerArraySchema({ type: 'integer' }, 1),
      subflowlines: integerArraySchema({ type: 'integer' }, 1),
      jumplines: integerArraySchema({ type: 'integer' }, 1),
      repeatsigns: {
        type: 'object',
        requiredx: ['voices', 'left', 'right'],
        properties: {
          voices: integerArraySchema({}, 0),
          left: { type: 'object', required: ['pos', 'text', 'style'], properties: { pos: legacyPosRef(), text: multilineTextSchema(), style: fontStyleSchema() } },
          right: { type: 'object', required: ['pos', 'text', 'style'], properties: { pos: legacyPosRef(), text: multilineTextSchema(), style: fontStyleSchema() } },
        },
      },
      layoutlines: integerArraySchema({ type: 'integer' }, 0),
      legend: {
        type: 'object',
        required: ['spos', 'pos'],
        properties: { spos: legacyPosRef(), pos: legacyPosRef(), tstyle: fontStyleSchema(), align: legacyAlignRef(), style: fontStyleSchema(), salign: legacyAlignRef() },
      },
      lyrics: { type: 'object', patternProperties: { '.*': { type: 'object', required: ['verses', 'pos'] } } },
      layout: refTo('#/definitions/extract_layout'),
      nonflowrest: { type: 'boolean' },
      notes: { patternProperties: { '.*': refTo('#/definitions/notes_entry') } },
      notebound: {
        type: 'object',
        additionalProperties: false,
        properties: {
          annotation: refTo('#/definitions/notebound_pos'),
          chord: refTo('#/definitions/notebound_pos'),
          barnumber: { $ref: '#/definitions/notebound_pos', align: legacyAlignRef() },
          c_jumplines: { type: 'object', additionalProperties: false, patternProperties: { 'v_d*': { p_repeat: { type: 'number' }, p_begin: { type: 'number' }, p_end: { type: 'number' }, p_follow: { type: 'number' } } } },
          countnote: refTo('#/definitions/notebound_pos'),
          decoration: { type: 'object', patternProperties: { 'd+': refTo('#/definitions/notebound_pos') } },
          flowline: { type: 'object', patternProperties: { 'v_d+': { type: 'object', patternProperties: { 'd*': refTo('#/definitions/annotated_bezier') } } } },
          minc: { type: 'object', additionalProperties: false, patternProperties: { 'd*': refTo('#/definitions/minc_entry') } },
          nconf: { type: 'object', additionalProperties: false, patternProperties: { 'v_d*': refTo('#/definitions/nconf_entry') } },
          partname: refTo('#/definitions/notebound_pos'),
          repeat_begin: refTo('#/definitions/notebound_pos'),
          repeat_end: refTo('#/definitions/notebound_pos'),
          tuplet: { type: 'object', patternProperties: { 'v_d*': { type: 'object', patternProperties: { 'd*': refTo('#/definitions/annotated_bezier') } } } },
          variantend: refTo('#/definitions/notebound_pos'),
        },
      },
      tuplets: { type: 'object', properties: { text: multilineTextSchema() } },
      barnumbers: {
        type: 'object',
        required: ['voices', 'pos', 'autopos', 'style', 'prefix'],
        properties: { voices: integerArraySchema({}, 0), pos: legacyPosRef(), autopos: { type: 'boolean' }, apanchor: legacyApanchorRef(), style: fontStyleSchema(), prefix: { type: 'string' } },
      },
      countnotes: {
        type: 'object',
        required: ['voices', 'pos', 'autopos', 'style'],
        properties: { voices: integerArraySchema({}, 0), pos: legacyPosRef(), autopos: { type: 'boolean' }, apanchor: legacyApanchorRef(), style: fontStyleSchema() },
        cntextleft: { type: 'string' },
        cntextright: { type: 'string' },
      },
      chords: { ref: '#/definitions/nb_annotations', style: fontStyleSchema() },
      stringnames: {
        type: 'object',
        required: ['text', 'vpos', 'style', 'marks'],
        properties: {
          text: multilineTextSchema(),
          vpos: integerArraySchema({ type: 'integer' }, 0),
          style: fontStyleSchema(),
          marks: { type: 'object', required: ['vpos', 'hpos'], properties: { vpos: integerArraySchema({ type: 'integer' }, 0), hpos: integerArraySchema({ type: 'integer' }, 0) } },
        },
      },
      instrument_shape: { type: 'string' },
      sortmark: { type: 'object', properties: { show: { type: 'boolean' } } },
      printer: {
        type: 'object',
        required: ['a3_offset', 'a4_offset', 'show_border'],
        properties: {
          a3_offset: { type: 'array', minItems: 2, axItems: 2, uniqueItems: false, items: { type: 'integer' } },
          a4_offset: { type: 'array', minItems: 2, uniqueItems: false, items: { type: 'integer' } },
          show_border: { type: 'boolean' },
        },
      },
      images: { type: 'object', patternProperties: { 'd*': { type: 'object', properties: { imagename: { type: 'string' }, show: { type: 'boolean' }, pos: legacyPosRef(), height: { type: 'number' } } } } },
    },
  }
}

function legacyRootLayoutSchema(): JsonSchemaNode {
  return {
    type: 'object',
    required: ['grid', 'limit_a3', 'SHOW_SLUR', 'LINE_THIN', 'LINE_MEDIUM', 'LINE_THICK', 'ELLIPSE_SIZE', 'REST_SIZE', 'X_SPACING', 'X_OFFSET', 'Y_SCALE', 'DRAWING_AREA_SIZE', 'BEAT_RESOLUTION', 'SHORTEST_NOTE', 'BEAT_PER_DURATION', 'PITCH_OFFSET', 'FONT_STYLE_DEF', 'MM_PER_POINT', 'DURATION_TO_STYLE', 'REST_TO_GLYPH'],
    properties: {
      grid: { type: 'boolean' },
      limit_a3: { type: 'boolean' },
      SHOW_SLUR: { type: 'boolean' },
      LINE_THIN: { type: 'number' },
      LINE_MEDIUM: { type: 'number' },
      LINE_THICK: { type: 'number' },
      ELLIPSE_SIZE: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'number' } },
      REST_SIZE: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'number' } },
      X_SPACING: { type: 'number' },
      X_OFFSET: { type: 'number' },
      Y_SCALE: { type: 'integer' },
      DRAWING_AREA_SIZE: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'integer' } },
      BEAT_RESOLUTION: { type: 'integer' },
      SHORTEST_NOTE: { type: 'integer' },
      BEAT_PER_DURATION: { type: 'integer' },
      PITCH_OFFSET: { type: 'integer' },
      FONT_STYLE_DEF: {
        type: 'object',
        required: ['bold', 'italic', 'large', 'regular', 'small_bold', 'small_italic', 'small', 'smaller'],
        patternProperties: {
          '.*': {
            type: 'object',
            required: ['text_color', 'font_size', 'font_style'],
            properties: {
              label: { type: 'string' },
              description: { type: 'string' },
              text_color: { type: 'array', minItems: 3, uniqueItems: false, items: { type: 'integer' } },
              font_size: { type: 'integer' },
              font_style: { type: 'string' },
            },
          },
        },
      },
      MM_PER_POINT: { type: 'number' },
      DURATION_TO_STYLE: {
        type: 'object',
        required: ['err', 'd64', 'd48', 'd32', 'd24', 'd16', 'd12', 'd8', 'd6', 'd4', 'd3', 'd2', 'd1'],
        patternProperties: { '.*': { type: 'array', minItems: 3, uniqueItems: false, items: { type: ['number', 'string', 'boolean'] } } },
      },
      REST_TO_GLYPH: {
        type: 'object',
        patternProperties: {
          '.*': {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: [
              { type: 'array', minItems: 1, uniqueItems: false, items: { type: 'number' } },
              { type: 'string' },
              { type: 'boolean' },
            ],
          },
        },
      },
    },
  }
}

function legacyNeatjsonSchema(): JsonSchemaNode {
  return {
    type: 'object',
    required: ['wrap', 'aligned', 'after_comma', 'after_colon_1', 'after_colon_n', 'before_colon_n', 'explicit_sort'],
    properties: {
      wrap: { type: 'integer' },
      aligned: { type: 'boolean' },
      after_comma: { type: 'integer' },
      after_colon_1: { type: 'integer' },
      after_colon_n: { type: 'integer' },
      before_colon_n: { type: 'integer' },
      sorted: { type: 'boolean' },
      explicit_sort: { type: 'object' },
    },
  }
}

export function buildConfigSchemaOverview(): JsonSchemaNode {
  return {
    $schema: ZUPFNOTER_CONFIG_SCHEMA_DRAFT,
    description: 'Generated from x.json with shasum 0b1781e0803dc084178858e9fbe2b4e0b65c08e7',
    type: 'object',
    required: ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS,
    definitions: legacyDefinitions(),
    properties: {
      confstack: { type: 'object', required: ['env'], properties: { env: { type: 'string' } } },
      produce: integerArraySchema({ type: 'integer' }, 0),
      template: { type: 'object', additionalProperties: false, properties: { filebase: { type: 'string' }, title: { type: 'string' } } },
      abc_parser: { type: 'string' },
      restposition: {
        type: 'object',
        additionalProperties: false,
        required: ['default', 'repeatstart', 'repeatend'],
        properties: {
          default: { type: 'string', ...editorSelection('restposition', ['center', 'next', 'previous', 'default']) },
          repeatstart: { type: 'string', ...editorSelection('restposition', ['center', 'next', 'previous', 'default']) },
          repeatend: { type: 'string', ...editorSelection('restposition', ['center', 'next', 'previous', 'default']) },
        },
      },
      wrap: { type: 'integer' },
      defaults: legacyDefaultsSchema(),
      templates: legacyTemplatesSchema(),
      annotations: legacyAnnotationsSchema(),
      extract: {
        type: 'object',
        patternProperties: {
          'd*': legacyExtractPatternSchema(),
          '4': { type: 'object', required: ['title', 'voices'], properties: { title: { type: 'string' }, filenamepart: {}, voices: integerArraySchema({ type: 'integer' }, 1) } },
          '5': { type: 'object', required: ['title', 'voices'], properties: { title: { type: 'string' }, filenamepart: {}, voices: integerArraySchema({ type: 'integer' }, 1) } },
        },
      },
      layout: legacyRootLayoutSchema(),
      neatjson: legacyNeatjsonSchema(),
    },
  }
}

export const ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW: JsonSchemaNode = buildConfigSchemaOverview()
const VALIDATION_SCHEMA_OVERVIEW: JsonSchemaNode = buildValidationSchemaOverview(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW)

export function getConfigSchemaOverview(): JsonSchemaNode {
  return ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW
}

/** Resolves a concrete path through schema properties, legacy patterns, references and arrays. */
export function resolveConfigSchemaPath(path: string): JsonSchemaNode | undefined {
  let current: JsonSchemaNode = ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW

  for (const segment of path.split('.')) {
    current = resolveSchemaNodeReference(current, ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW)
    if (current.type === 'array' && /^\d+$/.test(segment)) {
      if (!isSchemaNode(current.items)) return undefined
      current = current.items
      continue
    }

    const directSchema = current.properties?.[segment]
    if (directSchema !== undefined) {
      current = directSchema
      continue
    }

    const patternSchema = current.patternProperties === undefined
      ? undefined
      : findPatternSchema(segment, current.patternProperties)
    if (patternSchema === undefined) return undefined
    current = patternSchema
  }

  return resolveSchemaNodeReference(current, ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW)
}

function buildValidationSchemaOverview(schema: JsonSchemaNode): JsonSchemaNode {
  return normalizeSchemaNodeForValidation(schema, schema)
}

function normalizeSchemaNodeForValidation(
  schema: JsonSchemaNode,
  rootSchema: JsonSchemaNode,
): JsonSchemaNode {
  const resolvedSchema = resolveSchemaNodeReference(schema, rootSchema)
  const normalized: JsonSchemaNode = {}

  for (const [key, value] of Object.entries(resolvedSchema)) {
    if (key === '$ref' || key === 'ref' || key === 'definitions') {
      continue
    }

    if (key === 'properties' && isPlainObject(value)) {
      normalized.properties = normalizeSchemaPropertyMapForValidation(value, rootSchema)
      continue
    }

    if (key === 'patternProperties' && isPlainObject(value)) {
      normalized.patternProperties = normalizeSchemaPatternMapForValidation(value, rootSchema)
      continue
    }

    if (key === 'items') {
      if (Array.isArray(value)) {
        normalized.items = value.map((item) => (
          isSchemaNode(item) ? normalizeSchemaNodeForValidation(item, rootSchema) : item
        ))
        continue
      }
      if (isSchemaNode(value)) {
        normalized.items = normalizeSchemaNodeForValidation(value, rootSchema)
        continue
      }
    }

    if (key === 'additionalProperties' && isSchemaNode(value)) {
      normalized.additionalProperties = normalizeSchemaNodeForValidation(value, rootSchema)
      continue
    }

    normalized[key] = value
  }

  return normalized
}

function normalizeSchemaPropertyMapForValidation(
  schemaMap: Record<string, unknown>,
  rootSchema: JsonSchemaNode,
): Record<string, JsonSchemaNode> {
  return Object.fromEntries(
    Object.entries(schemaMap).map(([propertyKey, propertySchema]) => [
      propertyKey,
      isSchemaNode(propertySchema)
        ? normalizeSchemaNodeForValidation(propertySchema, rootSchema)
        : {},
    ]),
  ) as Record<string, JsonSchemaNode>
}

function normalizeSchemaPatternMapForValidation(
  schemaMap: Record<string, unknown>,
  rootSchema: JsonSchemaNode,
): Record<string, JsonSchemaNode> {
  return Object.fromEntries(
    Object.entries(schemaMap).map(([pattern, patternSchema]) => [
      normalizeLegacyPattern(pattern),
      isSchemaNode(patternSchema)
        ? normalizeSchemaNodeForValidation(patternSchema, rootSchema)
        : {},
    ]),
  ) as Record<string, JsonSchemaNode>
}

function resolveSchemaNodeReference(
  schema: JsonSchemaNode,
  rootSchema: JsonSchemaNode,
): JsonSchemaNode {
  const refPath = typeof schema.$ref === 'string'
    ? schema.$ref
    : typeof schema.ref === 'string'
      ? schema.ref
      : undefined

  if (refPath === undefined) {
    return schema
  }

  const referencedSchema = readSchemaReference(rootSchema, refPath)
  if (referencedSchema === undefined) {
    return schema
  }

  const resolvedReference = resolveSchemaNodeReference(referencedSchema, rootSchema)
  const { $ref: _ref, ref: _legacyRef, ...schemaOverrides } = schema

  return mergeSchemaNodes(resolvedReference, schemaOverrides)
}

function readSchemaReference(
  rootSchema: JsonSchemaNode,
  refPath: string,
): JsonSchemaNode | undefined {
  if (!refPath.startsWith('#/')) {
    return undefined
  }

  const pathSegments = refPath.slice(2).split('/')
  let current: unknown = rootSchema

  for (const segment of pathSegments) {
    if (!isPlainObject(current) || !(segment in current)) {
      return undefined
    }
    current = current[segment]
  }

  return isSchemaNode(current) ? current : undefined
}

function mergeSchemaNodes(
  baseSchema: JsonSchemaNode,
  overrideSchema: JsonSchemaNode,
): JsonSchemaNode {
  const mergedSchema: JsonSchemaNode = {
    ...baseSchema,
    ...overrideSchema,
  }

  if (baseSchema.properties !== undefined || overrideSchema.properties !== undefined) {
    mergedSchema.properties = {
      ...(baseSchema.properties ?? {}),
      ...(overrideSchema.properties ?? {}),
    }
  }

  if (baseSchema.patternProperties !== undefined || overrideSchema.patternProperties !== undefined) {
    mergedSchema.patternProperties = {
      ...(baseSchema.patternProperties ?? {}),
      ...(overrideSchema.patternProperties ?? {}),
    }
  }

  if (overrideSchema.additionalProperties === undefined) {
    mergedSchema.additionalProperties = baseSchema.additionalProperties
  }

  return mergedSchema
}

function normalizeLegacyPattern(pattern: string): string {
  if (pattern === 'd*' || pattern === 'd+') {
    return '^\\d+$'
  }

  if (pattern === 'v_d*' || pattern === 'v_d+') {
    return '^v_\\d+$'
  }

  return pattern
}

export function isLegacyTopLevelConfigKey(key: string): boolean {
  return ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS.includes(
    key as (typeof ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS)[number],
  )
}

export function toExtractConfigPath(
  suffix: string,
  extractPlaceholder = '{extract}',
): string {
  return `extract.${extractPlaceholder}.${suffix}`
}

export function hasConfigPathSegment(path: string, segment: string): boolean {
  return path.split('.').includes(segment)
}

export function isSelectableConfigPath(path: string | undefined): boolean {
  if (path === undefined) return false
  return LEGACY_SELECTABLE_CONFIG_PATH_SEGMENTS.some((segment) => hasConfigPathSegment(path, segment))
}

export function getConfigMenuKind(path: string | undefined): ConfigMenuKind {
  if (path === undefined) return 'default'

  for (const segment of LEGACY_CONFIG_MENU_PATH_SEGMENTS) {
    if (!hasConfigPathSegment(path, segment)) continue
    switch (segment) {
      case 'layout':
      case 'printer':
      case 'notebound':
      case 'notes':
      case 'lyrics':
      case 'stringnames':
      case 'annotations':
        return segment
    }
  }

  return 'default'
}

export function getConfigPathActionProfile(
  path: string | undefined,
  options: {
    hasEffectiveValue: boolean
    hasLocalValue: boolean
    isLeaf: boolean
  },
): ConfigPathActionProfile {
  return {
    canDelete: path !== undefined && options.hasLocalValue,
    canFill: path !== undefined && !options.hasLocalValue && options.hasEffectiveValue,
    canSelect: isSelectableConfigPath(path),
    menuKind: getConfigMenuKind(path),
  }
}

export function validateZupfnoterConfigShape(
  config: unknown,
  options: ConfigSchemaValidationOptions = {},
): string[] {
  const errors: string[] = []
  validateSchemaNode(config, VALIDATION_SCHEMA_OVERVIEW, '$', errors, options)
  return errors
}

export function validateEmbeddedZupfnoterConfigShape(config: unknown): string[] {
  return validateZupfnoterConfigShape(config, { enforceRequired: false })
}

export function validateCompleteZupfnoterConfigShape(config: unknown): string[] {
  return validateZupfnoterConfigShape(config, { enforceRequired: true })
}

function validateSchemaNode(
  value: unknown,
  schema: JsonSchemaNode,
  path: string,
  errors: string[],
  options: ConfigSchemaValidationOptions,
): void {
  if (schema.type !== undefined && !matchesSchemaType(value, schema.type)) {
    errors.push(`${path}: expected ${formatSchemaType(schema.type)}`)
    return
  }

  if (value === null || value === undefined) {
    return
  }

  if (schema.enum !== undefined && typeof value === 'string' && !schema.enum.includes(value)) {
    errors.push(`${path}: invalid value "${value}"`)
    return
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: expected at least ${schema.minItems} entries`)
    }
    if (schema.items !== undefined) {
      value.forEach((entry, index) => {
        validateSchemaNode(entry, schema.items as JsonSchemaNode, `${path}[${index}]`, errors, options)
      })
    }
    return
  }

  if (!isPlainObject(value)) {
    return
  }

  const properties = schema.properties ?? {}
  const patternProperties = schema.patternProperties ?? {}
  const enforceRequired = schema.enforceRequired ?? options.enforceRequired ?? false
  const nestedOptions: ConfigSchemaValidationOptions = {
    ...options,
    enforceRequired,
  }
  if (enforceRequired) {
    const required = schema.required ?? []
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${path}: missing required key "${key}"`)
      }
    }
  }
  const propertyKeys = Object.keys(value)
  for (const key of propertyKeys) {
    const directSchema = properties[key]
    if (directSchema !== undefined) {
      validateSchemaNode(value[key], directSchema, appendPath(path, key), errors, nestedOptions)
      continue
    }

    const patternSchema = findPatternSchema(key, patternProperties)
    if (patternSchema !== undefined) {
      validateSchemaNode(value[key], patternSchema, appendPath(path, key), errors, nestedOptions)
      continue
    }

    if (schema.additionalProperties === false) {
      if (schema.requiredx !== undefined) {
        continue
      }
      errors.push(`${appendPath(path, key)}: unknown key`)
      continue
    }

    if (isSchemaNode(schema.additionalProperties)) {
      validateSchemaNode(value[key], schema.additionalProperties, appendPath(path, key), errors, nestedOptions)
    }
  }
}

function findPatternSchema(
  key: string,
  patternProperties: Record<string, JsonSchemaNode>,
): JsonSchemaNode | undefined {
  for (const [pattern, schema] of Object.entries(patternProperties)) {
    const regex = new RegExp(pattern)
    if (regex.test(key)) {
      return schema
    }
  }
  return undefined
}

function matchesSchemaType(
  value: unknown,
  schemaType: JsonSchemaType | readonly JsonSchemaType[],
): boolean {
  const allowedTypes = Array.isArray(schemaType) ? schemaType : [schemaType]
  return allowedTypes.some((type) => matchesSingleSchemaType(value, type))
}

function matchesSingleSchemaType(value: unknown, schemaType: JsonSchemaType): boolean {
  switch (schemaType) {
    case 'array':
      return Array.isArray(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
    case 'number':
      return typeof value === 'number'
    case 'object':
      return isPlainObject(value)
    case 'string':
      return typeof value === 'string'
  }
}

function formatSchemaType(schemaType: JsonSchemaType | readonly JsonSchemaType[]): string {
  return Array.isArray(schemaType)
    ? Array.from(schemaType).join(' | ')
    : String(schemaType)
}

function appendPath(path: string, key: string): string {
  return path === '$' ? `$.${key}` : `${path}.${key}`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSchemaNode(value: unknown): value is JsonSchemaNode {
  return typeof value === 'object' && value !== null
}
