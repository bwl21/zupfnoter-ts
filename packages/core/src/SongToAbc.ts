import type { Note, Song, SynchPoint, VoiceEntity } from '@zupfnoter/types'
import { AbcParser } from './AbcParser.js'
import type { AbcModel } from './AbcModel.js'
import { AbcToSong } from './AbcToSong.js'
import { getSongVoiceByVoiceNumber, resolveConfigVoiceNumberFromAbcVoiceIndex } from './voiceIdentity.js'
import { Confstack } from './Confstack.js'
import { extractSongConfig, mergeSongConfig } from './extractSongConfig.js'
import { initConf } from './initConf.js'

interface SourceNoteChange {
  voice: number
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
  const keySignature = model.voices[0]?.voice_properties.key?.k_sf ?? 0
  let result = applySourceNoteChanges(source, changes, accidentalPreference, keySignature)
  // These voice-level transforms have already been applied to Song pitches.
  result = materializeEffectiveKeySignature(result, model)
  result = result
    .replace(/[ \t]*\bshift=\S+[ \t]*/g, '')
    .replace(/\boctave=-?\d+/g, '')
    .replace(/\b(treble|bass|alto|tenor|soprano|baritone)(?:[-+](?:8|15))\b/g, '$1')
  return result
}

/**
 * Formats a complete Zupfnoter document by materializing its effective Song.
 * The embedded configuration and resource sections remain part of the result.
 */
export function formatAbcSource(source: string): string {
  const defaults = initConf(new Confstack())
  const config = mergeSongConfig(defaults, extractSongConfig(source))
  const model = new AbcParser().parse(source)
  const song = new AbcToSong().transform(model, config)
  const exported = exportSongToAbc(source, song)
  const formatted = collapseMusicWhitespace(exported)
  return addFormattingComment(source, formatted)
}

function addFormattingComment(source: string, formatted: string): string {
  const formattedWithoutComments = removeFormattingComments(formatted)
  const formattedHash = formattingHash(formattedWithoutComments)
  const previousHash = extractFormattingHash(source)
  if (previousHash === formattedHash) return formatted
  return `% Von Zupfnoter-TS formatiert am ${new Date().toISOString()} content-hash=${formattedHash}\n${formatted}`
}

function removeFormattingComments(source: string): string {
  return source.replace(/^% Von Zupfnoter-TS formatiert am [^\r\n]+\r?\n/g, '')
}

function extractFormattingHash(source: string): string | undefined {
  const match = /^% Von Zupfnoter-TS formatiert am [^\r\n]+ content-hash=([0-9a-f]+)\r?\n/.exec(source)
  return match?.[1]
}

function formattingHash(source: string): string {
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function collapseMusicWhitespace(source: string): string {
  const lines = source.split(/\r?\n/)
  const result: string[] = []
  let inMusic = false

  for (const line of lines) {
    if (line.startsWith('%%%%zupfnoter.config')) {
      inMusic = false
    } else if (line.startsWith('K:')) {
      inMusic = true
    }

    result.push(inMusic && !isAbcFieldLine(line) ? collapseMusicLine(line) : line)
  }
  return result.join('\n')
}

function collapseMusicLine(line: string): string {
  let result = ''
  let pendingWhitespace = false
  let inQuotedText = false

  for (const character of line) {
    if (character === '"') {
      if (pendingWhitespace && result !== '') result += ' '
      pendingWhitespace = false
      inQuotedText = !inQuotedText
      result += character
      continue
    }
    if (!inQuotedText && (character === ' ' || character === '\t')) {
      pendingWhitespace = true
      continue
    }
    if (pendingWhitespace && result !== '') result += ' '
    pendingWhitespace = false
    result += character
  }
  return result.trim()
}

function isAbcFieldLine(line: string): boolean {
  return /^(?:[A-Z]:|%%|%)/.test(line.trimStart())
}

function wrapMusicLine(line: string, targetLength: number): string {
  if (line.length <= targetLength) return line

  const parts: string[] = []
  let start = 0
  let searchFrom = targetLength
  while (searchFrom < line.length) {
    const barIndex = line.indexOf('|', searchFrom)
    if (barIndex < 0) break

    let end = barIndex + 1
    while (end < line.length && '|:]'.includes(line[end] ?? '')) end += 1
    parts.push(line.slice(start, end))
    start = end
    searchFrom = start + targetLength
  }
  if (parts.length === 0) return line
  parts.push(line.slice(start))
  return parts.join('\n')
}

function resolveAccidentalPreference(model: AbcModel): AccidentalPreference {
  const keySignature = model.voices[0]?.voice_properties.key?.k_sf
  if (keySignature === undefined) return 'neutral'
  if (keySignature === 0) return 'sharp'
  return keySignature > 0 ? 'sharp' : 'flat'
}

function materializeEffectiveKeySignature(source: string, model: AbcModel): string {
  const key = model.voices[0]?.voice_properties.key
  if (key === undefined || key.k_sf === undefined) return source

  const keyName = keyNameFromSignature(key.k_sf, key.k_mode)
  return source.replace(
    /(^K:\s*)([A-G](?:#|b)?m?)(?=\s|$)/m,
    `$1${keyName}`,
  )
}

function keyNameFromSignature(keySignature: number, mode: number | undefined): string {
  if (mode === 5) {
    const sharpMinorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m']
    const flatMinorKeys = ['Am', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm']
    return keySignature >= 0 && keySignature < sharpMinorKeys.length
      ? (sharpMinorKeys[keySignature] ?? 'Am')
      : (flatMinorKeys[Math.abs(keySignature)] ?? 'Am')
  }

  const sharpKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
  const flatKeys = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
  return keySignature >= 0 && keySignature < sharpKeys.length
    ? (sharpKeys[keySignature] ?? 'C')
    : (flatKeys[Math.abs(keySignature)] ?? 'C')
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
        const offsets = normalizeNoteSourceOffsets(
          note.noteSourceOffsets ?? note.sourceOffsets,
          model.source,
        )
        if (offsets !== undefined) notesByStart.set(offsets[0], note)
      }
    }

    for (const symbol of voice.symbols) {
      for (const abcNote of symbol.notes ?? []) {
        const offsets = normalizeNoteSourceOffsets(
          abcNote.sourceOffsets ?? symbolSourceNoteOffsets(symbol, model.source),
          model.source,
        )
        if (offsets === undefined) continue
        const note = notesByStart.get(offsets[0])
        if (note === undefined) continue
        changes.push({ voice: voiceIndex, start: offsets[0], end: offsets[1], midi: note.pitch })
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

function normalizeNoteSourceOffsets(
  offsets: [number, number] | undefined,
  source: string,
): [number, number] | undefined {
  if (offsets === undefined) return undefined
  const text = source.slice(offsets[0], offsets[1])
  const match = /[\^_=]*[A-Ga-g][,']*/.exec(text)
  if (match === null || match.index === undefined) return offsets
  return [offsets[0] + match.index, offsets[0] + match.index + match[0].length]
}

function applySourceNoteChanges(
  source: string,
  changes: SourceNoteChange[],
  accidentalPreference: AccidentalPreference,
  keySignature: number,
): string {
  const unique = new Map<string, SourceNoteChange>()
  for (const change of changes) unique.set(`${change.voice}:${change.start}:${change.end}`, change)

  const replacements = new Map<string, string>()
  const changesByVoice = new Map<number, SourceNoteChange[]>()
  for (const change of unique.values()) {
    const voiceChanges = changesByVoice.get(change.voice) ?? []
    voiceChanges.push(change)
    changesByVoice.set(change.voice, voiceChanges)
  }

  for (const voiceChanges of changesByVoice.values()) {
    voiceChanges.sort((a, b) => a.start - b.start)
    const accidentalState = new Map<string, number>()
    let previousEnd = 0
    for (const change of voiceChanges) {
      if (source.slice(previousEnd, change.start).includes('|')) accidentalState.clear()
      const original = source.slice(change.start, change.end)
      const pitch = abcPitchToken(
        change.midi,
        original,
        accidentalPreference,
        keySignature,
        accidentalState,
      )
      replacements.set(`${change.start}:${change.end}`, pitch)
      updateAccidentalState(accidentalState, pitch)
      previousEnd = change.end
    }
  }

  const ordered = [...unique.values()].sort((a, b) => b.start - a.start)

  let result = source
  for (const change of ordered) {
    const pitch = replacements.get(`${change.start}:${change.end}`)
    if (pitch === undefined) continue
    result = `${result.slice(0, change.start)}${pitch}${result.slice(change.end)}`
  }
  return result
}

function abcPitchToken(
  midi: number,
  original: string,
  accidentalPreference: AccidentalPreference,
  keySignature: number,
  accidentalState: Map<string, number>,
): string {
  const originalMatch = /^[\^_=]*([A-Ga-g])([,']*)/.exec(original)
  if (originalMatch === null) return original
  const originalLetter = originalMatch[1] ?? 'C'
  const originalMarks = originalMatch[2] ?? ''
  const suffix = original.slice(originalMatch[0].length)

  const candidates: Array<{
    token: string
    distance: number
    statePenalty: number
    letterDistance: number
  }> = []
  for (const letter of 'CDEFGABcdefgab') {
    for (const octave of [-2, -1, 0, 1, 2]) {
      const marks = octave < 0 ? ','.repeat(-octave) : octave > 0 ? "'".repeat(octave) : ''
      const natural = pitchForLetterAndMarks(letter, marks)
      const defaultAccidental = keySignatureAdjustment(letter, keySignature)
      const currentAccidental = accidentalState.get(letter.toUpperCase()) ?? defaultAccidental
      const currentPitch = natural + currentAccidental
      const letterDistance = Math.abs(
        'CDEFGAB'.indexOf(letter.toUpperCase()) - 'CDEFGAB'.indexOf(originalLetter.toUpperCase()),
      )
      if (midi === currentPitch) {
        candidates.push({
          token: `${letter}${marks}${suffix}`,
          distance: 0,
          statePenalty: currentAccidental === defaultAccidental ? 0 : 1,
          letterDistance,
        })
      }

      const explicitAccidental = midi - natural
      if (explicitAccidental >= -2 && explicitAccidental <= 2 && explicitAccidental !== 0) {
        candidates.push({
          token: `${accidentalText(explicitAccidental)}${letter}${marks}${suffix}`,
          distance: Math.abs(explicitAccidental),
          statePenalty: 0,
          letterDistance,
        })
      } else if (explicitAccidental === 0 && currentAccidental !== 0) {
        candidates.push({
          token: `=${letter}${marks}${suffix}`,
          distance: 0,
          statePenalty: 0,
          letterDistance,
        })
      }
    }
  }
  candidates.sort((a, b) => {
    const accidentalOrder = compareAccidentalPreference(a.token, b.token, accidentalPreference)
    return a.distance - b.distance || a.statePenalty - b.statePenalty || accidentalOrder || a.letterDistance - b.letterDistance
  })
  const preferred = pitchForLetterAndMarks(originalLetter, originalMarks)
  return candidates[0]?.token ?? `${accidentalText(midi - preferred)}${originalLetter}${originalMarks}${suffix}`
}

function updateAccidentalState(state: Map<string, number>, token: string): void {
  const match = /^([\^_=]*)([A-Ga-g])/.exec(token)
  if (match === null) return
  const accidental = match[1] ?? ''
  if (accidental === '') return
  const letter = (match[2] ?? 'C').toUpperCase()
  state.set(letter, accidental === '=' ? 0 : accidental.startsWith('^') ? accidental.length : -accidental.length)
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
  if (value === 0) return '='
  if (value > 0) return '^'.repeat(value)
  if (value < 0) return '_'.repeat(-value)
  return ''
}

function keySignatureAdjustment(letter: string, keySignature: number): number {
  const sharpOrder = 'FCGDAEB'
  const flatOrder = 'BEADGCF'
  const upperLetter = letter.toUpperCase()
  if (keySignature > 0 && sharpOrder.slice(0, keySignature).includes(upperLetter)) return 1
  if (keySignature < 0 && flatOrder.slice(0, Math.abs(keySignature)).includes(upperLetter)) return -1
  return 0
}
