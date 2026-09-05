import type { PlaybackConfig, PlaybackLinkOptions, PlaybackPositionMarker, Song, ZupfnoterConfig } from '@zupfnoter/types'
import { AbcParser } from './AbcParser.js'
import { AbcToSong } from './AbcToSong.js'
import { Confstack } from './Confstack.js'
import { buildConfstack } from './buildConfstack.js'
import { extractSongConfig, mergeSongConfig } from './extractSongConfig.js'
import { initConf } from './initConf.js'
import { HarpnotesLayout } from './HarpnotesLayout.js'
import { createDefaultAnnotationTextMetrics, type HarpnotesLayoutOptions } from './TextMetrics.js'

/** Gemeinsame Built-in-/Dokumentkonfiguration für sämtliche Einstiegspunkte. */
export function prepareDocumentConfig(abcText: string): ZupfnoterConfig {
  return mergeSongConfig(initConf(new Confstack()), extractSongConfig(abcText))
}

/** Der optionale Parser erlaubt dem Aufrufer, dieselben Diagnosen auszulesen. */
export function parseDocumentSong(abcText: string, config = prepareDocumentConfig(abcText), parser = new AbcParser()): Song {
  return new AbcToSong().transform(parser.parse(abcText), config)
}

/** Gemeinsame Textmetriken; Plattform-I/O und Interaktivität sind explizite Optionen. */
export function layoutDocumentExtract(song: Song, config: ZupfnoterConfig, extract: number, format: 'A3' | 'A4' = 'A3', options: HarpnotesLayoutOptions = {}) {
  return new HarpnotesLayout(config, {
    annotationTextMetrics: createDefaultAnnotationTextMetrics(),
    ...options,
  }).layout(song, extract, format)
}

/** Wirksame Empfehlung des Auszugs, einschließlich Vererbung aus Auszug 0. */
export function resolveDocumentPlaybackConfig(config: ZupfnoterConfig, extract: number): PlaybackConfig | undefined {
  return buildConfstack(config, extract).get(`extract.${extract}.playback`) as PlaybackConfig | undefined
}

/** Plattformunabhängige Link-Metadaten; Kompression verbleibt beim Adapter. */
export function preparePlaybackLinkOptions(
  playerUrl: string,
  positionMarkers: readonly PlaybackPositionMarker[],
  tempoBpm?: number,
  tempoUnit?: number,
  config?: PlaybackConfig,
  timeResolutionMs = 10,
): PlaybackLinkOptions {
  return {
    playerUrl, positionMarkers, tempoBpm, tempoUnit, timeResolutionMs,
    metronome: config?.metronomeMode === undefined ? undefined : {
      mode: config.metronomeMode,
      minLeadIn: config.minLeadIn,
      bandPreCount: config.bandPreCount,
      division: config.division,
      subdivision: config.subdivision,
    },
  }
}
