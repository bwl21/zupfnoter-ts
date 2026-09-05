import type { PlaybackConfig, ReviewDocument, ReviewExtract, SongResources } from '@zupfnoter/types'

import { AbcParser } from './AbcParser.js'
import { AbcToSong } from './AbcToSong.js'
import { buildConfstack } from './buildConfstack.js'
import { Confstack } from './Confstack.js'
import { extractSongConfig, extractSongResources, mergeSongConfig } from './extractSongConfig.js'
import { HarpnotesLayout } from './HarpnotesLayout.js'
import { initConf } from './initConf.js'
import {
  buildPlaybackTimeline,
  resolveBaseTempoFromSong,
  resolveTempoUnitFromSong,
} from './PlaybackTimeline.js'
import { SvgEngine } from './SvgEngine.js'
import { createDefaultAnnotationTextMetrics } from './TextMetrics.js'

function resourceUrl(resources: SongResources, imageName: string): string | undefined {
  const parts = resources[imageName]
  return parts === undefined ? undefined : parts.join('')
}

function previewSvg(svg: string): string {
  return svg.replace(/(<svg[^>]*)\s+width="[^"]*"\s+height="[^"]*"/, '$1 width="100%"')
}

/** Rendert genau die Daten, die ein schreibgeschützter Review-Client benötigt. */
export function renderReviewDocument(abcText: string, extractNumber = 0): ReviewDocument {
  const config = mergeSongConfig(initConf(new Confstack()), extractSongConfig(abcText))
  const resources = extractSongResources(abcText)
  const song = new AbcToSong().transform(new AbcParser().parse(abcText), config)
  const sheet = new HarpnotesLayout(config, {
    annotationTextMetrics: createDefaultAnnotationTextMetrics(),
    imageResolver: (imageName) => resourceUrl(resources, imageName),
    interactive: true,
  }).layout(song, extractNumber, 'A3')
  const configuredExtracts =
    config.produce !== undefined && config.produce.length > 0 ? config.produce : [extractNumber]
  const extractNumbers = [...new Set([extractNumber, ...configuredExtracts])]
  const extracts: ReviewExtract[] = extractNumbers.map((number) => ({
    number,
    title:
      config.extract[String(number)]?.title?.trim() ||
      (number === 0 ? 'Alle Stimmen' : `Auszug ${number}`),
  }))
  const playbackConfig = buildConfstack(config, extractNumber).get(
    `extract.${extractNumber}.playback`,
  ) as PlaybackConfig | undefined

  return {
    title: song.metaData.title?.trim() || 'Unbenanntes Stück',
    extractNumber,
    extracts,
    scoreSvg: new AbcParser().renderSvg(abcText),
    harpSvg: previewSvg(new SvgEngine({ interactive: true }).draw(sheet)),
    playbackTimeline: buildPlaybackTimeline(song, sheet.activeVoices),
    playbackConfig,
    baseTempoBpm: resolveBaseTempoFromSong(song),
    tempoUnit: resolveTempoUnitFromSong(song),
  }
}
