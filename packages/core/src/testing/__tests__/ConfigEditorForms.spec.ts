import { describe, expect, it } from 'vitest'

import {
  CONFIG_EDITOR_FORM_SETS,
  CONFIG_EDITOR_MENU_ITEMS,
} from '../../configEditorForms.js'

describe('ConfigEditorForms', () => {
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
    expect(CONFIG_EDITOR_FORM_SETS.layout.keys).toEqual([
      'extract.{extract}.layoutlines',
      'extract.{extract}.startpos',
      'extract.{extract}.layout.LINE_THIN',
      'extract.{extract}.layout.LINE_MEDIUM',
      'extract.{extract}.layout.LINE_THICK',
      'extract.{extract}.layout.ELLIPSE_SIZE',
      'extract.{extract}.layout.REST_SIZE',
      'extract.{extract}.layout.limit_a3',
      'extract.{extract}.layout.DRAWING_AREA_SIZE',
      'extract.{extract}.layout.packer.pack_method',
      'extract.{extract}.layout.packer.pack_max_spreadfactor',
      'extract.{extract}.layout.packer.pack_min_increment',
      'extract.{extract}.layout.jumpline_anchor',
      'extract.{extract}.layout.jumpline_vcut',
      'extract.{extract}.layout.color.color_default',
      'extract.{extract}.layout.color.color_variant1',
      'extract.{extract}.layout.color.color_variant2',
      'extract.{extract}.layout.bottomup',
      'extract.{extract}.layout.beams',
    ])
  })
})
