import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { usePlaybackStore } from '../playback'
import { useSelectionStore } from '../selection'

describe('playback store', () => {
  it('resolves playback mode from the shared selection state', () => {
    setActivePinia(createPinia())

    const selectionStore = useSelectionStore()
    const playbackStore = usePlaybackStore()

    expect(playbackStore.mode).toBe('all-score')

    selectionStore.selectZnId('note-1')
    expect(playbackStore.mode).toBe('from-note-harp')

    selectionStore.selectMusicRange(['note-1', 'note-2'])
    expect(playbackStore.mode).toBe('range-harp')
  })

  it('updates highlight and stops playback when the document changes', () => {
    setActivePinia(createPinia())

    const playbackStore = usePlaybackStore()

    playbackStore.startPlayback(120)
    expect(playbackStore.state.status).toBe('playing')
    expect(playbackStore.state.baseTempoFromQ).toBe(120)

    playbackStore.handlePlayerEvent({
      kind: 'current-notes',
      activeZnIds: ['zn-1', 'zn-2'],
      activeStartChar: 41,
      activeTime: '1:2',
    })

    expect(playbackStore.highlight.activeZnIds).toEqual(['zn-1', 'zn-2'])
    expect(playbackStore.highlight.activeStartChar).toBe(41)
    expect(playbackStore.highlight.activeTime).toBe('1:2')

    playbackStore.markDocumentChanged()

    expect(playbackStore.state.status).toBe('stopped')
    expect(playbackStore.state.documentVersion).toBe(1)
    expect(playbackStore.highlight.activeZnIds).toEqual([])
  })
})
