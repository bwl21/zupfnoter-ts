import {
  exportPlaybackLink,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
  type PlaybackPositionMarker,
  type PlaybackLinkOptions,
} from '@zupfnoter/playback'
import { deflateSync, inflateSync } from 'fflate'
import { playerQrJpegDataUrl } from '@zupfnoter/core'
import type { PlaybackExportData } from '@zupfnoter/core'

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

/** Erzeugt das virtuelle Player-Bild als JPG-Daten-URL für SVG/PDF-Exporte. */
export async function createPlayerQrJpeg(playbackUrl: string): Promise<string> {
  return playerQrJpegDataUrl(playbackUrl)
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

/** Extracts the complete time-based measure/pass track, including silent steps. */
export function playbackPositionsFromTimeline(
  timeline: readonly PlaybackStep[],
): PlaybackPositionMarker[] {
  const markers: PlaybackPositionMarker[] = []
  for (const step of timeline) {
    if (step.position === undefined) continue
    const previous = markers[markers.length - 1]
    const positionChanged = previous === undefined
      || previous.position.measureNumber !== step.position.measureNumber
      || previous.position.passIndex !== step.position.passIndex
    if (positionChanged) {
      markers.push({
        timeMs: step.playbackStartMs,
        position: step.position,
        meter: step.meter,
      })
    } else if (previous !== undefined && previous.meter === undefined && step.meter !== undefined) {
      previous.meter = step.meter
    }
  }
  const finalPositionedStep = [...timeline]
    .reverse()
    .find((step): step is PlaybackStep & { position: NonNullable<PlaybackStep['position']> } => step.position !== undefined)
  const playbackEndMs = timeline.reduce(
    (endMs, step) => Math.max(endMs, step.playbackStartMs + step.durationMs),
    0,
  )
  const lastMarker = markers[markers.length - 1]
  if (finalPositionedStep !== undefined && lastMarker !== undefined && playbackEndMs > lastMarker.timeMs) {
    markers.push({
      timeMs: playbackEndMs,
      position: finalPositionedStep.position,
      meter: undefined,
    })
  }
  return markers
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
    {
      playerUrl,
      timeResolutionMs,
      positionMarkers: playbackPositionsFromTimeline(timeline),
    } satisfies PlaybackLinkOptions,
    browserPlaybackCodec,
  )
}

/** Erzeugt denselben Auszugs-Link wie der Node-CLI-Renderer aus Core-Daten. */
export async function createPlaybackLinkFromExportData(
  exportData: PlaybackExportData,
  playerUrl: string,
  timeResolutionMs = 10,
) {
  return exportPlaybackLink(
    exportData.events.map((event) => ({
      startMs: event.startMs,
      durationMs: event.durationMs,
      pitch: event.pitch,
      velocity: event.velocity,
      position: event.position,
    })),
    {
      playerUrl,
      timeResolutionMs,
      positionMarkers: exportData.positionMarkers,
    } satisfies PlaybackLinkOptions,
    browserPlaybackCodec,
  )
}
