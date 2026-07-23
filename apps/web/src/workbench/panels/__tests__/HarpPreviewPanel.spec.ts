import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HarpPreviewPanel from '../HarpPreviewPanel.vue'

describe('HarpPreviewPanel', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('opens the magnifier on shift click', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 240,
      width: 400,
      height: 240,
      toJSON: () => ({}),
    })

    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="200" height="100" viewBox="0 0 200 100"></svg>',
      },
    })

    await nextTick()
    wrapper.find('.harp-preview__frame').element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 120,
      clientY: 80,
      shiftKey: true,
    }))
    await nextTick()

    expect(document.body.querySelector('.harp-magnifier')).not.toBeNull()
  })

  it('closes the magnifier from the close button', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 400,
      bottom: 240,
      width: 400,
      height: 240,
      toJSON: () => ({}),
    })

    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="200" height="100" viewBox="0 0 200 100"></svg>',
      },
    })

    await nextTick()
    wrapper.find('.harp-preview__frame').element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 120,
      clientY: 80,
      shiftKey: true,
    }))
    await nextTick()

    const closeButton = document.body.querySelector('.harp-magnifier .harp-magnifier__close')
    expect(closeButton).not.toBeNull()
    closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(document.body.querySelector('.harp-magnifier')).toBeNull()
  })

  it('shows the real PDF preview when the PDF tab is selected', async () => {
    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="200" height="100" viewBox="0 0 200 100"></svg>',
        pdfUrl: 'blob:test-pdf',
        zoom: 140,
      },
    })

    await wrapper.findAll('.zn-tabs__tab')[4]?.trigger('click')
    await nextTick()

    const pdfFrame = wrapper.find('.harp-preview__pdf-document')
    expect(pdfFrame.exists()).toBe(true)
    expect(pdfFrame.attributes('src')).toBe('blob:test-pdf')
    expect(pdfFrame.attributes('style')).toContain('width: 140%;')
    expect(pdfFrame.attributes('style')).toContain('height: 140%;')
    expect(wrapper.find('.harp-preview__svg').exists()).toBe(false)
  })
})
