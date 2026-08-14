import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { PlaybackFlowStep } from '@zupfnoter/types'

import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { expandPlaybackFlow } from '../../PlaybackFlow.js'
import { buildPlaybackTimeline } from '../../PlaybackTimeline.js'
import { defaultTestConfig } from '../defaultConfig.js'

const amMoargoAbc = `X:799
Z:
F:799_am-moargo
S:
T:Am Moargo
C:M: Hubert Franz
C:T: Kaspar Troy
S: Bregenzerwaelder Lieder und Jodler)
C:Bearb.: Ruth und Bernhard Weichel
%%scale 0.91
%%pagewidth 20.98cm
%%score ( 1 2 ) ( 3 4 )
L:1/4
M:3/4
K:A
V:1 treble
V:2 treble
V:3 bass
V:4 bass
V:1
E/F/ |: !fermata!E C A | G A B |1 A2 F :|2 E2 c | d c B ||
d c B | A3 | z z E | c B A | G A B | A2 F |
E2 c | B B d | c c B | A3 | z z  |
%
V:2
C/D/ | CA,C | B,CD| C2 D | C2 E | FED |
FED | C3 | z z C | EDC | B,CD | C2 D |
C2 E | DEF | EED | C3 | zz |
%
V:3 octave=-1
z |: A, z z  | E z z |1 A z D :|2 A2 z |E z z ||
E z z | A E C | A,2 z | A, z z | E z z | A z D |
A z A, | B, z E | E F | G | A,C E | A z |
%
V:4
%
%
`

function expandFlow(abcText: string): PlaybackFlowStep[] {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const song = new AbcToSong().transform(model, defaultTestConfig)
  return expandPlaybackFlow(song)
}

function buildTimeline(abcText: string) {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const song = new AbcToSong().transform(model, defaultTestConfig)
  return buildPlaybackTimeline(song)
}

describe('expandPlaybackFlow', () => {
  it('maps named part markers to the header sequence and keeps voices synchronized', () => {
    const abc = readFileSync(resolve(
      __dirname,
      '../../../../../fixtures/cases/public/part-sequence-named-markers/input.abc',
    ), 'utf8')
    const parser = new AbcParser()
    const model = parser.parse(abc)
    const configuredTestConfig = {
      ...defaultTestConfig,
      extract: {
        ...defaultTestConfig.extract,
        '0': {
          ...defaultTestConfig.extract['0'],
          playback: {
            ...(defaultTestConfig.extract['0'].playback ?? {}),
            parts: { A: 'A', B: 'Teil 1', C: 'Teil 2' },
          },
        },
      },
    }
    const song = new AbcToSong().transform(model, configuredTestConfig)
    for (const voice of song.voices) {
      voice.entities = voice.entities.filter(entity => entity.type !== 'NoteBoundAnnotation')
    }

    expect(song.metaData.partSequence).toEqual({
      order: ['A', 'B', 'A', 'B', 'C'],
      markers: [
        { id: 'A', displayName: 'A', time: 768 },
        { id: 'B', displayName: 'Teil 1', time: 1536 },
        { id: 'C', displayName: 'Teil 2', time: 3072 },
      ],
    })

    const flow = expandPlaybackFlow(song)
    let activePart: string | undefined
    const partNames = flow.map((step) => {
      if (step.partName !== undefined && step.partName.trim() !== '') activePart = step.partName.trim()
      return activePart
    })
    expect(partNames.filter((name, index) => index === 0 || name !== partNames[index - 1])).toEqual([
      'A', 'Teil 1', 'A', 'Teil 1', 'Teil 2',
    ])
    expect(flow[0]?.partId).toBe('A')
    expect(song.voices.slice(1).map((voice) => voice.entities
      .filter((entity) => entity.type === 'Note' || entity.type === 'Pause' || entity.type === 'SynchPoint')
      .map((entity) => entity.time))).toEqual([
      [0, 384, 768, 1152, 1536, 1920, 2304, 2688, 3072, 3456],
      [0, 384, 768, 1152, 1536, 1920, 2304, 2688, 3072, 3456],
    ])
    expect(flow.some((step) => step.sourceTime < 768)).toBe(false)
    expect(flow.find((step) => step.sourceTime === 768)?.passIndex).toBe(1)
    expect(flow.filter((step) => step.sourceTime === 768)[1]?.passIndex).toBe(2)

    const timeline = buildPlaybackTimeline(song)
    expect(timeline[0]?.sourceTime).toBe(768)
    let timelinePart: string | undefined
    const timelinePartNames = timeline.map((step) => {
      if (step.partName !== undefined && step.partName.trim() !== '') timelinePart = step.partName.trim()
      return timelinePart
    })
    expect(timelinePartNames.filter((name, index) => index === 0 || name !== timelinePartNames[index - 1])).toEqual([
      'A', 'Teil 1', 'A', 'Teil 1', 'Teil 2',
    ])

    const configuredConfig = {
      ...defaultTestConfig,
      extract: {
        ...defaultTestConfig.extract,
        '0': { ...defaultTestConfig.extract['0'] },
      },
    }
    configuredConfig.extract['0'].playback = {
      ...(configuredConfig.extract['0'].playback ?? {}),
      parts: { A: 'Teil 1', B: 'A', C: 'Teil 2' },
    }
    const configuredSong = new AbcToSong().transform(model, configuredConfig)
    expect(configuredSong.metaData.partSequence?.markers).toEqual([
      { id: 'B', displayName: 'A', time: 768 },
      { id: 'A', displayName: 'Teil 1', time: 1536 },
      { id: 'C', displayName: 'Teil 2', time: 3072 },
    ])
  })

  it('duplicates a simple repeat into a second pass', () => {
    const flow = expandFlow(`X:1
T:Repeat
M:4/4
L:1/4
K:C
|: C D E :|
`)

    expect(flow).toHaveLength(6)
    expect(flow.map((step) => step.passIndex)).toEqual([1, 1, 1, 2, 2, 2])
  })

  it('returns to the beginning for D.C. al Fine and stops at Fine', () => {
    const abc = `X:1
T:D.C. al Fine
M:4/4
L:1/4
K:C
C D | !D.C.alfine! E F | !fine! G A |
`
    const flow = expandFlow(abc)

    expect(flow.map((step) => step.sourceTime)).toEqual([0, 384, 768, 0, 384, 768, 1152, 1536])
    expect(flow.map((step) => step.passIndex)).toEqual([1, 1, 1, 2, 2, 2, 2, 2])

    const timeline = buildTimeline(abc)
    expect(timeline[2]?.activeNotes.length).toBeGreaterThan(0)
    expect(timeline[2]?.activeTextRanges.length).toBeGreaterThan(0)
  })

  it('does not repeat again after D.C. al Fine', () => {
    const flow = expandFlow(`X:1
T:D.C. al Fine without repeats
M:4/4
L:1/4
K:C
|: C D E F :| G A !D.C.alfine! B c | !fine! d e f g |
`)

    expect(flow.filter((step) => step.passIndex === 3).map((step) => step.sourceTime)).toEqual([
      0, 384, 768, 1152, 1536, 1920, 2304, 2688, 3072,
    ])
  })

  it('waits for D.C. al Fine markers in all voices before jumping', () => {
    const flow = expandFlow(`X:1
T:D.C. al Fine with different voice lengths
M:3/4
L:1/4
K:F
V:1
L:1/8
C D E F !D.C.alfine! G | !fine! A |
V:3
C, C, C, | D, E, !D.C.alfine! z | !fine! F, |
`)

    expect(flow.filter((step) => step.passIndex === 1).map((step) => step.sourceTime)).toContain(1920)
    expect(flow.filter((step) => step.passIndex === 2).map((step) => step.sourceTime)).toContain(2304)
  })

  it('skips the first volta on the second pass', () => {
    const flow = expandFlow(`X:1
T:Volta
M:4/4
L:1/4
K:C
|: C D | [1 E :| [2 F |]
`)

    expect(flow).toHaveLength(6)
    expect(flow.map((step) => step.passIndex)).toEqual([1, 1, 1, 2, 2, 2])
    expect(flow.map((step) => step.voltaNumber ?? 0)).toEqual([0, 0, 1, 0, 0, 2])
  })

  it('does not jump into the first ending before slower voices finish the pre-volta bar', () => {
    const flow = expandFlow(`X:1
T:Multi Voice Volta
M:4/4
L:1/8
K:C
V:1 treble
V:2 treble
V:1
|: C4 D4 | [1 E4 :| [2 F4 |]
V:2
|: C2 D2 E2 F2 | [1 G2 A2 :| [2 B2 c2 |]
`)

    expect(flow.map((step) => step.sourceTime)).toEqual([
      0, 384, 768, 1152, 1536, 1920,
      0, 384, 768, 1152, 2304, 2688,
    ])
    expect(flow.map((step) => step.passIndex)).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2])
    expect(flow.map((step) => step.voltaNumber ?? 0)).toEqual([0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 2, 2])
  })

  it('keeps the second ending inside the second pass for Am Moargo', () => {
    const flow = expandFlow(amMoargoAbc)
    const secondPassTimes = flow
      .filter((step) => step.passIndex === 2)
      .map((step) => step.sourceTime)

    expect(secondPassTimes).toContain(3840)
    expect(secondPassTimes).toContain(4608)
    expect(secondPassTimes).toContain(4992)
    expect(secondPassTimes).toContain(5376)
    expect(secondPassTimes).toContain(5760)

    const secondVoltaTimes = flow
      .filter((step) => step.passIndex === 2 && step.voltaNumber === 2)
      .map((step) => step.sourceTime)

    expect(secondVoltaTimes).toEqual([3840, 4608, 4992, 5376, 5760])
  })

  it('keeps the measure number stable at interior events of a voice with another L', () => {
    const flow = expandFlow(`X:1
T:Different voice lengths
M:4/4
L:1/4
K:C
V:1
C D E F | G A B c |
V:2
L:1/8
C2 D2 E2 F2 G2 A2 B2 c2 | d2 e2 f2 g2 a2 b2 c'2 d'2 |
`)

    const measureNumbers = flow.map((step) => step.measureNumber)
    expect(measureNumbers).toEqual([...measureNumbers].sort((left, right) => left - right))
    expect(new Set(measureNumbers)).toEqual(new Set([1, 2]))
  })


})
