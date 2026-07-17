import { describe, it, expect } from 'vitest'
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { computeBeatCompression } from '../../BeatPacker.js'
import { buildConfstack } from '../../buildConfstack.js'
import { fixtureConfigFromAbc, hasFixtureCase, readFixtureAbc } from '../../testing/fixtureLoader.js'

const CASE = '246_Horch-was-kommt-von-draussen-rein'

describe.skipIf(!hasFixtureCase(CASE))('BeatPacker per-beat diagnostic', () => {
  it('dumps all intermediate values per beat', () => {
    const abc = readFixtureAbc(CASE)
    const config = fixtureConfigFromAbc(abc)
    const model = new AbcParser().parse(abc)
    const song = new AbcToSong().transform(model, config)

    // Test with different layout line sets: [1, 2] (1-based, as from config)
    // and [0, 1] (0-based, raw indices, for comparison)

    for (const layoutLines of [[0, 1], [1, 2]]) {
      const conf = buildConfstack(config, '0')
      // monkey-patch the pack method via conf
      const compression = computeBeatCompression(song, layoutLines, conf)
      const rawValues = Object.values(compression)
      const maxRaw = Math.max(...rawValues)
      const beats = Object.keys(compression).map(Number).sort((a, b) => a - b)

      console.log(`\n--- layoutLines=${JSON.stringify(layoutLines)} ---`)
      console.log(`total beats: ${beats.length}, max raw: ${maxRaw}`)

      // Dump first 10 and last 10 entries
      const dump = (entries: number[], label: string) => {
        console.log(`  ${label}:`)
        for (const beat of entries.slice(0, 20)) {
          console.log(`    beat=${beat} raw=${compression[beat]}`)
        }
        if (entries.length > 40) {
          console.log(`    ... (${entries.length - 40} skipped)`)
        }
        for (const beat of entries.slice(-20)) {
          console.log(`    beat=${beat} raw=${compression[beat]}`)
        }
      }
      dump(beats, 'beats')
    }

    expect(true).toBe(true)
  })
})
