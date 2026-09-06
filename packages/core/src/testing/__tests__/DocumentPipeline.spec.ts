import { describe, expect, it } from 'vitest'
import { prepareDocumentConfig, parseDocumentSong, layoutDocumentExtract, resolveDocumentPlaybackConfig, resolveDocumentPlaybackLinkConfig, preparePlaybackLinkOptions } from '../../DocumentPipeline.js'
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
  it('omits built-in metronome defaults from links without changing live playback defaults', () => {
    const document = 'X:1\nM:4/4\nK:C\nC D E F|'
    expect(resolveDocumentPlaybackConfig(prepareDocumentConfig(document), 0)?.metronomeMode).toBe('off')
    for (const extract of [0, 1]) {
      const config = resolveDocumentPlaybackLinkConfig(document, extract)
      expect(config).toBeUndefined()
      expect(preparePlaybackLinkOptions('https://practice.example/', [], undefined, undefined, config).metronome).toBeUndefined()
    }
  })

  it('inherits explicit values, including off and false, and preserves partial settings', () => {
    const document = `X:1\nK:C\nC|\n%%%%zupfnoter.config\n${JSON.stringify({
      extract: {
        '0': { playback: { bandPreCount: false, minLeadIn: 2 } },
        '1': { playback: { metronomeMode: 'off', minLeadIn: 3 } },
      },
    })}`
    expect(resolveDocumentPlaybackLinkConfig(document, 0)).toEqual({ bandPreCount: false, minLeadIn: 2 })
    expect(resolveDocumentPlaybackLinkConfig(document, 1)).toEqual({ bandPreCount: false, minLeadIn: 3, metronomeMode: 'off' })
    const options = preparePlaybackLinkOptions('https://practice.example/', [], undefined, undefined,
      resolveDocumentPlaybackLinkConfig(document, 2))
    expect(options.metronome).toEqual({ mode: undefined, bandPreCount: false, minLeadIn: 2, division: undefined, subdivision: undefined })
  })

  it('does not create metronome metadata for part labels alone', () => {
    expect(preparePlaybackLinkOptions('https://practice.example/', [], undefined, undefined,
      { parts: { A: 'Refrain' } }).metronome).toBeUndefined()
  })

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
