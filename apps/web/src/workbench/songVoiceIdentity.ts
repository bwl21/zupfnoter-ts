import type { Sheet, Song, Voice } from '@zupfnoter/types'

export function isUserVisibleVoice(voice: Voice): boolean {
  return voice.index > 0
}

export function resolveUserVisibleVoiceId(voice: Voice): string | undefined {
  return isUserVisibleVoice(voice) ? `${voice.index}` : undefined
}

export function resolveUserVisibleVoiceIds(song: Song): string[] {
  return song.voices
    .filter(isUserVisibleVoice)
    .map((voice) => `${voice.index}`)
}

export function resolveSongVoiceById(song: Song, voiceId: string): Voice | undefined {
  return song.voices.find((voice) => isUserVisibleVoice(voice) && `${voice.index}` === voiceId)
}

export function resolveSongArrayIndexByVoiceId(song: Song, voiceId: string): number | undefined {
  const voice = resolveSongVoiceById(song, voiceId)
  if (voice === undefined) return undefined
  const arrayIndex = song.voices.findIndex((candidate) => candidate.index === voice.index)
  return arrayIndex >= 0 ? arrayIndex : undefined
}

export function resolveActiveVoiceIdsFromSheet(sheet: Sheet): string[] {
  return sheet.activeVoices.map((voiceIndex) => `${voiceIndex}`)
}
