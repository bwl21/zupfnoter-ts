/**
 * Playback model shared by the workbench and later worker/player layers.
 */

import type { SelectionTextRange } from './selection.js'

/**
 * One note scheduled by playback.
 */
export interface PlaybackNote {
  pitch: number
  durationMs: number
  attack: boolean
}

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
  totalPassCount?: number
}

/**
 * Highlight information emitted by the player.
 */
export interface PlaybackHighlight {
  activeTextRanges: SelectionTextRange[]
  activeStartChar?: number
  activeTime?: string
  passIndex?: number
  voltaNumber?: number
}

/**
 * One step in the expanded playback flow after repeats and voltas are resolved.
 */
export interface PlaybackFlowStep {
  /** Playback start time in milliseconds after local traversal. */
  playbackStartMs: number
  /** Time position of the originating notated material in abc2svg units. */
  sourceTime: number
  /** Zupfnoter ids of the notated playables that sound at this flow step. */
  originZnIds: string[]
  /** Addressable ABC text ranges that belong to this flow step. */
  activeTextRanges: SelectionTextRange[]
  /** Notes that should be triggered at this step. */
  activeNotes: PlaybackNote[]
  /** Earliest ABC start offset of the grouped playables, if available. */
  activeStartChar?: number
  /** Index within the expanded playback flow. */
  flowIndex: number
  /** Sequential pass number in the expanded traversal. */
  passIndex: number
  /** Volta number of this step when it belongs to a variant ending. */
  voltaNumber?: number
}

/**
 * Player events consumed by the workbench playback adapter.
 */
export type PlaybackPlayerEvent =
    | {
      kind: 'current-notes'
      activeTextRanges: SelectionTextRange[]
      activeStartChar?: number
      activeTime?: string
      passIndex?: number
      voltaNumber?: number
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
