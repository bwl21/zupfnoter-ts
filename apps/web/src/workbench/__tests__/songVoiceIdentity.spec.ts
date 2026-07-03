import { describe, expect, it } from 'vitest'

import type { Sheet, Song, Voice } from '@zupfnoter/types'

import {
  isUserVisibleVoice,
  resolveActiveVoiceIdsFromSheet,
  resolveSongArrayIndexByVoiceId,
  resolveSongVoiceById,
  resolveUserVisibleVoiceId,
  resolveUserVisibleVoiceIds,
} from '../songVoiceIdentity'

function createVoice(index: number): Voice {
  return {
    index,
    showVoice: true,
    showFlowline: true,
    showJumpline: true,
    entities: [],
  }
}

describe('songVoiceIdentity', () => {
  it('treats the legacy duplicate voice 0 as non-user-visible', () => {
    expect(isUserVisibleVoice(createVoice(0))).toBe(false)
    expect(resolveUserVisibleVoiceId(createVoice(0))).toBeUndefined()
  })

  it('resolves user-visible voice ids from fachliche voice indexes', () => {
    const song: Song = {
      voices: [createVoice(0), createVoice(1), createVoice(2), createVoice(4)],
      beatMaps: [],
      metaData: {},
    }

    expect(resolveUserVisibleVoiceIds(song)).toEqual(['1', '2', '4'])
    expect(resolveSongVoiceById(song, '2')?.index).toBe(2)
    expect(resolveSongArrayIndexByVoiceId(song, '2')).toBe(2)
    expect(resolveSongArrayIndexByVoiceId(song, '3')).toBeUndefined()
  })

  it('resolves active extract voices from sheet numbering unchanged', () => {
    const sheet: Sheet = {
      children: [],
      activeVoices: [1, 3, 4],
    }

    expect(resolveActiveVoiceIdsFromSheet(sheet)).toEqual(['1', '3', '4'])
  })
})
