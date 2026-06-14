import type { PlaybackHighlight, SelectionProjection, SelectionState } from '@zupfnoter/types'
import type { SelectionTextRange } from '@zupfnoter/types'

export interface HarpMirrorSnapshot {
  abcText: string
  currentExtract: number
  scoreSvg: string
  harpSvg: string
  renderError: string
  playbackHighlight: PlaybackHighlight
  selection: SelectionProjection
  selectionState: SelectionState
  selectedScoreTextRanges: SelectionTextRange[]
  playbackScoreTextRanges: SelectionTextRange[]
  harpZoom: number
  scrollLeft: number
  scrollTop: number
}

export interface HarpMirrorMessage {
  kind: 'snapshot'
  snapshot: HarpMirrorSnapshot
}

const CHANNEL_NAME = 'zupfnoter-view-duplication'

export function createHarpMirrorChannel(): BroadcastChannel | undefined {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return undefined
  }
  return new BroadcastChannel(CHANNEL_NAME)
}

export function postHarpMirrorSnapshot(channel: BroadcastChannel | undefined, snapshot: HarpMirrorSnapshot): void {
  if (channel === undefined) return
  const message: HarpMirrorMessage = { kind: 'snapshot', snapshot }
  channel.postMessage(message)
}
