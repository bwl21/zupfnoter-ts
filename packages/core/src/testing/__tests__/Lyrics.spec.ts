import { describe, expect, it } from 'vitest'

import { extractLyricsText, replaceLyricsText } from '../../lyrics.js'

describe('lyrics text bridge', () => {
  it('reads W lines like the legacy editor', () => {
    expect(extractLyricsText('X:1\nW:Eine Zeile\nW:   noch weiter\nK:C')).toBe('Eine Zeile\nnoch weiter')
  })

  it('writes edited lines back as W lines', () => {
    expect(replaceLyricsText('X:1\nW:alt\nK:C', 'neu\nweiter')).toBe('X:1\nW:neu\nW:weiter\nK:C')
  })

  it('replaces the complete existing W block instead of duplicating old lines', () => {
    expect(replaceLyricsText('X:1\nW:alt\nW:weiter\nK:C', 'neu')).toBe('X:1\nW:neu\nK:C')
  })

  it('preserves an empty final lyrics line for a new verse', () => {
    const documentText = replaceLyricsText('X:1\nW:erste Strophe\nK:C', 'erste Strophe\n')
    expect(extractLyricsText(documentText)).toBe('erste Strophe\n')
  })

  it('creates a legacy lyrics section when none exists', () => {
    expect(replaceLyricsText('X:1\nK:C\nC', 'neu')).toBe('X:1\nK:C\nC\n%\nW:neu\n%\n%\n')
  })
})
