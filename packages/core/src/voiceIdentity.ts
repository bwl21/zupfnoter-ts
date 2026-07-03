import type { Song, Voice } from '@zupfnoter/types'

export function resolveConfigVoiceNumberFromAbcVoiceIndex(abcVoiceIndex: number): number {
  return abcVoiceIndex + 1
}

export function isConfigAddressableVoice(voice: Voice): boolean {
  return voice.index > 0
}

export function getSongVoiceByVoiceNumber(song: Song, voiceNumber: number): Voice | undefined {
  return song.voices.find((voice) => isConfigAddressableVoice(voice) && voice.index === voiceNumber)
}

export function getSongArrayIndexByVoiceNumber(song: Song, voiceNumber: number): number | undefined {
  const arrayIndex = song.voices.findIndex((voice) => voice.index === voiceNumber)
  return arrayIndex >= 0 ? arrayIndex : undefined
}

export function getSongVoiceNumbers(song: Song): number[] {
  return song.voices
    .filter(isConfigAddressableVoice)
    .map((voice) => voice.index)
}
