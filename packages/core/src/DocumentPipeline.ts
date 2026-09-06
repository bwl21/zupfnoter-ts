import type { PlaybackConfig, PlaybackLinkOptions, PlaybackPositionMarker, Song, ZupfnoterConfig } from '@zupfnoter/types'
import { AbcParser } from './AbcParser.js'
import { AbcToSong } from './AbcToSong.js'
import { Confstack } from './Confstack.js'
import { buildConfstack } from './buildConfstack.js'
import { createConfigEditorContext } from './ConfigEditorContext.js'
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

/** Nur explizite Dokumentvorgaben exportieren, ohne Built-in-Defaults festzuschreiben. */
export function resolveDocumentPlaybackLinkConfig(abcText: string, extract: number): PlaybackConfig | undefined {
  const { stack } = createConfigEditorContext(extractSongConfig(abcText) ?? {}, extract)
  const path = `extract.${extract}.playback`
  const config = stack.get(path) as PlaybackConfig | undefined
  if (config === undefined) return undefined
  const entries = Object.entries(config).filter(([key]) => {
    const source = stack.getSource(`${path}.${key}`)
    return source !== undefined && source !== 'built-in'
  })
  return entries.length === 0 ? undefined : Object.fromEntries(entries) as PlaybackConfig
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
  const metronome = {
    mode: config?.metronomeMode,
    minLeadIn: config?.minLeadIn,
    bandPreCount: config?.bandPreCount,
    division: config?.division,
    subdivision: config?.subdivision,
  }
  return {
    playerUrl, positionMarkers, tempoBpm, tempoUnit, timeResolutionMs,
    metronome: Object.values(metronome).some((value) => value !== undefined) ? metronome : undefined,
  }
}
