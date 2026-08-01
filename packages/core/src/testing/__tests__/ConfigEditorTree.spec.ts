import { describe, expect, it } from 'vitest'

import {
  buildConfigEditorAllParametersTree,
  buildConfigEditorSectionTree,
  CONFIG_EDITOR_TREE_DEFINITION,
  findConfigEditorTreeDefinition,
} from '../../configEditorTree.js'
import type { ConfigEditorTreeDefinition } from '../../configEditorTree.js'
import type { CommandArgumentValue } from '../../commands.js'

function flattenConfigPaths(definitions: readonly ConfigEditorTreeDefinition[]): string[] {
  const paths: string[] = []

  const visit = (items: readonly ConfigEditorTreeDefinition[]): void => {
    for (const item of items) {
      if (item.configPath !== undefined) {
        paths.push(item.configPath)
      }
      if (item.children !== undefined) {
        visit(item.children)
      }
    }
  }

  visit(definitions)
  return paths
}

function flattenTreePaths(
  definitions: readonly ConfigEditorTreeDefinition[],
  parentPath = '',
): string[] {
  return definitions.flatMap((definition) => {
    const path = parentPath === '' ? definition.key : `${parentPath}.${definition.key}`
    return [path, ...flattenTreePaths(definition.children ?? [], path)]
  })
}

describe('buildConfigEditorSectionTree', () => {
  it('derives the rest-position subtree from the configuration schema', () => {
    expect(findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, 'produce')?.label).toBe('PDF für Auszüge')
    expect(findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, 'restposition')?.label).toBe('Position der Pausen')
    expect(findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, 'restposition.default')?.label).toBe('Vorgabewert')
    expect(findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, 'restposition.repeatstart')?.label).toBe('Wiederholungsanfang')
    expect(findConfigEditorTreeDefinition(CONFIG_EDITOR_TREE_DEFINITION, 'restposition.repeatend')?.label).toBe('Wiederholungsende')
  })

  it('expands object-valued form keys from the configuration schema', () => {
    const tree = buildConfigEditorSectionTree('basic_settings', {}, {}, 0)
    const paths = flattenConfigPaths(tree ?? [])

    expect(paths).toContain('restposition.default')
    expect(paths).toContain('restposition.repeatstart')
    expect(paths).toContain('restposition.repeatend')
  })

  it('materializes dynamic entries in the all-parameters tree', () => {
    const currentConfig = {
      extract: {
        0: {
          lyrics: {
            0: { verses: [1], pos: [10, 20], style: 'regular' },
          },
        },
      },
    } as unknown as Record<string, CommandArgumentValue>

    const tree = buildConfigEditorAllParametersTree(currentConfig, currentConfig, 0)
    const paths = flattenTreePaths(tree)

    expect(paths).toContain('extract.current.lyrics.0.verses')
    expect(paths).toContain('extract.current.lyrics.0.pos')
  })

  it('includes schema-defined tuplet fields without a local configuration value', () => {
    const tree = buildConfigEditorAllParametersTree({}, {}, 0)
    const paths = flattenTreePaths(tree)

    expect(paths).toContain('extract.current.tuplets')
    expect(paths).toContain('extract.current.tuplets.text')
    expect(paths).toContain('extract.current.tuplets.style')
  })

  it('keeps schema-defined dynamic entries from the current and effective config', () => {
    const currentConfig = {
      extract: {
        0: {
          notebound: {
            flowline: {
              v_1: {
                1: { cp1: [1, 2], cp2: [1, -2], shape: ['c'], show: true },
              },
            },
          },
        },
      },
    } as unknown as Record<string, CommandArgumentValue>

    const tree = buildConfigEditorAllParametersTree(currentConfig, {}, 0)
    const paths = flattenTreePaths(tree)

    expect(paths).toContain('extract.current.notebound.flowline.v_1.1.cp1')
  })

  it('expands extract annotation keys for extract ids from current and effective config', () => {
    const currentConfig = {
      extract: {
        0: { title: 'Zero' },
        2: { title: 'Two' },
      },
    } as unknown as Record<string, CommandArgumentValue>
    const effectiveConfig = {
      extract: {
        0: { title: 'Zero' },
        1: { title: 'One' },
        2: { title: 'Two' },
      },
    } as unknown as Record<string, CommandArgumentValue>

    const tree = buildConfigEditorSectionTree('extract_annotation', currentConfig, effectiveConfig, 0)
    expect(tree).toBeDefined()

    const configPaths = flattenConfigPaths(tree ?? [])
    expect(configPaths).toContain('extract.0.title')
    expect(configPaths).toContain('extract.1.voices')
    expect(configPaths).toContain('extract.2.filenamepart')
  })

  it('expands lyrics entries from extract 0 for any active extract', () => {
    const currentConfig = {
      extract: {
        0: {
          lyrics: {
            0: { verses: [1], pos: [10, 20], style: 'regular' },
          },
        },
      },
    } as unknown as Record<string, CommandArgumentValue>

    const tree = buildConfigEditorSectionTree('lyrics', currentConfig, currentConfig, 2)
    expect(tree).toBeDefined()

    const configPaths = flattenConfigPaths(tree ?? [])
    expect(configPaths).toContain('extract.0.lyrics.0.verses')
    expect(configPaths).toContain('extract.0.lyrics.0.pos')
    expect(configPaths).toContain('extract.0.lyrics.0.style')
  })

  it('expands image resources and image entries from extract 0', () => {
    const currentConfig = {
      $resources: {
        logo: 'data:image/png;base64,abc',
      },
      extract: {
        0: {
          images: {
            0: { imagename: 'logo', show: true, pos: [1, 2], height: 30 },
          },
        },
      },
    } as unknown as Record<string, CommandArgumentValue>

    const tree = buildConfigEditorSectionTree('images', currentConfig, currentConfig, 2)
    expect(tree).toBeDefined()

    const configPaths = flattenConfigPaths(tree ?? [])
    expect(configPaths).toContain('$resources.logo')
    expect(configPaths).toContain('extract.0.images.0.imagename')
    expect(configPaths).toContain('extract.0.images.0.pos')
  })

  it('expands stringnames from effective extract 0 keys', () => {
    const effectiveConfig = {
      extract: {
        0: {
          stringnames: {
            text: 'A B C',
            vpos: [5],
            marks: {
              hpos: [43, 55, 79],
              vpos: [290],
            },
          },
        },
      },
    } as unknown as Record<string, CommandArgumentValue>

    const tree = buildConfigEditorSectionTree('stringnames', {}, effectiveConfig, 2)
    expect(tree).toBeDefined()

    const configPaths = flattenConfigPaths(tree ?? [])
    expect(configPaths).toContain('extract.2.stringnames.text')
    expect(configPaths).toContain('extract.2.stringnames.vpos')
    expect(configPaths).toContain('extract.2.stringnames.marks.hpos')
    expect(configPaths).toContain('extract.2.stringnames.marks.vpos')
  })

  it('expands notebound fields from the configuration schema', () => {
    const effectiveConfig = {
      extract: {
        0: {
          notebound: {
            annotation: { pos: [1, 2], text: 'A', style: 'regular' },
            minc: { d1: { minc: 0.2 } },
          },
        },
      },
    } as unknown as Record<string, CommandArgumentValue>

    const tree = buildConfigEditorSectionTree('notebound', {}, effectiveConfig, 0)
    const configPaths = flattenConfigPaths(tree ?? [])

    expect(configPaths).toContain('extract.current.notebound.annotation.pos')
    expect(configPaths).toContain('extract.current.notebound.annotation.text')
    expect(configPaths).toContain('extract.current.notebound.minc.d1.minc')
  })

  it('expands global annotations from current and effective config', () => {
    const currentConfig = {
      annotations: {
        accel: { text: 'accel.', pos: [1, 2], style: 'italic' },
      },
    } as unknown as Record<string, CommandArgumentValue>
    const effectiveConfig = {
      annotations: {
        vl: { text: 'v', pos: [-5, -5] },
        accel: { text: 'accel.', pos: [1, 2], style: 'italic' },
      },
    } as unknown as Record<string, CommandArgumentValue>

    const tree = buildConfigEditorSectionTree('annotations', currentConfig, effectiveConfig, 0)
    expect(tree).toBeDefined()

    const configPaths = flattenConfigPaths(tree ?? [])
    expect(configPaths).toContain('annotations.vl.text')
    expect(configPaths).toContain('annotations.vl.pos')
    expect(configPaths).toContain('annotations.accel.style')
  })
})
