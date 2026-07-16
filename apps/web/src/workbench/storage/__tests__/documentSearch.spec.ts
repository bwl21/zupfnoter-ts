import { describe, expect, it } from 'vitest'

import { matchesStorageDocumentQuery } from '../documentSearch'

describe('matchesStorageDocumentQuery', () => {
  it('treats whitespace as Dropbox-style filename tokens', () => {
    expect(matchesStorageDocumentQuery('709_for-the-one-i-oove.abc', 'for the')).toBe(true)
    expect(matchesStorageDocumentQuery('347_the-entertainer.abc', 'the enter')).toBe(true)
  })

  it('matches preceding tokens exactly and the final token as a prefix', () => {
    expect(matchesStorageDocumentQuery('bat-cave.abc', 'bat c')).toBe(true)
    expect(matchesStorageDocumentQuery('batman-car.abc', 'bat c')).toBe(false)
    expect(matchesStorageDocumentQuery('709_for-the-one.abc', 'abc for the')).toBe(false)
  })
})
