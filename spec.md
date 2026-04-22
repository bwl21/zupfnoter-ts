# Spec: Legacy-Vergleichstests aktivieren (Phase 2 – Fixture-Aktivierung)

## Problem

Die `legacy_comparison.spec.ts`-Tests für Song (Stufe 2) und Sheet (Stufe 3) sind
strukturell vorhanden, testen aber nichts:

1. **Stub statt echter Pipeline**: `transformAbcToSong()` gibt immer `{voices: []}` zurück,
   statt die echte `AbcParser + AbcToSong`-Pipeline aufzurufen.
2. **Platzhalter-Fixtures werden still durchgelassen**: `matchSong` gibt `passed: true`
   zurück, wenn `fixture.voices.length === 0` — d.h. alle Tests sind grün, egal was passiert.
3. **Fixture-JSONs sind Platzhalter**: Alle `fixtures/song/*.json` enthalten `"voices": []`.

Das Ergebnis: 10 Song-Tests und 10 Sheet-Tests laufen grün, ohne irgendetwas zu prüfen.

---

## Ziel

- Song-Vergleichstests rufen die echte TS-Pipeline auf (`AbcParser + AbcToSong`)
- Fixture-JSONs enthalten echte Referenzwerte aus dem Legacy-Ruby-System
- Platzhalter-Fixtures lassen Tests **fehlschlagen** (kein stilles Durchlassen)
- Sheet-Tests bleiben `it.skip` bis Phase 3 (DefaultLayout) implementiert ist

---

## Anforderungen

### 1. `semanticMatch.ts` — Platzhalter-Check umkehren

`matchSong`: Wenn `fixture.voices.length === 0` → `passed: false` mit Mismatch:
```
{ path: 'fixture', expected: 'non-empty fixture', actual: 'placeholder (voices: [])' }
```

`matchSheet`: Wenn `fixture.children.length === 0` → `passed: false` mit Mismatch:
```
{ path: 'fixture', expected: 'non-empty fixture', actual: 'placeholder (children: [])' }
```

### 2. `legacy_comparison.spec.ts` (Song) — echte Pipeline

Den Stub `transformAbcToSong` ersetzen durch die echte Pipeline:

```typescript
import { AbcParser } from '../../AbcParser.js'
import { AbcToSong } from '../../AbcToSong.js'
import { songToFixture } from '../../fixtureLoader.js'
import { defaultTestConfig } from '../defaultConfig.js'

function transformAbcToSong(abcText: string): SongFixture {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const transformer = new AbcToSong()
  const song = transformer.transform(model, defaultTestConfig)
  return songToFixture(song)
}
```

### 3. `fixtureLoader.ts` — `songToFixture()` hinzufügen

Neue Hilfsfunktion, die ein `Song`-Objekt in das `SongFixture`-Format konvertiert.
Enthält **alle** Entity-Typen (Note, Pause, SynchPoint, MeasureStart, NewPart, Goto,
Chordsymbol, NoteBoundAnnotation).

```typescript
export function songToFixture(song: Song): SongFixture {
  return {
    meta_data: song.metaData as Record<string, unknown>,
    voices: song.voices.map((v) => ({
      entities: v.entities.map((e) => ({
        type: e.type,
        pitch: 'pitch' in e ? (e as { pitch: number }).pitch : undefined,
        duration: 'duration' in e ? (e as { duration: number }).duration : undefined,
        beat: e.beat,
        variant: e.variant,
        visible: e.visible,
      })),
    })),
    beat_maps: song.beatMaps.map((bm) =>
      Object.fromEntries(Object.entries(bm.entries).map(([k, v]) => [k, v.beat]))
    ),
  }
}
```

### 4. Fixture-JSONs befüllen (Legacy-Export)

Die 10 Fixture-JSONs in `fixtures/song/` werden aus dem Legacy-Ruby-System exportiert
(Anleitung in `fixtures/README.md`). Alle Entity-Typen werden eingeschlossen.

Betroffene Dateien:
- `fixtures/song/single_note.json`
- `fixtures/song/two_voices.json`
- `fixtures/song/repeat.json`
- `fixtures/song/pause.json`
- `fixtures/song/tuplet.json`
- `fixtures/song/tie.json`
- `fixtures/song/decoration.json`
- `fixtures/song/lyrics.json`
- `fixtures/song/02_twoStaff.json`
- `fixtures/song/Twostaff.json`

### 5. `legacy_comparison.spec.ts` (Sheet) — `it.skip` beibehalten

Sheet-Tests bleiben `it.skip` bis Phase 3 implementiert ist. Der Stub bleibt.
`matchSheet` Platzhalter-Check wird trotzdem auf `passed: false` umgestellt
(damit Sheet-Tests sofort fehlschlagen, sobald `it.skip` entfernt wird und
Fixtures noch leer sind).

---

## Fixture-Format Song (vollständig)

Alle Entity-Typen werden in der Fixture abgebildet. Felder, die für einen Typ
nicht relevant sind, werden weggelassen (nicht `null`).

```json
{
  "meta_data": { "title": "...", "meter": "4/4", "key": "C" },
  "voices": [
    {
      "entities": [
        { "type": "MeasureStart", "beat": 0,   "variant": 0, "visible": true },
        { "type": "Note",  "pitch": 48, "duration": 96, "beat": 0,  "variant": 0, "visible": true },
        { "type": "Pause", "duration": 96,               "beat": 96, "variant": 0, "visible": true },
        { "type": "Goto",  "beat": 192, "variant": 0, "visible": true }
      ]
    }
  ],
  "beat_maps": [{ "0": 0, "96": 1 }]
}
```

---

## Akzeptanzkriterien

1. `pnpm --filter @zupfnoter/core run test:unit` läuft durch.
2. Song-Vergleichstests rufen die echte `AbcParser + AbcToSong`-Pipeline auf.
3. Ein leerer Platzhalter (`voices: []` oder `children: []`) lässt den Test **fehlschlagen**.
4. Alle 10 Song-Fixture-JSONs sind mit echten Werten aus dem Legacy-System befüllt.
5. Song-Tests sind grün (TS-Ausgabe stimmt mit Legacy-Fixtures überein).
6. Sheet-Tests sind `it.skip` (kein Fehler, kein grüner Durchlauf).
7. `AbcToSong.spec.ts` bleibt unverändert und grün.

---

## Branch

`feature/phase-2-fixture-activation` (neu von `main`)

## Implementierungsschritte

1. Branch `feature/phase-2-fixture-activation` von `main` erstellen
2. `semanticMatch.ts`: Platzhalter-Checks auf `passed: false` umstellen (Song + Sheet)
3. `fixtureLoader.ts`: `songToFixture()` hinzufügen (alle Entity-Typen)
4. `legacy_comparison.spec.ts` (Song): Stub durch echte Pipeline ersetzen
5. `legacy_comparison.spec.ts` (Sheet): alle Tests auf `it.skip` setzen
6. Legacy-Export durchführen: Fixture-JSONs für alle 10 ABC-Fixtures befüllen
7. Tests ausführen und grün machen

---

## Nicht in Scope

- `AbcToSong.spec.ts` bleibt unverändert
- Sheet-Fixtures (`fixtures/sheet/`) werden nicht befüllt (Phase 3)
- `fixtures/README.md` wird nicht geändert

---

# Archiv: Phase 2 – ABC → Song (`@zupfnoter/core`)

## Problem

`packages/core` enthält bisher nur Test-Infrastruktur. Phase 2 implementiert
Stufe 1 der Transformationskette: ABC-Text → `Song`-Objekt.

abc2svg wird als **lokale Vendor-Datei** eingebunden (Tarball von moinejf.free.fr),
nicht als npm-Paket (deprecated). Die Bibliothek bleibt hinter einer sauberen
Abstraktionsschicht gekapselt — kein Code außerhalb von `AbcParser` darf direkt
auf abc2svg-Interna zugreifen.

Der Scope dieser Phase umfasst **AbcParser + AbcToSong komplett**:
vollständige Transformation ABC → `Song` in einem Schritt.

---

## Architektur

```
packages/core/
├── vendor/
│   └── abc2svg-1.js          # Lokale Kopie, nicht per npm
├── src/
│   ├── AbcParser.ts          # Kapselung von abc2svg — einziger Zugriffspunkt
│   ├── AbcToSong.ts          # Transformation AbcModel → Song
│   ├── AbcModel.ts           # Interne Typen für das abc2svg-Datenmodell
│   └── index.ts              # Public API von @zupfnoter/core
```

**Kapselungsprinzip:** `AbcParser` ist der einzige Ort, der `abc2svg-1.js` kennt.
`AbcToSong` arbeitet ausschließlich mit dem `AbcModel`-Interface — nie direkt mit
abc2svg-Objekten.

---

## Anforderungen

### `AbcModel.ts` – Interne Typen für das abc2svg-Datenmodell

Typen für das Datenmodell, das abc2svg via `get_abcmodel`-Callback liefert.
Diese Typen sind **nicht** Teil der Public API (`@zupfnoter/types`) — sie sind
interne Implementierungsdetails von `@zupfnoter/core`.

```typescript
// Internes abc2svg-Datenmodell (nicht exportiert nach außen)

export interface AbcSymbol {
  type: number              // Numerischer Typ (Note, Bar, Rest, ...)
  time: number              // Zeitposition (abc2svg-Einheiten, 1536 = ganze Note)
  dur?: number              // Dauer
  istart: number            // Offset im ABC-Quelltext (Start)
  iend: number              // Offset im ABC-Quelltext (Ende)
  notes?: AbcNote[]         // Noten (bei Akkorden mehrere)
  bar_type?: string         // Takttyp (z.B. '|', '||', '|:', ':|')
  text?: string             // Text (Volta-Klammern, Parts)
  ti1?: number              // Bindebogen-Start
  slur_sls?: number[]       // Bindebogen-Start-IDs
  slur_end?: number         // Anzahl endender Bögen
  rbstart?: number          // Volta-Klammer-Start (2 = neue Volta)
  rbstop?: number           // Volta-Klammer-Ende
  invisible?: boolean
  invis?: boolean
  extra?: AbcExtra[]        // Zusatzinformationen (Chordsymbole, Annotationen)
  [key: string]: unknown    // abc2svg kann weitere Felder haben
}

export interface AbcNote {
  midi: number              // MIDI-Pitch
  dur: number               // Dauer
  [key: string]: unknown
}

export interface AbcExtra {
  type: number
  text?: string
  [key: string]: unknown
}

export interface AbcVoice {
  voice_properties: {
    id: string
    meter: {
      wmeasure: number
      a_meter: Array<{ bot: number; top: number }>
    }
    key: AbcKey
    okey?: AbcKey
  }
  symbols: AbcSymbol[]
}

export interface AbcKey {
  k_mode?: number
  k_sf?: number             // Vorzeichen (-7..+7)
}

export interface AbcModel {
  voices: AbcVoice[]
  music_types: string[]     // Index → Typname ('note', 'bar', 'rest', ...)
  music_type_ids: {
    note: number
    bar: number
    rest: number
    tempo: number
    clef: number
    key: number
    meter: number
    [key: string]: number
  }
  info: Record<string, string>  // T:, C:, M:, K:, Q: etc.
}
```

### `AbcParser.ts` – Kapselung von abc2svg

```typescript
export class AbcParser {
  /**
   * Parst ABC-Text und liefert das interne AbcModel.
   * Einziger Ort im Projekt, der abc2svg direkt verwendet.
   *
   * @param abcText  Vollständiger ABC-Text inkl. Header
   * @returns        AbcModel oder wirft bei Parse-Fehler
   */
  parse(abcText: string): AbcModel

  /** Gemeldete Fehler und Warnungen des letzten parse()-Aufrufs */
  readonly errors: AbcParseError[]
}

export interface AbcParseError {
  severity: 0 | 1 | 2   // 0=warning, 1=error, 2=fatal
  message: string
  line?: number
  column?: number
}
```

**Implementierungsdetails:**
- abc2svg-1.js wird via `import`/`require` als lokale Datei geladen
- Der `get_abcmodel`-Callback von abc2svg wird genutzt, um das Modell zu extrahieren
- `img_out` wird auf eine No-Op-Funktion gesetzt (keine SVG-Ausgabe nötig)
- `read_file` gibt `null` zurück (kein `%%abc-include`-Support in Phase 2)

### `AbcToSong.ts` – Transformation AbcModel → Song

```typescript
export class AbcToSong {
  /**
   * Transformiert ein AbcModel in ein Song-Objekt.
   * Arbeitet ausschließlich mit AbcModel — kein direkter abc2svg-Zugriff.
   */
  transform(model: AbcModel, config: ZupfnoterConfig): Song
}
```

**Zu implementierende Transformationen** (aus `abc2svg_to_harpnotes.rb`):

| abc2svg-Typ | Ergebnis |
|-------------|----------|
| `note` (1 Note) | `Note` |
| `note` (n Noten) | `SynchPoint` mit `Note[]` |
| `rest` | `Pause` |
| `bar` | `MeasureStart` + Goto-Logik für Wiederholungen |
| `part` | `NewPart` |
| Chordsymbol (via `extra`) | `Chordsymbol` |
| Annotation (via `extra`) | `NoteBoundAnnotation` |

**Beat-Berechnung:**
- `beat = time / (ABC2SVG_DURATION_FACTOR / BEAT_RESOLUTION)`
- `ABC2SVG_DURATION_FACTOR = 1536` (ganze Note in abc2svg-Einheiten)
- `BEAT_RESOLUTION` aus `config.layout.BEAT_RESOLUTION`

**Wiederholungen und Varianten:**
- Volta-Klammern (`rbstart`/`rbstop`) → `Goto`-Entitäten
- `variant`-Zähler: 0 = keine, 1 = erste Volta, 2 = zweite Volta

**Bindebögen und Bögen:**
- `ti1` → `tieStart = true` auf der Note
- Folgenote bekommt `tieEnd = true`
- `slur_sls` / `slur_end` → `slurStarts` / `slurEnds`

**Metadaten** (aus `model.info`):
- `T:` → `title`, `C:` → `composer`, `M:` → `meter`, `K:` → `key`, `Q:` → `tempo`

### `index.ts` – Public API

```typescript
export { AbcParser } from './AbcParser.js'
export type { AbcParseError } from './AbcParser.js'
export { AbcToSong } from './AbcToSong.js'
// AbcModel ist NICHT exportiert — internes Implementierungsdetail
```

---

## abc2svg-Einbindung (Vendor)

abc2svg wird **nicht** per npm installiert, sondern als lokale Datei:

```
packages/core/vendor/abc2svg-1.js   # Kopie von http://moinejf.free.fr/js/abc2svg-1.js
```

- Die Datei wird in `.gitignore` **nicht** ausgeschlossen — sie ist Teil des Repos
- Version wird in `packages/core/vendor/README.md` dokumentiert
- Update: manuelle Kopie der neuen Version, Commit mit Versionsangabe
- In `packages/core/tsconfig.json`: `vendor/` wird nicht type-gecheckt

**Laden in Node.js (Tests, CLI):**
```typescript
// In AbcParser.ts:
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const abc2svg = require('../vendor/abc2svg-1.js')
```

**Laden im Browser (apps/web):**
```typescript
// Vite behandelt den Import als Asset
import abc2svgUrl from '@zupfnoter/core/vendor/abc2svg-1.js?url'
// oder: direkt als Script-Tag in index.html
```

---

## Akzeptanzkriterien

1. `AbcParser.parse(abcText)` liefert ein `AbcModel` für gültige ABC-Eingaben
2. `AbcToSong.transform(model, config)` liefert ein `Song`-Objekt
3. Für `single_note.abc`: Song enthält genau 1 Voice mit 1 `Note`-Entity
4. Für `two_voices.abc`: Song enthält 2 Voices mit je 4 `Note`-Entities
5. Für `repeat.abc`: Song enthält `Goto`-Entities für die Wiederholung
6. Für `pause.abc`: Song enthält `Pause`-Entities
7. Kein Code außerhalb von `AbcParser.ts` importiert `abc2svg-1.js`
8. `pnpm --filter @zupfnoter/core run type-check` läuft ohne Fehler
9. `pnpm --filter @zupfnoter/core run test:unit` — alle Tests grün

---

## Implementierungsschritte

1. `packages/core/vendor/` anlegen, `abc2svg-1.js` herunterladen und einchecken
2. `packages/core/vendor/README.md` mit Versionsinfo erstellen
3. `packages/core/src/AbcModel.ts` erstellen (interne Typen)
4. `packages/core/src/AbcParser.ts` implementieren (abc2svg-Kapselung)
5. `packages/core/src/AbcToSong.ts` implementieren (Transformation)
6. `packages/core/src/index.ts` mit Public API befüllen
7. Vitest-Tests für `AbcParser` (parse + Fehlerbehandlung)
8. Vitest-Tests für `AbcToSong` gegen minimale Fixtures
9. Legacy-Vergleichstests in `packages/core/src/testing/__tests__/song/` aktivieren
10. AGENTS.md Phase 2 auf lokale Vendor-Einbindung aktualisieren

---

# Specs (Index)

Spezifikationen sind nach Phase geordnet in `docs/<phase>/spec.md` abgelegt.

| Datei | Inhalt |
|-------|--------|
| [docs/phase-0/spec.md](docs/phase-0/spec.md) | Phase 0 – Monorepo-Setup |
| [docs/phase-1/spec.md](docs/phase-1/spec.md) | Phase 1 – `@zupfnoter/types` |
| [docs/fixtures/spec.md](docs/fixtures/spec.md) | Legacy-Vergleichstests (fixtures/) |

Neue Specs werden im jeweiligen Phase-Ordner als `spec.md` abgelegt.
Die aktuelle Arbeits-Spec wird von Ona in dieser Datei verwaltet.
