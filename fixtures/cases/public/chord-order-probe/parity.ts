import type { FixtureParityContext } from '../../../../packages/core/src/testing/fixtureLoader.js'

export default {
  ignoreSongEntityFields: ['countNote'],

  assertSong({ actual, abcText }: FixtureParityContext): void {
    for (const voice of actual.voices) {
      for (const entity of voice.entities) {
        if (entity.type !== 'SynchPoint') continue

        const notes = entity.notes
        if (!Array.isArray(notes) || notes.length === 0) {
          throw new Error('chord-order-probe: SynchPoint has no note metadata')
        }

        notes.forEach((note, index) => {
          if (note.sourceOrder !== index) {
            throw new Error(`chord-order-probe: expected sourceOrder ${index}, got ${String(note.sourceOrder)}`)
          }
          const offsets = note.noteSourceOffsets
          if (!Array.isArray(offsets) || offsets.length !== 2) {
            throw new Error('chord-order-probe: missing individual note source offsets')
          }
          const excerpt = abcText.slice(offsets[0], offsets[1])
          if (!/[A-Ga-g]/.test(excerpt)) {
            throw new Error(`chord-order-probe: invalid note source range ${offsets.join('..')}`)
          }
        })
      }
    }
  },
}
