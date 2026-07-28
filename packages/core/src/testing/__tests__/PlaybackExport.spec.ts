import { describe, expect, it } from 'vitest'
import jpeg from 'jpeg-js'

import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import {
  buildPlaybackExportData,
  buildPlaybackExportDataFromTimeline,
} from '../../PlaybackExport.js'
import { buildPlaybackTimeline } from '../../PlaybackTimeline.js'
import { createPlayerQrJpeg } from '../../playerQr.js'
import { defaultTestConfig } from '../defaultConfig.js'

describe('Playback-Export aus Song und Auszug', () => {
  it.each([
    { name: 'L:1/4 bei Q:1/4=120', length: '1/4', tempo: '1/4=120', expectedMs: 500 },
    { name: 'L:1/16 bei Q:1/8=120', length: '1/16', tempo: '1/8=120', expectedMs: 250 },
    { name: 'L:1/64 bei Q:1/32=1000', length: '1/64', tempo: '1/32=1000', expectedMs: 30 },
  ])('berechnet Notenlängen unabhängig von Längen- und Tempo-Nennern ($name)', ({ length, tempo, expectedMs }) => {
    const abc = `X:1
T:Tempo-Nenner
M:4/4
L:${length}
Q:${tempo}
K:C
C |]
`
    const song = new AbcToSong().transform(new AbcParser().parse(abc), defaultTestConfig)
    const result = buildPlaybackExportData(song, [1])

    expect(result.events[0]?.durationMs).toBe(expectedMs)
  })

  it('bezieht nur die Stimmen des gerenderten Auszugs ein', () => {
    const abc = `X:1
T:Auszug
M:4/4
L:1/4
K:C
V:1
C D
V:2
E F
`
    const song = new AbcToSong().transform(new AbcParser().parse(abc), defaultTestConfig)

    const result = buildPlaybackExportData(song, [1])

    expect(result.events).toHaveLength(2)
    expect(result.events.map((event) => event.pitch)).toEqual(expect.arrayContaining([60, 62]))
    expect(result.positionMarkers[0]?.position).toEqual({ measureNumber: 1, passIndex: 1 })
  })

  it('filtert Stimmen erst nach dem Aufbau der vollständigen Timeline', () => {
    const abc = `X:1
T:Timeline-Filter
M:4/4
L:1/4
K:C
V:1
C z C |]
V:2
z2 C2 |]
`
    const song = new AbcToSong().transform(new AbcParser().parse(abc), defaultTestConfig)
    const exportData = buildPlaybackExportData(song, [1])
    const workbenchEquivalent = buildPlaybackExportDataFromTimeline(
      buildPlaybackTimeline(song),
      new Set(['1']),
    )

    expect(exportData).toEqual(workbenchEquivalent)
  })

  it('erzeugt ein decodierbares JPG für den Player-Link', () => {
    const bytes = createPlayerQrJpeg('https://zupfnoter-player.example/#p=test')
    const image = jpeg.decode(bytes)

    expect(bytes[0]).toBe(0xff)
    expect(bytes[1]).toBe(0xd8)
    expect(image.width).toBeGreaterThan(0)
    expect(image.height).toBe(image.width)
  })
})
