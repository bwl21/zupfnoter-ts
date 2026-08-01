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

export interface HarpPreviewDragEnd {
  confKey: string
  handler: string
  delta: [number, number]
  value?: number | [number, number]
  updates?: Array<{ confKey: string; value: number | [number, number] }>
  source: 'harp-preview'
}

export interface HarpMirrorMessage {
  kind: 'snapshot'
  snapshot: HarpMirrorSnapshot
}

export interface HarpMirrorDragEndMessage {
  kind: 'mirror-drag-end'
  payload: HarpPreviewDragEnd
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
