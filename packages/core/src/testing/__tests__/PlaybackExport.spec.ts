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
import { loadFixture } from '../fixtureLoader.js'

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

  it('preserves meter changes before and after a repeated section', () => {
    const abc = `X:1
T:Taktwechsel mit Wiederholung
L:1/8
Q:1/4=120
M:4/4
K:C
|: C8 | [M:3/4] C6 :| [M:2/4] C4 |]
`
    const song = new AbcToSong().transform(new AbcParser().parse(abc), defaultTestConfig)
    const result = buildPlaybackExportData(song, [1])

    expect(result.positionMarkers.map(({ timeMs, position, meter }) => ({ timeMs, position, meter }))).toEqual([
      { timeMs: 0, position: { measureNumber: 1, passIndex: 1 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 2000, position: { measureNumber: 2, passIndex: 1 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 3500, position: { measureNumber: 1, passIndex: 2 }, meter: { numerator: 4, denominator: 4 } },
      { timeMs: 5500, position: { measureNumber: 2, passIndex: 2 }, meter: { numerator: 3, denominator: 4 } },
      { timeMs: 7000, position: { measureNumber: 3, passIndex: 2 }, meter: { numerator: 2, denominator: 4 } },
      { timeMs: 8000, position: { measureNumber: 3, passIndex: 2 }, meter: undefined },
    ])
  })

  it('preserves an unmetered pickup marker when the repeat jumps back to it', () => {
    const abc = `X:1
T:Wiederholter Auftakt mit Pause
L:1/8
Q:1/4=120
M:4/4
K:C
z2 G2 | C8 | B2 c2 :|
`
    const song = new AbcToSong().transform(new AbcParser().parse(abc), defaultTestConfig)
    const result = buildPlaybackExportData(song, [1])

    expect(result.positionMarkers.slice(3, 5)).toEqual([
      { timeMs: 4000, position: { measureNumber: 1, passIndex: 2 }, meter: undefined, partName: undefined },
      {
        timeMs: 5000,
        position: { measureNumber: 1, passIndex: 2 },
        meter: { numerator: 4, denominator: 4 },
        partName: undefined,
      },
    ])
  })

  it('expands the public metronome fixture with parts, meters and variant endings', () => {
    const fixture = loadFixture('metronome-meter-repeat')
    const song = new AbcToSong().transform(new AbcParser().parse(fixture.input.abc), fixture.config)
    const timeline = buildPlaybackTimeline(song)
    const result = buildPlaybackExportDataFromTimeline(timeline)

    expect([...new Set(result.positionMarkers
      .filter((marker) => marker.meter !== undefined)
      .map((marker) => `${marker.meter?.numerator}/${marker.meter?.denominator}`))]).toEqual([
      '4/4', '3/4', '2/4', '6/8', '12/8',
    ])
    expect([...new Set(result.positionMarkers
      .map((marker) => marker.partName)
      .filter((partName): partName is string => partName !== undefined))]).toEqual([
      'A – Auftakt und Wiederholung',
      'B – Dreier- und Zweiertakt',
      'C – Sechsachteltakt',
      'D – Zwölfachteltakt',
    ])
    expect([...new Set(timeline
      .map((step) => step.voltaNumber)
      .filter((voltaNumber): voltaNumber is number => voltaNumber !== undefined))]).toEqual([1, 2])
    const firstAttack = timeline.find((step) => step.activeNotes.some((note) => note.attack))
    expect(timeline[0]?.activeNotes).toEqual([])
    expect(firstAttack?.playbackStartMs).toBeGreaterThan(0)
    expect(result.positionMarkers.find((marker, index, markers) => {
      const previous = markers[index - 1]
      return previous !== undefined
        && marker.position.passIndex > previous.position.passIndex
        && marker.meter?.numerator === 3
    })).toMatchObject({
      meter: { numerator: 3, denominator: 4 },
      partName: 'B – Dreier- und Zweiertakt',
    })
    const playbackEndMs = result.positionMarkers[result.positionMarkers.length - 1]?.timeMs ?? 0
    expect(result.positionMarkers
      .filter((marker) => marker.timeMs > 0 && marker.timeMs < playbackEndMs)
      .every((marker) => marker.partName !== undefined)).toBe(true)
    expect(fixture.config.extract['0']?.playback).toMatchObject({
      metronomeMode: 'always',
      minLeadIn: 2,
      bandPreCount: false,
      subdivision: 1,
    })
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
