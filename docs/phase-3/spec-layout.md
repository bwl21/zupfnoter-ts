# Spec: Phase 3.3 – HarpnotesLayout (Song → Sheet)

## Problem

Stufe 2 der Transformationskette (`Song → Sheet`) ist noch nicht implementiert.
`HarpnotesLayout` ist der Port von `Harpnotes::Layout::Default` aus `harpnotes.rb`
(ab Zeile 1302). Die Klasse nimmt ein `Song`-Objekt und eine `ZupfnoterConfig`
entgegen und erzeugt ein `Sheet`-Objekt mit allen zeichenbaren Elementen.

Alle Abhängigkeiten sind fertig: `Confstack`, `buildConfstack`, `computeBeatCompression`,
`@zupfnoter/types` (Song, Sheet, alle Drawable-Typen, alle Config-Typen).

---

## Referenz

- `docs/phase-0/architektur_zupfnoter.md` — Ablauf `Layout::Default#layout`
- `docs/phase-3/konzept_json_serialisierung.md` — Sheet-JSON-Schema, Drawable-Typen
- `docs/voice-styles/konzept_voice_styles.md` — Layout-Methoden und Konfig-Zugriffe
- Legacy-Klasse: `Harpnotes::Layout::Default` in `harpnotes.rb` ab Zeile 1302

---

## Architektur

```
packages/core/src/
└── HarpnotesLayout.ts     # Neue Datei — Port von Harpnotes::Layout::Default
```

### Öffentliche API

```typescript
export class HarpnotesLayout {
  constructor(config: ZupfnoterConfig) {}

  /**
   * Hauptmethode: Song → Sheet.
   * Entspricht Layout::Default#layout in harpnotes.rb.
   */
  layout(song: Song, extractNr: number | string, pageFormat: 'A3' | 'A4'): Sheet
}
```

### Interne Methoden (alle private)

| Methode | Entspricht Legacy | Ausgabe |
|---------|-------------------|---------|
| `_layoutPrepareOptions(extractNr)` | `_layout_prepare_options` | Confstack aufbauen |
| `_layoutImages(conf)` | `layout_images` | `Image[]` |
| `_layoutVoices(song, conf)` | `_layout_voices` | `DrawableElement[]` pro Stimme |
| `_layoutVoice(voice, beatMap, voiceNr, conf)` | `layout_voice` | `DrawableElement[]` |
| `_layoutNote(note, conf)` | `layout_note` | `Ellipse` |
| `_layoutPause(pause, conf)` | `layout_pause` | `Glyph` |
| `_layoutVoiceFlowlines(voice, conf)` | `_layout_voice_flowlines` | `FlowLine[]` |
| `_layoutVoiceSubflowlines(voice, conf)` | `_layout_voice_subflowlines` | `FlowLine[]` |
| `_layoutVoiceGotos(voice, conf)` | `_layout_voice_gotos` | `Path[]` |
| `_layoutVoiceTuplets(voice, conf)` | `_layout_voice_tuplets` | `Path[]` |
| `_layoutSynchLines(voices, beatMaps, conf)` | `_layout_synclines` | `FlowLine[]` |
| `_layoutSheetmarks(conf)` | `_layout_sheetmarks` | `DrawableElement[]` |
| `_layoutInstrument(conf)` | `_layout_instrument` | `DrawableElement[]` |
| `_layoutCutmarks(pageFormat, conf)` | `_layout_cutmarks` | `Path[]` |
| `_layoutLegend(song, conf)` | `_layout_legend` | `Annotation[]` |
| `_layoutLyrics(song, conf)` | `_layout_lyrics` | `Annotation[]` |
| `_layoutAnnotations(conf)` | `_layout_sheet_annotations` | `Annotation[]` |
| `_layoutBarnumbers(voice, conf)` | `layout_barnumbers_countnotes` | `Annotation[]` |

---

## Anforderungen

### Koordinatensystem

- **X-Achse:** Horizontale Position = `(pitch - PITCH_OFFSET) * X_SPACING + X_OFFSET`
  - Pitch 60 (mittleres C) → Saite 0 → `X_OFFSET`
  - Jede Halbton-Stufe = `X_SPACING` mm
- **Y-Achse:** Vertikale Position = `beatCompressionMap[beat] * Y_SCALE + startpos`
  - Beat 0 → `startpos` (aus `extract.N.startpos`)
  - Wächst nach unten

### `_layoutNote(note, conf): Ellipse`

- `center`: `[pitchToX(note.pitch), beatToY(note.beat)]`
- `size`: `ELLIPSE_SIZE * DURATION_TO_STYLE[durationKey].sizeFactor`
- `fill`: `DURATION_TO_STYLE[durationKey].fill`
- `dotted`: `DURATION_TO_STYLE[durationKey].dotted`
- `color`: Variante 0 → `color_default`, 1 → `color_variant1`, 2 → `color_variant2`
- `lineWidth`: `LINE_THICK`
- `visible`: `note.visible`
- `confKey`: `note.confKey`
- Wenn `note.measureStart`: `hasbarover: true` auf der Ellipse

### `_layoutPause(pause, conf): Glyph`

- `center`: `[pitchToX(pause.pitch), beatToY(pause.beat)]`
- `size`: `REST_SIZE * DURATION_TO_STYLE[durationKey].sizeFactor`
- `glyphName`: aus `REST_TO_GLYPH[durationKey]` (z.B. `'rest_4'` für Viertelpause)
- `dotted`: `DURATION_TO_STYLE[durationKey].dotted`
- `color`: wie Note
- `visible`: `pause.visible && !pause.invisible`

### `_layoutVoiceFlowlines(voice, conf): FlowLine[]`

- Verbindet aufeinanderfolgende Playables mit einer Linie
- Unterbrechung bei `firstInPart === true` (neuer Abschnitt)
- `style`: `'solid'` für Hauptflowlines, `'dashed'` für Subflowlines
- `lineWidth`: `LINE_THIN`
- `from`: Center der vorherigen Note, `to`: Center der aktuellen Note

### `_layoutVoiceGotos(voice, conf): Path[]`

- Für jedes `Goto`-Entity in der Stimme eine Jumpline zeichnen
- Jumpline = Bezier-Kurve von `from`-Note zu `to`-Note
- Horizontaler Abstand aus `goto.policy.distance` (oder Default)
- Pfeilspitze am Ziel (`fill: 'filled'`)
- `lineWidth`: `LINE_THICK`

### `_layoutVoiceTuplets(voice, conf): Path[]`

- Für jede Tuplet-Gruppe (tupletStart → tupletEnd) eine Klammer zeichnen
- Klammer = horizontale Linie über den Noten mit senkrechten Enden
- Text: Tuplet-Zahl (z.B. "3" für Triole)

### `_layoutSynchLines(voices, beatMaps, conf): FlowLine[]`

- Für jedes Paar in `extract.N.synchlines` Synchlinien zeichnen
- Verbindet Noten gleichen Beats zwischen zwei Stimmen
- `style`: `'dotted'`
- `lineWidth`: `LINE_THIN`

### `_layoutSheetmarks(conf): DrawableElement[]`

- Horizontale Linien für Saitenmarkierungen (C-Saiten, F-Saiten)
- Position aus Instrument-Konfiguration

### `_layoutLegend(song, conf): Annotation[]`

- Titel, Komponist, Tonart, Taktart, Tempo aus `song.metaData`
- Position aus `extract.N.legend.pos` (oder Default)
- Stil aus `extract.N.legend.style`

### `_layoutLyrics(song, conf): Annotation[]`

- Liedtext-Silben aus `note.lyrics` als Annotationen unter den Noten
- Position: unter der Note (`center[1] + offset`)

### `_layoutAnnotations(conf): Annotation[]`

- Blatt-Annotationen aus `extract.N.notes`
- Jeder Eintrag: `{ pos, text, style }`

### `_layoutBarnumbers(voice, conf): Annotation[]`

- Taktnummern aus `note.measureCount` für Noten mit `measureStart === true`
- Position aus `extract.N.barnumbers.pos` (oder Auto-Position)
- Nur für Stimmen in `extract.N.barnumbers.voices`

### `_layoutImages(conf): Image[]`

- Liest `extract.N.images` aus dem Confstack
- Jeder Eintrag: `{ show, imagename, pos, height }`
- Nur wenn `show === true`: `Image`-Drawable mit `url` (Data-URI), `position`, `height`
- `confKey`: `extract.N.images.<nr>.pos` für Drag&Drop

### `_layoutInstrument(conf): DrawableElement[]`

- Liest `extract.N.instrument_shape` aus dem Confstack (JSON-String mit SVG-Pfad)
- Wenn vorhanden: als `Path`-Drawable ins Sheet
- Wenn nicht vorhanden: leeres Array `[]`
- Instrument-spezifische Logik (Zipino, Saitenspiel, Okon etc.) als Stub — gibt `[]` zurück

### `_layoutCutmarks(pageFormat: 'A3' | 'A4', conf): Path[]`

- Zeichnet Schnittmarkierungen für A4-Druck an den Seitenrändern
- Nur bei `pageFormat === 'A4'`: horizontale Linien an den A4-Seitengrenzen
- Position: `12 * X_SPACING` pro Seite (aus `printer.a4Pages`)
- Bei `pageFormat === 'A3'`: leeres Array `[]`

### `restposition` in `AbcToSong._transformRest()` (Phase 2 Nacharbeit)

Wird **zusammen mit Phase 3.3** implementiert, da korrekte Pause-Positionen
für sinnvolle Sheet-Ausgabe nötig sind.

- Konfiguration: `conf.get('restposition.default')` → `'center'` | `'next'` | `'previous'`
- `'center'`: Durchschnitt von `prevPlayable.pitch` und `nextPlayable.pitch`
  (beide sind jetzt auf `Playable` verfügbar)
- `'next'`: `nextPlayable.pitch` (oder `prevPlayable.pitch` wenn kein next)
- `'previous'`: `prevPlayable.pitch` (oder `nextPlayable.pitch` wenn kein prev)
- Default (wenn nicht konfiguriert): `'center'`
- Fallback wenn weder prev noch next: `pitch: 60`

---

## Hilfsfunktionen (modul-intern)

```typescript
// Pitch → X-Position in mm
function pitchToX(pitch: number, conf: Confstack): number

// Beat → Y-Position in mm (via BeatCompressionMap)
function beatToY(beat: number, beatMap: BeatCompressionMap, conf: Confstack): number

// Duration (abc2svg-Einheiten) → DurationKey
function durationToKey(duration: number): DurationKey

// Variante → Farbe
function variantToColor(variant: 0 | 1 | 2, conf: Confstack): string
```

---

## Render-Reihenfolge in `Sheet.children`

Entspricht der Legacy-Reihenfolge in `Layout::Default#layout`:

1. Images (eingebettete Bilder)
2. Synchlines
3. Noten, Pausen, Flowlines, Gotos, Tuplets, Barnumbers (alle Stimmen, pro Stimme)
4. Legend
5. Annotations (Blatt-Annotationen)
6. Lyrics
7. Sheetmarks (Saitenmarkierungen)
8. Cutmarks
9. Instrument-Shape

---

## Tests

### Datei: `packages/core/src/testing/__tests__/HarpnotesLayout.spec.ts`

Unit-Tests mit Vitest-Snapshots:

| Test | Eingabe | Prüfung |
|------|---------|---------|
| `single_note` | 1 Note C4, 4/4 | Ellipse an korrekter Position |
| `two_voices` | 2 Stimmen | Ellipsen + Flowlines für beide Stimmen |
| `pause` | Pause | Glyph statt Ellipse |
| `repeat` | Wiederholung | Goto-Pfad vorhanden |
| `synchlines` | 2 Stimmen, gleicher Beat | Synchline zwischen Stimmen |
| `barnumbers` | Mehrere Takte | Taktnummer-Annotationen |
| `legend` | Song mit Metadaten | Legend-Annotationen |

### `legacy_comparison.spec.ts` (Sheet) — Stub entfernen

Den `transformAbcToSheet`-Stub durch die echte Pipeline ersetzen:
```typescript
function transformAbcToSheet(abcText: string): SheetFixture {
  const parser = new AbcParser()
  const model = parser.parse(abcText)
  const song = new AbcToSong().transform(model, defaultTestConfig)
  const sheet = new HarpnotesLayout(defaultTestConfig).layout(song, 0, 'A4')
  return sheetToFixture(sheet)
}
```

Sheet-Fixtures sind noch Platzhalter (`children: []`) → Tests laufen als `it.skip`
bis Fixtures aus Legacy-System exportiert werden.

---

## Akzeptanzkriterien

1. `HarpnotesLayout.layout(song, 0, 'A4')` gibt ein `Sheet` zurück
2. Für `single_note.abc`: Sheet enthält mindestens 1 `Ellipse` an korrekter X/Y-Position
3. Für `two_voices.abc`: Sheet enthält Ellipsen für beide Stimmen + Flowlines
4. Für `pause.abc`: Sheet enthält `Glyph` statt `Ellipse`, Pause-X-Position ≠ 60 (restposition)
5. Für `repeat.abc`: Sheet enthält `Path` für die Jumpline
6. Alle Unit-Tests grün
7. `pnpm --filter @zupfnoter/core run type-check` ohne Fehler
8. `HarpnotesLayout` in `packages/core/src/index.ts` exportiert
9. AGENTS.md Phase 3.3 als erledigt markiert

---

## Nicht in Scope

- Voice Styles (post-migration, Phase 3.4)
- `resolveVoiceStyle()` (post-migration)
- Sheet-Legacy-Fixtures befüllen (separater Schritt nach Legacy-Export)

---

## Branch

`feature/phase-3-layout` (neu von `main`)

## Implementierungsschritte

1. Branch `feature/phase-3-layout` von `main` erstellen
2. `AbcToSong._transformRest()`: `restposition` implementieren (`center`/`next`/`previous`)
3. `packages/core/src/HarpnotesLayout.ts` anlegen
4. Hilfsfunktionen: `pitchToX`, `beatToY`, `durationToKey`, `variantToColor`
5. `_layoutPrepareOptions` — Confstack aufbauen via `buildConfstack`
6. `_layoutNote` und `_layoutPause`
7. `_layoutVoiceFlowlines` und `_layoutVoiceSubflowlines`
8. `_layoutVoiceGotos` (Jumplines als Bezier-Pfade)
9. `_layoutVoiceTuplets`
10. `_layoutVoice` — Orchestrierung der Stimmen-Methoden
11. `_layoutVoices` — Schleife über aktive Stimmen + BeatCompression
12. `_layoutSynchLines`
13. `_layoutSheetmarks`
14. `_layoutLegend`, `_layoutLyrics`, `_layoutAnnotations`, `_layoutBarnumbers`
15. `_layoutImages` — eingebettete Bilder aus Config
16. `_layoutInstrument` — Stub (gibt `[]` zurück, liest `instrument_shape`)
17. `_layoutCutmarks` — Schnittmarkierungen für A4
18. `layout()` — Hauptmethode, alle Teile in korrekter Reihenfolge
19. `HarpnotesLayout.spec.ts` — Unit-Tests mit Snapshots
20. `legacy_comparison.spec.ts` (Sheet) — Stub durch echte Pipeline ersetzen
21. `index.ts` — `HarpnotesLayout` exportieren
22. AGENTS.md Phase 3.3 als erledigt markieren
