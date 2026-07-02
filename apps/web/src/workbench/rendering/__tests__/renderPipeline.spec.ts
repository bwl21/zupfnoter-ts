import { describe, expect, it } from 'vitest'

import { renderWorkbenchPreviews } from '../renderPipeline'

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

describe('renderWorkbenchPreviews', () => {
  it('surfaces translated abc2svg tie errors in the editor diagnostics', () => {
    const result = renderWorkbenchPreviews('X:1\nT:Demo\nK:C\ng-d')

    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.editorDiagnostics.length).toBeGreaterThan(0)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.toastDiagnostics).toHaveLength(0)
    expect(result.editorDiagnostics.some((diagnostic) => diagnostic.message.includes('fehlerhafter Haltebogen'))).toBe(true)
    expect(result.editorDiagnostics.some((diagnostic) => diagnostic.line === 4)).toBe(true)
  })

  it('builds a sheet object index from the rendered score and song model', () => {
    const result = renderWorkbenchPreviews('X:1\nT:Demo\nK:C\nC D')

    expect(result.sheetObjectIndex).toBeDefined()
    expect(result.sheetObjectIndex?.entries.length).toBeGreaterThan(0)
    expect(Object.keys(result.sheetObjectIndex?.byZnId ?? {})).not.toHaveLength(0)
    expect(result.scoreSvg).toContain('data-start-char=')
    expect(result.scoreSvg).toContain('class="zn-score-annotation zn-score-hitbox"')
  })

  it('builds an expanded playback timeline for repeat endings', () => {
    const result = renderWorkbenchPreviews('X:1\nT:Demo\nM:4/4\nL:1/4\nK:C\n|: C D | [1 E :| [2 F |]')

    expect(result.playbackTimeline).toHaveLength(6)
    expect(result.playbackTimeline.map((step) => step.passIndex)).toEqual([1, 1, 1, 2, 2, 2])
    expect(result.playbackTimeline.map((step) => step.voltaNumber ?? 0)).toEqual([0, 0, 1, 0, 0, 2])
    expect(result.playbackTimeline.map((step) => step.playbackStartMs)).toEqual([0, 500, 1000, 1500, 2000, 2500])
    expect(result.playbackTimeline[4]?.durationMs).toBe(result.playbackTimeline[1]?.durationMs)
    expect(result.playbackTimeline[4]?.durationMs).toBe(result.playbackTimeline[5]?.durationMs)
  })

  it('renders the Am Moargo second ending inside the second playback pass', () => {
    const result = renderWorkbenchPreviews(amMoargoAbc)
    const secondVoltaSteps = result.playbackTimeline.filter(
      (step) => step.passIndex === 2 && step.voltaNumber === 2,
    )
    const finalSharedStep = result.playbackTimeline[16]

    expect(secondVoltaSteps.map((step) => step.sourceTime)).toEqual([3840, 4608, 4992, 5376, 5760])
    expect(finalSharedStep).toBeDefined()
    expect(secondVoltaSteps[0]?.playbackStartMs).toBe(
      (finalSharedStep?.playbackStartMs ?? 0) + (finalSharedStep?.durationMs ?? 0),
    )
  })

  it('merges tied note durations into a single playback attack', () => {
    const result = renderWorkbenchPreviews('X:1\nT:Tie\nL:1/4\nK:C\nV:1\nC-C D')

    expect(result.playbackTimeline).toHaveLength(3)
    expect(result.playbackTimeline[0]?.activeNotes).toContainEqual(expect.objectContaining({
      originVoiceId: '1',
      pitch: 60,
      durationMs: 1000,
      attack: true,
      pan: 'left',
    }))
    expect(result.playbackTimeline[1]?.activeNotes).toEqual([])
    expect(result.playbackTimeline[2]?.activeNotes).toContainEqual(expect.objectContaining({
      originVoiceId: '1',
      pitch: 62,
      durationMs: 500,
      attack: true,
      pan: 'left',
    }))
  })

  it('keeps all song voices in the playback timeline even when an extract narrows the rendered sheet', () => {
    const result = renderWorkbenchPreviews(`X:1
T:Extract Playback
L:1/4
M:4/4
K:C
V:1
C D
V:2
G, A,

%%%%zupfnoter.config
{
  "extract": {
    "1": {
      "voices": [1]
    }
    }
}
`, 1)

    expect(result.activeVoiceIds).toEqual(['1'])
    expect(result.playbackTimeline).toHaveLength(2)
    expect(result.playbackTimeline[0]?.originVoiceIds).toContain('1')
    expect(result.playbackTimeline[0]?.originVoiceIds).toContain('2')
    expect(result.playbackTimeline[0]?.activeNotes.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(result.playbackTimeline[1]?.originVoiceIds).toContain('1')
    expect(result.playbackTimeline[1]?.originVoiceIds).toContain('2')
    expect(result.playbackTimeline[1]?.activeNotes.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('keeps higher song voice numbers in the playback timeline even when the extract targets one voice', () => {
    const result = renderWorkbenchPreviews(`X:1
T:Fourth Voice Playback
L:1/4
M:4/4
K:C
V:1
C
V:2
D
V:3
E
V:4
F

%%%%zupfnoter.config
{
  "extract": {
    "1": {
      "voices": [4]
    }
  }
}
`, 1)

    expect(result.activeVoiceIds).toEqual(['4'])
    expect(result.allVoiceIds).toContain('4')
    expect(result.allVoiceIds.length).toBeGreaterThan(1)
    expect(result.playbackTimeline).toHaveLength(1)
    expect(result.playbackTimeline[0]?.originVoiceIds).toContain('4')
    expect(result.playbackTimeline[0]?.originVoiceIds.length).toBeGreaterThan(1)
    expect(result.playbackTimeline[0]?.activeNotes.length ?? 0).toBeGreaterThanOrEqual(4)
  })
})
