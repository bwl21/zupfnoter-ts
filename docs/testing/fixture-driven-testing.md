# Fixture-Driven Testing Strategy

## Übersicht

Die Test-Strategie basiert auf **Fixtures**, die den Zustand jeder Transformationsstufe
als JSON speichern. Tests vergleichen TypeScript-Ausgabe mit Legacy-Referenzen.

```
ABC-Datei + Config
    ↓
[Stufe 1: AbcParser] → fixture: abc_model.json
    ↓
[Stufe 2: AbcToSong] → fixture: song.json
    ↓
[Stufe 3: HarpnotesLayout] → fixture: sheet.json
    ↓
[Stufe 4: SvgEngine] → fixture: output.svg
```

Alle Fixtures liegen unter `fixtures/` und sind **versioniert**.

---

## Fixture-Struktur

```
fixtures/
└── cases/
    ├── <test-case>/
    │   ├── input.abc          # ABC-Notation + optionaler %%%%zupfnoter.config Block
    │   ├── song.json          # Stufe 2: Song-Modell (Legacy Reference)
    │   ├── sheet.json         # Stufe 3: Sheet-Modell (Legacy Reference)
    │   ├── output.svg         # Stufe 4: SVG-String (Legacy Reference, geplant)
    │   └── _ts_output/        # TypeScript-Ausgabe (generiert)
    │       ├── song.json
    │       ├── sheet.json
    │       └── output.svg
    └── ...
```

**Konvention:**
- Input: `fixtures/cases/<test-case>/input.abc`
- Legacy Reference: `fixtures/cases/<test-case>/<stufe>.json` (hand-gepflegt oder exportiert)
- TypeScript Output: `fixtures/cases/<test-case>/_ts_output/<stufe>.json` (generiert)
- Discovery: Tests scannen `fixtures/cases/*/input.abc`.
- Stage-Aktivierung: Song-Tests laufen für Testfälle mit `song.json`; Sheet-Tests für Testfälle mit `sheet.json`.
- Config: inline im ABC via `%%%%zupfnoter.config`; fehlt der Block, gelten `initConf()`-Defaults.
- Keine separate `input.config.json`: Fixture-Tests verwenden genau dieselbe Config-Quelle wie die Pipeline.

---

## Test-Implementierung

### 1. Basis-Test-Struktur

```typescript
// packages/core/src/testing/__tests__/fixtures.spec.ts

import { describe, it, expect } from 'vitest'
import { loadFixture, scanFixtureCases, transformFixtureToSong, transformFixtureToSheet } from '../fixtureLoader'
import { matchSong, matchSheet, formatMismatches } from '../semanticMatch'

describe('Fixture-Driven Tests', () => {
  describe('Stufe 2: AbcToSong', () => {
    for (const testCase of scanFixtureCases().filter((tc) => tc.hasSongFixture)) {
      it(`matches legacy song.json: ${testCase.id}`, () => {
      const fixture = loadFixture(testCase)
      if (fixture.song === null) throw new Error(`Missing song fixture for ${testCase.id}`)
      const actual = transformFixtureToSong(fixture)
      const result = matchSong(actual, fixture.song)
      expect(result.passed, formatMismatches(result)).toBe(true)
    })
    }
  })

  describe('Stufe 3: HarpnotesLayout', () => {
    for (const testCase of scanFixtureCases().filter((tc) => tc.hasSheetFixture)) {
      it(`matches legacy sheet.json: ${testCase.id}`, () => {
      const fixture = loadFixture(testCase)
      if (fixture.sheet === null) throw new Error(`Missing sheet fixture for ${testCase.id}`)
      const actual = transformFixtureToSheet(fixture)
      const result = matchSheet(actual, fixture.sheet)
      expect(result.passed, formatMismatches(result)).toBe(true)
    })
    }
  })
})
```

### 2. Fixture-Loader

```typescript
// packages/core/src/testing/fixture-loader.ts

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import type { ZupfnoterConfig } from '@zupfnoter/types'
import { extractSongConfig, mergeSongConfig } from '../../extractSongConfig'
import { defaultTestConfig } from './defaultConfig'

export interface FixtureCase {
  name: string
  id: string
  dir: string
  hasSongFixture: boolean
  hasSheetFixture: boolean
}

export interface FixtureSet {
  name: string
  id: string
  dir: string
  input: {
    abc: string
  }
  config: ZupfnoterConfig
  song: any
  sheet: any
  output_svg: string | null
}

const FIXTURE_CASES_ROOT = resolve(__dirname, '../../../../fixtures/cases')

export function scanFixtureCases(): FixtureCase[] {
  return readdirSync(FIXTURE_CASES_ROOT)
    .map((name) => {
      const dir = resolve(FIXTURE_CASES_ROOT, name)
      return {
        name,
        id: name,
        dir,
        hasSongFixture: existsSync(resolve(dir, 'song.json')),
        hasSheetFixture: existsSync(resolve(dir, 'sheet.json')),
      }
    })
    .filter((testCase) => existsSync(resolve(testCase.dir, 'input.abc')))
}

export function loadFixture(testCase: FixtureCase): FixtureSet {
  const abc = readFileSync(resolve(testCase.dir, 'input.abc'), 'utf-8')
  return {
    name: testCase.name,
    id: testCase.id,
    dir: testCase.dir,
    input: { abc },
    config: mergeSongConfig(defaultTestConfig, extractSongConfig(abc)),
    song: safeLoadJson(resolve(testCase.dir, 'song.json')),
    sheet: safeLoadJson(resolve(testCase.dir, 'sheet.json')),
    output_svg: safeLoadText(resolve(testCase.dir, 'output.svg')),
  }
}

export function saveFixtureOutput(
  fixture: FixtureSet,
  stage: 'song' | 'sheet' | 'output_svg',
  data: any
) {
  const dir = resolve(fixture.dir, '_ts_output')
  const filename = stage === 'output_svg' ? 'output.svg' : `${stage}.json`
  const filepath = resolve(dir, filename)
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  mkdirSync(dir, { recursive: true })
  writeFileSync(filepath, content, 'utf-8')
}

function safeLoadJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function safeLoadText(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

```

### 3. Comparison / Semantic Matching

```typescript
// packages/core/src/testing/compare-fixtures.ts

export interface ComparisonResult {
  matches: boolean
  differences: string[]
}

/**
 * Semantischer Vergleich zwischen TypeScript-Ausgabe und Legacy-Reference.
 * Ignoriert irrelevante Unterschiede (z.B. Floating-Point-Präzision, Feld-Ordnung).
 */
export function compareFixtures(
  ts_output: any,
  legacy_reference: any,
  tolerance = 0.0001
): ComparisonResult {
  const differences: string[] = []
  
  function compare(a: any, b: any, path: string = '$') {
    if (a === b) return
    
    if (typeof a === 'number' && typeof b === 'number') {
      if (Math.abs(a - b) > tolerance) {
        differences.push(`${path}: ${a} != ${b} (delta: ${Math.abs(a - b)})`)
      }
      return
    }
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        differences.push(`${path}: array length ${a.length} != ${b.length}`)
        return
      }
      a.forEach((item, i) => compare(item, b[i], `${path}[${i}]`))
      return
    }
    
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      const allKeys = new Set([...keysA, ...keysB])
      
      allKeys.forEach(key => {
        if (!(key in a)) {
          differences.push(`${path}.${key}: missing in ts_output`)
        } else if (!(key in b)) {
          differences.push(`${path}.${key}: unexpected in ts_output`)
        } else {
          compare(a[key], b[key], `${path}.${key}`)
        }
      })
      return
    }
    
    differences.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)
  }
  
  compare(ts_output, legacy_reference)
  
  return {
    matches: differences.length === 0,
    differences
  }
}
```

---

## Fixture-Extraktion aus Legacy-System

### Schritt 1: Legacy-Exporter schreiben (Ruby)

Im Legacy-Repository (`bwl21/zupfnoter`, Branch `feature/voice-styles_and-other-concepts`):

```ruby
# tools/export_fixtures.rb

require 'zupfnoter'
require 'json'

ABC_FILES = [
  'twostaff',
  'variations',
  'synchlines',
  # ... weitere Testfälle
]

ABC_FILES.each do |name|
  abc_path = "fixtures/#{name}/input.abc"
  next unless File.exist?(abc_path)
  
  abc_text = File.read(abc_path)
  config = extract_config_from_abc(abc_text)
  
  # Stufe 1: abc_model (via abc2svg)
  abc_model = Zupfnoter::Abc.parse(abc_text)
  
  # Stufe 2: Song (via Harpnotes::Music)
  song = Zupfnoter::AbcToSong.transform(abc_model, config)
  
  # Stufe 3: Sheet (via Harpnotes::Drawing)
  sheet = Zupfnoter::HarpnotesLayout.layout(song, 0, 'A3')
  
  # Stufe 4: SVG
  svg = Zupfnoter::SvgEngine.render(sheet)
  
  # JSON exportieren (zirkuläre Refs entfernen!)
  output_dir = "fixtures/#{name}"
  
  File.write("#{output_dir}/abc_model.json",
    JSON.pretty_generate(sanitize_for_json(abc_model)))
  
  File.write("#{output_dir}/song.json",
    JSON.pretty_generate(song.to_json_safe))  # Ohne @references
  
  File.write("#{output_dir}/sheet.json",
    JSON.pretty_generate(sheet.to_json_safe)) # Ohne @drawables
  
  File.write("#{output_dir}/output.svg", svg)
  
  puts "✓ Exported: #{name}"
end

def extract_config_from_abc(abc_text)
  match = abc_text.match(/%%%%zupfnoter\.config\s*({[\s\S]*?})\s*$/m)
  match ? JSON.parse(match[1]) : {}
end

def sanitize_for_json(obj)
  # Entfernt zirkuläre Refs, konvertiert Ruby-Objekte
  JSON.parse(JSON.generate(obj))
end
```

**Aufruf:**
```bash
cd zupfnoter  # Legacy-Repo
ruby tools/export_fixtures.rb > /path/to/zupfnoter-ts/fixtures/
```

### Schritt 2: Fixtures versionieren

Nach dem Export:

```bash
cd zupfnoter-ts
git add fixtures/*/
git commit -m "docs(fixtures): export legacy references for Phase 2-4 tests"
```

---

## Test-Ausführung

### 1. Alle Fixture-Tests laufen

```bash
pnpm test --run packages/core

# Oder nur Fixtures:
pnpm test fixtures.spec.ts
```

### 2. Watch-Mode für Entwicklung

```bash
pnpm test --watch packages/core
```

### 3. Snapshot-Updates (nach Absicht-Änderungen)

```bash
pnpm test --update packages/core
```

### 4. Fixtures neu exportieren (nach Legacy-Änderung)

```bash
# Im Legacy-Repo:
ruby tools/export_fixtures.rb

# In zupfnoter-ts:
git diff fixtures/  # Review
git add fixtures/
git commit -m "chore(fixtures): regenerate from legacy"
```

---

## CI-Integration

```yaml
# .github/workflows/test.yml

- name: Run fixture tests
  run: pnpm test --run packages/core

- name: Check for snapshot changes
  run: |
    if [[ -n $(git status -s) ]]; then
      echo "❌ Snapshot changes detected. Run pnpm test --update"
      exit 1
    fi
```

---

## Fehlerbehandlung

### Fall 1: Legacy-Referenz ist "falsch"

Wenn die Legacy-Ausgabe einen Bug enthält, den wir in TS korrigieren wollen:

1. Fixture **nicht updaten**, stattdessen einen **Kommentar** hinzufügen:
   ```typescript
   // KNOWN ISSUE: Legacy hatte Bug in BeatPacker für Kollisionen
   // TS-Version ist korrekt. Fixture wird ignoriert für diesen Fall.
   it.skip('should match legacy sheet.json (known issue)', () => {
     // ...
   })
   ```

2. Neue **korrigierte Referenz** erstellen:
   ```
   fixtures/twostaff/sheet.corrected.json
   ```

3. Test gegen korrigierte Version:
   ```typescript
   expect(sheet.toJSON()).toEqual(fixtures.sheet_corrected)
   ```

### Fall 2: TypeScript-Output unterscheidet sich unbeabsichtigt

```bash
pnpm test fixtures.spec.ts --reporter=verbose

# Diff anschauen:
cat fixtures/twostaff/_ts_output/song.diff
```

---

## Best Practices

1. **Kleine, fokussierte Testfälle:** Ein ABC pro Funktion (1–2 Maßnahmen)
2. **Aussagekräftige Namen:** `twostaff`, `synchlines`, `variations` statt `test1`, `test2`
3. **Config inline in ABC:** Nutze `%%%%zupfnoter.config`-Block statt separater JSON
4. **Fixtures versionieren:** Kein `.gitignore` für `fixtures/`
5. **Nur Legacy-Referenzen committieren:** `_ts_output/` wird bei jedem Run regeneriert

---

## Roadmap

- [x] Phase 2: Song-Fixtures bootstrap + Tests aktivieren
- [x] Phase 3: Sheet-Fixtures bootstrap + Tests aktivieren  
- [ ] Phase 4: SVG-Fixtures + Snapshot-Tests
- [ ] Phase 4: PDF-Fixtures (nur "valides PDF", kein Byte-Vergleich)
