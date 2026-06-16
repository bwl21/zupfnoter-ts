import type { PlaybackInstrument } from './useAudioPlayer'

const SOUND_ALIASES = [
  { name: 'harp', aliases: ['harfe', 'harp'] },
  { name: 'piano', aliases: ['klavier', 'piano', 'grandpiano', 'grand-piano', 'grand piano'] },
  { name: 'western-guitar', aliases: ['western-gitarre', 'western-guitar', 'gitarre', 'guitar'] },
  { name: 'oscillator', aliases: ['oscillator', 'oszillator', 'synth', 'synthie'] },
] as const

export function resolvePlaybackInstrument(input: string): PlaybackInstrument | undefined {
  const normalized = input.trim().toLowerCase()
  const matches = SOUND_ALIASES.filter((sound) => {
    const candidates = [sound.name, ...sound.aliases]
    return candidates.some((candidate) => candidate.startsWith(normalized) || normalized.startsWith(candidate))
  })
  if (matches.length !== 1) return undefined
  return matches[0]?.name
}
