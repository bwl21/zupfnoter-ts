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
        activeSection: 'basic_settings',
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
        activeSection: 'basic_settings',
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
    expect(treeText).toContain('Stimmen für Layout')
    expect(treeText).toContain('Startposition')
    expect(treeText).toContain('Linienstärke dünn')
    expect(treeText).toContain('Packmethode')
    expect(treeText).not.toContain('Saitennamen')
    expect(treeText).not.toContain('Taktnummern')
    expect(treeText).not.toContain('Druck')
  })

  it('uses translated legacy names for basic extract parameters', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]',
        currentExtract: 0,
        activeSection: 'basic_settings',
      },
    })

    const treeText = wrapper.find('.config-panel__tree').text()
    expect(treeText).toContain('Flußlinien')
    expect(treeText).toContain('Hilfsmelodielinien')
    expect(treeText).toContain('Sprunglinien')
    expect(treeText).not.toContain('jumplines')
  })

  it('shows the legacy instrument-specific parameter set', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'instrument_specific',
      },
    })

    const labels = wrapper.findAll('.config-row__label').map((node) => node.text())
    expect(labels).toContain('Instrument')
    expect(labels).toContain('Stimmung')
    expect(labels).toContain('Begrenzung auf A3')
    expect(labels).toContain('Spiel aufwärts')
    expect(labels).toContain('Notenhälse')
    expect(labels).toContain('X - Offset')
    expect(labels).toContain('Saitenabstand')
    expect(labels).toContain('PitchOffset')
    expect(labels).toContain('Saitennamen')
    expect(labels).toContain('Drucker')

    expect(labels.indexOf('Instrument')).toBeLessThan(labels.indexOf('Stimmung'))
    expect(labels.indexOf('Stimmung')).toBeLessThan(labels.indexOf('Begrenzung auf A3'))
    expect(labels.indexOf('PitchOffset')).toBeLessThan(labels.indexOf('Saitennamen'))
    expect(labels.indexOf('Saitennamen')).toBeLessThan(labels.indexOf('Drucker'))
  })

  it('keeps the intermediate entry level for lyrics configuration', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
          '',
          '%%%%zupfnoter.config',
          '{"extract":{"0":{"lyrics":{"0":{"verses":[1],"pos":[350,70],"style":"regular"}}}}}',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'lyrics',
      },
    })

    const labels = wrapper.findAll('.config-row__label').map((node) => node.text())
    expect(labels).toContain('0')
    expect(labels).toContain('Strophen')
    expect(labels).toContain('Position')
    expect(labels).toContain('Stil')
    expect(labels.indexOf('0')).toBeLessThan(labels.indexOf('Strophen'))
  })

  it('expands page annotation entries from the current config', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
          '',
          '%%%%zupfnoter.config',
          '{"extract":{"0":{"notes":{"T01_number_extract":{"pos":[320,6],"text":"{{extract_filename}}","style":"large"}}}}}',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'notes',
      },
    })

    const labels = wrapper.findAll('.config-row__label').map((node) => node.text())
    expect(labels).toContain('T01 Auszug-Nummer')
    expect(labels).toContain('Position')
    expect(labels).toContain('Text')
    expect(labels).toContain('Stil')
    expect(labels.indexOf('T01_number_extract')).toBeLessThan(labels.lastIndexOf('Position'))
  })

  it('renders legacy text fields as multi-line inputs', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
          '',
          '%%%%zupfnoter.config',
          '{"extract":{"0":{"notes":{"T01":{"pos":[1,2],"text":"erste\\nzweite Zeile","style":"regular","align":"l"}}}}}',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'notes',
      },
    })

    const textarea = wrapper.find('textarea.config-row__textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.attributes('rows')).toBe('2')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('erste\nzweite Zeile')
    expect(textarea.element.closest('.config-row')?.classList.contains('config-row--multiline')).toBe(true)

    const styleRow = wrapper.findAll('.config-row').find((row) => row.find('.config-row__label').text() === 'Stil')
    expect(styleRow?.find('details.config-row__select').exists()).toBe(true)
    const styleOption = styleRow?.findAll('.config-row__select-option').find((option) => option.text() === 'Fett (bold)')
    expect(styleOption?.attributes('data-option-description')).toBe('Text wird **fett** gesetzt.')

    const alignRow = wrapper.findAll('.config-row').find((row) => row.find('.config-row__label').text() === 'Ausrichtung')
    expect(alignRow?.find('details.config-row__select').exists()).toBe(true)
    expect(alignRow?.findAll('.config-row__select-option').map((option) => option.text())).toContain('Automatisch (auto)')
  })

  it('expands global annotation templates from effective and current config', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
          '',
          '%%%%zupfnoter.config',
          '{"annotations":{"accel":{"text":"accel.","pos":[1,2],"style":"italic"}}}',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'annotations',
      },
    })

    const labels = wrapper.findAll('.config-row__label').map((node) => node.text())
    expect(labels).toContain("'V' links")
    expect(labels).toContain('accel')
    expect(labels).toContain('Position')
    expect(labels).toContain('Text')
    expect(labels).toContain('Stil')
  })

  it('disables new entry when the current form set does not support it', () => {
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

    const newEntryButton = wrapper.findAll('button').find((button) => button.text() === 'Neuer Eintrag')
    expect(newEntryButton).toBeDefined()
    expect(newEntryButton?.attributes('disabled')).toBeDefined()
  })

  it('emits the legacy addconf key for supported new entry sections', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'lyrics',
      },
    })

    const newEntryButton = wrapper.findAll('button').find((button) => button.text() === 'Neuer Eintrag')
    expect(newEntryButton).toBeDefined()
    expect(newEntryButton?.attributes('disabled')).toBeUndefined()
    if (newEntryButton === undefined) return

    await newEntryButton.trigger('click')

    expect(wrapper.emitted('intent')).toContainEqual([
      {
        action: 'config.addEntry',
        path: 'lyrics',
        extractId: 0,
      },
    ])
  })

  it('emits the delete command for a deletable local parameter', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
          '',
          '%%%%zupfnoter.config',
          '{"extract":{"0":{"title":"Alt"}}}',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'all_parameters',
      },
    })

    const titleRow = wrapper.findAll('.config-row').find((row) => row.text().includes('Titel'))
    expect(titleRow).toBeDefined()
    if (titleRow === undefined) return

    const deleteButton = titleRow.find('button[aria-label="Pfad oder Teilbaum loeschen"]')
    await deleteButton.trigger('click')

    expect(wrapper.emitted('intent')).toContainEqual([
      {
        action: 'config.deletePath',
        path: 'extract.0.title',
        extractId: 0,
      },
    ])
  })

  it('emits config undo and redo intents from the toolbar', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]',
        currentExtract: 0,
        activeSection: 'layout',
      },
    })

    await wrapper.find('button[aria-label="Undo"]').trigger('click')
    await wrapper.find('button[aria-label="Redo"]').trigger('click')

    expect(wrapper.emitted('intent')).toContainEqual([
      { action: 'config.undo', extractId: 0 },
    ])
    expect(wrapper.emitted('intent')).toContainEqual([
      { action: 'config.redo', extractId: 0 },
    ])
  })

  it('emits a config command when a local value is committed', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
          '',
          '%%%%zupfnoter.config',
          '{"extract":{"0":{"title":"Alt"}}}',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'all_parameters',
      },
    })

    const titleRow = wrapper.findAll('.config-row').find((row) => row.text().includes('Titel'))
    expect(titleRow).toBeDefined()
    if (titleRow === undefined) return

    const input = titleRow.find('input')
    await input.setValue('Neu')
    await input.trigger('blur')

    expect(wrapper.emitted('intent')).toContainEqual([
      {
        action: 'config.setPath',
        path: 'extract.0.title',
        value: 'Neu',
        extractId: 0,
      },
    ])
  })

  it('preserves numeric array values when committing compact input', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]',
        currentExtract: 0,
        activeSection: 'all_parameters',
      },
    })

    const produceRow = wrapper.findAll('.config-row').find((row) => row.text().includes('PDF für Auszüge'))
    expect(produceRow).toBeDefined()
    if (produceRow === undefined) return

    const input = produceRow.find('input')
    expect((input.element as HTMLInputElement).value).toBe('0')
    await input.setValue('0')
    await input.trigger('blur')

    expect(wrapper.emitted('intent')).toContainEqual([
      {
        action: 'config.setPath',
        path: 'produce',
        value: [0],
        extractId: 0,
      },
    ])
  })

  it('renders boolean schema values as switches and emits booleans', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]',
        currentExtract: 0,
        activeSection: 'instrument_specific',
      },
    })

    const limitRow = wrapper.findAll('.config-row').find((row) => row.text().includes('Begrenzung auf A3'))
    const switchButton = limitRow?.find('[role="switch"]')
    expect(switchButton?.exists()).toBe(true)
    expect(switchButton?.attributes('aria-checked')).toBe('true')
    await switchButton?.trigger('click')

    expect(wrapper.emitted('intent')).toContainEqual([
      {
        action: 'config.setPath',
        path: 'extract.0.layout.limit_a3',
        value: false,
        extractId: 0,
      },
    ])
  })

  it('serializes synchronization lines with the legacy integer-pair notation', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]',
        currentExtract: 0,
        activeSection: 'all_parameters',
      },
    })

    const synchlinesRow = wrapper.findAll('.config-row').find((row) => row.text().includes('Synchronisationslinien'))
    expect(synchlinesRow).toBeDefined()
    if (synchlinesRow === undefined) return

    const input = synchlinesRow.find('input')
    await input.setValue('1-2, 2-3')
    await input.trigger('blur')

    expect(wrapper.emitted('intent')).toContainEqual([
      {
        action: 'config.setPath',
        path: 'extract.0.synchlines',
        value: [[1, 2], [2, 3]],
        extractId: 0,
      },
    ])
  })

  it('keeps an invalid typed value local and shows an error', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]',
        currentExtract: 0,
        activeSection: 'all_parameters',
      },
    })

    const produceRow = wrapper.findAll('.config-row').find((row) => row.text().includes('PDF für Auszüge'))
    expect(produceRow).toBeDefined()
    if (produceRow === undefined) return

    const input = produceRow.find('input')
    await input.setValue('not-a-number')
    await input.trigger('blur')

    expect(wrapper.emitted('intent')).toBeUndefined()
    expect(produceRow.text()).toContain('Bitte eine ganze Zahl eingeben.')
  })

  it('renders documented static options as a select with its explanation', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]\n\n%%%%zupfnoter.config\n{"extract":{"0":{"layout":{"tuning":"open"}}}}',
        currentExtract: 0,
        activeSection: 'instrument_specific',
      },
    })

    const tuningRow = wrapper.findAll('.config-row').find((row) => row.text().includes('Stimmung'))
    expect(tuningRow?.find('details').exists()).toBe(true)
    expect(tuningRow?.find('.config-row__select-caret').exists()).toBe(true)
    expect(tuningRow?.text()).not.toContain('Stimmung der Saiten')
    expect(tuningRow?.find('[data-option-description*="Stimmung der Saiten"]').exists()).toBe(true)
  })

  it('closes an open documented option list with Escape', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]\n\n%%%%zupfnoter.config\n{"extract":{"0":{"layout":{"tuning":"open"}}}}',
        currentExtract: 0,
        activeSection: 'instrument_specific',
      },
    })

    const options = wrapper.find('.config-row__select')
    ;(options.element as HTMLDetailsElement).open = true
    await options.trigger('keydown', { key: 'Escape' })

    expect((options.element as HTMLDetailsElement).open).toBe(false)
  })

  it('closes an open documented option list when clicking outside', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]\n\n%%%%zupfnoter.config\n{"extract":{"0":{"layout":{"tuning":"open"}}}}',
        currentExtract: 0,
        activeSection: 'instrument_specific',
      },
    })

    const options = wrapper.find('.config-row__select')
    ;(options.element as HTMLDetailsElement).open = true
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect((options.element as HTMLDetailsElement).open).toBe(false)
  })

  it('fills a missing structure with its effective object value', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: 'X:1\nT:Config Demo\nK:C\nC |]',
        currentExtract: 0,
        activeSection: 'all_parameters',
      },
    })

    const restpositionRow = wrapper.findAll('.config-row').find((row) => row.text().includes('Position der Pausen'))
    expect(restpositionRow).toBeDefined()
    if (restpositionRow === undefined) return

    const fillButton = restpositionRow.find('button[aria-label="Parameter mit wirksamem Wert auffuellen"]')
    expect(fillButton.attributes('disabled')).toBeUndefined()
    await fillButton.trigger('click')

    expect(restpositionRow.find('input').exists()).toBe(false)
    const visiblePaths = wrapper.findAll('.config-row__name-copy').map((element) => element.attributes('title'))
    expect(visiblePaths).toContain('restposition.default')
    expect(visiblePaths).toContain('restposition.repeatstart')
    expect(visiblePaths).toContain('restposition.repeatend')

    expect(wrapper.emitted('intent')).toContainEqual([
      {
        action: 'config.setPath',
        path: 'restposition',
        value: { default: 'center', repeatstart: 'next', repeatend: 'default' },
        extractId: 0,
      },
    ])
  })

  it('expands a newly added configuration entry after the command succeeds', async () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
        ].join('\n'),
        currentExtract: 0,
        activeSection: 'lyrics',
        entryMutationVersion: 0,
      },
    })

    const newEntryButton = wrapper.findAll('button').find((button) => button.text() === 'Neuer Eintrag')
    expect(newEntryButton).toBeDefined()
    if (newEntryButton === undefined) return

    await newEntryButton.trigger('click')
    await wrapper.setProps({
      abcText: [
        'X:1',
        'T:Config Demo',
        'K:C',
        'C |]',
        '',
        '%%%%zupfnoter.config',
        '{"extract":{"0":{"lyrics":{"0":{"verses":[1],"pos":[1,2],"style":"default"}}}}}',
      ].join('\n'),
      entryMutationVersion: 1,
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.config-row__label').map((node) => node.text())).toContain('Strophen')
  })

  it('disables new entry for extract-zero-only sections outside extract 0', () => {
    const wrapper = mount(ConfigEditorPanel, {
      props: {
        abcText: [
          'X:1',
          'T:Config Demo',
          'K:C',
          'C |]',
        ].join('\n'),
        currentExtract: 2,
        activeSection: 'lyrics',
      },
    })

    const newEntryButton = wrapper.findAll('button').find((button) => button.text() === 'Neuer Eintrag')
    expect(newEntryButton).toBeDefined()
    expect(newEntryButton?.attributes('disabled')).toBeDefined()
  })
})
