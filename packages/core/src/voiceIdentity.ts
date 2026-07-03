import type { Song, Voice } from '@zupfnoter/types'

export function resolveConfigVoiceNumberFromAbcVoiceIndex(abcVoiceIndex: number): number {
  return abcVoiceIndex + 1
}

export function resolveSongVoiceByConfigVoiceNumber(song: Song, voiceNumber: number): Voice | undefined {
  return song.voices.find((voice) => voice.index === voiceNumber)
}

export function resolveSongArrayIndexByConfigVoiceNumber(song: Song, voiceNumber: number): number | undefined {
  const arrayIndex = song.voices.findIndex((voice) => voice.index === voiceNumber)
  return arrayIndex >= 0 ? arrayIndex : undefined
}
