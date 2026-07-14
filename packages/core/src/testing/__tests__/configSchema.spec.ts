import { describe, expect, it } from 'vitest'
import { Confstack } from '../../Confstack.js'
import { initConf } from '../../initConf.js'

import {
  buildConfigSchemaOverview,
  getConfigMenuKind,
  getConfigSchemaOverview,
  getConfigPathActionProfile,
  resolveConfigSchemaPath,
  hasConfigPathSegment,
  isLegacyTopLevelConfigKey,
  isSelectableConfigPath,
  LEGACY_CONFIG_MENU_PATH_SEGMENTS,
  validateCompleteZupfnoterConfigShape,
  validateEmbeddedZupfnoterConfigShape,
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
  LEGACY_SELECTABLE_CONFIG_PATH_SEGMENTS,
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
    expect(ZUPFNOTER_EXTRACT_REQUIRED_KEYS).toContain('repeatsigns')
    expect(ZUPFNOTER_EXTRACT_REQUIRED_KEYS).toContain('chords')
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

  it('offers the productive schema overview from the TS builder', () => {
    expect(buildConfigSchemaOverview()).toEqual(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW)
    expect(getConfigSchemaOverview()).toBe(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW)
    expect(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW.$schema).toBe(ZUPFNOTER_CONFIG_SCHEMA_DRAFT)
    expect(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW.definitions?.pos).toBeDefined()
    expect(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW.properties?.extract?.patternProperties?.['d*']).toBeDefined()
    expect(
      ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW.properties?.extract?.patternProperties?.['d*']?.properties?.printer?.properties,
    ).toMatchObject({
      a3_offset: { type: 'array' },
      a4_offset: { type: 'array' },
      show_border: { type: 'boolean' },
    })
  })

  it('resolves direct properties, numeric extract patterns and references', () => {
    expect(resolveConfigSchemaPath('produce')).toMatchObject({ type: 'array', items: { type: 'integer' } })
    expect(resolveConfigSchemaPath('extract.0.synchlines')).toMatchObject({
      type: 'array',
      items: { type: 'array', items: { type: 'integer' } },
    })
    expect(resolveConfigSchemaPath('extract.0.layout.tuning')?.['x-zupfnoter-editor']?.options).toEqual([
      expect.objectContaining({ value: 'fixed', label: 'feste stimmung' }),
      expect.objectContaining({ value: 'open', label: 'offene Stimmung' }),
    ])
    expect(resolveConfigSchemaPath('extract.0.layout.instrument')?.['x-zupfnoter-editor']?.options).toContainEqual(
      expect.objectContaining({ value: 'okon-g', label: 'Okon-Tischharfe' }),
    )
    expect(resolveConfigSchemaPath('extract.0.notes.T01.text')?.['x-zupfnoter-editor']?.strategy).toBe('textarea')
    expect(resolveConfigSchemaPath('extract.0.notes.T01.style')?.['x-zupfnoter-editor']?.strategy).toBe('font-style-select')
    expect(resolveConfigSchemaPath('extract.0.notes.T01.align')?.['x-zupfnoter-editor']?.options).toContainEqual(
      expect.objectContaining({ value: 'auto' }),
    )
    expect(resolveConfigSchemaPath('extract.0.countnotes.cntextleft')?.['x-zupfnoter-editor']?.strategy).toBeUndefined()
  })

  it('recognizes legacy top-level keys', () => {
    expect(isLegacyTopLevelConfigKey('extract')).toBe(true)
    expect(isLegacyTopLevelConfigKey('layout')).toBe(true)
    expect(isLegacyTopLevelConfigKey('printer')).toBe(false)
  })

  it('exposes central selectable config path segments', () => {
    expect(LEGACY_SELECTABLE_CONFIG_PATH_SEGMENTS).toEqual([
      'notebound',
      'notes',
      'annotations',
    ])
    expect(hasConfigPathSegment('extract.0.notebound.flowline.v_1.9024', 'notebound')).toBe(true)
    expect(hasConfigPathSegment('extract.0.stringnames.text', 'notes')).toBe(false)
    expect(isSelectableConfigPath('extract.0.notes.T01_number')).toBe(true)
    expect(isSelectableConfigPath('annotations.vl')).toBe(true)
    expect(isSelectableConfigPath('extract.0.stringnames.text')).toBe(false)
  })

  it('classifies config menu kinds and row actions centrally', () => {
    expect(LEGACY_CONFIG_MENU_PATH_SEGMENTS).toEqual([
      'layout',
      'printer',
      'notebound',
      'notes',
      'lyrics',
      'stringnames',
      'annotations',
    ])
    expect(getConfigMenuKind('extract.0.layout.LINE_THIN')).toBe('layout')
    expect(getConfigMenuKind('extract.0.printer.a4_pages')).toBe('printer')
    expect(getConfigMenuKind('extract.0.notes.T01_number')).toBe('notes')
    expect(getConfigMenuKind('extract.0.voices')).toBe('default')

    expect(getConfigPathActionProfile('extract.0.notes.T01_number', {
      hasEffectiveValue: true,
      hasLocalValue: false,
      isLeaf: true,
    })).toEqual({
      canDelete: false,
      canFill: true,
      canSelect: true,
      menuKind: 'notes',
    })

    expect(getConfigPathActionProfile('extract.0.stringnames', {
      hasEffectiveValue: true,
      hasLocalValue: true,
      isLeaf: false,
    })).toEqual({
      canDelete: true,
      canFill: false,
      canSelect: false,
      menuKind: 'stringnames',
    })

    expect(getConfigPathActionProfile('restposition', {
      hasEffectiveValue: true,
      hasLocalValue: false,
      isLeaf: false,
    }).canFill).toBe(true)
  })

  it('keeps open legacy subtrees open in runtime validation', () => {
    expect(validateZupfnoterConfigShape({
      extract: {
        '0': {
          printer: {
            showBorder: false,
          },
        },
      },
    })).toEqual([])
  })

  it('accepts partial embedded config overlays without requiring full defaults', () => {
    expect(validateEmbeddedZupfnoterConfigShape({
      extract: {
        '0': {
          printer: {
            show_border: false,
          },
        },
      },
    })).toEqual([])
  })

  it('does not confuse normalized initConf defaults with the embedded legacy config shape', () => {
    const completeConfig = initConf(new Confstack())
    expect(validateCompleteZupfnoterConfigShape(completeConfig)).toContain(
      '$.layout.FONT_STYLE_DEF.bold: missing required key "text_color"',
    )
  })

  it('reports missing required keys for complete config validation', () => {
    expect(validateCompleteZupfnoterConfigShape({
      extract: {},
    })).toContain('$: missing required key "produce"')
  })

  it('accepts legacy-shaped deep notebound structures', () => {
    expect(validateEmbeddedZupfnoterConfigShape({
      extract: {
        '0': {
          notebound: {
            minc: {
              '10752': { minc_f: 0.5 },
            },
            flowline: {
              v_1: {
                '9024': { cp2: [-2.64, -58.59] },
              },
            },
            tuplet: {
              v_1: {
                tp_1_1: { cp1: [-52.07, -6.91], cp2: [-54.61, 6.7] },
              },
            },
            barnumber: {
              v_2: {
                t_384: { align: 'r' },
              },
            },
            c_jumplines: {
              v_1: {
                '8640': { p_repeat: -3 },
                '26880': {
                  '0': { p_begin: -2 },
                  '1': { p_begin: 4 },
                  p_follow: -3,
                },
              },
            },
          },
        },
      },
    })).toEqual([])
  })

  it('rejects unknown keys inside strict deep notebound structures', () => {
    expect(validateEmbeddedZupfnoterConfigShape({
      extract: {
        '0': {
          notebound: {
            minc: {
              '10752': { mincFactor: 0.5 },
            },
          },
        },
      },
    })).toContain('$.extract.0.notebound.minc.10752.mincFactor: unknown key')
  })

  it('keeps legacy chord annotation blocks open where the parity schema is open', () => {
    expect(validateEmbeddedZupfnoterConfigShape({
      extract: {
        '0': {
          chords: {
            voices: [],
            show: true,
          },
        },
      },
    })).toEqual([])
  })

  it('keeps the legacy preset families in the default config', () => {
    const config = initConf(new Confstack())
    const presets = config.presets as Record<string, unknown>
    const instrumentPresets = presets.instrument as Record<string, unknown>
    const layoutPresets = presets.layout as Record<string, unknown>
    const notesPresets = presets.notes as Record<string, unknown>
    const printerPresets = presets.printer as Record<string, unknown>

    expect(Object.keys(presets)).toEqual([
      'barnumbers_countnotes',
      'stdextract',
      'layout',
      'instrument',
      'notes',
      'printer',
    ])
    expect(layoutPresets).toHaveProperty('notes_with_beams')
    expect(layoutPresets).toHaveProperty('packer_regular')
    expect(instrumentPresets).toHaveProperty('Akkordzither')
    expect(instrumentPresets).toHaveProperty('Zipino')
    expect(notesPresets).toHaveProperty('T01_number')
    expect(notesPresets).toHaveProperty('T06_legend')
    expect(printerPresets).toHaveProperty('printer_centric')
  })
})
