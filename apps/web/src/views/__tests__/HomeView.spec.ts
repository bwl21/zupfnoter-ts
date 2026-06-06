import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HomeView from '../HomeView.vue'

describe('HomeView', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the reference sheet panes', async () => {
    vi.useFakeTimers()
    const wrapper = mount(HomeView)

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
})
