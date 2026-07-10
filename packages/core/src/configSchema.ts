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
  $ref?: string
  $schema?: string
  additionalProperties?: boolean | JsonSchemaNode
  description?: string
  enum?: readonly string[]
  items?: JsonSchemaNode
  minItems?: number
  patternProperties?: Record<string, JsonSchemaNode>
  properties?: Record<string, JsonSchemaNode>
  required?: readonly string[]
  type?: JsonSchemaType | readonly JsonSchemaType[]
  uniqueItems?: boolean
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
  'layoutlines',
  'legend',
  'lyrics',
  'layout',
  'nonflowrest',
  'notes',
  'barnumbers',
  'countnotes',
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
  properties: {
    pos: POSITION_SCHEMA,
    text: { type: 'string' },
    style: { type: 'string' },
    align: { type: 'string', enum: ['l', 'r', 'auto'] },
  },
}

const LAYOUT_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
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
    instrument: { type: 'string' },
    tuning: { type: 'string' },
    DRAWING_AREA_SIZE: NUMBER_ARRAY_SCHEMA,
    ELLIPSE_SIZE: NUMBER_ARRAY_SCHEMA,
    REST_SIZE: NUMBER_ARRAY_SCHEMA,
    grid: { type: 'boolean' },
    color: {
      type: 'object',
      properties: {
        color_default: { type: 'string' },
        color_variant1: { type: 'string' },
        color_variant2: { type: 'string' },
      },
    },
    packer: {
      type: 'object',
      properties: {
        pack_method: { type: 'integer' },
        pack_max_spreadfactor: { type: 'number' },
        pack_min_increment: { type: 'number' },
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
      type: 'object',
      required: ['spos', 'pos'],
      properties: {
        spos: POSITION_SCHEMA,
        pos: POSITION_SCHEMA,
        tstyle: { type: 'string' },
        align: { type: 'string', enum: ['l', 'r', 'auto'] },
        style: { type: 'string' },
        salign: { type: 'string', enum: ['l', 'r', 'auto'] },
      },
    },
    lyrics: {
      type: 'object',
      patternProperties: {
        '.*': {
          type: 'object',
          required: ['verses', 'pos'],
          properties: {
            verses: INTEGER_ARRAY_SCHEMA,
            pos: POSITION_SCHEMA,
            style: { type: 'string' },
          },
        },
      },
    },
    layout: LAYOUT_SCHEMA,
    nonflowrest: { type: 'boolean' },
    notes: {
      type: 'object',
      patternProperties: {
        '.*': NOTES_ENTRY_SCHEMA,
      },
    },
    barnumbers: {
      type: 'object',
      properties: {
        voices: INTEGER_ARRAY_SCHEMA,
        pos: POSITION_SCHEMA,
        autopos: { type: 'boolean' },
        apanchor: { type: 'string', enum: ['manual', 'box', 'center'] },
        style: { type: 'string' },
        prefix: { type: 'string' },
      },
    },
    countnotes: {
      type: 'object',
      properties: {
        voices: INTEGER_ARRAY_SCHEMA,
        pos: POSITION_SCHEMA,
        autopos: { type: 'boolean' },
        apanchor: { type: 'string', enum: ['manual', 'box', 'center'] },
        style: { type: 'string' },
        cntextleft: { type: 'string' },
        cntextright: { type: 'string' },
      },
    },
    stringnames: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        vpos: INTEGER_ARRAY_SCHEMA,
        style: { type: 'string' },
        marks: {
          type: 'object',
          properties: {
            vpos: INTEGER_ARRAY_SCHEMA,
            hpos: INTEGER_ARRAY_SCHEMA,
          },
        },
      },
    },
    printer: PRINTER_SCHEMA,
    notebound: {
      type: 'object',
      additionalProperties: true,
    },
  },
}

export const ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW: JsonSchemaNode = {
  $schema: ZUPFNOTER_CONFIG_SCHEMA_DRAFT,
  description: 'TS overview port of the legacy Zupfnoter configuration schema',
  type: 'object',
  required: ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS,
  properties: {
    $schema: { type: 'string' },
    $version: { type: 'string' },
    produce: INTEGER_ARRAY_SCHEMA,
    abc_parser: { type: 'string' },
    restposition: {
      type: 'object',
      required: ['default', 'repeatstart', 'repeatend'],
      properties: {
        default: { type: 'string' },
        repeatstart: { type: 'string' },
        repeatend: { type: 'string' },
      },
    },
    wrap: { type: 'integer' },
    defaults: {
      type: 'object',
      additionalProperties: true,
    },
    templates: {
      type: 'object',
      additionalProperties: true,
    },
    annotations: {
      type: 'object',
      additionalProperties: true,
    },
    extract: {
      type: 'object',
      patternProperties: {
        [ZUPFNOTER_EXTRACT_KEY_PATTERN]: EXTRACT_SCHEMA,
      },
    },
    layout: {
      type: 'object',
      additionalProperties: true,
    },
    neatjson: {
      type: 'object',
      additionalProperties: true,
    },
    template: {
      type: 'object',
      properties: {
        filebase: { type: 'string' },
        title: { type: 'string' },
      },
    },
    presets: {
      type: 'object',
      additionalProperties: true,
    },
    resources: {
      type: 'object',
      additionalProperties: true,
    },
  },
}

export function getLegacyConfigSchemaOverview(): JsonSchemaNode {
  return ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW
}

export function isLegacyTopLevelConfigKey(key: string): boolean {
  return ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS.includes(
    key as (typeof ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS)[number],
  )
}

export function validateZupfnoterConfigShape(config: unknown): string[] {
  const errors: string[] = []
  validateSchemaNode(config, ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW, '$', errors)
  return errors
}

function validateSchemaNode(
  value: unknown,
  schema: JsonSchemaNode,
  path: string,
  errors: string[],
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
        validateSchemaNode(entry, schema.items as JsonSchemaNode, `${path}[${index}]`, errors)
      })
    }
    return
  }

  if (!isPlainObject(value)) {
    return
  }

  const properties = schema.properties ?? {}
  const patternProperties = schema.patternProperties ?? {}
  const propertyKeys = Object.keys(value)
  for (const key of propertyKeys) {
    const directSchema = properties[key]
    if (directSchema !== undefined) {
      validateSchemaNode(value[key], directSchema, appendPath(path, key), errors)
      continue
    }

    const patternSchema = findPatternSchema(key, patternProperties)
    if (patternSchema !== undefined) {
      validateSchemaNode(value[key], patternSchema, appendPath(path, key), errors)
      continue
    }

    if (schema.additionalProperties === false) {
      errors.push(`${appendPath(path, key)}: unknown key`)
      continue
    }

    if (isSchemaNode(schema.additionalProperties)) {
      validateSchemaNode(value[key], schema.additionalProperties, appendPath(path, key), errors)
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

function isSchemaNode(value: boolean | JsonSchemaNode | undefined): value is JsonSchemaNode {
  return typeof value === 'object' && value !== null
}
