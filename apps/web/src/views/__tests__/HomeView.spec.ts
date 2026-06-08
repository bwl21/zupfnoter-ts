import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HomeView from '../HomeView.vue'
import AbcEditorPanel from '../../workbench/panels/AbcEditorPanel.vue'
import { useSelectionStore } from '../../stores/selection'

describe('HomeView', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the reference sheet panes', async () => {
    vi.useFakeTimers()
    const wrapper = mount(HomeView, {
      global: {
        plugins: [createPinia()],
      },
    })

    expect(wrapper.text()).toContain('ABC-Notation')
    expect(wrapper.text()).toContain('Pdf-Vorschau')
    expect(wrapper.text()).not.toContain('Console')
    expect(wrapper.text()).toContain('Extract 0')
    expect(wrapper.text()).toContain('01:01')
    expect(wrapper.findAll('.zn-zoom-control')).toHaveLength(1)

    expect(wrapper.find('.cm-editor').exists()).toBe(true)

    const editor = wrapper.find('[aria-label="ABC notation editor"]')
    const element = editor.element
    expect(element).toBeInstanceOf(HTMLElement)
    if (element instanceof HTMLElement) {
      expect(element.textContent ?? '').toContain('F:3015_reference_sheet')
    }

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    expect(wrapper.find('.preview-stage__svg svg').exists()).toBe(true)
    expect(wrapper.find('.harp-preview__svg svg').exists()).toBe(true)
  })

  it('treats a collapsed editor selection as cursor-only state', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
      },
    })

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    const selectionStore = useSelectionStore(pinia)
    const selectableRange = selectionStore.sheetObjectIndex?.entries.find((entry) => entry.addressableIn.editor && entry.textRange !== undefined)?.textRange
    expect(selectableRange).toBeDefined()
    if (selectableRange === undefined) {
      throw new Error('expected an editor-addressable range in sheetObjectIndex')
    }
    expect(selectionStore.selection.selectedIndexes).toEqual([])

    wrapper.findComponent(AbcEditorPanel).vm.$emit('selection-change', {
      startpos: 10,
      endpos: 10,
      start: { line: 2, column: 3 },
      end: { line: 2, column: 3 },
    })
    await nextTick()

    expect(selectionStore.selection.selectedIndexes).toEqual([])

    wrapper.findComponent(AbcEditorPanel).vm.$emit('selection-change', {
      startpos: selectableRange.startpos,
      endpos: selectableRange.endpos,
      start: { line: 2, column: 3 },
      end: { line: 2, column: 5 },
    })
    await nextTick()

    expect(selectionStore.selection.source).toBe('abc-editor')
    expect(selectionStore.selection.selectedIndexes.length).toBeGreaterThan(0)
  })

  it('keeps external score selections as score-originated state', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
      },
    })

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    const selectionStore = useSelectionStore(pinia)
    const scoreIndex = selectionStore.sheetObjectIndex?.entries.findIndex((entry) => entry.addressableIn.score && entry.textRange !== undefined) ?? -1
    expect(scoreIndex).toBeGreaterThanOrEqual(0)
    selectionStore.selectIndexes([scoreIndex], 'score-preview')
    await nextTick()

    expect(selectionStore.selection.source).toBe('score-preview')
    expect(selectionStore.selection.selectedIndexes).toEqual([scoreIndex])
  })
})
