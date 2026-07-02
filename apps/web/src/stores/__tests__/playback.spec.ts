import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import type { SheetObjectIndex } from '@zupfnoter/types'

import { usePlaybackStore } from '../playback'
import { useSelectionStore } from '../selection'

const sheetObjectIndex: SheetObjectIndex = {
  version: 1,
  lineStarts: [0],
  voiceByLine: {},
  byZnId: {
    'note-1': [0],
    'note-2': [1],
  },
  byConfKey: {},
  byTextRange: {},
  entries: [
    {
      kind: 'music-entity',
      znId: 'note-1',
      addressableIn: { editor: false, score: false, svg: true },
    },
    {
      kind: 'music-entity',
      znId: 'note-2',
      addressableIn: { editor: false, score: false, svg: true },
    },
  ],
}

describe('playback store', () => {
  it('resolves playback mode from the shared selection state', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    const playbackStore = usePlaybackStore()
    selectionStore.setSheetObjectIndex(sheetObjectIndex)

    expect(playbackStore.mode).toBe('all-score')

    selectionStore.selectZnId('note-1', 'harp-preview')
    expect(playbackStore.mode).toBe('range-harp')

    selectionStore.selectMusicRange(['note-1', 'note-2'], 'harp-preview')
    expect(playbackStore.mode).toBe('range-harp')
  })

  it('resolves editor-driven note selections as selection playback too', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    const playbackStore = usePlaybackStore()
    selectionStore.setSheetObjectIndex({
      ...sheetObjectIndex,
      byTextRange: {
        '4:6': [0],
      },
      entries: [
        {
          kind: 'music-entity',
          znId: 'note-1',
          textRange: { startpos: 4, endpos: 6 },
          addressableIn: { editor: true, score: true, svg: true },
        },
        {
          kind: 'music-entity',
          znId: 'note-2',
          textRange: { startpos: 8, endpos: 10 },
          addressableIn: { editor: true, score: true, svg: true },
        },
      ],
    })

    selectionStore.selectTextRange(4, 6, 'abc-editor')

    expect(playbackStore.mode).toBe('range-harp')
  })

  it('updates highlight and stops playback when the document changes', () => {
    setActivePinia(createPinia())

    const playbackStore = usePlaybackStore()

    playbackStore.startPlayback(120, 2)
    expect(playbackStore.state.status).toBe('playing')
    expect(playbackStore.state.baseTempoFromQ).toBe(120)
    expect(playbackStore.state.totalPassCount).toBe(2)

    playbackStore.handlePlayerEvent({
      kind: 'current-notes',
      activeTextRanges: [{ startpos: 41, endpos: 46 }],
      activeStartChar: 41,
      activeTime: '1:2',
      passIndex: 2,
      voltaNumber: 2,
    })

    expect(playbackStore.highlight.activeTextRanges).toEqual([{ startpos: 41, endpos: 46 }])
    expect(playbackStore.highlight.activeStartChar).toBe(41)
    expect(playbackStore.highlight.activeTime).toBe('1:2')
    expect(playbackStore.highlight.passIndex).toBe(2)
    expect(playbackStore.highlight.voltaNumber).toBe(2)

    playbackStore.markDocumentChanged()

    expect(playbackStore.state.status).toBe('stopped')
    expect(playbackStore.state.documentVersion).toBe(1)
    expect(playbackStore.state.totalPassCount).toBeUndefined()
    expect(playbackStore.highlight.activeTextRanges).toEqual([])
  })
})
