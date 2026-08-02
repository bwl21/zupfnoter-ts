import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { SheetObjectIndex } from '@zupfnoter/types'

import HarpPreviewPanel from '../HarpPreviewPanel.vue'

const sheetObjectIndex: SheetObjectIndex = {
  version: 1,
  lineStarts: [0, 4],
  voiceByLine: { 1: undefined, 2: '4' },
  byZnId: { 'note-4': [0, 1] },
  byConfKey: { 'extract.0.note-4': [1] },
  byTextRange: { '20:24': [0] },
  byMusicTime: { '512': [0] },
  entries: [
    {
      kind: 'music-entity',
      znId: 'note-4',
      voiceId: '4',
      musicTime: 512,
      textRange: { startpos: 20, endpos: 24 },
      startPos: { line: 2, column: 1 },
      endPos: { line: 2, column: 5 },
      addressableIn: { editor: true, score: true, svg: true },
    },
    {
      kind: 'sheet-object',
      znId: 'note-4',
      confKey: 'extract.0.note-4',
      addressableIn: { editor: false, score: false, svg: true },
    },
  ],
}

describe('HarpPreviewPanel selection', () => {
  it('clears the selection when clicking outside a harp hitbox', async () => {
    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><rect width="10" height="10" /></svg>',
      },
    })

    const svg = wrapper.find('.harp-preview__svg svg').element
    svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))

    expect(wrapper.emitted('selection-background-click')).toHaveLength(1)
    expect(wrapper.emitted('select-text-range')).toBeUndefined()
  })

  it('emits fachliche origin data with harp clicks', async () => {
    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><rect class="zupfnoter-hitbox" data-start-char="20" data-end-char="24" data-zn-id="note-4" width="10" height="10" /></svg>',
        sheetObjectIndex,
      },
    })

    wrapper.find('.harp-preview__svg rect').element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: 10,
      clientY: 10,
      shiftKey: true,
    }))
    wrapper.find('.harp-preview__frame').element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      clientX: 10,
      clientY: 10,
      shiftKey: true,
    }))

    expect(wrapper.emitted('select-text-range')).toEqual([
      [{
        startpos: 20,
        endpos: 24,
        extend: true,
        startNewSegment: false,
        origin: {
          voiceId: '4',
          musicTime: 512,
          znId: 'note-4',
        },
        source: 'harp-preview',
      }],
    ])
  })

  it('emits Option-Shift as a new selection segment from the harp preview', async () => {
    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><rect class="zupfnoter-hitbox" data-start-char="20" data-end-char="24" data-zn-id="note-4" width="10" height="10" /></svg>',
        sheetObjectIndex,
      },
    })

    const hitbox = wrapper.find('.harp-preview__svg rect').element
    hitbox.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      shiftKey: true,
      altKey: true,
    }))
    wrapper.find('.harp-preview__frame').element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      button: 0,
      shiftKey: true,
      altKey: true,
    }))

    expect(wrapper.emitted('select-text-range')?.[0]?.[0]).toMatchObject({
      extend: false,
      startNewSegment: true,
    })
  })

  it('keeps Option-Shift available after a first harp selection', async () => {
    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="80" height="20"><rect class="zupfnoter-hitbox" data-start-char="20" data-end-char="24" data-zn-id="note-4" x="0" width="10" height="10" /><rect class="zupfnoter-hitbox" data-start-char="28" data-end-char="32" data-zn-id="note-5" x="20" width="10" height="10" /></svg>',
        sheetObjectIndex: {
          ...sheetObjectIndex,
          byZnId: { 'note-4': [0], 'note-5': [2] },
          byTextRange: { '20:24': [0], '28:32': [2] },
          entries: [
            ...sheetObjectIndex.entries,
            {
              kind: 'music-entity',
              znId: 'note-5',
              voiceId: '4',
              musicTime: 544,
              textRange: { startpos: 28, endpos: 32 },
              addressableIn: { editor: true, score: true, svg: true },
            },
          ],
        },
      },
    })

    const hitboxes = wrapper.findAll('.harp-preview__svg rect')
    const frame = wrapper.find('.harp-preview__frame').element
    hitboxes[0]?.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    frame.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
    hitboxes[1]?.element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      shiftKey: true,
      altKey: true,
    }))
    frame.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      button: 0,
      shiftKey: true,
      altKey: true,
    }))

    expect(wrapper.emitted('select-text-range')?.map((event) => event[0])).toEqual([
      expect.objectContaining({ startpos: 20, startNewSegment: false }),
      expect.objectContaining({ startpos: 28, startNewSegment: true }),
    ])
  })

  it('keeps the voice of a drawable when the znId is shared by voices', async () => {
    const sharedVoiceIndex: SheetObjectIndex = {
      ...sheetObjectIndex,
      byZnId: { 'note-4': [0, 1, 2, 3] },
      byConfKey: {
        'extract.0.notebound.nconf.v_1.t_512.n_0.***': [1],
        'extract.0.notebound.nconf.v_2.t_512.n_0.***': [3],
      },
      entries: [
        ...sheetObjectIndex.entries,
        {
          kind: 'music-entity',
          znId: 'note-4',
          voiceId: '2',
          musicTime: 512,
          textRange: { startpos: 20, endpos: 24 },
          startPos: { line: 2, column: 1 },
          endPos: { line: 2, column: 5 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'sheet-object',
          znId: 'note-4',
          confKey: 'extract.0.notebound.nconf.v_2.t_512.n_0.***',
          addressableIn: { editor: false, score: false, svg: true },
        },
      ],
    }
    const wrapper = mount(HarpPreviewPanel, {
      props: {
        svg: '<svg width="40" height="20"><g class="zupfnoter-element" data-conf-key="extract.0.notebound.nconf.v_2.t_512.n_0.***"><rect class="zupfnoter-element zupfnoter-hitbox" data-start-char="20" data-end-char="24" data-zn-id="note-4" width="10" height="10" /></g></svg>',
        sheetObjectIndex: sharedVoiceIndex,
      },
    })

    wrapper.find('.zupfnoter-hitbox').element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: 10,
      clientY: 10,
    }))
    wrapper.find('.harp-preview__frame').element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      clientX: 10,
      clientY: 10,
    }))

    expect(wrapper.emitted('select-text-range')?.[0]?.[0]).toMatchObject({
      origin: expect.objectContaining({ voiceId: '2' }),
    })
  })
})
