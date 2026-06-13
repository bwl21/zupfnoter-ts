import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { computeWheelZoomDelta } from '../useZoomableSvgPreview'
import HarpPreviewPanel from '../HarpPreviewPanel.vue'

function createRect(width: number, height: number): DOMRect {
  return new DOMRect(0, 0, width, height)
}

describe('computeWheelZoomDelta', () => {
  it('keeps small wheel movements gentle and scales larger gestures progressively', () => {
    expect(computeWheelZoomDelta(1)).toBe(1)
    expect(computeWheelZoomDelta(10)).toBe(1)
    expect(computeWheelZoomDelta(40)).toBe(3)
    expect(computeWheelZoomDelta(120)).toBe(7)
    expect(computeWheelZoomDelta(480)).toBe(16)
  })
})

describe('HarpPreviewPanel zooming', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the last zoom focus when the zoom control changes the value', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('harp-preview__frame')) {
        return createRect(500, 250)
      }
      if (this.classList.contains('harp-preview__svg')) {
        return createRect(1000, 500)
      }
      return createRect(0, 0)
    })

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('harp-preview__frame') ? 500 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('harp-preview__frame') ? 250 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientLeft', 'get').mockImplementation(() => 0)
    vi.spyOn(HTMLElement.prototype, 'clientTop', 'get').mockImplementation(() => 0)

    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="1000" height="500" viewBox="0 0 1000 500"></svg>',
      },
    })

    await nextTick()
    await nextTick()

    const frame = wrapper.find('.harp-preview__frame').element as HTMLElement
    expect(frame.scrollLeft).toBe(0)
    expect(frame.scrollTop).toBe(0)

    frame.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      ctrlKey: true,
      deltaY: -120,
      clientX: 100,
      clientY: 80,
    }))
    await nextTick()
    await nextTick()

    expect(frame.scrollLeft).toBeCloseTo(7, 5)
    expect(frame.scrollTop).toBeCloseTo(5.6, 5)

    frame.scrollLeft = 27

    const zoomSlider = wrapper.find('.zn-zoom-control__slider')
    await zoomSlider.setValue('130')
    await nextTick()
    await nextTick()

    expect(frame.scrollLeft).toBeCloseTo(50, 5)
    expect(frame.scrollTop).toBeCloseTo(24, 5)

    await wrapper.find('.zn-zoom-control__value').trigger('click')
    await nextTick()
    await nextTick()

    expect(frame.scrollLeft).toBeCloseTo(0, 5)
    expect(frame.scrollTop).toBeCloseTo(0, 5)

    await zoomSlider.setValue('130')
    await nextTick()
    await nextTick()

    expect(frame.scrollLeft).toBeCloseTo(30, 5)
    expect(frame.scrollTop).toBeCloseTo(24, 5)
  })
})
