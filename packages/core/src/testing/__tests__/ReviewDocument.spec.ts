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
    expect(result.extracts).toEqual([{ number: 0, title: 'Alle Stimmen' }])
    expect(result.scoreSvg).toContain('<svg')
    expect(result.harpSvg).toContain('class="zupfnoter-svg"')
    expect(result.playbackTimeline.length).toBeGreaterThan(0)
    expect(result.baseTempoBpm).toBe(96)
    expect(result.tempoUnit).toBe(0.25)
  })
})
