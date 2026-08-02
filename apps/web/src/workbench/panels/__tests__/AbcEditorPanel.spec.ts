import { mount } from '@vue/test-utils'
import { EditorView } from '@codemirror/view'
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
      offset: 0,
      line: 1,
      column: 1,
      unicode: undefined,
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

  it('keeps diagnostics with columns beyond the line inside the document', async () => {
    vi.useFakeTimers()

    const wrapper = mount(AbcEditorPanel, {
      props: {
        modelValue: 'X:1\nT:Demo\nK:C\nC',
        diagnostics: [
          {
            severity: 'error',
            message: 'Invalid character',
            line: 4,
            column: 999,
            source: 'abc-parser',
          },
          {
            severity: 'warning',
            message: 'Earlier warning',
            line: 1,
            column: 1,
            source: 'abc-parser',
          },
        ],
      },
    })

    await vi.advanceTimersByTimeAsync(100)
    await nextTick()

    expect(wrapper.find('.cm-abc-diagnostic-underline').exists()).toBe(true)
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

  it('shows invisible characters without changing the ABC document', async () => {
    const source = 'X:1\nT:De\tmo  \nC:\u00a0\u00ad\u202f\u200b\u200c\u200d\u2060\ufeff'
    const wrapper = mount(AbcEditorPanel, {
      props: {
        modelValue: source,
        showInvisibleCharacters: true,
      },
    })

    await nextTick()

    expect(wrapper.findAll('.cm-abc-invisible-character').length).toBe(8)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.setProps({ showInvisibleCharacters: false })
    await nextTick()

    expect(wrapper.findAll('.cm-abc-invisible-character')).toHaveLength(0)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps invisible character markers disabled by default', async () => {
    const wrapper = mount(AbcEditorPanel, {
      props: {
        modelValue: 'X:1\nT:Demo\t  ',
      },
    })

    await nextTick()

    expect(wrapper.find('.cm-abc-invisible-character').exists()).toBe(false)
  })

  it('restores the requested cursor offset when the editor is mounted again', async () => {
    const wrapper = mount(AbcEditorPanel, {
      props: {
        modelValue: 'X:1\nT:Demo\nK:C\nC D E',
        cursorOffset: 17,
      },
    })

    await nextTick()

    expect(wrapper.emitted('cursor-change')?.[0]?.[0]).toMatchObject({
      offset: 17,
      line: 4,
      column: 3,
      unicode: 'U+0020',
    })
  })

  it('renders multiple externally projected text selections', async () => {
    const wrapper = mount(AbcEditorPanel, {
      props: {
        modelValue: 'X:1\nK:C\nC D E\nC D E',
        selectedTextRanges: [
          { startpos: 11, endpos: 12 },
          { startpos: 17, endpos: 18 },
        ],
      },
    })

    await nextTick()

    const editorView = EditorView.findFromDOM(wrapper.find('.cm-editor').element as HTMLElement)
    expect(editorView?.state.selection.ranges.map((range) => ({ from: range.from, to: range.to }))).toEqual([
      { from: 11, to: 12 },
      { from: 17, to: 18 },
    ])
  })
})
