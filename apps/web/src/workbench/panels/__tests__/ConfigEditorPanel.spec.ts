import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ConfigEditorPanel from '../ConfigEditorPanel.vue'

describe('ConfigEditorPanel', () => {
  it('renders a tree-based config stub with effective values', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
          '',
          '%%%%zupfnoter.config',
          '{"extract":{"0":{"title":"Alt","voices":[1,2],"layout":{"X_SPACING":13}}}}',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'all_parameters',
      },
    })

    expect(wrapper.text()).toContain('Auszug')
    expect(wrapper.text()).toContain('0')
    expect(wrapper.text()).toContain('Titel')
    const inputs = wrapper.findAll('input')
    expect(inputs.some((input) => (input.element as HTMLInputElement).value === 'Alt')).toBe(true)
  })

  it('renders the legacy config edit menu entries and emits edit commands', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'all_parameters',
      },
    })

    expect(wrapper.text()).toContain('Grundeinstellungen')
    expect(wrapper.text()).toContain('Layout')
    expect(wrapper.text()).toContain('Vorlage konfigurieren')

    const layoutButton = wrapper.findAll('button').find((button) => button.text() === 'Layout')
    expect(layoutButton).toBeDefined()
    if (layoutButton === undefined) return

    await layoutButton.trigger('click')

    expect(wrapper.emitted('intent')).toContainEqual([
      {
        action: 'config.editSection',
        path: 'layout',
        extractId: 0,
      },
    ])
  })

  it('filters the tree to the selected config edit section', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'layout',
      },
    })

    const treeText = wrapper.find('.config-panel__tree').text()
    expect(treeText).toContain('Layout')
    expect(treeText).toContain('Layoutstimmen')
    expect(treeText).toContain('Startposition')
    expect(treeText).toContain('Linienstaerke duenn')
    expect(treeText).toContain('Packmethode')
    expect(treeText).not.toContain('Saitennamen')
    expect(treeText).not.toContain('Taktnummern')
    expect(treeText).not.toContain('Druck')
  })
})
