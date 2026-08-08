/**
 * Playback model shared by the workbench and later worker/player layers.
 */

import type { SelectionTextRange } from './selection.js'
import type { TimeSignature } from './music.js'
import type { PlaybackPosition } from './playbackLink.js'

/**
 * Runtime status of playback.
 */
export type PlaybackStatus = 'stopped' | 'playing' | 'paused'

/**
 * Playback mode resolved from the current selection.
 */
export type PlaybackMode = 'all-score' | 'from-note-harp' | 'range-harp'

/** Controls whether the shared metronome clicks during count-in and playback. */
export type PlaybackMetronomeMode = 'off' | 'countIn' | 'playback' | 'always'

/** Per-extract playback recommendation and metronome settings. */
export interface PlaybackConfig {
  metronomeMode?: PlaybackMetronomeMode
  /** Minimum number of audible main beats before the actual musical entry. */
  minLeadIn?: number
  /** Adds the explicit Zupfnoter band pre-count before normal entry counting. */
  bandPreCount?: boolean
  /** Number of main count beats per measure. */
  division?: number
  /** Number of audible subdivisions per main count beat. */
  subdivision?: number
}

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
  /** Time position of the originating notated material in abc2svg units. */
  sourceTime: number
  /** Zupfnoter ids of the notated playables that sound at this flow step. */
  originZnIds: string[]
  /** Addressable ABC text ranges that belong to this flow step. */
  activeTextRanges: SelectionTextRange[]
  /** Earliest ABC start offset of the grouped playables, if available. */
  activeStartChar?: number
  /** Index within the expanded playback flow. */
  flowIndex: number
  /** Sequential pass number in the expanded traversal. */
  passIndex: number
  /** Canonical notated measure number for this playback step. */
  measureNumber: number
  /** Taktart am Beginn dieses Taktes. */
  meter?: TimeSignature
  /** Partname at the beginning of this playback step, if explicitly named. */
  partName?: string
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

/** A note on the shared, expanded playback timeline. */
export interface PlaybackNote {
  originVoiceId: string
  originPlaybackId: string
  originZnId: string
  pitch: number
  durationMs: number
  attack: boolean
  pan: 'left' | 'right'
}

export interface PlaybackStepTextRange {
  playbackId: string
  voiceId: string
  textRange: SelectionTextRange
}

/** One time-based step of the expanded playback flow. */
export interface PlaybackStep {
  originVoiceIds: string[]
  originPlaybackIds: string[]
  originZnIds: string[]
  activeTextRanges: SelectionTextRange[]
  activePlaybackTextRanges?: PlaybackStepTextRange[]
  /** Playback identities whose visual highlight ends at this step. */
  endedPlaybackIds?: string[]
  activeNotes: PlaybackNote[]
  activeStartChar?: number
  activeTime: string
  playbackStartMs: number
  durationMs: number
  sourceTime: number
  position?: PlaybackPosition
  /** Time signature at the beginning of the measure. */
  meter?: TimeSignature
  /** Partname at the beginning of this playback step, if explicitly named. */
  partName?: string
  flowIndex: number
  passIndex: number
  voltaNumber?: number
}
