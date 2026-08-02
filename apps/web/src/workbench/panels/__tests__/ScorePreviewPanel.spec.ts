import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { SheetObjectIndex } from '@zupfnoter/types'

import ScorePreviewPanel from '../ScorePreviewPanel.vue'

const sheetObjectIndex: SheetObjectIndex = {
  version: 1,
  lineStarts: [0, 4],
  voiceByLine: { 1: undefined, 2: '3' },
  byZnId: { 'note-3': [0] },
  byConfKey: {},
  byTextRange: { '12:18': [0, 1] },
  byMusicTime: { '384': [0] },
  entries: [
    {
      kind: 'music-entity',
      znId: 'note-3',
      voiceId: '3',
      musicTime: 384,
      textRange: { startpos: 12, endpos: 18 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 7 },
      addressableIn: { editor: true, score: true, svg: true },
    },
    {
      kind: 'score-object',
      textRange: { startpos: 12, endpos: 18 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 7 },
      addressableIn: { editor: true, score: true, svg: false },
    },
  ],
}

describe('ScorePreviewPanel', () => {
  it('renders the score svg without zoom controls', () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="200" height="100" viewBox="0 0 200 100"></svg>',
      },
    })

    expect(wrapper.find('.preview-stage__svg svg').exists()).toBe(true)
    expect(wrapper.find('.zn-zoom-control').exists()).toBe(false)
  })

  it('emits selected znId clicks from the injected svg', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><rect class="zn-score-hitbox" data-start-char="12" data-end-char="18" width="10" height="10" /></svg>',
        sheetObjectIndex,
      },
    })

    wrapper.find('.preview-stage__svg rect').element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
    }))
    wrapper.find('.preview-stage__svg rect').element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      button: 0,
    }))

    expect(wrapper.emitted('select-text-range')).toEqual([
      [{
        startpos: 12,
        endpos: 18,
        extend: false,
        startNewSegment: false,
        origin: {
          voiceId: '3',
          musicTime: 384,
          znId: 'note-3',
        },
        source: 'score-preview',
      }],
    ])
  })

  it('emits shift-clicks as range extensions', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><rect class="zn-score-hitbox" data-start-char="12" data-end-char="18" width="10" height="10" /></svg>',
        sheetObjectIndex,
      },
    })

    wrapper.find('.preview-stage__svg rect').element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      shiftKey: true,
    }))
    wrapper.find('.preview-stage__svg rect').element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      button: 0,
      shiftKey: true,
    }))

    expect(wrapper.emitted('select-text-range')).toEqual([
      [{
        startpos: 12,
        endpos: 18,
        extend: true,
        startNewSegment: false,
        origin: {
          voiceId: '3',
          musicTime: 384,
          znId: 'note-3',
        },
        source: 'score-preview',
      }],
    ])
  })

  it('emits option-shift-clicks as new selection segments', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><rect class="zn-score-hitbox" data-start-char="12" data-end-char="18" width="10" height="10" /></svg>',
        sheetObjectIndex,
      },
    })

    const hitbox = wrapper.find('.preview-stage__svg rect').element
    hitbox.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      shiftKey: true,
      altKey: true,
    }))
    hitbox.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      button: 0,
      shiftKey: true,
    }))

    expect(wrapper.emitted('select-text-range')?.[0]?.[0]).toMatchObject({
      extend: false,
      startNewSegment: true,
    })
  })

  it('clears the selection when clicking outside a score hitbox', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><rect width="10" height="10" /></svg>',
      },
    })

    const svg = wrapper.find('.preview-stage__svg svg').element
    svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))

    expect(wrapper.emitted('selection-background-click')).toHaveLength(1)
    expect(wrapper.emitted('select-text-range')).toBeUndefined()
  })

  it('marks score selection as pending until the pointer is released', async () => {
    const wrapper = mount(ScorePreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><rect class="zn-score-hitbox" data-start-char="12" data-end-char="18" width="10" height="10" /></svg>',
      },
    })

    const pointerDown = new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    })
    wrapper.find('.preview-stage__svg rect').element.dispatchEvent(pointerDown)
    wrapper.find('.preview-stage__svg').element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      button: 0,
    }))

    expect(pointerDown.defaultPrevented).toBe(true)
    expect(wrapper.emitted('selection-gesture')).toEqual([[true], [false]])
  })
})
