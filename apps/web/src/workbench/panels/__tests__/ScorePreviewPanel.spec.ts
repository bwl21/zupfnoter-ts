import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ScorePreviewPanel from '../ScorePreviewPanel.vue'

const SVG_SOURCE = '<svg width="200" height="100" viewBox="0 0 200 100"></svg>'
const MULTI_SVG_SOURCE = [
  '<svg width="200" height="100" viewBox="0 0 200 100"></svg>',
  '<svg width="200" height="220" viewBox="0 0 200 220"></svg>',
].join('')

describe('ScorePreviewPanel', () => {
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
  const originalGetComputedStyle = window.getComputedStyle

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    if (originalClientWidth !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
    }
    if (originalClientHeight !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
    }
    window.getComputedStyle = originalGetComputedStyle
    vi.restoreAllMocks()
  })

  it('fits the preview at 100% and scales beyond it', async () => {
    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLElement) {
      if (this.classList.contains('preview-stage__frame')) {
        return new DOMRect(0, 0, 1000, 500)
      }

      if (this.classList.contains('preview-stage__svg')) {
        return this.children.length === 2
          ? new DOMRect(0, 0, 200, 320)
          : new DOMRect(0, 0, 200, 100)
      }

      return new DOMRect(0, 0, 0, 0)
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 1000,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 500,
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
      const style = originalGetComputedStyle.call(window, element)
      return Object.assign({}, style, {
        paddingLeft: '0px',
        paddingRight: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
      }) as CSSStyleDeclaration
    })

    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: SVG_SOURCE,
        zoom: 100,
      },
    })

    await nextTick()
    await nextTick()

    const canvas = wrapper.find('.preview-stage__svg').element as HTMLElement
    expect(canvas.style.width).toBe('1000px')
    expect(canvas.style.height).toBe('500px')

    await wrapper.setProps({ zoom: 200 })
    await nextTick()

    expect(canvas.style.width).toBe('2000px')
    expect(canvas.style.height).toBe('1000px')
  })

  it('keeps the cursor position centered while zooming with the wheel', async () => {
    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLElement) {
      if (this.classList.contains('preview-stage__frame')) {
        return new DOMRect(0, 0, 1000, 500)
      }

      if (this.classList.contains('preview-stage__svg')) {
        return new DOMRect(0, 0, 200, 100)
      }

      return new DOMRect(0, 0, 0, 0)
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 1000,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 500,
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
      const style = originalGetComputedStyle.call(window, element)
      return Object.assign({}, style, {
        paddingLeft: '8px',
        paddingRight: '8px',
        paddingTop: '8px',
        paddingBottom: '8px',
      }) as CSSStyleDeclaration
    })

    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: SVG_SOURCE,
        zoom: 100,
      },
    })

    await nextTick()
    await nextTick()

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -120,
      clientX: 258,
      clientY: 133,
    })
    wrapper.find('.preview-stage__frame').element.dispatchEvent(wheelEvent)

    await nextTick()
    await nextTick()

    const frame = wrapper.find('.preview-stage__frame').element as HTMLElement
    expect(frame.scrollLeft).toBe(75)
    expect(frame.scrollTop).toBe(37.5)
  })

  it('pans the preview while dragging with the primary mouse button', async () => {
    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLElement) {
      if (this.classList.contains('preview-stage__frame')) {
        return new DOMRect(0, 0, 1000, 500)
      }

      if (this.classList.contains('preview-stage__svg')) {
        return new DOMRect(0, 0, 200, 100)
      }

      return new DOMRect(0, 0, 0, 0)
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 1000,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 500,
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
      const style = originalGetComputedStyle.call(window, element)
      return Object.assign({}, style, {
        paddingLeft: '0px',
        paddingRight: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
      }) as CSSStyleDeclaration
    })

    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: SVG_SOURCE,
        zoom: 200,
      },
    })

    await nextTick()
    await nextTick()

    const frame = wrapper.find('.preview-stage__frame').element as HTMLElement

    frame.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      pointerId: 7,
      clientX: 500,
      clientY: 250,
    }))

    frame.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      buttons: 1,
      pointerId: 7,
      clientX: 450,
      clientY: 200,
    }))

    frame.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 0,
      pointerId: 7,
      clientX: 450,
      clientY: 200,
    }))

    await nextTick()

    expect(frame.scrollLeft).toBe(50)
    expect(frame.scrollTop).toBe(50)
  })

  it('measures the full content when multiple svg blocks are rendered', async () => {
    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLElement) {
      if (this.classList.contains('preview-stage__frame')) {
        return new DOMRect(0, 0, 1000, 500)
      }

      if (this.classList.contains('preview-stage__svg')) {
        return this.children.length === 2
          ? new DOMRect(0, 0, 200, 320)
          : new DOMRect(0, 0, 200, 100)
      }

      return new DOMRect(0, 0, 0, 0)
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 1000,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 500,
    })
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
      const style = originalGetComputedStyle.call(window, element)
      return Object.assign({}, style, {
        paddingLeft: '0px',
        paddingRight: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
      }) as CSSStyleDeclaration
    })

    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: MULTI_SVG_SOURCE,
        zoom: 100,
      },
    })

    await nextTick()
    await nextTick()

    const canvas = wrapper.find('.preview-stage__svg').element as HTMLElement
    expect(canvas.style.width).toBe('312.5px')
    expect(canvas.style.height).toBe('500px')
  })
})
