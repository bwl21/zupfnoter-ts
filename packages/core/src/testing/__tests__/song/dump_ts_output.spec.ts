/**
 * Dumps the TS pipeline output for all song fixtures to fixtures/song/_ts_output/.
 *
 * Development helper — not a regression test.
 * Run once to see what the TS pipeline currently produces:
 *
 *   cd packages/core
 *   npx vitest run --reporter=verbose src/testing/__tests__/song/dump_ts_output.spec.ts
 *
 * Output: fixtures/song/_ts_output/<name>.json
 * Compare with the legacy Ruby export to identify discrepancies before populating
 * the real fixtures in fixtures/song/<name>.json.
 */
import { describe, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AbcParser } from '../../../AbcParser.js'
import { AbcToSong } from '../../../AbcToSong.js'
import { songToFixture } from '../../fixtureLoader.js'
import { defaultTestConfig } from '../../defaultConfig.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../../../../..')
const OUT_DIR = resolve(REPO_ROOT, 'fixtures/song/_ts_output')

function dump(name: string, abcPath: string) {
  const abc = readFileSync(resolve(REPO_ROOT, abcPath), 'utf-8')
  const model = new AbcParser().parse(abc)
  const song = new AbcToSong().transform(model, defaultTestConfig)
  const fixture = songToFixture(song)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, `${name}.json`), JSON.stringify(fixture, null, 2) + '\n', 'utf-8')
  console.log(`Written: fixtures/song/_ts_output/${name}.json`)
}

describe('dump TS song output (dev helper)', () => {
  it('single_note', () => dump('single_note', 'fixtures/abc/minimal/single_note.abc'))
  it('two_voices',  () => dump('two_voices',  'fixtures/abc/minimal/two_voices.abc'))
  it('repeat',      () => dump('repeat',      'fixtures/abc/minimal/repeat.abc'))
  it('pause',       () => dump('pause',       'fixtures/abc/minimal/pause.abc'))
  it('tuplet',      () => dump('tuplet',      'fixtures/abc/minimal/tuplet.abc'))
  it('tie',         () => dump('tie',         'fixtures/abc/minimal/tie.abc'))
  it('decoration',  () => dump('decoration',  'fixtures/abc/minimal/decoration.abc'))
  it('lyrics',      () => dump('lyrics',      'fixtures/abc/minimal/lyrics.abc'))
  it('02_twoStaff', () => dump('02_twoStaff', 'fixtures/abc/legacy/02_twoStaff.abc'))
  it('Twostaff',    () => dump('Twostaff',    'fixtures/abc/legacy/Twostaff.abc'))
})
