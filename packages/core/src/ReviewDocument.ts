import { prepareDocumentConfig, parseDocumentSong, layoutDocumentExtract, resolveDocumentPlaybackConfig } from './DocumentPipeline.js'
import type { ReviewDocument, ReviewExtract, SongResources } from '@zupfnoter/types'

import { AbcParser } from './AbcParser.js'
import { extractSongResources } from './extractSongConfig.js'
import {
  buildPlaybackTimeline,
  filterPlaybackTimelineToVoices,
  resolveBaseTempoFromSong,
  resolveTempoUnitFromSong,
} from './PlaybackTimeline.js'
import { SvgEngine } from './SvgEngine.js'

function resourceUrl(resources: SongResources, imageName: string): string | undefined {
  const parts = resources[imageName]
  return parts === undefined ? undefined : parts.join('')
}

function previewSvg(svg: string): string {
  return svg.replace(/(<svg[^>]*)\s+width="[^"]*"\s+height="[^"]*"/, '$1 width="100%"')
}

/** Rendert genau die Daten, die ein schreibgeschützter Review-Client benötigt. */
export function renderReviewDocument(abcText: string, extractNumber = 0): ReviewDocument {
  const config = prepareDocumentConfig(abcText)
  const resources = extractSongResources(abcText)
  const song = parseDocumentSong(abcText, config)
  const sheet = layoutDocumentExtract(song, config, extractNumber, 'A3', {
    imageResolver: (imageName) => resourceUrl(resources, imageName),
    interactive: true,
  })
  const configuredExtracts =
    config.produce !== undefined && config.produce.length > 0 ? config.produce : [extractNumber]
  const extractNumbers = [...new Set([extractNumber, ...configuredExtracts])]
  const extracts: ReviewExtract[] = extractNumbers.map((number) => ({
    number,
    title:
      config.extract[String(number)]?.title?.trim() ||
      (number === 0 ? 'Alle Stimmen' : `Auszug ${number}`),
  }))
  const playbackConfig = resolveDocumentPlaybackConfig(config, extractNumber)

  return {
    title: song.metaData.title?.trim() || 'Unbenanntes Stück',
    extractNumber,
    extracts,
    scoreSvg: new AbcParser().renderSvg(abcText),
    harpSvg: previewSvg(new SvgEngine({ interactive: true }).draw(sheet)),
    playbackTimeline: filterPlaybackTimelineToVoices(
      buildPlaybackTimeline(song),
      sheet.activeVoices.map((voiceNumber) => `${voiceNumber}`),
    ),
    playbackConfig,
    baseTempoBpm: resolveBaseTempoFromSong(song),
    tempoUnit: resolveTempoUnitFromSong(song),
  }
}
