import { describe, expect, it } from 'vitest'
import { resolveLocalTargetPath } from '../localFsProvider'

describe('resolveLocalTargetPath', () => {
  it('does not prepend the current folder twice for listed paths', () => {
    expect(resolveLocalTargetPath('songs', 'songs/101.abc')).toBe('songs/101.abc')
  })

  it('resolves a file name relative to the current folder', () => {
    expect(resolveLocalTargetPath('songs', '101.abc')).toBe('songs/101.abc')
  })

  it('keeps workspace-root files unchanged', () => {
    expect(resolveLocalTargetPath('', '101.abc')).toBe('101.abc')
  })
})
