# AGENTS.md – Implementierungsplan Zupfnoter-TS

Dieses Dokument beschreibt den Implementierungsplan für den TypeScript-Rewrite von
Zupfnoter (`bwl21/zupfnoter` → `bwl21/zupfnoter-ts`).

Referenz-Dokumentation: `docs/` in diesem Repository (kopiert aus `bwl21/zupfnoter`,
Branch `feature/voice-styles_and-other-concepts`, Ordner `30_sources/SRC_Zupfnoter/docs/`).

---

## Kontext: Was ist Zupfnoter?

Zupfnoter wandelt ABC-Notation in Harfennoten-Blätter (Zupfnoten) um. Die Kerntransformation
durchläuft vier Stufen:

```
ABC-Text → Musikmodell (Song) → Layout-Modell (Sheet) → Ausgabe (SVG / PDF)
```

Der bisherige Stack (Opal/Ruby → JavaScript, w2ui, jQuery) wird vollständig durch TypeScript,
Vue 3 und Vite ersetzt.

---

## Dokumentation (`docs/`)

Referenzdokumente aus dem Legacy-System, nach Phase geordnet:

```
docs/
├── phase-0/
│   ├── architektur_zupfnoter.md       # Gesamtarchitektur und Transformationskette
│   ├── architecture-vision.md         # Langfristige Architekturvision (TypeScript-Rewrite)
│   └── refactor-plan.md               # Migrations- und Refactor-Plan
├── phase-2/
│   └── konzept_json_serialisierung.md # JSON-Serialisierung der Transformationsstufen
├── phase-3/
│   └── konzept_json_serialisierung.md # (gleiche Datei, relevant für Sheet-Tests)
├── phase-5/
│   ├── architektur_command_ui.md      # Command-System und UI-Architektur
│   └── architektur_dropbox.md         # Dropbox-Integration
└── voice-styles/
    └── konzept_voice_styles.md        # Voice-Styles-Konzept (post-migration)
```

Neue Dokumente (Specs, ADRs, Konzepte) werden im jeweiligen Phase-Ordner abgelegt.
Spezifikationen liegen als `docs/<phase>/spec.md`. Die Root-`spec.md` ist ein Index.
Die aktuelle Arbeits-Spec wird von Ona direkt in `spec.md` verwaltet und nach Abschluss
in den zugehörigen Phase-Ordner verschoben.

---

## Zielarchitektur (Monorepo)

```
zupfnoter-ts/
├── packages/
│   ├── core/          # Transformationskette: ABC → Song → Sheet
│   └── types/         # Gemeinsame TypeScript-Typen und Interfaces
├── apps/
│   ├── web/           # Vue 3 Frontend (Editor + Preview)
│   └── cli/           # TypeScript-CLI (PDF/SVG-Export ohne Browser)
├── src/               # Aktuell: Vue-Scaffold (wird zu apps/web migriert)
└── AGENTS.md
```

Paketnamen: `@zupfnoter/core`, `@zupfnoter/types`, `@zupfnoter/web`, `@zupfnoter/cli`

Tooling: TypeScript, Vue 3 (Composition API), Vite, Pinia, Vitest, PNPM Workspaces

---

## Transformationskette (Referenz)

```
Stufe 1: ABC-Text       → abc_model   (via abc2svg JavaScript-Bibliothek)
Stufe 2: abc_model      → Song        (Musikmodell: Notes, Pauses, SynchPoints, Gotos)
Stufe 3: Song           → Sheet       (Drawing-Modell: Ellipses, FlowLines, Paths, Annotations)
Stufe 4: Sheet          → SVG / PDF   (Ausgabe-Engines)
```

---

## Implementierungsphasen

### Phase 0 – Monorepo-Setup

**Ziel:** Workspace-Struktur aufsetzen, bestehenden Vue-Scaffold einordnen.

- [ ] PNPM Workspaces konfigurieren (`pnpm-workspace.yaml`)
- [ ] Verzeichnisstruktur `packages/core`, `packages/types`, `apps/web`, `apps/cli` anlegen
- [ ] Bestehenden `src/`-Scaffold nach `apps/web/src/` verschieben
- [ ] Gemeinsame `tsconfig.base.json` erstellen
- [ ] CI-Grundkonfiguration (lint, type-check, test)

---

### Phase 1 – `@zupfnoter/types`

**Ziel:** Alle Datenmodelle als TypeScript-Interfaces definieren. Keine Logik, nur Typen.

#### 1.1 Musikmodell (`Harpnotes.Music`)

```typescript
// Basis
interface MusicEntity {
  beat: number          // Zeitposition (vertikal)
  time: number          // Position in der Zeitdomäne
  startPos: number      // Position im ABC-Quelltext
  endPos: number
  decorations: string[]
  visible: boolean
  variant: 0 | 1 | 2   // Wiederholungsvariante
  znId: string          // Zupfnoter-ID für Konfigurationsreferenz
}

interface Note extends MusicEntity {
  pitch: number
  duration: number
  tieStart?: boolean
  tieEnd?: boolean
}

interface Pause extends MusicEntity {
  duration: number
  pitch: number         // für Layout-Positionierung
}

interface SynchPoint extends MusicEntity {
  notes: Note[]
}

interface Goto extends MusicEntity {
  target: number
  gotoType: 'repeat' | 'dacapo' | 'segno' | 'fine'
}

interface NoteBoundAnnotation extends MusicEntity {
  text: string
  position: [number, number]
  style: string
}

type Playable = Note | Pause | SynchPoint
type NonPlayable = MeasureStart | NewPart | NoteBoundAnnotation | Chordsymbol | Goto

interface Voice {
  entities: (Playable | NonPlayable)[]
}

interface Song {
  voices: Voice[]
  beatMaps: BeatMap[]
  metaData: SongMetaData
}
```

#### 1.2 Drawing-Modell (`Harpnotes.Drawing`)

```typescript
interface Drawable {
  color: string
  lineWidth: number
  confKey?: string
  visible: boolean
}

interface Ellipse extends Drawable {
  center: [number, number]
  size: [number, number]
  fill: boolean
  origin?: Note | Pause
}

interface FlowLine extends Drawable {
  from: [number, number]
  to: [number, number]
  style: 'solid' | 'dashed' | 'dotted'
}

interface Path extends Drawable {
  path: string          // SVG-Pfad-String
  fill: boolean
}

interface Annotation extends Drawable {
  center: [number, number]
  text: string
  style: string
}

interface Glyph extends Drawable {
  center: [number, number]
  size: [number, number]
  glyphName: string
}

interface Sheet {
  children: Drawable[]
  activeVoices: number[]
}
```

#### 1.3 Konfigurationstypen

```typescript
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
  color: {
    color_default: string
    color_variant1: string
    color_variant2: string
  }
  FONT_STYLE_DEF: Record<string, FontStyle>
  instrument: string
  packer: { pack_method: 0 | 1 | 2 | 10 }
}

interface ExtractConfig {
  voices: number[]
  flowlines: number[]
  subflowlines: number[]
  jumplines: number[]
  synchlines: number[]
  layoutlines: number[]
  startpos: number
  barnumbers: BarnumberConfig
  legend: LegendConfig
  notes: AnnotationConfig[]
  layout?: Partial<LayoutConfig>
}

interface ZupfnoterConfig {
  layout: LayoutConfig
  extract: Record<string, ExtractConfig>
  printer: PrinterConfig
}
```

---

### Phase 2 – `@zupfnoter/core` – Stufe 1: ABC → Musikmodell

**Ziel:** ABC-Text in ein `Song`-Objekt transformieren.

Referenz: `abc2svg_to_harpnotes.rb` (Legacy), `docs/phase-2/konzept_json_serialisierung.md`

**abc2svg-Einbindung:** Lokale Vendor-Datei `packages/core/vendor/abc2svg-1.js`
(heruntergeladen von http://moinejf.free.fr/js/abc2svg-1.js). Nicht als npm-Paket.
Nur `AbcParser.ts` darf diese Datei importieren.

- [x] abc2svg als lokale Vendor-Datei einbinden (`packages/core/vendor/abc2svg-1.js`)
- [x] `AbcModel.ts`: Interne Typen für das abc2svg-Datenmodell (nicht Public API)
- [x] `AbcParser`-Klasse: Wrapper um abc2svg, liefert `AbcModel`
- [x] `AbcToSong`-Transformer:
  - `transform(model: AbcModel, config: ZupfnoterConfig): Song`
  - Note, Pause, SynchPoint, MeasureStart, NewPart, Goto
  - Chordsymbol, NoteBoundAnnotation (via `extra`)
  - Wiederholungen, Varianten, Bindebögen, Slurs
  - Beat-Maps berechnen
- [x] Metadaten-Extraktion (T:, C:, M:, K:, Q:)
- [x] Unit-Tests: `AbcParser.spec.ts`, `AbcToSong.spec.ts`
- [ ] Legacy-Vergleichstests aktivieren (nach Legacy-Export der Fixtures)

---

### Phase 3 – `@zupfnoter/core` – Stufe 2: Musikmodell → Layout-Modell

**Ziel:** `Song` in ein `Sheet`-Objekt transformieren.

Referenz: `harpnotes.rb` (ab Zeile 1302, `Layout::Default`), `docs/phase-3/konzept_json_serialisierung.md`

#### 3.1 Konfigurationssystem (`Confstack`)

- [x] `Confstack`-Klasse: Flat-Stack mit hierarchischer Auflösung (Port von `confstack.rb`)
  - `push(config)` / `pop()`
  - `get(path: string): unknown` — Punkt-Notation, letzter Treffer von unten gewinnt
  - `getAll(): ConfigObject` — gesamter Stack als verschachteltes Objekt
  - `getSubtree(prefix: string): ConfigObject | undefined` — Subtree ab Präfix
  - `require(path: string): unknown` — wirft bei fehlendem Wert
  - `set(path, value)` — schreibt direkt in oberste Schicht
  - `keys(): string[]` — alle Punkt-Pfade
  - Rekursives Late Binding (Funktionen in Werten, Arrays, Objekten)
  - Circular-Dependency-Erkennung
- [x] `buildConfstack(config, extractNr)` — Zupfnoter-spezifischer Stack-Aufbau
  in `buildConfstack.ts` (bewusst von `Confstack.ts` getrennt)
- [ ] `resolveVoiceStyle(voiceNr, extractConfig, globalStyles): VoiceStyle | null`

#### 3.2 Beat-Packer (vertikale Kompression)

- [ ] `BeatPacker`-Interface mit Methode `pack(beats, music): BeatCompressionMap`
- [ ] Implementierungen:
  - `StandardPacker` (pack_method 0): Berücksichtigt Notengrößen, Taktanfänge
  - `CollisionPacker` (pack_method 1): Horizontale Überlappungsprüfung
  - `LinearPacker` (pack_method 2): `beat * 8`
- [ ] Manuelle Inkremente (`minc`) pro Zeitposition

#### 3.3 Layout-Engine

- [ ] `DefaultLayout`-Klasse:
  - `layout(song: Song, printVariantNr: number, pageFormat: 'A3' | 'A4'): Sheet`
  - `_layoutPrepareOptions(printVariantNr)` — Konfig-Stack aufbauen
  - `_layoutVoices(...)` — Schleife über aktive Stimmen
  - `layoutVoice(voice, beatLayout, voiceNr, voiceStyle)` — eine Stimme layouten
  - `layoutNote(note, voiceStyle): Ellipse`
  - `layoutPause(pause, voiceStyle): Glyph`
  - `_layoutVoiceFlowlines(voice, voiceStyle): FlowLine[]`
  - `_layoutVoiceGotos(voice, voiceStyle): Path[]`
  - `_layoutVoiceTuplets(voice): Path[]`
  - `_layoutSynchLines(voices): FlowLine[]`
  - `_layoutSheetmarks(): Drawable[]`
  - `_layoutLegend(config): Annotation[]`
  - `_layoutLyrics(song): Annotation[]`
  - `_layoutAnnotations(config): Annotation[]`
  - `_layoutBarnumbers(voice): Annotation[]`

#### 3.4 Voice Styles

Wird nach Abschluss der Migration als separates Feature implementiert. Siehe Abschnitt
[Voice Styles](#voice-styles-post-migration) am Ende dieses Dokuments.

#### 3.5 Tests

- [ ] Unit-Tests für Confstack
- [ ] Unit-Tests für BeatPacker (alle Methoden)
- [ ] Snapshot-Tests für Layout-Ausgabe (Sheet-JSON)
- [ ] Referenz-Vergleich mit Legacy-Ausgabe (JSON-Serialisierung, siehe `docs/phase-3/konzept_json_serialisierung.md`)

---

### Phase 4 – `@zupfnoter/core` – Stufe 3: Ausgabe-Engines

**Ziel:** `Sheet` in SVG oder PDF rendern.

Referenz: `svg_engine.rb`, `pdf_engine.rb`

#### 4.1 SVG-Engine

- [ ] `SvgEngine`-Klasse:
  - `draw(sheet: Sheet): SVGElement`
  - `drawEllipse(e: Ellipse): SVGElement`
  - `drawFlowLine(f: FlowLine): SVGElement`
  - `drawGlyph(g: Glyph): SVGElement`
  - `drawAnnotation(a: Annotation): SVGElement`
  - `drawPath(p: Path): SVGElement`
  - `drawImage(i: Image): SVGElement`
- [ ] Interaktivität: Klick → ABC-Quelltext-Selektion (via `confKey`)
- [ ] Highlighting bei Editor-Selektion

#### 4.2 PDF-Engine

- [ ] `PdfEngine`-Klasse (basierend auf jsPDF):
  - `draw(sheet: Sheet): Blob` — A3 (eine Seite)
  - `drawInSegments(sheet: Sheet): Blob` — A4 (mehrere Seiten)
- [ ] Farb-Lookup (RGB-Arrays)
- [ ] Seitenaufteilung A4: horizontale Verschiebung um `12 * X_SPACING`

---

### Phase 5 – `apps/web` – Vue-Frontend

**Ziel:** Vollständige Web-Anwendung mit Editor und Vorschau.

Referenz: `docs/phase-5/architektur_command_ui.md`, `user-interface.js`

#### 5.1 Layout-Grundstruktur

- [ ] Haupt-Layout: Editor (links) + Vorschau (rechts), Splitter
- [ ] UI-Bibliothek auswählen: **Naive UI** (TypeScript-freundlich, Tab-Layouts, Grids)
- [ ] Toolbar mit Hauptaktionen
- [ ] Statusbar

#### 5.2 ABC-Editor

- [ ] CodeMirror 6 oder Monaco Editor einbinden
- [ ] Syntax-Highlighting für ABC-Notation
- [ ] Bidirektionale Selektion: Editor-Cursor ↔ SVG-Highlighting

#### 5.3 Vorschau-Panel

- [ ] SVG-Vorschau (reaktiv, aktualisiert bei Änderung)
- [ ] Extrakt-Auswahl (Tabs oder Dropdown)
- [ ] Zoom / Pan

#### 5.4 Konfigurationseditor

- [ ] JSON-Editor für `ZupfnoterConfig`
- [ ] Formular-basierter Editor für häufige Einstellungen
- [ ] Voice-Styles-Editor (Tabelle: Stimme → Stil)

#### 5.5 Command-System

Referenz: `docs/phase-5/architektur_command_ui.md`

- [ ] `CommandRegistry`: Registrierung benannter Kommandos
- [ ] `CommandProcessor`: Ausführung mit Undo/Redo
- [ ] Toolbar-Buttons und Menüeinträge binden Kommandos
- [ ] Konsolen-Eingabe für direkte Kommandoausführung

#### 5.6 Datei-Integration

Referenz: `docs/phase-5/architektur_dropbox.md`

- [ ] Lokale Datei öffnen/speichern (File System Access API)
- [ ] Dropbox-Integration (Dropbox Chooser API)
- [ ] Auto-Save

#### 5.7 MIDI-Player

- [ ] Web MIDI API oder Tone.js
- [ ] Play/Pause/Stop
- [ ] Synchronisation mit SVG-Highlighting

#### 5.8 Pinia Stores

- [ ] `useEditorStore`: ABC-Text, Cursor-Position, Dirty-Flag
- [ ] `useConfigStore`: `ZupfnoterConfig`, Confstack
- [ ] `useRenderStore`: Song, Sheet, SVG-Ausgabe, Render-Status
- [ ] `usePlayerStore`: MIDI-Zustand

---

### Phase 6 – `apps/cli` – TypeScript-CLI

**Ziel:** Kommandozeilen-Tool für PDF/SVG-Export ohne Browser.

- [ ] `@zupfnoter/cli` mit Commander.js oder yargs
- [ ] `zupfnoter render <input.abc> --format pdf|svg --output <file>`
- [ ] Konfiguration via JSON-Datei oder Inline-ABC-Konfiguration
- [ ] Node.js-kompatible PDF-Engine (jsPDF läuft in Node)
- [ ] SVG-Ausgabe als Datei

---

### Phase 7 – Worker-Architektur

**Ziel:** Rechenintensive Operationen aus dem UI-Thread auslagern.

Referenz: `docs/phase-0/architektur_zupfnoter.md`, Abschnitt 7

- [ ] `ZupfnoterWorker` (Web Worker):
  - Nachrichten: `render_harpnotepreview`, `render_pdf`, `parse_abc`
  - Typed Message Protocol
- [ ] `WorkerBridge` im Haupt-Thread: Promise-basierte API
- [ ] Fallback: Synchrone Ausführung im UI-Thread (für CLI und Tests)

---

## Datenfluss (Gesamtübersicht)

```
[ABC-Editor]
     │ abc_text
     ▼
[AbcParser (abc2svg)]
     │ AbcModel
     ▼
[AbcToSong]  ◄── ZupfnoterConfig (Confstack)
     │ Song
     ▼
[DefaultLayout]  ◄── ZupfnoterConfig (Confstack + VoiceStyles)
     │ Sheet
     ├──► [SvgEngine] → SVGElement → [Vorschau-Panel]
     └──► [PdfEngine] → Blob → Download
```

---

## Konfigurationssystem (Confstack)

Das Konfigurationssystem ist ein Stack mit hierarchischer Auflösung (höchste Priorität oben):

```
┌─────────────────────────────┐  ← Top
│ extract.<nr>.layout-Override│
├─────────────────────────────┤
│ extract.<nr>.printer-Override│
├─────────────────────────────┤
│ Song-Konfiguration (JSON)   │
├─────────────────────────────┤
│ Defaults (init_conf)        │
└─────────────────────────────┘  ← Bottom
```

- `push(config)` / `pop()` für temporäre Overrides während des Layouts
- `get('layout.ELLIPSE_SIZE')` — Punkt-Notation, sucht von oben
- Late Binding: Werte können Funktionen sein, die bei Zugriff ausgewertet werden
- Extract-Vererbung: `extract.N` erbt von `extract.0`, überschreibt nur Abweichungen

---

## Voice Styles (post-migration)

Wird nach Abschluss der Migration (Phasen 0–7) als separates Feature implementiert.
Referenz: `docs/voice-styles/konzept_voice_styles.md`.

Kurzbeschreibung: Benannte visuelle Stile (Linienbreite, Notengröße, Farbe) werden
top-level definiert und pro Extrakt den einzelnen Stimmen zugeordnet. In einer zweiten
Ausbaustufe ist eine abschnittsweise Überschreibung innerhalb einer Stimme vorgesehen.

Die Implementierung erweitert `@zupfnoter/types` (neue Interfaces `VoiceStyle`,
`VoiceStyleOverride`), `@zupfnoter/core` (Auflösungslogik in `DefaultLayout`) und
`apps/web` (Konfigurationseditor für Voice Styles).

---

## JSON-Serialisierung der Transformationsstufen

Referenz: `docs/phase-2/konzept_json_serialisierung.md`

Für Tests und Debugging können alle Zwischenstufen als JSON serialisiert werden:

| Stufe | Objekt | Methode |
|-------|--------|---------|
| 1 | `AbcModel` | Direkt aus abc2svg (bereits JSON-kompatibel) |
| 2 | `Song` | `song.toJSON()` |
| 3 | `Sheet` | `sheet.toJSON()` |

Die JSON-Schemas dienen als Regressionstests: Legacy-Ausgabe (Ruby) vs. neue Ausgabe (TS)
müssen für identische Eingaben identische Schemas erzeugen.

---

## Umsetzungsreihenfolge (empfohlen)

| Phase | Inhalt | Abhängigkeit |
|-------|--------|-------------|
| 0 | Monorepo-Setup | – |
| 1 | `@zupfnoter/types` | Phase 0 |
| 2 | ABC → Song (Stufe 1) | Phase 1 |
| 3 | Song → Sheet (Stufe 2) | Phase 2 |
| 4 | SVG/PDF-Engines (Stufe 3) | Phase 3 |
| 5 | Vue-Frontend | Phase 4 |
| 6 | CLI | Phase 3, 4 |
| 7 | Worker-Architektur | Phase 5 |

---

## Technologie-Entscheidungen

| Bereich | Technologie | Begründung |
|---------|-------------|-----------|
| Sprache | TypeScript 5.x | Typsicherheit, IDE-Support |
| Framework | Vue 3 (Composition API) | Reaktivität, TypeScript-Integration |
| Build | Vite | Schnell, ESM-nativ |
| Workspace | PNPM Workspaces | Monorepo-Management |
| UI-Bibliothek | Naive UI | TypeScript-freundlich, Tab/Grid/Form-Komponenten |
| Editor | CodeMirror 6 | Erweiterbar, ABC-Syntax-Highlighting möglich |
| PDF | jsPDF | Läuft in Browser und Node.js |
| Tests | Vitest | Vite-integriert, schnell |
| State | Pinia | Vue 3 Standard |

---

## Konventionen für dieses Projekt

- Alle Klassen und Interfaces in `@zupfnoter/types` definieren, bevor sie in `core` implementiert werden
- Transformationen sind pure Funktionen (kein globaler State) — Konfiguration wird explizit übergeben
- `Confstack` ist der einzige Ort für Konfigurationsauflösung; kein direkter Zugriff auf globale Config-Objekte
- Tests für jede Transformationsstufe mit JSON-Snapshots aus dem Legacy-System
- Voice Styles sind rückwärtskompatibel: fehlt `voice_styles`, gelten globale `layout.*`-Werte
- Worker-Nachrichten sind typisiert (kein `any`)
