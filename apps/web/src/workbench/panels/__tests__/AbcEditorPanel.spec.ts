import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AbcEditorPanel from '../AbcEditorPanel.vue'

describe('AbcEditorPanel', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders diagnostics at the editor edge', async () => {
    vi.useFakeTimers()

    const wrapper = mount(AbcEditorPanel, {
      props: {
        modelValue: 'X:1\nT:Demo\nK:C\nC',
        diagnostics: [
          {
            severity: 'error',
            message: 'Missing note duration',
            line: 4,
            column: 1,
            source: 'abc-parser',
          },
        ],
      },
    })

    await vi.advanceTimersByTimeAsync(100)
    await nextTick()

    expect(wrapper.find('.cm-editor').exists()).toBe(true)
    expect(wrapper.emitted('cursor-change')?.[0]?.[0]).toEqual({
      line: 1,
      column: 1,
    })
    expect(wrapper.emitted('selection-change')?.[0]?.[0]).toEqual({
      startpos: 0,
      endpos: 0,
      start: {
        line: 1,
        column: 1,
      },
      end: {
        line: 1,
        column: 1,
      },
    })
    const diagnosticUnderline = wrapper.find('.cm-abc-diagnostic-underline')
    expect(diagnosticUnderline.exists()).toBe(true)
    expect(wrapper.find('.cm-abc-diagnostic-underline--error').exists()).toBe(true)
    const gutterMarker = wrapper.find('.cm-abc-gutter-marker')
    expect(gutterMarker.exists()).toBe(true)
    expect(wrapper.find('.cm-abc-gutter-marker--error').exists()).toBe(true)
  })

  it('opens the native CodeMirror search panel with Ctrl+F', async () => {
    const wrapper = mount(AbcEditorPanel, {
      props: { modelValue: 'X:1\nT:Demo\nK:C\nC D C' },
    })

    await wrapper.find('.cm-content').trigger('keydown', { key: 'f', ctrlKey: true })
    expect(wrapper.find('.cm-search').exists()).toBe(true)
    expect(wrapper.find('.cm-search input').exists()).toBe(true)
  })

  it('uses the native CodeMirror replace controls', async () => {
    const wrapper = mount(AbcEditorPanel, {
      props: { modelValue: 'X:1\nT:C C\nK:C\nC' },
    })

    await wrapper.find('.cm-content').trigger('keydown', { key: 'f', ctrlKey: true })
    const searchPanel = wrapper.find('.cm-search')
    expect(searchPanel.findAll('input').length).toBeGreaterThanOrEqual(1)
    expect(searchPanel.findAll('button').length).toBeGreaterThan(2)
  })
})
