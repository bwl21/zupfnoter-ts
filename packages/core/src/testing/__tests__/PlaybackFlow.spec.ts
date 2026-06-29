import { describe, expect, it } from 'vitest'

import type { PlaybackFlowStep } from '@zupfnoter/types'

import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { expandPlaybackFlow } from '../../PlaybackFlow.js'
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

describe('expandPlaybackFlow', () => {
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


})
