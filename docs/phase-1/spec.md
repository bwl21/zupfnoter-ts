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

