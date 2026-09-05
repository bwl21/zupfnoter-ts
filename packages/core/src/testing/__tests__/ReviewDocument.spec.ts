import { describe, expect, it } from 'vitest'

import { renderReviewDocument } from '../../ReviewDocument.js'

const ABC = `X:1
T:Mobiler Test
M:4/4
L:1/4
Q:1/4=96
K:C
C D E F|
`

describe('renderReviewDocument', () => {
  it('derives both notation views and playback from the same song', () => {
    const result = renderReviewDocument(ABC)

    expect(result.title).toBe('Mobiler Test')
    expect(result.extracts).toEqual([{ number: 0, title: 'alle Stimmen' }])
    expect(result.scoreSvg).toContain('<svg')
    expect(result.harpSvg).toContain('class="zupfnoter-svg"')
    expect(result.playbackTimeline.length).toBeGreaterThan(0)
    expect(result.baseTempoBpm).toBe(96)
    expect(result.tempoUnit).toBe(0.25)
  })

  it('keeps decimal ABC tempo declarations as BPM values', () => {
    const result = renderReviewDocument(ABC.replace('Q:1/4=96', 'Q:1/4=80.00'))

    expect(result.baseTempoBpm).toBe(80)
  })

  it('uses the same complete playback timeline as Web for a voice-limited extract', () => {
    const result = renderReviewDocument(
      `X:1
T:Timeline-Parität
M:4/4
L:1/4
K:C
V:1
C D
V:2
C, D,

%%%%zupfnoter.config
{
  "extract": {
    "1": {
      "voices": [2]
    }
  }
}
`,
      1,
    )

    expect(new Set(result.playbackTimeline.flatMap((step) => step.originVoiceIds))).toEqual(
      new Set(['2']),
    )
  })
})
