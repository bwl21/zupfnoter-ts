/**
 * BeatPacker – vertikale Kompression der Notenposition.
 *
 * Port von `compute_beat_compression()` und den zugehörigen Methoden
 * in `harpnotes.rb` (Legacy).
 *
 * Wandelt Beat-Nummern (Zeitpositionen im Musikmodell) in vertikale
 * Positionen um. Die Positionen skalieren wie Beats, sind aber keine
 * absoluten Pixel — die Umrechnung erfolgt im DefaultLayout via Y_SCALE.
 *
 * Dispatcht intern auf pack_method 0/1/2/3/10 aus dem Confstack.
 */

import type { Song, Playable, SynchPoint } from '@zupfnoter/types'
import type { DurationKey, DurationStyle } from '@zupfnoter/types'
import type { Confstack } from './Confstack.js'

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Beat-Nummer → vertikale Position. */
export type BeatCompressionMap = Record<number, number>

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Berechnet die vertikale Kompression der Notenposition.
 *
 * Entspricht `compute_beat_compression()` in `harpnotes.rb`.
 *
 * @param song        Das Musikmodell
 * @param layoutLines Stimmen-Indizes die für das Layout berücksichtigt werden
 * @param conf        Confstack mit layout.packer.pack_method etc.
 */
export function computeBeatCompression(
  song: Song,
  layoutLines: number[],
  conf: Confstack,
): BeatCompressionMap {
  const packMethod = (conf.get('layout.packer.pack_method') as number) ?? 0

  switch (packMethod) {
    case 1:  return _packMethod1(song, layoutLines, conf)
    case 2:  return _packMethod2(song, layoutLines)
    case 3:  return _packMethod3(song, layoutLines, conf)
    case 10: return _packMethod10(song, layoutLines, conf)
    default: return _packMethod0(song, layoutLines, conf)
  }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Sammelt alle relevanten Playables aus den angegebenen Stimmen.
 * SynchPoint-Noten werden flach eingebettet.
 * Entspricht dem `relevant_notes`-Block in allen pack-Methoden.
 */
function collectRelevantPlayables(song: Song, layoutLines: number[]): Playable[] {
  const playables: Playable[] = []
  for (const voiceId of layoutLines) {
    const voice = song.voices[voiceId]
    if (!voice) continue
    for (const entity of voice.entities) {
      if (isPlayable(entity)) {
        playables.push(entity)
        // SynchPoint-Noten flach einbetten
        if (isSynchPoint(entity)) {
          for (const note of entity.notes) {
            playables.push(note)
          }
        }
      }
    }
  }
  return playables
}

/**
 * Gruppiert Playables nach Beat-Nummer.
 * Entspricht `group_by { |p| p.beat }` in Ruby.
 */
function groupByBeat(playables: Playable[]): Map<number, Playable[]> {
  const map = new Map<number, Playable[]>()
  for (const p of playables) {
    const group = map.get(p.beat)
    if (group) {
      group.push(p)
    } else {
      map.set(p.beat, [p])
    }
  }
  return map
}

/**
 * Gibt den `sizeFactor` für eine Notendauer zurück.
 * Entspricht `duration_to_style[duration_to_id(duration)].first` in Ruby.
 */
function getSizeFactor(
  duration: number,
  durationToStyle: Record<DurationKey, DurationStyle>,
): number {
  const key = `d${duration}` as DurationKey
  return durationToStyle[key]?.sizeFactor ?? durationToStyle['err']?.sizeFactor ?? 1
}

/**
 * Berechnet den manuellen Inkrement-Faktor für eine Zeitposition.
 * Entspricht `get_minc_factor()` in `harpnotes.rb`.
 */
function getMincFactor(
  time: number,
  increment: number,
  layoutMinc: Record<string, { minc_f?: number }>,
): number {
  const entry = layoutMinc[String(time)]
  if (entry?.minc_f !== undefined) {
    return entry.minc_f * increment
  }
  return 0
}

function isPlayable(entity: unknown): entity is Playable {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'pitch' in entity &&
    'duration' in entity &&
    'beat' in entity
  )
}

function isSynchPoint(entity: Playable): entity is SynchPoint {
  return 'notes' in entity && Array.isArray((entity as SynchPoint).notes)
}

// ---------------------------------------------------------------------------
// Pack-Methode 2 – Linear
// ---------------------------------------------------------------------------

/**
 * Lineare Kompression: position = beat * 8.
 * Entspricht `compute_beat_compression_2()` in `harpnotes.rb`.
 */
function _packMethod2(song: Song, layoutLines: number[]): BeatCompressionMap {
  const playables = collectRelevantPlayables(song, layoutLines)
  const beats = groupByBeat(playables)
  const result: BeatCompressionMap = {}
  for (const beat of beats.keys()) {
    result[beat] = beat * 8
  }
  return result
}

// ---------------------------------------------------------------------------
// Pack-Methode 0 – Standard (Default)
// ---------------------------------------------------------------------------

/**
 * Standard-Kompression: berücksichtigt Notengrößen, Taktanfänge, Parts.
 * Entspricht `compute_beat_compression_0()` in `harpnotes.rb`.
 */
function _packMethod0(song: Song, layoutLines: number[], conf: Confstack): BeatCompressionMap {
  const durationToStyle = conf.get('layout.DURATION_TO_STYLE') as Record<DurationKey, DurationStyle>
  const beatResolution = (conf.get('layout.BEAT_RESOLUTION') as number) ?? 384
  const confMinIncrement = ((conf.get('layout.packer.pack_min_increment') as number) ?? 0) * beatResolution
  const layoutMinc = (conf.get('notebound.minc') as Record<string, { minc_f?: number }>) ?? {}

  const playables = collectRelevantPlayables(song, layoutLines)
  const beats = groupByBeat(playables)
  const sortedBeats = Array.from(beats.keys()).sort((a, b) => a - b)

  let newbeat = 0
  let lastSize = 0
  const result: BeatCompressionMap = {}

  for (const beat of sortedBeats) {
    const notes = beats.get(beat)!
    const maxDuration = Math.max(...notes.map(n => n.duration))
    const sizeFactor = getSizeFactor(maxDuration, durationToStyle)
    const size = beatResolution * sizeFactor

    const isNewPart = notes.some(n => n.firstInPart)
    const measureStart = notes.some(n => n.measureStart)

    let defaultIncrement = (size + lastSize) / 2
    defaultIncrement = Math.max(defaultIncrement, confMinIncrement)
    lastSize = size

    let increment = defaultIncrement

    if (isNewPart) increment += defaultIncrement
    if (measureStart) increment += increment / 4

    increment += getMincFactor(notes[0]!.time, defaultIncrement, layoutMinc)

    newbeat += increment
    result[beat] = newbeat
  }

  return result
}

// ---------------------------------------------------------------------------
// Pack-Methode 10 – Legacy Standard
// ---------------------------------------------------------------------------

/**
 * Legacy-Standard-Kompression: nutzt beatMaps statt direkter Voice-Iteration.
 * Entspricht `compute_beat_compression_10()` in `harpnotes.rb`.
 */
function _packMethod10(song: Song, layoutLines: number[], conf: Confstack): BeatCompressionMap {
  const durationToStyle = conf.get('layout.DURATION_TO_STYLE') as Record<DurationKey, DurationStyle>
  const beatResolution = (conf.get('layout.BEAT_RESOLUTION') as number) ?? 384
  const confMinIncrement = ((conf.get('layout.packer.pack_min_increment') as number) ?? 0) * beatResolution
  const layoutMinc = (conf.get('notebound.minc') as Record<string, { minc_f?: number }>) ?? {}

  // Alle relevanten BeatMaps sammeln
  const relevantBeatMaps = layoutLines
    .map(i => song.beatMaps[i])
    .filter((bm): bm is NonNullable<typeof bm> => bm !== undefined)

  // Alle Beats aus allen BeatMaps sammeln (unique, sortiert)
  const allBeats = Array.from(
    new Set(song.beatMaps.flatMap(bm => Object.keys(bm.entries).map(Number)))
  ).sort((a, b) => a - b)

  let currentBeat = 0
  let lastSize = 0
  const result: BeatCompressionMap = {}

  for (const beat of allBeats) {
    const notesOnBeat = relevantBeatMaps
      .map(bm => bm.entries[beat])
      .filter((n): n is NonNullable<typeof n> => n !== undefined)

    if (notesOnBeat.length === 0) continue

    const maxDuration = Math.max(...notesOnBeat.map(n => n.duration))
    const sizeFactor = getSizeFactor(maxDuration, durationToStyle)
    const size = beatResolution * sizeFactor

    const isNewPart = notesOnBeat.some(n => n.firstInPart)
    const measureStart = notesOnBeat.some(n => n.measureStart)

    let increment = (size + lastSize) / 2
    increment = Math.max(increment, confMinIncrement)
    lastSize = size

    if (measureStart) increment += increment / 4
    if (isNewPart) increment += increment

    increment += getMincFactor(notesOnBeat[0]!.time, increment, layoutMinc)

    currentBeat += increment
    result[beat] = currentBeat
  }

  return result
}

// ---------------------------------------------------------------------------
// Pack-Methode 1 – Collision
// ---------------------------------------------------------------------------

/**
 * Kollisions-basierte Kompression: prüft horizontale Überlappung benachbarter Noten.
 * Entspricht `compute_beat_compression_1()` in `harpnotes.rb`.
 */
function _packMethod1(song: Song, layoutLines: number[], conf: Confstack): BeatCompressionMap {
  const durationToStyle = conf.get('layout.DURATION_TO_STYLE') as Record<DurationKey, DurationStyle>
  const beatResolution = (conf.get('layout.BEAT_RESOLUTION') as number) ?? 384
  const confMinIncrement = ((conf.get('layout.packer.pack_min_increment') as number) ?? 0) * beatResolution
  const layoutMinc = (conf.get('notebound.minc') as Record<string, { minc_f?: number }>) ?? {}

  const playables = collectRelevantPlayables(song, layoutLines)
  const beats = groupByBeat(playables)
  const sortedBeats = Array.from(beats.keys()).sort((a, b) => a - b)

  const collisionStack: Record<number, number> = {}  // pitch → last newbeat
  let newbeat = 0
  let nextIncrement = -1  // -1 = noch nicht initialisiert
  let lastSize = 0
  const result: BeatCompressionMap = {}

  for (const beat of sortedBeats) {
    const notes = beats.get(beat)!
    const maxDuration = Math.max(...notes.map(n => n.duration))
    const sizeFactor = getSizeFactor(maxDuration, durationToStyle)
    const size = beatResolution * sizeFactor

    let defaultIncrement = (size + lastSize) / 2
    defaultIncrement = Math.max(defaultIncrement, confMinIncrement)
    lastSize = size

    // Kollisionserkennung: Note deren Pitch zuletzt auf einem Beat war
    // der noch nicht weit genug zurückliegt
    const collisions = notes.filter(note => {
      const lastBeat = collisionStack[note.pitch] ?? -Infinity
      return lastBeat >= newbeat - confMinIncrement
    })

    // Inversions-Erkennung: Melodielinie die nicht monoton ist
    const inversions = notes.filter(note => {
      const prev = note.prevPitch ?? note.pitch
      const next = note.nextPitch ?? note.pitch
      const a = [prev, note.pitch, next]
      const isMonotone = (
        (a[0]! >= a[1]! && a[1]! >= a[2]!) ||
        (a[0]! <= a[1]! && a[1]! <= a[2]!)
      )
      return !isMonotone
    })

    const isNewPart = notes.some(n => n.firstInPart)
    const measureStart = notes.some(n => n.measureStart)

    // Erster Beat: defaultIncrement verwenden
    let increment = nextIncrement < 0 ? defaultIncrement : nextIncrement
    nextIncrement = confMinIncrement

    if (collisions.length > 0) {
      increment = defaultIncrement
    } else if (inversions.length > 0) {
      nextIncrement = defaultIncrement / 2
      increment = Math.max(increment, nextIncrement)
    }

    if (isNewPart) {
      increment += defaultIncrement
      nextIncrement = confMinIncrement
    }
    if (measureStart) increment += increment / 4

    increment += getMincFactor(notes[0]!.time, defaultIncrement, layoutMinc)

    newbeat += increment
    for (const note of notes) {
      collisionStack[note.pitch] = newbeat
    }
    result[beat] = newbeat
  }

  return result
}

// ---------------------------------------------------------------------------
// Pack-Methode 3 – Collision v2
// ---------------------------------------------------------------------------

/**
 * Kollisions-Kompression v2: verfeinerte Kollisionsprüfung mit Pitch-Ranges.
 * Entspricht `compute_beat_compression_3()` in `harpnotes.rb`.
 */
function _packMethod3(song: Song, layoutLines: number[], conf: Confstack): BeatCompressionMap {
  const durationToStyle = conf.get('layout.DURATION_TO_STYLE') as Record<DurationKey, DurationStyle>
  const beatResolution = (conf.get('layout.BEAT_RESOLUTION') as number) ?? 384
  const confMinIncrement = ((conf.get('layout.packer.pack_min_increment') as number) ?? 0) * beatResolution
  const layoutMinc = (conf.get('notebound.minc') as Record<string, { minc_f?: number }>) ?? {}

  const playables = collectRelevantPlayables(song, layoutLines)
  const beats = groupByBeat(playables)
  const sortedBeats = Array.from(beats.keys()).sort((a, b) => a - b)

  type StackEntry = { beat: number; kind: 'note' | 'line'; inc: number }
  const collisionStack: Record<number, StackEntry> = {}
  let collisionRange: Record<number, { beat: number; note: Playable; pitch: number; kind: 'note' | 'line' }> = {}
  let newbeat = 0
  let isFirst = true
  const result: BeatCompressionMap = {}

  for (const beat of sortedBeats) {
    const notes = beats.get(beat)!

    // 1. Kollisions-Range berechnen: alle Pitches zwischen prevPitch und pitch
    collisionRange = {}
    for (const note of notes) {
      const prev = note.prevPitch ?? note.pitch
      const lo = Math.min(prev, note.pitch)
      const hi = Math.max(prev, note.pitch)
      for (let p = lo; p <= hi; p++) {
        collisionRange[p] = {
          beat: newbeat,
          note,
          pitch: p,
          kind: p === note.pitch ? 'note' : 'line',
        }
      }
      // prevPitch selbst aus Range entfernen (wie in Ruby: result.delete(note.prev_pitch))
      if (prev !== note.pitch) {
        delete collisionRange[prev]
      }
    }

    // 2. Kollisionen identifizieren
    const collisionCandidateKeys = Object.keys(collisionRange)
      .map(Number)
      .filter(k => k in collisionStack)

    const collisions = collisionCandidateKeys
      .map(k => {
        const rangeEntry = collisionRange[k]!
        const stackEntry = collisionStack[k]!
        const sizeFactor = getSizeFactor(rangeEntry.note.duration, durationToStyle)
        const size = beatResolution * sizeFactor
        const collisionType = `${stackEntry.kind}-${rangeEntry.kind}`
        const validTypes = ['note-note', 'note-line', 'line-note', 'dline-line']
        if (
          validTypes.includes(collisionType) &&
          rangeEntry.beat <= stackEntry.beat + confMinIncrement
        ) {
          return { ...rangeEntry, inc: size }
        }
        return null
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    // 3. Default-Inkrement berechnen
    const maxDuration = Math.max(...notes.map(n => n.duration))
    const sizeFactor = getSizeFactor(maxDuration, durationToStyle)
    const sizeIncrement = beatResolution * sizeFactor

    let defaultIncrement: number
    if (isFirst || collisions.length > 0) {
      defaultIncrement = Math.max(sizeIncrement, confMinIncrement)
    } else {
      defaultIncrement = confMinIncrement
    }
    isFirst = false

    // 4. Sonderfälle (Takt, Part)
    const isNewPart = notes.some(n => n.firstInPart)
    const measureStart = notes.some(n => n.measureStart)

    let increment = defaultIncrement
    if (isNewPart) increment += defaultIncrement
    if (measureStart) increment += increment / 4
    increment += getMincFactor(notes[0]!.time, defaultIncrement, layoutMinc)

    newbeat += increment

    // CollisionStack aktualisieren
    for (const k of Object.keys(collisionRange).map(Number)) {
      collisionStack[k] = {
        beat: newbeat,
        kind: collisionRange[k]!.kind,
        inc: increment,
      }
    }

    result[beat] = newbeat
  }

  return result
}
