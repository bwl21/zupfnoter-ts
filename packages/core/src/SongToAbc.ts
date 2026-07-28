import type { Note, Song, SynchPoint, VoiceEntity } from '@zupfnoter/types'
import { AbcParser } from './AbcParser.js'
import type { AbcModel } from './AbcModel.js'
import { getSongVoiceByVoiceNumber, resolveConfigVoiceNumberFromAbcVoiceIndex } from './voiceIdentity.js'

interface SourceNoteChange {
  start: number
  end: number
  midi: number
}

type AccidentalPreference = 'sharp' | 'flat' | 'neutral'

/**
 * Writes the effective pitches of a Song back into its original ABC source.
 *
 * The source remains the formatting and syntax authority. Only note tokens
 * that can be mapped through sourceOffsets are changed; repeats and all other
 * ABC constructs therefore remain exactly where they were. Voice/key shifts
 * are removed after their effective pitches have been materialized.
 */
export function exportSongToAbc(source: string, song: Song): string {
  const model = new AbcParser().parse(source)
  const changes = collectSourceNoteChanges(model, song)
  const accidentalPreference = resolveAccidentalPreference(model)
  let result = applySourceNoteChanges(source, changes, accidentalPreference)
  // These voice-level transforms have already been applied to Song pitches.
  result = result
    .replace(/(\bshift=)\S+/g, '')
    .replace(/\boctave=-?\d+/g, '')
  return result
}

function resolveAccidentalPreference(model: AbcModel): AccidentalPreference {
  const keySignature = model.voices[0]?.voice_properties.key?.k_sf
  if (keySignature === undefined || keySignature === 0) return 'neutral'
  return keySignature > 0 ? 'sharp' : 'flat'
}

function collectSourceNoteChanges(model: AbcModel, song: Song): SourceNoteChange[] {
  const changes: SourceNoteChange[] = []

  model.voices.forEach((voice, voiceIndex) => {
    const songVoice = getSongVoiceByVoiceNumber(
      song,
      resolveConfigVoiceNumberFromAbcVoiceIndex(voiceIndex),
    )
    if (songVoice === undefined) return

    const notesByStart = new Map<number, Note>()
    for (const entity of songVoice.entities) {
      for (const note of notesFromEntity(entity)) {
        const offsets = note.noteSourceOffsets ?? note.sourceOffsets
        if (offsets !== undefined) notesByStart.set(offsets[0], note)
      }
    }

    for (const symbol of voice.symbols) {
      for (const abcNote of symbol.notes ?? []) {
        const offsets = abcNote.sourceOffsets ?? symbolSourceNoteOffsets(symbol, model.source)
        if (offsets === undefined) continue
        const note = notesByStart.get(offsets[0])
        if (note === undefined) continue
        changes.push({ start: offsets[0], end: offsets[1], midi: note.pitch })
      }
    }
  })

  return changes
}

function notesFromEntity(entity: VoiceEntity): Note[] {
  if (entity.type === 'Note') return [entity]
  if (entity.type === 'SynchPoint') return entity.notes
  return []
}

function symbolSourceNoteOffsets(
  symbol: { istart: number; iend: number },
  source: string,
): [number, number] | undefined {
  const text = source.slice(symbol.istart, symbol.iend)
  const match = /[\^_=]*[A-Ga-g][,']*/.exec(text)
  if (match === null || match.index === undefined) return undefined
  return [symbol.istart + match.index, symbol.istart + match.index + match[0].length]
}

function applySourceNoteChanges(
  source: string,
  changes: SourceNoteChange[],
  accidentalPreference: AccidentalPreference,
): string {
  const unique = new Map<string, SourceNoteChange>()
  for (const change of changes) unique.set(`${change.start}:${change.end}`, change)
  const ordered = [...unique.values()].sort((a, b) => b.start - a.start)

  let result = source
  for (const change of ordered) {
    const original = result.slice(change.start, change.end)
    const pitch = abcPitchToken(change.midi, original, accidentalPreference)
    result = `${result.slice(0, change.start)}${pitch}${result.slice(change.end)}`
  }
  return result
}

function abcPitchToken(midi: number, original: string, accidentalPreference: AccidentalPreference): string {
  const originalMatch = /^[\^_=]*([A-Ga-g])([,']*)/.exec(original)
  if (originalMatch === null) return original
  const originalLetter = originalMatch[1] ?? 'C'
  const originalMarks = originalMatch[2] ?? ''
  const suffix = original.slice(originalMatch[0].length)

  const candidates: Array<{ token: string; distance: number; letterDistance: number }> = []
  for (const letter of 'CDEFGABcdefgab') {
    for (const octave of [-2, -1, 0, 1, 2]) {
      const marks = octave < 0 ? ','.repeat(-octave) : octave > 0 ? "'".repeat(octave) : ''
      const natural = pitchForLetterAndMarks(letter, marks)
      const accidental = midi - natural
      if (accidental < -2 || accidental > 2) continue
      candidates.push({
        token: `${accidentalText(accidental)}${letter}${marks}${suffix}`,
        distance: Math.abs(accidental),
        letterDistance: Math.abs(
          'CDEFGAB'.indexOf(letter.toUpperCase()) - 'CDEFGAB'.indexOf(originalLetter.toUpperCase()),
        ),
      })
    }
  }
  candidates.sort((a, b) => {
    const accidentalOrder = compareAccidentalPreference(a.token, b.token, accidentalPreference)
    return a.distance - b.distance || accidentalOrder || a.letterDistance - b.letterDistance
  })
  const preferred = pitchForLetterAndMarks(originalLetter, originalMarks)
  return candidates[0]?.token ?? `${accidentalText(midi - preferred)}${originalLetter}${originalMarks}${suffix}`
}

function compareAccidentalPreference(
  first: string,
  second: string,
  preference: AccidentalPreference,
): number {
  if (preference === 'neutral') return 0
  const firstMatches = preference === 'sharp' ? first.startsWith('^') : first.startsWith('_')
  const secondMatches = preference === 'sharp' ? second.startsWith('^') : second.startsWith('_')
  return Number(secondMatches) - Number(firstMatches)
}

function pitchForLetterAndMarks(letter: string, marks: string): number {
  const natural: Record<string, number> = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 }
  const upper = letter.toUpperCase()
  const base = natural[upper] ?? 60
  const octave = letter === upper ? -marks.length : 1 + marks.length
  return base + octave * 12
}

function accidentalText(value: number): string {
  if (value > 0) return '^'.repeat(value)
  if (value < 0) return '_'.repeat(-value)
  return ''
}
