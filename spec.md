# Spec: Phase 2 – ABC → Song (`@zupfnoter/core`)

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
