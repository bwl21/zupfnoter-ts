import { describe, expect, it } from 'vitest'

import {
  CONFIG_EDITOR_FORM_SETS,
  CONFIG_EDITOR_MENU_ITEMS,
  getConfigEditorDynamicFields,
  getConfigEditorNewEntryCommand,
  getConfigEditorFormSections,
} from '../../configEditorForms.js'
import {
  LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES,
  LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES,
  LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES,
  LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS,
  LEGACY_NOTES_EXTRACT_PATH_SUFFIXES,
  LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES,
  LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES,
  toExtractConfigPath,
} from '../../configSchema.js'

const expectedLayoutFormKeys = [
  'extract.{extract}.layoutlines',
  'extract.{extract}.startpos',
  ...LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES
    .filter((suffix) => !LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES.includes(
      suffix as (typeof LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES)[number],
    ))
    .map((suffix) => toExtractConfigPath(suffix)),
  ...LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix)),
]

describe('ConfigEditorForms', () => {
  it('exposes legacy tuplet parameters including the annotation position', () => {
    expect(getConfigEditorDynamicFields('extract.0.notebound.tuplet.v_1.1536'))
      .toEqual(['show', 'pos', 'shape', 'cp1', 'cp2'])
  })

  it('keeps the global tuplet style parameter in the editor form', () => {
    expect(CONFIG_EDITOR_FORM_SETS.barnumbers_countnotes.keys)
      .toContain('extract.{extract}.tuplets.style')
  })

  it('ports the legacy editconf menu order and ids', () => {
    const menuShape = CONFIG_EDITOR_MENU_ITEMS.map((item) => {
      if (item.type === 'separator') return '|'
      return item.id
    })

    expect(menuShape).toEqual([
      'extract_annotation',
      'notes',
      '|',
      'basic_settings',
      'lyrics',
      'layout',
      'instrument_specific',
      '|',
      'barnumbers_countnotes',
      'repeatsigns',
      'annotations',
      '|',
      'stringnames',
      'printer',
      'notebound',
      'images',
      '|',
      'validationerrors',
      '|',
      'all_parameters',
      'template',
    ])
  })

  it('keeps legacy menu metadata with the menu commands', () => {
    const commands = CONFIG_EDITOR_MENU_ITEMS
      .filter((item) => item.type === 'command')
      .map((item) => ({
        id: item.id,
        legacyText: item.legacyText,
        legacyIcon: item.legacyIcon,
      }))

    expect(commands).toEqual([
      { id: 'extract_annotation', legacyText: 'Extract-Annotation', legacyIcon: 'fa fa-bars' },
      { id: 'notes', legacyText: 'page annotation', legacyIcon: 'fa fa-file-text-o' },
      { id: 'basic_settings', legacyText: 'basic settings', legacyIcon: 'fa fa-heartbeat' },
      { id: 'lyrics', legacyText: 'lyrics', legacyIcon: 'fa fa-font' },
      { id: 'layout', legacyText: 'layout', legacyIcon: 'fa fa-align-center' },
      { id: 'instrument_specific', legacyText: 'instrument specific', legacyIcon: 'fa fa-pie-chart' },
      { id: 'barnumbers_countnotes', legacyText: 'barnumbers and countnotes', legacyIcon: 'fa fa-list-ol' },
      { id: 'repeatsigns', legacyText: 'repeat signs', legacyIcon: 'fa fa-repeat' },
      { id: 'annotations', legacyText: 'annotations', legacyIcon: 'fa fa-commenting-o' },
      { id: 'stringnames', legacyText: 'stringnames', legacyIcon: 'fa fa-ellipsis-h' },
      { id: 'printer', legacyText: 'Printer adapt', legacyIcon: 'fa fa-print' },
      { id: 'notebound', legacyText: 'notebound', legacyIcon: 'fa fa-adjust' },
      { id: 'images', legacyText: 'images', legacyIcon: 'fa fa-image' },
      { id: 'validationerrors', legacyText: 'validationerrors', legacyIcon: 'fa fa-exclamation-circle' },
      { id: 'all_parameters', legacyText: 'all parameters', legacyIcon: 'fa fa-list' },
      { id: 'template', legacyText: 'configtemplate', legacyIcon: 'fa fa-pencil-square-o' },
    ])
  })

  it('ports the legacy layout form key list', () => {
    expect(CONFIG_EDITOR_FORM_SETS.layout.keys).toEqual(expectedLayoutFormKeys)
  })

  it('derives layout and printer form paths from the central schema source', () => {
    const expectedLayoutPaths = LEGACY_LAYOUT_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))
    const expectedPrinterPaths = LEGACY_PRINTER_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))

    expect(CONFIG_EDITOR_FORM_SETS.layout.keys).toEqual(expectedLayoutFormKeys)

    expect(CONFIG_EDITOR_FORM_SETS.instrument_specific.keys).toEqual(expect.arrayContaining(expectedPrinterPaths))
  })

  it('derives barnumber and countnote paths from the central schema source', () => {
    const expectedBarnumberPaths = LEGACY_BARNUMBERS_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))
    const expectedCountnotePaths = LEGACY_COUNTNOTES_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))

    expect(CONFIG_EDITOR_FORM_SETS.barnumbers_countnotes.keys).toEqual(expect.arrayContaining(expectedBarnumberPaths))
    expect(CONFIG_EDITOR_FORM_SETS.barnumbers_countnotes.keys).toEqual(expect.arrayContaining(expectedCountnotePaths))
  })

  it('keeps packer keys attached to the central layout schema path set', () => {
    const expectedPackerPaths = LEGACY_LAYOUT_PACKER_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))
    expect(CONFIG_EDITOR_FORM_SETS.layout.keys).toEqual(expect.arrayContaining(expectedPackerPaths))
  })

  it('derives notes, lyrics and stringnames paths from the central schema source', () => {
    const expectedNotesPaths = LEGACY_NOTES_EXTRACT_PATH_SUFFIXES.map((suffix) => toExtractConfigPath(suffix))
    const expectedLyricsPaths = LEGACY_LYRICS_EXTRACT_PATH_SUFFIX_PATTERNS.map((suffix) => toExtractConfigPath(suffix))

    expect(CONFIG_EDITOR_FORM_SETS.notes.keys).toEqual(expectedNotesPaths)
    expect(CONFIG_EDITOR_FORM_SETS.lyrics.keys).toEqual(expectedLyricsPaths)
    expect(CONFIG_EDITOR_FORM_SETS.stringnames.keys).toEqual([
      toExtractConfigPath(LEGACY_STRINGNAMES_EXTRACT_PATH_SUFFIXES[0]),
      'extract.{extract}.sortmark',
    ])
  })

  it('defines productive sections for every formset', () => {
    for (const [formId, formSet] of Object.entries(CONFIG_EDITOR_FORM_SETS)) {
      const sections = getConfigEditorFormSections(formId)

      expect(sections, `missing sections for ${formId}`).toBeDefined()
      expect(sections?.flatMap((section) => section.keys) ?? []).toEqual(formSet.keys)
    }
  })

  it('keeps instrument-specific section order in the central form source', () => {
    const sections = getConfigEditorFormSections('instrument_specific')

    expect(sections?.map((section) => section.id)).toEqual([
      'layout',
      'stringnames_text',
      'printer',
      'stringnames_marks',
    ])
    expect(sections?.flatMap((section) => section.keys) ?? []).toEqual(
      CONFIG_EDITOR_FORM_SETS.instrument_specific.keys,
    )
  })

  it('ports legacy new-entry command wiring', () => {
    expect(getConfigEditorNewEntryCommand('extract_annotation', 0)).toBe('extracts')
    expect(getConfigEditorNewEntryCommand('annotations', 0)).toBe('annotations')
    expect(getConfigEditorNewEntryCommand('notes', 0)).toBe('notes')
    expect(getConfigEditorNewEntryCommand('lyrics', 0)).toBe('lyrics')
    expect(getConfigEditorNewEntryCommand('images', 0)).toBe('images')

    expect(getConfigEditorNewEntryCommand('lyrics', 2)).toBeUndefined()
    expect(getConfigEditorNewEntryCommand('images', 2)).toBeUndefined()
    expect(getConfigEditorNewEntryCommand('layout', 0)).toBeUndefined()
  })
})
