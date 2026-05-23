import { describe, expect, it } from 'vitest'

import { matchSvg, normalizeSvgFixture } from '../semanticMatch.js'

describe('SVG fixture normalization', () => {
  it('normalizes whitespace, attribute order, and numeric precision', () => {
    const actual = `
      <svg width="410.0000mm" height="292mm" xmlns="http://www.w3.org/2000/svg">
        <ellipse cy="100.0000" cx="50" fill="black" rx="3.5000" ry="1.7000" />
      </svg>
    `
    const expected = '<svg xmlns="http://www.w3.org/2000/svg" height="292.0mm" width="410mm"><ellipse cx="50.000" cy="100" fill="black" rx="3.5" ry="1.7" /></svg>'

    expect(normalizeSvgFixture(actual)).toEqual(normalizeSvgFixture(expected))
  })

  it('matches normalized svg fixtures semantically', () => {
    const actual = '<svg width="10.0000mm" xmlns="http://www.w3.org/2000/svg"><path stroke="black" d="M10.000,20.0 L30,40.000" fill="none" stroke-width="0.3000" /></svg>'
    const expected = '<svg xmlns="http://www.w3.org/2000/svg" width="10mm"><path d="M10,20 L30,40" fill="none" stroke="black" stroke-width="0.3" /></svg>'

    expect(matchSvg(actual, expected).passed).toBe(true)
  })
})
