import { describe, expect, it } from 'vitest'
import type { Song, Voice } from '@zupfnoter/types'

import {
  getSongVoiceNumbers,
  getSongArrayIndexByVoiceNumber,
  getSongVoiceByVoiceNumber,
  isConfigAddressableVoice,
  resolveConfigVoiceNumberFromAbcVoiceIndex,
} from '../../voiceIdentity.js'

function createVoice(index: number, name: string): Voice {
  return {
    index,
    name,
    showFlowline: true,
    showJumpline: true,
    showVoice: true,
    entities: [],
  }
}

function createSong(): Song {
  return {
    voices: [
      createVoice(0, 'legacy-v1-duplicate'),
      createVoice(1, 'Sopran'),
      createVoice(3, 'Tenor'),
      createVoice(4, 'Bass'),
    ],
    beatMaps: [],
    metaData: {},
  }
}

describe('voiceIdentity', () => {
  it('maps abc voice indexes to config voice numbers centrally', () => {
    expect(resolveConfigVoiceNumberFromAbcVoiceIndex(0)).toBe(1)
    expect(resolveConfigVoiceNumberFromAbcVoiceIndex(3)).toBe(4)
  })

  it('treats the legacy duplicate voice as non-addressable', () => {
    expect(isConfigAddressableVoice(createVoice(0, 'legacy'))).toBe(false)
    expect(isConfigAddressableVoice(createVoice(2, 'Alt'))).toBe(true)
  })

  it('resolves voices by config voice number instead of array position', () => {
    const song = createSong()

    expect(getSongVoiceByVoiceNumber(song, 1)?.name).toBe('Sopran')
    expect(getSongVoiceByVoiceNumber(song, 3)?.name).toBe('Tenor')
    expect(getSongVoiceByVoiceNumber(song, 2)).toBeUndefined()
  })

  it('exposes array indices only through the central helper', () => {
    const song = createSong()

    expect(getSongArrayIndexByVoiceNumber(song, 1)).toBe(1)
    expect(getSongArrayIndexByVoiceNumber(song, 4)).toBe(3)
    expect(getSongArrayIndexByVoiceNumber(song, 2)).toBeUndefined()
  })

  it('lists only config-addressable voice numbers', () => {
    const song = createSong()

    expect(getSongVoiceNumbers(song)).toEqual([1, 3, 4])
  })
})
