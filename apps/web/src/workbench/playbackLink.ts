import {
  exportPlaybackLink,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
  type PlaybackLinkOptions,
} from '@zupfnoter/playback'
import { deflateSync, inflateSync } from 'fflate'

import type { PlaybackStep } from './playback'

/** Browser compression adapter shared by web export and the player. */
export const browserPlaybackCodec: PlaybackCompressionCodec = {
  async compress(value) {
    return new Uint8Array(deflateSync(new Uint8Array(value)))
  },
  async decompress(value) {
    return new Uint8Array(inflateSync(new Uint8Array(value)))
  },
}

/** Converts the existing complete workbench timeline into portable note events. */
export function playbackEventsFromTimeline(
  timeline: readonly PlaybackStep[],
  activeVoiceIds?: ReadonlySet<string>,
): PlaybackEvent[] {
  return timeline.flatMap((step) => {
    const position = step.position ?? { measureNumber: 1, passIndex: step.passIndex }
    return step.activeNotes
      .filter((note) => note.attack)
      .filter((note) => activeVoiceIds === undefined || activeVoiceIds.has(note.originVoiceId))
      .map((note) => ({
        startMs: step.playbackStartMs,
        durationMs: note.durationMs,
        pitch: note.pitch,
        velocity: 127,
        position,
      }))
  })
}

/** Creates one compressed playback link from the existing workbench timeline. */
export async function createPlaybackLinkFromTimeline(
  timeline: readonly PlaybackStep[],
  playerUrl: string,
  activeVoiceIds?: ReadonlySet<string>,
  timeResolutionMs = 10,
) {
  return exportPlaybackLink(
    playbackEventsFromTimeline(timeline, activeVoiceIds),
    { playerUrl, timeResolutionMs } satisfies PlaybackLinkOptions,
    browserPlaybackCodec,
  )
}
