import { describe, expect, it } from 'vitest'
import jpeg from 'jpeg-js'

import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { buildPlaybackExportData } from '../../PlaybackExport.js'
import { createPlayerQrJpeg } from '../../playerQr.js'
import { defaultTestConfig } from '../defaultConfig.js'

describe('Playback-Export aus Song und Auszug', () => {
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

  it('erzeugt ein decodierbares JPG für den Player-Link', () => {
    const bytes = createPlayerQrJpeg('https://zupfnoter-player.example/#p=test')
    const image = jpeg.decode(bytes)

    expect(bytes[0]).toBe(0xff)
    expect(bytes[1]).toBe(0xd8)
    expect(image.width).toBeGreaterThan(0)
    expect(image.height).toBe(image.width)
  })
})
