# Spec: Phase 1 – `@zupfnoter/types`

## Problem

`packages/types/src/index.ts` ist ein leerer Platzhalter. Phase 1 definiert alle
TypeScript-Interfaces und -Typen für die gesamte Transformationskette — ohne Logik.
Diese Typen werden von `@zupfnoter/core`, `@zupfnoter/web` und `@zupfnoter/cli` importiert.

## Dateistruktur

```
packages/types/src/
├── index.ts              # Re-exportiert alles
├── music.ts              # Harpnotes.Music: MusicEntity, Note, Pause, SynchPoint, ...
├── drawing.ts            # Harpnotes.Drawing: Drawable, Ellipse, FlowLine, ...
└── config.ts             # ZupfnoterConfig, LayoutConfig, ExtractConfig, PrinterConfig, ...
```

## Anforderungen

### `music.ts` – Musikmodell

Abgeleitet aus `harpnotes.rb` (Klassen `MusicEntity`, `Playable`, `NonPlayable`, etc.)

```typescript
// Basis aller Musikentitäten
interface MusicEntity {
  beat: number              // Zeitposition (vertikal im Sheet)
  time: number              // Position in der Zeitdomäne (abc2svg-Einheiten)
  startPos: [number, number] // [Zeile, Spalte] im ABC-Quelltext
  endPos: [number, number]
  decorations: string[]
  barDecorations: string[]
  visible: boolean
  variant: 0 | 1 | 2        // Wiederholungsvariante
  znId: string              // Zupfnoter-ID für Konfigurationsreferenz
  confKey?: string
}

// Spielbare Entitäten (haben duration, beat, pitch)
interface Playable extends MusicEntity {
  duration: number
  pitch: number
  tieStart: boolean
  tieEnd: boolean
  tuplet: number            // 1 = kein Tuplet, 3 = Triole etc.
  tupletStart: boolean
  tupletEnd: boolean
  firstInPart: boolean
  measureStart: boolean
  measureCount: number
  jumpStarts: string[]
  jumpEnds: string[]
  slurStarts: string[]
  slurEnds: string[]
  countNote: string | null
  lyrics: string | null
}

interface Note extends Playable {
  readonly type: 'Note'
}

interface Pause extends Playable {
  readonly type: 'Pause'
  invisible: boolean
}

interface SynchPoint extends Playable {
  readonly type: 'SynchPoint'
  notes: Note[]
  synchedNotes: Note[]
}

// Nicht-spielbare Entitäten (haben companion)
interface NonPlayable extends MusicEntity {
  companion: Playable
}

interface MeasureStart extends NonPlayable {
  readonly type: 'MeasureStart'
}

interface NewPart extends NonPlayable {
  readonly type: 'NewPart'
  name: string
}

interface NoteBoundAnnotation extends NonPlayable {
  readonly type: 'NoteBoundAnnotation'
  text: string
  position: [number, number]
  style: string
  policy?: string
}

interface Chordsymbol extends NonPlayable {
  readonly type: 'Chordsymbol'
  text: string
  position: [number, number]
  style: string
}

// Goto ist direkt von MusicEntity (nicht NonPlayable)
interface Goto extends MusicEntity {
  readonly type: 'Goto'
  from: Playable
  to: Playable
  policy: GotoPolicy
}

interface GotoPolicy {
  confKey?: string
  level?: number
  distance?: number
}

type PlayableEntity = Note | Pause | SynchPoint
type NonPlayableEntity = MeasureStart | NewPart | NoteBoundAnnotation | Chordsymbol | Goto
type VoiceEntity = PlayableEntity | NonPlayableEntity

interface Voice {
  index: number
  name?: string
  showVoice: boolean
  showFlowline: boolean
  showJumpline: boolean
  entities: VoiceEntity[]
}

interface BeatMap {
  index: number
  entries: Record<number, PlayableEntity>  // beat → Playable
}

interface SongMetaData {
  title?: string
  composer?: string
  filename?: string
  meter?: string
  key?: string
  tempo?: number
}

interface Song {
  voices: Voice[]
  beatMaps: BeatMap[]
  metaData: SongMetaData
  harpnoteOptions?: Record<string, unknown>
  checksum?: string
}
```

### `drawing.ts` – Drawing-Modell

Abgeleitet aus `harpnotes.rb` (Klassen `Drawable`, `Ellipse`, `FlowLine`, etc.)

```typescript
interface Drawable {
  color: string
  lineWidth: number
  confKey?: string
  visible: boolean
}

type FillStyle = 'filled' | 'empty'

interface Ellipse extends Drawable {
  readonly type: 'Ellipse'
  center: [number, number]
  size: [number, number]
  fill: FillStyle
  dotted: boolean
  origin?: Note | Pause
}

interface FlowLine extends Drawable {
  readonly type: 'FlowLine'
  from: [number, number]
  to: [number, number]
  style: 'solid' | 'dashed' | 'dotted'
}

interface Path extends Drawable {
  readonly type: 'Path'
  path: [number, number][]  // Array von Punkten
  fill: boolean
}

interface Annotation extends Drawable {
  readonly type: 'Annotation'
  center: [number, number]
  text: string
  style: string
  size?: [number, number]
  origin?: PlayableEntity
}

interface Glyph extends Drawable {
  readonly type: 'Glyph'
  center: [number, number]
  size: [number, number]
  glyphName: string
  dotted: boolean
  fill: FillStyle
}

interface Image extends Drawable {
  readonly type: 'Image'
  url: string
  position: [number, number]
  height: number
}

type DrawableElement = Ellipse | FlowLine | Path | Annotation | Glyph | Image

interface Sheet {
  children: DrawableElement[]
  activeVoices: number[]
}
```

### `config.ts` – Konfigurationstypen

Abgeleitet aus `init_conf.rb`

```typescript
interface FontStyle {
  textColor: [number, number, number]
  fontSize: number
  fontStyle: 'normal' | 'bold' | 'italic'
}

type DurationKey = 'err' | 'd96' | 'd64' | 'd48' | 'd32' | 'd24' | 'd16' |
                   'd12' | 'd8' | 'd6' | 'd4' | 'd3' | 'd2' | 'd1'

interface DurationStyle {
  sizeFactor: number
  fill: FillStyle
  dotted: boolean
}

interface LayoutConfig {
  ELLIPSE_SIZE: [number, number]
  REST_SIZE: [number, number]
  LINE_THIN: number
  LINE_MEDIUM: number
  LINE_THICK: number
  Y_SCALE: number
  X_SPACING: number
  X_OFFSET: number
  PITCH_OFFSET: number
  SHORTEST_NOTE: number
  BEAT_RESOLUTION: number
  BEAT_PER_DURATION: number
  DRAWING_AREA_SIZE: [number, number]
  MM_PER_POINT: number
  color: {
    color_default: string
    color_variant1: string
    color_variant2: string
  }
  FONT_STYLE_DEF: Record<string, FontStyle>
  DURATION_TO_STYLE: Record<DurationKey, DurationStyle>
  instrument: string
  packer: { pack_method: 0 | 1 | 2 | 10 }
  limit_a3: boolean
  grid: boolean
}

interface PrinterConfig {
  a3Offset: [number, number]
  a4Offset: [number, number]
  a4Pages: number[]
  showBorder: boolean
}

interface BarnumberConfig {
  voices?: number[]
  pos?: [number, number]
  autopos?: boolean
  apbase?: [number, number]
  apanchor?: string
  style?: string
}

interface LegendConfig {
  spos?: [number, number]
  pos?: [number, number]
  tstyle?: string
  align?: string
  style?: string
}

interface AnnotationConfig {
  pos: [number, number]
  text: string
  style: string
}

interface ExtractConfig {
  title?: string
  voices: number[]
  flowlines: number[]
  subflowlines: number[]
  jumplines: number[]
  synchlines: number[][]
  layoutlines: number[]
  startpos: number
  barnumbers?: BarnumberConfig
  legend?: LegendConfig
  notes?: Record<string, AnnotationConfig>
  layout?: Partial<LayoutConfig>
  printer?: Partial<PrinterConfig>
}

interface ZupfnoterConfig {
  layout: LayoutConfig
  extract: Record<string, ExtractConfig>
  printer: PrinterConfig
}
```

## Akzeptanzkriterien

1. `pnpm --filter @zupfnoter/types run type-check` läuft ohne Fehler
2. Alle Typen sind aus `@zupfnoter/types` importierbar
3. Keine Logik in `packages/types/` — nur `interface`, `type`, `enum`
4. Jede Datei hat einen JSDoc-Kommentar mit Referenz auf die Legacy-Klasse
5. `index.ts` re-exportiert alle öffentlichen Typen

## Implementierungsschritte

1. `packages/types/src/music.ts` erstellen
2. `packages/types/src/drawing.ts` erstellen
3. `packages/types/src/config.ts` erstellen
4. `packages/types/src/index.ts` mit Re-Exports befüllen
5. Type-Check ausführen und Fehler beheben

---

# Spec: Phase 0 – Monorepo-Setup

## Problem

Das Projekt ist aktuell ein einzelner Vue-Scaffold (`src/`, `package.json` mit npm).
Für den Zupfnoter-TS-Rewrite wird eine Monorepo-Struktur mit PNPM Workspaces benötigt,
damit `@zupfnoter/core`, `@zupfnoter/types`, `@zupfnoter/web` und `@zupfnoter/cli`
als eigenständige Pakete entwickelt und lokal verknüpft werden können.

## Ist-Zustand

| Element | Status |
|---------|--------|
| `packages/core/` | ✅ existiert (nur `src/testing/`) |
| `packages/types/` | ❌ fehlt |
| `apps/web/` | ❌ fehlt |
| `apps/cli/` | ❌ fehlt |
| `src/` (Vue-Scaffold) | noch am Root, muss nach `apps/web/` |
| `pnpm-workspace.yaml` | ❌ fehlt |
| `tsconfig.base.json` | ❌ fehlt |
| Devcontainer mit Node.js | ❌ nur Ubuntu-Basis |
| `package.json` Name | `my-vue-app` → `zupfnoter-ts` |

## Anforderungen

### 1. Devcontainer: Node.js + PNPM

`devcontainer.json` auf `mcr.microsoft.com/devcontainers/typescript-node:22` umstellen.
Kein eigenes Dockerfile mehr nötig — das Image bringt Node 22, npm, TypeScript und
gängige Dev-Tools mit. PNPM via devcontainer Feature hinzufügen.

### 2. PNPM Workspaces

`pnpm-workspace.yaml` anlegen:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

Root-`package.json` anpassen:
- `name`: `zupfnoter-ts`
- `private: true`
- Scripts auf `pnpm` umstellen (`pnpm -r run …`)
- `package-lock.json` entfernen (durch `pnpm-lock.yaml` ersetzt nach `pnpm install`)

### 3. Verzeichnisstruktur anlegen

```
packages/
  core/        # bereits vorhanden — package.json ergänzen
  types/       # neu: leeres Paket mit package.json + tsconfig.json
apps/
  web/         # Vue-Scaffold hierher verschieben
  cli/         # neu: leeres Paket mit package.json + tsconfig.json
```

### 4. `src/` → `apps/web/` verschieben

Den bestehenden Vue-Scaffold (`src/`, `index.html`, `vite.config.ts`, `tsconfig.app.json`,
`tsconfig.vitest.json`, `env.d.ts`, `public/`) nach `apps/web/` verschieben.
Root bleibt nur noch Workspace-Konfiguration.

### 5. Gemeinsame `tsconfig.base.json`

Am Root eine `tsconfig.base.json` mit gemeinsamen Compiler-Optionen erstellen.
Alle Paket-`tsconfig.json`-Dateien erweitern diese Basis.

### 6. Paket-`package.json` für alle Pakete

| Paket | Name | Version |
|-------|------|---------|
| `packages/core` | `@zupfnoter/core` | `0.1.0` |
| `packages/types` | `@zupfnoter/types` | `0.1.0` |
| `apps/web` | `@zupfnoter/web` | `0.1.0` |
| `apps/cli` | `@zupfnoter/cli` | `0.1.0` |

`apps/web` hängt von `@zupfnoter/core` und `@zupfnoter/types` ab (`workspace:*`).
`packages/core` hängt von `@zupfnoter/types` ab (`workspace:*`).

## Akzeptanzkriterien

1. `pnpm install` läuft am Root durch ohne Fehler
2. `pnpm -r run type-check` läuft durch (alle Pakete)
3. `pnpm -r run test:unit` läuft durch (alle Pakete mit Tests)
4. `apps/web/` enthält den Vue-Scaffold, `src/` am Root existiert nicht mehr
5. `packages/types/` und `apps/cli/` existieren als leere Pakete
6. Devcontainer verwendet `typescript-node:22`-Image

## Implementierungsschritte

1. `devcontainer.json` auf `typescript-node:22`-Image umstellen, Dockerfile entfernen
2. `pnpm-workspace.yaml` anlegen
3. Root-`package.json` anpassen (Name, Scripts)
4. `tsconfig.base.json` am Root erstellen
5. `packages/types/` anlegen (package.json, tsconfig.json, leeres `src/index.ts`)
6. `apps/cli/` anlegen (package.json, tsconfig.json, leeres `src/index.ts`)
7. `src/` → `apps/web/` verschieben (inkl. vite.config, tsconfig.app, index.html, public/)
8. `apps/web/package.json` anlegen, Abhängigkeiten auf `workspace:*` setzen
9. `packages/core/package.json` anlegen/ergänzen
10. Alle Paket-`tsconfig.json` auf `tsconfig.base.json` umstellen
11. Root-`tsconfig.json` als Projekt-Referenz-Datei aktualisieren
12. `package-lock.json` entfernen, `.gitignore` um `pnpm-lock.yaml`-Eintrag ergänzen
13. `pnpm install` ausführen und verifizieren

---

# Spec: Legacy-Vergleichstests für Zupfnoter-TS

## Problem

Der TypeScript-Rewrite von Zupfnoter muss fachlich korrekte Ergebnisse liefern.
Da die Transformationskette komplex ist (ABC → Song → Sheet), brauchen wir eine
Teststrategie, die sicherstellt, dass die TS-Implementierung semantisch äquivalent
zum Legacy-System (Ruby/Opal) ist — ohne das Legacy-System im CI betreiben zu müssen.

---

## Teststrategie: Überblick

```
Legacy-System (einmalig, lokal)          zupfnoter-ts (CI)
────────────────────────────────         ──────────────────────────────
ABC-Fixture → Song.toJSON()   ──────►   fixtures/song/<name>.json
ABC-Fixture → Sheet.toJSON()  ──────►   fixtures/sheet/<name>.json
                                         │
                                         ▼
                                    Vitest: TS-Ausgabe vs. Fixture
                                    (semantischer Vergleich)
```

Fixtures werden **einmalig manuell** aus dem laufenden Legacy-System exportiert
und ins Repository eingecheckt. Im CI läuft nur der TS-seitige Vergleich.

---

## Vergleichsstufen

Verglichen wird auf **beiden** Transformationsstufen:

| Stufe | Legacy-Objekt | Fixture-Datei | TS-Klasse |
|-------|--------------|---------------|-----------|
| 2 | `Harpnotes::Music::Song` | `fixtures/song/<name>.json` | `Song` |
| 3 | `Harpnotes::Drawing::Sheet` | `fixtures/sheet/<name>.json` | `Sheet` |

---

## ABC-Fixtures

Zwei Kategorien:

### Minimale Fixtures (neu erstellt)

Kleine, gezielt konstruierte ABC-Stücke, die einzelne Features isoliert testen.
Abgelegt unter `fixtures/abc/minimal/`.

| Datei | Testet |
|-------|--------|
| `single_note.abc` | Eine Note, eine Stimme |
| `two_voices.abc` | Zwei Stimmen, Synchlines |
| `repeat.abc` | Wiederholung mit Volta-Klammern |
| `pause.abc` | Pausen verschiedener Längen |
| `tuplet.abc` | Triolen |
| `tie.abc` | Bindebögen |
| `decoration.abc` | Fermata, Dynamik |
| `lyrics.abc` | Liedtext (w:-Zeilen) |

### Legacy-Testcases (aus `bwl21/zupfnoter`)

Ausgewählte Dateien aus `30_sources/SRC_Zupfnoter/testcases/`.
Abgelegt unter `fixtures/abc/legacy/`.

| Datei | Testet |
|-------|--------|
| `02_twoStaff.abc` | Mehrstimmigkeit, Parts |
| `Twostaff.abc` | Standardfall |

---

## Fixture-Erzeugung (einmalig, manuell)

### Voraussetzung

Laufendes Legacy-System (`bwl21/zupfnoter`, Branch `feature/voice-styles_and-other-concepts`).

### Vorgehen

1. Im Legacy-System eine Export-Funktion aktivieren (oder temporär einbauen), die
   nach der Transformation `Song#to_json` und `Sheet#to_json` in Dateien schreibt.
2. Für jede ABC-Fixture-Datei ausführen:
   ```
   zupfnoter export --abc fixtures/abc/minimal/single_note.abc \
     --song fixtures/song/single_note.json \
     --sheet fixtures/sheet/single_note.json
   ```
3. Erzeugte JSON-Dateien ins Repository einchecken.
4. Fixtures gelten als **stabil** — sie werden nur bei bewussten fachlichen Änderungen
   aktualisiert (mit Commit-Kommentar, der die Änderung begründet).

### Fixture-Format Song (Stufe 2)

```json
{
  "meta_data": { "title": "...", "composer": "...", "meter": "4/4", "key": "G" },
  "voices": [
    {
      "entities": [
        { "type": "Note", "pitch": 60, "duration": 384, "beat": 0, "znId": "1-0" },
        { "type": "Pause", "duration": 384, "beat": 384 }
      ]
    }
  ],
  "beat_maps": [ { "0": 0, "384": 1 } ]
}
```

### Fixture-Format Sheet (Stufe 3)

```json
{
  "children": [
    { "type": "Ellipse", "center": [25.4, 10.0], "size": [3.5, 1.7], "fill": false, "color": "black" },
    { "type": "FlowLine", "from": [25.4, 10.0], "to": [25.4, 15.0], "style": "solid" }
  ]
}
```

---

## Vergleichsstrategie: Semantischer Vergleich

Kein exakter JSON-Vergleich. Geprüft werden nur fachlich relevante Felder.

### Song-Vergleich (Stufe 2)

Pro Entity in jeder Stimme werden verglichen:

| Feld | Toleranz | Begründung |
|------|----------|-----------|
| `type` | exakt | Note/Pause/SynchPoint muss stimmen |
| `pitch` | exakt | MIDI-Pitch ist diskret |
| `duration` | exakt | Notenwert ist diskret |
| `beat` | exakt | Zeitposition ist diskret |
| `variant` | exakt | Wiederholungsvariante |
| `visible` | exakt | Sichtbarkeit |

Nicht verglichen: interne IDs, Quelltext-Positionen (`startPos`/`endPos`), Implementierungsdetails.

### Sheet-Vergleich (Stufe 3)

Pro Drawable in `children`:

| Feld | Toleranz | Begründung |
|------|----------|-----------|
| `type` | exakt | Ellipse/FlowLine/Glyph/Annotation/Path |
| `center` | ±0.1 mm | Fließkomma-Layoutberechnung |
| `size` | ±0.05 mm | Fließkomma |
| `fill` | exakt | Boolean |
| `color` | exakt | String |
| `style` | exakt | solid/dashed/dotted |
| Anzahl children | exakt | Kein Element darf fehlen oder hinzukommen |

Nicht verglichen: `confKey`, `draginfo`, interne Referenzen.

### Hilfsfunktion `semanticMatch`

```typescript
// packages/core/src/testing/semanticMatch.ts
function matchSong(actual: Song, fixture: SongFixture): MatchResult
function matchSheet(actual: Sheet, fixture: SheetFixture): MatchResult

interface MatchResult {
  passed: boolean
  mismatches: Mismatch[]
}

interface Mismatch {
  path: string      // z.B. "voices[0].entities[3].pitch"
  expected: unknown
  actual: unknown
}
```

---

## Anforderungen

### Muss

- [ ] Fixture-Verzeichnisstruktur anlegen (`fixtures/abc/`, `fixtures/song/`, `fixtures/sheet/`)
- [ ] Minimale ABC-Fixtures erstellen (8 Dateien, siehe oben)
- [ ] Legacy-ABC-Fixtures kopieren (2 Dateien aus `bwl21/zupfnoter`)
- [ ] Export-Skript für Legacy-System dokumentieren (README in `fixtures/`)
- [ ] `semanticMatch`-Hilfsfunktionen implementieren (`matchSong`, `matchSheet`)
- [ ] Vitest-Tests für Stufe 2 (Song): je eine Testdatei pro ABC-Fixture
- [ ] Vitest-Tests für Stufe 3 (Sheet): je eine Testdatei pro ABC-Fixture
- [ ] Fixture-JSON für alle ABC-Fixtures einchecken (initial: Platzhalter, befüllt nach Legacy-Export)

### Kann (später)

- [ ] Update-Skript: Fixtures automatisch aus Legacy neu generieren
- [ ] Diff-Report: HTML-Ausgabe bei Abweichungen

---

## Akzeptanzkriterien

1. `npm run test:unit` läuft ohne Legacy-System durch.
2. Für jede ABC-Fixture existiert ein Song-Fixture und ein Sheet-Fixture.
3. `matchSong` und `matchSheet` schlagen bei bekannten Abweichungen fehl und
   geben einen lesbaren Pfad zur Abweichung aus.
4. Float-Toleranz von ±0.1 mm für Positionen, ±0.05 mm für Größen.
5. Fehlende oder zusätzliche Drawables im Sheet führen immer zum Fehler.
6. Fixtures sind versioniert und ändern sich nur durch bewusste Commits.

---

## Verzeichnisstruktur

```
fixtures/
├── README.md                  # Anleitung zur Fixture-Erzeugung aus Legacy
├── abc/
│   ├── minimal/
│   │   ├── single_note.abc
│   │   ├── two_voices.abc
│   │   ├── repeat.abc
│   │   ├── pause.abc
│   │   ├── tuplet.abc
│   │   ├── tie.abc
│   │   ├── decoration.abc
│   │   └── lyrics.abc
│   └── legacy/
│       ├── 02_twoStaff.abc
│       └── Twostaff.abc
├── song/
│   ├── single_note.json
│   ├── two_voices.json
│   └── ...
└── sheet/
    ├── single_note.json
    ├── two_voices.json
    └── ...

packages/core/src/testing/
├── semanticMatch.ts           # matchSong, matchSheet
└── __tests__/
    ├── song/
    │   ├── single_note.spec.ts
    │   ├── two_voices.spec.ts
    │   └── ...
    └── sheet/
        ├── single_note.spec.ts
        ├── two_voices.spec.ts
        └── ...
```

---

## Implementierungsschritte

1. `fixtures/`-Verzeichnisstruktur anlegen
2. Minimale ABC-Fixtures erstellen
3. Legacy-ABC-Fixtures kopieren
4. `fixtures/README.md` schreiben (Anleitung Legacy-Export)
5. Platzhalter-JSON für alle Fixtures anlegen (leere Struktur, damit Tests kompilieren)
6. `semanticMatch.ts` implementieren (`matchSong`, `matchSheet`, Float-Toleranz)
7. Vitest-Tests für Song-Stufe schreiben (gegen Platzhalter-Fixtures)
8. Vitest-Tests für Sheet-Stufe schreiben (gegen Platzhalter-Fixtures)
9. Legacy-Export durchführen und Fixture-JSON befüllen
10. Tests gegen befüllte Fixtures grün machen
