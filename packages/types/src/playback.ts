/**
 * Playback model shared by the workbench and later worker/player layers.
 */

/**
 * Runtime status of playback.
 */
export type PlaybackStatus = 'stopped' | 'playing' | 'paused'

/**
 * Playback mode resolved from the current selection.
 */
export type PlaybackMode = 'all-score' | 'from-note-harp' | 'range-harp'

/**
 * Shared playback state for the workbench.
 */
export interface PlaybackState {
  status: PlaybackStatus
  mode?: PlaybackMode
  speedFactor: number
  baseTempoFromQ?: number
  activeExtract: number
  documentVersion: number
}

/**
 * Highlight information emitted by the player.
 */
export interface PlaybackHighlight {
  activeZnIds: string[]
  activeStartChar?: number
  activeTime?: string
}

/**
 * Player events consumed by the workbench playback adapter.
 */
export type PlaybackPlayerEvent =
  | {
      kind: 'current-notes'
      activeZnIds: string[]
      activeStartChar?: number
      activeTime?: string
    }
  | {
      kind: 'clear-highlight'
    }
  | {
      kind: 'pause'
    }
  | {
      kind: 'stop'
    }
