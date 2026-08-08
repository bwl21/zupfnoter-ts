import {
  exportPlaybackLink,
  type PlaybackCompressionCodec,
  type PlaybackEvent,
  type PlaybackPositionMarker,
  type PlaybackLinkOptions,
  type PlaybackMetronomeConfig,
} from '@zupfnoter/playback'
import { deflateSync, inflateSync } from 'fflate'
import {
  buildPlaybackExportDataFromTimeline,
  playerQrJpegDataUrl,
} from '@zupfnoter/core'
import type { PlaybackExportData } from '@zupfnoter/core'

import type { PlaybackStep } from './playback'
import type { PlaybackConfig } from '@zupfnoter/types'

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
  return buildPlaybackExportDataFromTimeline(timeline, activeVoiceIds).events.map((event) => ({
    startMs: event.startMs,
    durationMs: event.durationMs,
    pitch: event.pitch,
    velocity: event.velocity,
    position: event.position,
  }))
}

/** Extracts the complete time-based measure/pass track, including silent steps. */
export function playbackPositionsFromTimeline(
  timeline: readonly PlaybackStep[],
): PlaybackPositionMarker[] {
  return buildPlaybackExportDataFromTimeline(timeline).positionMarkers.map((marker) => ({
    timeMs: marker.timeMs,
    position: marker.position,
    meter: marker.meter,
    partName: marker.partName,
  }))
}

function toPlaybackMetronomeConfig(config: PlaybackConfig | undefined): PlaybackMetronomeConfig | undefined {
  if (config === undefined || config.metronomeMode === undefined) return undefined
  return {
    mode: config.metronomeMode,
    minLeadIn: config.minLeadIn,
    bandPreCount: config.bandPreCount,
    division: config.division,
    subdivision: config.subdivision,
  }
}

/** Creates one compressed playback link from the existing workbench timeline. */
export async function createPlaybackLinkFromTimeline(
  timeline: readonly PlaybackStep[],
  playerUrl: string,
  activeVoiceIds?: ReadonlySet<string>,
  timeResolutionMs = 10,
  tempoBpm?: number,
  tempoUnit?: number,
  playbackConfig?: PlaybackConfig,
) {
  return exportPlaybackLink(
    playbackEventsFromTimeline(timeline, activeVoiceIds),
    {
      playerUrl,
      timeResolutionMs,
      positionMarkers: playbackPositionsFromTimeline(timeline),
      tempoBpm,
      tempoUnit,
      metronome: toPlaybackMetronomeConfig(playbackConfig),
    } satisfies PlaybackLinkOptions,
    browserPlaybackCodec,
  )
}

/** Erzeugt denselben Auszugs-Link wie der Node-CLI-Renderer aus Core-Daten. */
export async function createPlaybackLinkFromExportData(
  exportData: PlaybackExportData,
  playerUrl: string,
  timeResolutionMs = 10,
  tempoBpm?: number,
  tempoUnit?: number,
  playbackConfig?: PlaybackConfig,
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
      tempoBpm,
      tempoUnit,
      metronome: toPlaybackMetronomeConfig(playbackConfig),
    } satisfies PlaybackLinkOptions,
    browserPlaybackCodec,
  )
}
