# Zupfnoter – Konzept für die grafische UI-Anbindung

## 1. Ziel

Die grafische UI von Zupfnoter soll so angebunden werden, dass:

- die Fachlogik im Core bleibt
- die UI nur über klar definierte Schnittstellen arbeitet
- SVG-Selektion und Editor-Selektion denselben fachlichen Bezug haben
- Vergleiche zwischen Legacy und TypeScript reproduzierbar sind
- spätere Erweiterungen nicht an impliziten DOM-Tricks hängen
- Extrakt-Auswahl, Shortcuts, abc2svg-Notensatz, Wiedergabe und Harmony-Assistent sauber eingebunden werden

Die UI darf das SVG nicht fachlich interpretieren. Sie darf technische Marker lesen, muss deren Bedeutung aber über Core-/Adapter-Schnittstellen auflösen.

---

## 2. Grundpipeline

```text
ABC-Text
  ↓
AbcParser / abc2svg
  ↓
Song-Modell
  ↓
Sheet-Modell
  ↓
Render-Modell
  ↓
SVG / PDF
```

Für die grafische UI wird zusätzlich eine explizite Mapping-Schicht benötigt:

```text
ABC-Position
  ↔ Song-Entity
  ↔ Sheet-Element
  ↔ Render-Element
  ↔ SVG-Node
```

Diese Mapping-Schicht ist kein UI-Hilfsmittel, sondern Teil des reproduzierbaren Render-Ergebnisses.

---

## 3. Harte Schichtentrennung

## 3.1 Core

Der Core verantwortet:

- ABC-Analyse
- Song-Modell
- Sheet-Modell
- Layout
- Render-Modell
- Extrakt-Ermittlung
- fachliche IDs
- SourceRanges
- RenderMap
- Vergleichsdaten für Legacy/TS
- editierbare Operationen für Assistentenfunktionen

Der Core kennt keine Vue-Komponenten, keine DOM-Knoten und keine Browser-Events.

---

## 3.2 UI-Adapter

Der UI-Adapter verantwortet:

- Aufruf der Core-Fassade
- Halten des aktuellen Dokumentzustands
- Verwaltung von Auswahl, aktivem Extrakt und aktiven Stimmen
- Weiterleitung von Commands
- Synchronisierung zwischen Editor, Harpnotes-SVG, abc2svg-SVG, Player und Harmony-Assistent

---

## 3.3 UI-Komponenten

Die UI-Komponenten sind dünn:

```text
ZupfnoterEditor
  - zeigt ABC-Text
  - meldet SourceRange

HarpnotesPreview
  - zeigt Zupfnoten-SVG
  - meldet renderElementId

ClassicalScorePreview
  - zeigt abc2svg-/Klaviernotensatz-SVG
  - meldet SourceRange oder ScoreElementId

ExtractMenu
  - zeigt verfügbare Extrakte

Toolbar / ShortcutLayer
  - löst Commands aus

PlayerControls
  - play, stop, speed, active voices

HarmonyPanel
  - zeigt Analyse und Vorschläge
```

---

## 4. Zentrale Core-Fassade

Die UI soll nicht direkt `AbcToSong`, `HarpnotesLayout`, `SvgEngine` oder abc2svg-Interna verwenden.

```ts
interface ZupfnoterCoreFacade {
  parseDocument(input: AbcInput, config: ZupfnoterConfig): ParsedDocument;

  listExtracts(document: ParsedDocument): ExtractDescriptor[];

  renderExtract(
    document: ParsedDocument,
    extractId: string,
    options: RenderOptions
  ): InteractiveRenderResult;

  renderClassicalScore(
    document: ParsedDocument,
    extractId: string,
    options: ScoreRenderOptions
  ): ScoreRenderResult;

  resolveFromSourceRange(
    document: ParsedDocument,
    range: SourceRange
  ): SelectionTarget[];

  resolveFromRenderElement(
    document: ParsedDocument,
    renderElementId: string
  ): SelectionTarget[];

  compareWithLegacy(
    input: AbcInput,
    config: ZupfnoterConfig,
    extractId?: string
  ): LegacyComparisonResult;
}
```

---

## 5. Fachliche IDs und SourceRanges

Jede fachlich relevante Entität erhält eine stabile ID.

```ts
type SourceRange = {
  start: number;
  end: number;
  line?: number;
  column?: number;
};
```

```ts
type MusicalRef = {
  songEntityId: string;
  voiceId?: string;
  measureId?: string;
  abcRange?: SourceRange;
};
```

```ts
type SheetRef = {
  sheetElementId: string;
  songEntityId?: string;
  abcRange?: SourceRange;
};
```

```ts
type RenderRef = {
  renderElementId: string;
  sheetElementId?: string;
  songEntityId?: string;
  abcRange?: SourceRange;
};
```

Die IDs entstehen vor dem SVG. Das SVG übernimmt diese IDs nur als technische Marker.

---

## 6. SelectionTarget als einheitlicher Auswahlbegriff

Editor, Harpnotes-SVG, abc2svg-SVG, Player und Harmony-Assistent arbeiten alle auf demselben Auswahlmodell.

```ts
type SelectionTarget = {
  kind:
    | "note"
    | "pause"
    | "bar"
    | "annotation"
    | "synch"
    | "goto"
    | "chord"
    | "extract"
    | "unknown";

  songEntityId?: string;
  sheetElementId?: string;
  renderElementId?: string;
  scoreElementId?: string;

  voiceId?: string;
  measureId?: string;
  abcRange?: SourceRange;

  label?: string;
  debug?: Record<string, unknown>;
};
```

Beispiel SVG → Editor:

```text
Klick auf SVG-Element
  → data-render-id="r-184"
  → SelectionService.resolveRenderId("r-184")
  → songEntityId="n-52"
  → abcRange={ start: 120, end: 123 }
  → Editor markiert ABC-Stelle
```

Beispiel Editor → SVG:

```text
Editor-Selektion
  → SourceRange
  → CoreFacade.resolveFromSourceRange(...)
  → SelectionTarget[]
  → Harpnotes-SVG hebt RenderElemente hervor
  → abc2svg-SVG hebt ScoreElemente hervor
```

---

## 7. RenderMap

Der Renderer liefert neben SVG immer eine RenderMap.

```ts
type RenderMap = {
  byRenderId: Record<string, RenderRef>;
  bySongEntityId: Record<string, RenderRef[]>;
  bySheetElementId: Record<string, RenderRef[]>;
  bySourceRange: SourceRangeIndex;
};
```

```ts
type InteractiveRenderResult = {
  svg: string;
  renderMap: RenderMap;
  selectionIndex: SelectionIndex;
  diagnostics: Diagnostic[];
};
```

Das SVG ist damit nicht die fachliche Wahrheit. Die Wahrheit ist die RenderMap.

---

## 8. SVG-Marker

Das SVG darf technische IDs tragen:

```xml
<ellipse
  data-render-id="r-184"
  data-sheet-id="s-91"
  data-song-id="n-52"
  data-abc-start="120"
  data-abc-end="123"
/>
```

Nicht erlaubt:

```ts
if (svgElement.tagName === "ellipse") {
  // ist bestimmt eine Note
}
```

Erlaubt:

```ts
const renderId = element.dataset.renderId;
const target = selectionService.resolveRenderId(renderId);
```

---

## 9. Extrakt-Auswahl

Im Legacy gibt es ein Menü, das die Extrakte darstellt. In TS sollte das kein UI-Sonderfall sein, sondern ein fachliches Core-Ergebnis.

```ts
type ExtractDescriptor = {
  id: string;
  label: string;
  description?: string;

  sourceRange?: SourceRange;
  voices?: string[];
  variant?: string;

  configPatch?: Partial<ZupfnoterConfig>;
  isDefault?: boolean;
};
```

Core-Schnittstelle:

```ts
interface ExtractService {
  listExtracts(document: ParsedDocument): ExtractDescriptor[];

  renderExtract(
    document: ParsedDocument,
    extractId: string,
    config: ZupfnoterConfig
  ): InteractiveRenderResult;
}
```

UI-Anbindung:

```text
ExtractMenu
  → zeigt ExtractDescriptor[]
  → Benutzer wählt ExtractDescriptor.id
  → DocumentController setzt activeExtractId
  → CoreFacade.renderExtract(...)
  → Preview, SelectionIndex, PlayerModel und Harmony-Kontext werden aktualisiert
```

Wichtig: Der aktive Extrakt ist Teil des Dokumentzustands.

```ts
type DocumentUiState = {
  activeExtractId: string;
  activeSelection: SelectionTarget[];
  activeVoices: string[];
  playerSpeed: number;
};
```

---

## 10. Shortcuts und Commands

Shortcuts sollen nicht direkt Vue-Methoden auslösen. Sie lösen Commands aus.

```ts
type CommandId =
  | "document.render"
  | "extract.next"
  | "extract.previous"
  | "extract.select"
  | "selection.play"
  | "selection.playFrom"
  | "selection.stop"
  | "selection.expand"
  | "editor.undo"
  | "editor.redo"
  | "config.undo"
  | "config.redo"
  | "global.undo"
  | "global.redo"
  | "harmony.analyze"
  | "harmony.applySuggestion";
```

```ts
type ShortcutBinding = {
  key: string;
  command: CommandId;
  context: "editor" | "preview" | "score" | "global";
};
```

Beispiele:

```ts
const defaultShortcuts: ShortcutBinding[] = [
  { key: "Mod+Enter", command: "document.render", context: "editor" },
  { key: "Alt+ArrowDown", command: "extract.next", context: "global" },
  { key: "Alt+ArrowUp", command: "extract.previous", context: "global" },
  { key: "Space", command: "selection.play", context: "preview" },
  { key: "Shift+Space", command: "selection.playFrom", context: "preview" },
  { key: "Escape", command: "selection.stop", context: "global" },
  { key: "Mod+Z", command: "editor.undo", context: "editor" },
  { key: "Mod+Shift+Z", command: "editor.redo", context: "editor" }
];
```

Die UI-Komponente kennt nur:

```ts
commandBus.execute("selection.play");
```

Die fachliche Bedeutung liegt im CommandHandler.

---

## 11. abc2svg als Notensatz-Provider

abc2svg stellt den klassischen Notensatz bzw. Klaviernotensatz bereit. Das ist eine eigene Render-Spur neben dem Zupfnoten-Rendering.

```text
ABC
 ├─ abc2svg → ClassicalScoreView
 └─ Zupfnoter Core → HarpnotesView
```

Gemeinsam ist nicht das SVG, sondern der fachliche Bezug über SourceRange und SongEntityId.

```ts
type ScoreRenderResult = {
  svg: string;
  scoreMap: ScoreMap;
  diagnostics: Diagnostic[];
  playerModelAbc?: unknown;
};
```

```ts
type ScoreMap = {
  byScoreElementId: Record<string, ScoreRef>;
  bySourceRange: SourceRangeIndex;
};
```

```ts
type ScoreRef = {
  scoreElementId: string;
  abcRange?: SourceRange;
  songEntityId?: string;
  voiceId?: string;
};
```

Die UI darf aus dem abc2svg-SVG keine Zupfnotenbedeutung ableiten.

---

## 12. Wiedergabe

Die Legacy-Datei `harpnote_player.rb` zeigt wichtige fachliche Anforderungen:

- Wiedergabe basiert auf abc2svg/AbcPlay
- `noteon` und `noteoff` liefern ABC-Positionen
- Auswahl basiert auf `origin.startChar` und `origin.endChar`
- es gibt aktive Stimmen
- Tempo wird aus den Musik-Metadaten berechnet
- Pausen werden selektiert, aber praktisch stumm gespielt
- Auswahl kann als Bereich oder ab aktueller Position gespielt werden
- es gibt ein Worker-Modell mit Voice-Elementen und Zeitfaktoren

Daraus folgt ein eigener Player-Service.

```ts
interface HarpnotePlayerService {
  loadSong(
    song: SongViewModel,
    activeVoices: string[],
    options: PlayerLoadOptions
  ): PlayerModel;

  setWorkerModel(model: PlayerWorkerModel): void;
  getWorkerModel(): PlayerWorkerModel;

  playSong(): void;
  playSelection(selection: SelectionTarget[]): void;
  playFromSelection(selection: SelectionTarget[]): void;
  playPitches(pitches: number[]): void;

  stop(): void;
  setSpeed(speed: number): void;

  onNoteOn(callback: (range: SourceRange) => void): void;
  onNoteOff(callback: (range: SourceRange) => void): void;
  onSongEnd(callback: () => void): void;
}
```

```ts
type PlayerElement = {
  delay: number;
  pitch: number;
  duration: number;
  velocity: number;

  voiceId: string;
  abcRange: SourceRange;
  songEntityId?: string;

  midi?: number;
};
```

```ts
type PlayerWorkerModel = {
  voiceElements: PlayerElement[];
  activeVoices: string[];
  durationTimeFactor: number;
  beatTimeFactor: number;
};
```

Ablauf:

```text
Player noteOn
  → SourceRange
  → SelectionService.resolveFromSourceRange(...)
  → Editor markiert ABC
  → Harpnotes-SVG markiert Zupfnote
  → abc2svg-SVG markiert Klaviernote
```

---

## 13. Harmony-Assistent

Der Harmony-Assistent ist kein UI-Feature, sondern ein fachlicher Service.

Er arbeitet auf:

```text
ABC + Song + aktiver Extrakt + SelectionTarget + SourceRange
```

Nicht auf:

```text
DOM + SVG-Knoten + Pixelpositionen + Editor-Interna
```

Schnittstelle:

```ts
interface HarmonyAssistantService {
  analyze(input: HarmonyAnalysisInput): HarmonyAnalysisResult;

  suggestChords(selection: SelectionTarget[]): ChordSuggestion[];

  applySuggestion(
    suggestionId: string,
    document: AbcInput
  ): AbcEditOperation[];
}
```

```ts
type HarmonyAnalysisInput = {
  abcText: string;
  activeExtractId?: string;
  selection?: SelectionTarget[];
  song: SongViewModel;
  keySignature?: string;
  meter?: string;
};
```

```ts
type ChordSuggestion = {
  id: string;
  label: string;
  confidence?: number;
  abcRange: SourceRange;
  chordSymbol: string;
  reason?: string;
};
```

Der Assistent schreibt nicht direkt in den Editor. Er liefert Edit-Operationen.

```ts
type AbcEditOperation = {
  range: SourceRange;
  replacement: string;
};
```

UI-Ablauf:

```text
HarmonyPanel
  → Benutzer klickt Vorschlag
  → CommandBus: harmony.applySuggestion
  → HarmonyAssistantService liefert AbcEditOperation[]
  → Editor/DocumentController wendet Änderung an
  → Pipeline rendert neu
```

---

## 14. DocumentController

Der DocumentController bündelt die Anwendungssicht.

```ts
interface DocumentController {
  loadAbc(text: string): void;
  updateAbc(edit: AbcEditOperation): void;

  selectExtract(extractId: string): void;
  selectSourceRange(range: SourceRange): void;
  selectRenderElement(renderElementId: string): void;

  execute(command: CommandId, payload?: unknown): void;

  getState(): DocumentUiState;
  getRenderResult(): InteractiveRenderResult;
}
```

Er kennt die UI-Komponenten nicht direkt. Er liefert Zustand und nimmt Commands entgegen.

---

## 15. Legacy-/TS-Parität

Für reproduzierbare Vergleiche muss pro Fixture nicht nur SVG exportiert werden.

Empfohlene Struktur:

```text
fixtures/<case>/
  input.abc
  config.json

  legacy.song.raw.json
  legacy.sheet.raw.json
  legacy.render-map.json
  legacy.extracts.json
  legacy.player-model.json
  legacy.score-map.json

  ts.song.raw.json
  ts.sheet.raw.json
  ts.render-map.json
  ts.extracts.json
  ts.player-model.json
  ts.score-map.json

  comparison.md
```

Vergleichsebenen:

```text
ABC range
Song entity
Sheet element
Render element
SVG marker
Extract descriptor
Player element
Score element
Harmony suggestion
```

Beispiel:

```text
ABC 120-123
Legacy: note n-52 → ellipse r-184 at x=340 y=120
TS:     note n-52 → ellipse r-184 at x=344 y=120
Gap: x-position differs by 4
```

Oder für Wiedergabe:

```text
ABC 120-123
Legacy: PlayerElement delay=1.25 duration=0.5 pitch=64 voice=1
TS:     PlayerElement delay=1.25 duration=0.5 pitch=64 voice=1
Result: parity
```

---

## 16. Verbotene Kopplungen

Nicht verwenden:

- SVG-Elementtyp als Bedeutung
- CSS-Klassen als fachliche Wahrheit
- Reihenfolge der SVG-Nodes
- Pixelposition zur Rückrechnung auf Noten
- Textinhalt im SVG zur Identifikation
- direkter Zugriff der UI auf Layout-Interna
- direkte Editor-Manipulation durch Harmony-Assistent oder Player
- Shortcut-Handler mit Fachlogik

Erlaubt:

- stabile fachliche IDs
- SourceRange
- SongEntityId
- SheetElementId
- RenderElementId
- ScoreElementId
- SelectionTarget
- RenderMap
- ScoreMap
- CommandBus
- reproduzierbare Fixture-Exports

---

## 17. Aktualisiertes Gesamtbild

```text
                         ┌──────────────┐
                         │   ABC-Text   │
                         └──────┬───────┘
                                │
                    ┌───────────▼───────────┐
                    │   ZupfnoterCoreFacade │
                    └───────────┬───────────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
│ Extracts    │          │ Song/Sheet  │          │ abc2svg     │
│ Menümodell  │          │ Layout      │          │ Score SVG   │
└──────┬──────┘          └──────┬──────┘          └──────┬──────┘
       │                        │                        │
       │                 ┌──────▼──────┐                 │
       │                 │ Harpnotes   │                 │
       │                 │ SVG         │                 │
       │                 └──────┬──────┘                 │
       │                        │                        │
       └──────────────┬─────────┴──────────┬─────────────┘
                      ▼                    ▼
              SelectionService       CommandBus
                      │                    │
       ┌──────────────┼──────────────┐     │
       ▼              ▼              ▼     ▼
    Editor      Harpnotes SVG   Score SVG  Shortcuts
       │              │              │
       └──────────────┼──────────────┘
                      ▼
              HarpnotePlayerService
                      │
                      ▼
              HarmonyAssistantService
```

---

## 18. Konkrete Umsetzungsschritte

## Schritt 1: IDs und SourceRanges stabilisieren

- SongEntityId einführen
- SheetElementId einführen
- RenderElementId einführen
- SourceRange konsequent aus ABC übernehmen
- Legacy-Raw-Export um diese Felder erweitern oder Raw-Dump vergleichbar machen

---

## Schritt 2: RenderMap exportieren

- SVG-Renderer erzeugt `InteractiveRenderResult`
- jedes relevante SVG-Element erhält `data-render-id`
- RenderMap wird unabhängig vom SVG serialisiert

---

## Schritt 3: SelectionService bauen

- `resolveFromSourceRange`
- `resolveFromRenderElement`
- `resolveFromScoreElement`
- gemeinsame `SelectionTarget[]`

---

## Schritt 4: Extrakt-Modell einführen

- Legacy-Menü fachlich nachbauen
- `ExtractDescriptor[]` aus Core liefern
- aktiver Extrakt wird Teil des UI-Zustands
- Fixture-Export `extracts.json`

---

## Schritt 5: CommandBus und Shortcuts

- Command-IDs definieren
- Shortcut-Mapping auslagern
- Editor-/Preview-/Global-Kontexte unterscheiden
- Undo-Stapel sauber adressieren

---

## Schritt 6: abc2svg anbinden

- ScoreRenderResult definieren
- ScoreMap auf SourceRange aufbauen
- Score-SVG nicht fachlich interpretieren
- Selektion über SelectionService synchronisieren

---

## Schritt 7: Wiedergabe portieren

- PlayerElement aus Song-Modell erzeugen
- `origin.startChar/endChar` durch `SourceRange` ersetzen bzw. kapseln
- aktive Stimmen, Tempo-Faktoren und Worker-Modell abbilden
- noteOn/noteOff an SelectionService koppeln

---

## Schritt 8: Harmony-Assistent anbinden

- Analyse-Service ohne UI-Abhängigkeit
- Vorschläge als fachliche Objekte
- Änderungen nur als `AbcEditOperation[]`
- Anwendung über CommandBus

---

## 19. Kernaussage

Die UI wird nicht um das SVG herum gebaut, sondern um ein fachliches Interaktionsmodell:

```text
SourceRange
  + SongEntityId
  + SheetElementId
  + RenderElementId
  + ScoreElementId
  + SelectionTarget
```

Extrakt-Menü, Shortcuts, abc2svg-Ansicht, Wiedergabe und Harmony-Assistent hängen alle an diesem Modell.

Damit bleibt die Fachlogik im Core, die UI bleibt austauschbar, und Legacy-/TS-Parität wird nicht visuell geraten, sondern reproduzierbar gemessen.
