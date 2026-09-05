import { describe, expect, it } from 'vitest'
import { prepareDocumentConfig, parseDocumentSong, layoutDocumentExtract, resolveDocumentPlaybackConfig, preparePlaybackLinkOptions } from '../../DocumentPipeline.js'
import { buildPlaybackExportData, buildPlaybackExportDataFromTimeline } from '../../PlaybackExport.js'
import { buildPlaybackTimeline, resolveBaseTempoFromSong, resolveTempoUnitFromSong } from '../../PlaybackTimeline.js'

const abc = `X:1
T:Export-Metadaten
M:3/4
L:1/4
Q:1/8=80.00
K:C
C D E|

%%%%zupfnoter.config
{"extract":{"0":{"playback":{"metronomeMode":"always","division":3,"subdivision":2,"minLeadIn":4}},"1":{"voices":[1]}}}
`

describe('gemeinsame Dokument-/Exportvorbereitung', () => {
  it('preserves inherited metronome and non-quarter tempo metadata for all exporters', () => {
    const config = prepareDocumentConfig(abc)
    const song = parseDocumentSong(abc, config)
    const sheet = layoutDocumentExtract(song, config, 1)
    const nodeData = buildPlaybackExportData(song, sheet.activeVoices)
    const webData = buildPlaybackExportDataFromTimeline(buildPlaybackTimeline(song), new Set(['1']))
    expect(nodeData).toEqual(webData)
    const options = preparePlaybackLinkOptions('https://practice.example/', nodeData.positionMarkers,
      resolveBaseTempoFromSong(song), resolveTempoUnitFromSong(song), resolveDocumentPlaybackConfig(config, 1))
    expect(options).toMatchObject({ tempoBpm: 80, tempoUnit: 0.125,
      metronome: { mode: 'always', division: 3, subdivision: 2, minLeadIn: 4 } })
    expect(options.positionMarkers).toEqual(webData.positionMarkers)
  })
})
