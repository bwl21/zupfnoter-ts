import { describe, expect, it } from 'vitest'

import {
  getLegacyConfigSchemaOverview,
  isLegacyTopLevelConfigKey,
  validateZupfnoterConfigShape,
  ZUPFNOTER_CONFIG_SCHEMA_DRAFT,
  ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW,
  ZUPFNOTER_CONFIG_SCHEMA_URI,
  ZUPFNOTER_EXTRACT_KEY_PATTERN,
  ZUPFNOTER_EXTRACT_REQUIRED_KEYS,
  ZUPFNOTER_LAYOUT_CORE_KEYS,
  ZUPFNOTER_PRINTER_KEYS,
  ZUPFNOTER_PRINTER_REQUIRED_KEYS,
  ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS,
} from '../../configSchema.js'

describe('configSchema', () => {
  it('exposes the legacy schema identifiers', () => {
    expect(ZUPFNOTER_CONFIG_SCHEMA_URI).toBe('https://zupfnoter.weichel21.de/schema/zupfnoter-config_1.0.json')
    expect(ZUPFNOTER_CONFIG_SCHEMA_DRAFT).toBe('http://json-schema.org/draft-04/schema#')
  })

  it('keeps the legacy top-level required keys together', () => {
    expect(ZUPFNOTER_TOP_LEVEL_REQUIRED_KEYS).toEqual([
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
    ])
  })

  it('models extract keys as open numeric branches', () => {
    expect(ZUPFNOTER_EXTRACT_KEY_PATTERN).toBe('^\\d+$')
    expect(ZUPFNOTER_EXTRACT_REQUIRED_KEYS).toContain('printer')
    expect(ZUPFNOTER_EXTRACT_REQUIRED_KEYS).toContain('layout')
    expect(ZUPFNOTER_EXTRACT_REQUIRED_KEYS).toContain('stringnames')
  })

  it('keeps the corrected legacy printer keys in the schema source', () => {
    expect(ZUPFNOTER_PRINTER_KEYS).toEqual([
      'a3_offset',
      'a4_offset',
      'a4_pages',
      'show_border',
    ])
    expect(ZUPFNOTER_PRINTER_REQUIRED_KEYS).toEqual([
      'a3_offset',
      'a4_offset',
      'show_border',
    ])
  })

  it('includes the core legacy layout keys that drive the config editor', () => {
    expect(ZUPFNOTER_LAYOUT_CORE_KEYS).toContain('LINE_THIN')
    expect(ZUPFNOTER_LAYOUT_CORE_KEYS).toContain('LINE_MEDIUM')
    expect(ZUPFNOTER_LAYOUT_CORE_KEYS).toContain('LINE_THICK')
    expect(ZUPFNOTER_LAYOUT_CORE_KEYS).toContain('ELLIPSE_SIZE')
    expect(ZUPFNOTER_LAYOUT_CORE_KEYS).toContain('REST_SIZE')
    expect(ZUPFNOTER_LAYOUT_CORE_KEYS).toContain('X_SPACING')
    expect(ZUPFNOTER_LAYOUT_CORE_KEYS).toContain('X_OFFSET')
    expect(ZUPFNOTER_LAYOUT_CORE_KEYS).toContain('PITCH_OFFSET')
  })

  it('offers a reusable schema overview object', () => {
    expect(getLegacyConfigSchemaOverview()).toBe(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW)
    expect(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW.$schema).toBe(ZUPFNOTER_CONFIG_SCHEMA_DRAFT)
    expect(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW.properties?.extract?.patternProperties?.[ZUPFNOTER_EXTRACT_KEY_PATTERN]).toBeDefined()
    expect(
      ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW.properties?.extract?.patternProperties?.[ZUPFNOTER_EXTRACT_KEY_PATTERN]?.properties?.printer?.properties,
    ).toMatchObject({
      a3_offset: { type: 'array' },
      a4_offset: { type: 'array' },
      a4_pages: { type: 'array' },
      show_border: { type: 'boolean' },
    })
  })

  it('recognizes legacy top-level keys', () => {
    expect(isLegacyTopLevelConfigKey('extract')).toBe(true)
    expect(isLegacyTopLevelConfigKey('layout')).toBe(true)
    expect(isLegacyTopLevelConfigKey('printer')).toBe(false)
  })

  it('flags unknown keys in strict legacy subtrees', () => {
    expect(validateZupfnoterConfigShape({
      extract: {
        '0': {
          printer: {
            showBorder: false,
          },
        },
      },
    })).toContain('$.extract.0.printer.showBorder: unknown key')
  })
})
