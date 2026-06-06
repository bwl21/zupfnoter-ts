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
    const diagnosticLine = wrapper.find('.cm-abc-diagnostic-line')
    expect(diagnosticLine.exists()).toBe(true)
    expect(diagnosticLine.attributes('title')).toContain('Missing note duration')
    expect(wrapper.find('.cm-abc-diagnostic-line--error').exists()).toBe(true)
  })
})
