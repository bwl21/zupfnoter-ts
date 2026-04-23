#!/usr/bin/env node
/**
 * Converts a Legacy Song JSON (from zupfnoter-cli.js export) into the
 * SongFixture format used by the zupfnoter-ts regression tests.
 *
 * Usage:
 *   node tools/legacy-song-to-fixture.mjs <input.song.json> [output.json]
 *
 *   # Convert a single file:
 *   node tools/legacy-song-to-fixture.mjs /tmp/znout/single_note.song.json fixtures/song/single_note.json
 *
 *   # Convert all files in a directory:
 *   for f in /tmp/znout/*.song.json; do
 *     name=$(basename "$f" .song.json)
 *     node tools/legacy-song-to-fixture.mjs "$f" "fixtures/song/${name}.json"
 *   done
 *
 * Scale factors (Legacy → TS):
 *   duration: × 6   (Legacy Viertelnote = 16, TS = 96)
 *   beat:     × 2   (Legacy Viertelnote-Abstand = 48, TS = 96)
 *
 * Entity type mapping:
 *   Harpnotes::Music::Note       → Note
 *   Harpnotes::Music::Pause      → Pause
 *   Harpnotes::Music::SynchPoint → SynchPoint
 *   Harpnotes::Music::Goto       → Goto
 *   Harpnotes::Music::NewPart    → NewPart
 *   (MeasureStart is not emitted by the legacy system)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Scale factors
// ---------------------------------------------------------------------------

const DURATION_FACTOR = 6  // Legacy dur 16 → TS dur 96
const BEAT_FACTOR = 2      // Legacy beat 48 → TS beat 96

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

const CLASS_TO_TYPE = {
  'Harpnotes::Music::Note':              'Note',
  'Harpnotes::Music::Pause':             'Pause',
  'Harpnotes::Music::SynchPoint':        'SynchPoint',
  'Harpnotes::Music::Goto':              'Goto',
  'Harpnotes::Music::NewPart':           'NewPart',
  'Harpnotes::Music::NoteBoundAnnotation': 'NoteBoundAnnotation',
  'Harpnotes::Music::Chordsymbol':       'Chordsymbol',
}

// ---------------------------------------------------------------------------
// Entity conversion
// ---------------------------------------------------------------------------

function convertEntity(e) {
  const type = CLASS_TO_TYPE[e['class']]
  if (!type) return null  // skip unknown types

  const out = {
    type,
    beat:    e['@beat']    != null ? e['@beat']    * BEAT_FACTOR : undefined,
    variant: e['@variant'] ?? 0,
    visible: e['@visible'] ?? true,
  }

  // Note: pitch included for comparison.
  // Pause: pitch intentionally omitted — TS hardcodes pitch=60 (middle C) because
  // `restposition` (center/next/previous) is not yet implemented in AbcToSong.
  // Once restposition is implemented, re-enable pitch for Pause here.
  if (type === 'Note' && e['@pitch'] != null) out.pitch = e['@pitch']
  if (e['@duration'] != null) out.duration = e['@duration'] * DURATION_FACTOR

  // Note: tie flags
  if (e['@tie_start'] != null) out.tieStart = e['@tie_start']
  if (e['@tie_end']   != null) out.tieEnd   = e['@tie_end']

  // Goto: from/to beats
  if (type === 'Goto') {
    if (e['@from']?.['@beat'] != null) out.from = e['@from']['@beat'] * BEAT_FACTOR
    if (e['@to']?.['@beat']   != null) out.to   = e['@to']['@beat']   * BEAT_FACTOR
  }

  // Remove undefined fields
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined))
}

// ---------------------------------------------------------------------------
// Voice conversion
// ---------------------------------------------------------------------------

function convertVoice(legacyVoice) {
  const entities = legacyVoice
    .filter(e => typeof e === 'object' && e !== null && 'class' in e)
    .map(convertEntity)
    .filter(Boolean)
  return { entities }
}

// ---------------------------------------------------------------------------
// beat_maps conversion
// ---------------------------------------------------------------------------

function convertBeatMaps(legacyBeatMaps) {
  return legacyBeatMaps.map(bm => {
    const out = {}
    for (const [k, v] of Object.entries(bm)) {
      const legacyBeat = typeof v === 'object' && v !== null ? v['@beat'] : v
      if (legacyBeat != null) {
        const tsBeat = legacyBeat * BEAT_FACTOR
        out[String(tsBeat)] = tsBeat
      }
    }
    return out
  })
}

// ---------------------------------------------------------------------------
// meta_data conversion
// ---------------------------------------------------------------------------

function convertMetaData(legacyMeta) {
  return {
    title:    legacyMeta['title']    ?? '',
    composer: legacyMeta['composer'] ?? '',
    meter:    Array.isArray(legacyMeta['meter'])
                ? legacyMeta['meter'].join(', ')
                : (legacyMeta['meter'] ?? ''),
    key:      legacyMeta['key']      ?? '',
  }
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

function convertSong(legacySong) {
  // Legacy always prepends a duplicate of voice[1] as voice[0].
  // Skip voice[0] — the real voices start at index 1.
  const allVoices = legacySong.voices ?? []
  const uniqueVoices = allVoices.slice(1)
  const uniqueBeatMaps = (legacySong.beat_maps ?? []).slice(1)

  return {
    meta_data:  convertMetaData(legacySong.meta_data ?? {}),
    voices:     uniqueVoices.map(convertVoice),
    beat_maps:  convertBeatMaps(uniqueBeatMaps),
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.length < 1) {
  console.error('Usage: node tools/legacy-song-to-fixture.mjs <input.song.json> [output.json]')
  process.exit(1)
}

const inputPath  = resolve(args[0])
const outputPath = args[1] ? resolve(args[1]) : null

const raw     = readFileSync(inputPath, 'utf-8')
const legacy  = JSON.parse(raw)
const fixture = convertSong(legacy)
const json    = JSON.stringify(fixture, null, 2) + '\n'

if (outputPath) {
  writeFileSync(outputPath, json, 'utf-8')
  console.log(`Written: ${outputPath}`)
} else {
  process.stdout.write(json)
}
