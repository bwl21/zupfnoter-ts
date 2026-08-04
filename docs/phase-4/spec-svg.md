# Phase 4.1 – SvgEngine (Sheet → SVG)

**Status:** Implementiert  
**Branch:** `feature/phase-4-svg`  
**Commit:** `cdb5e55`

> **Abweichungen (Stand 2026-06):**
> - **Maße:** Der SVG-Viewport verwendet standardmäßig die vollständige A3-Fläche `420 × 297` mm. Die Layout-Zeichenfläche `400 × 282` mm begrenzt ausschließlich die vertikale Notenverteilung und ist keine SVG-Clipping-Grenze.
> - **`DurationStyle.hasbarover`:** Spec-Zeile 74/75 behauptet das Feld existiere auf `DurationStyle` und werde von `_layoutNote` gesetzt. Code hat **kein `hasbarover` auf `DurationStyle`**, und `_layoutNote` setzt `hasbarover: false` (das Feld auf `Ellipse` wird nie auf `true` gesetzt). Barover werden stattdessen als `rect: true`-Ellipsen via `_layoutMeasureBarover` erzeugt.

---

## Ziel

`Sheet`-Objekt (Ergebnis von `HarpnotesLayout`) in einen selbstständigen SVG-String rendern.
Kein DOM, kein Browser erforderlich — reines String-Building.

Referenz: `svg_engine.rb` (Legacy)

---

## Public API

```typescript
class SvgEngine {
  constructor(options?: SvgEngineOptions)
  draw(sheet: Sheet): string
}

interface SvgEngineOptions {
  width?: number   // SVG-Seitenbreite in mm (default: 420, A3)
  height?: number  // SVG-Seitenhöhe in mm (default: 297, A3)
  fontStyles?: Record<string, { fontSize: number; fontStyle: string }>
}
```

---

## Drawable-Typen

| Typ | Methode | Besonderheiten |
|-----|---------|----------------|
| `Ellipse` | `_drawEllipse` | filled/empty, dotted (Augmentationspunkt), hasbarover (Balken) |
| `FlowLine` | `_drawFlowLine` | solid/dashed/dotted via `stroke-dasharray` |
| `Glyph` | `_drawGlyph` | SVG-Pfad aus `glyphs.ts`, skaliert via `transform="translate scale"` |
| `Annotation` | `_drawAnnotation` | Einzel- und Mehrzeilentext (tspan), Font-Style-Lookup |
| `Path` | `_drawPath` | Sprunglinien, Tuplet-Klammern; filled/unfilled |
| `Image` | `_drawImage` | `<image href>` mit `preserveAspectRatio` |

Unsichtbare Elemente (`visible: false`) werden übersprungen.

---

## Glyph-Definitionen (`glyphs.ts`)

SVG-Pfade für Pausenzeichen, portiert aus `harpnotes.rb Glyph::GLYPHS`:

| Name | Beschreibung |
|------|-------------|
| `rest_1` | Ganztaktpause (Rechteck) |
| `rest_2` | Halbe Pause (Rechteck) |
| `rest_4` | Viertelpause (Kurve) |
| `rest_8` | Achtelpause (eine Flagge) |
| `rest_16` | Sechzehntelpause (zwei Flaggen) |
| `rest_32` | Zweiunddreißigstelpause |
| `rest_64` | Vierundsechzigstelpause |
| `fermata` | Fermate |
| `emphasis` | Akzent |
| `error` | Fehler-Fallback |

Glyphen werden zentriert auf `[cx, cy]` gerendert und auf `size[1] * 2 / h` skaliert.

---

## Typänderungen

- `Ellipse.hasbarover: boolean` — Balken über der Ellipse (halbe Noten)
- `DurationStyle.hasbarover?: boolean` — in `DURATION_TO_STYLE` für ganze/halbe Noten gesetzt
- `HarpnotesLayout._layoutNote` setzt `hasbarover` aus `DurationStyle`

---

## Offene Punkte (Phase 5)

- Interaktivität: Klick auf Note → Cursor-Sprung im ABC-Editor (via `confKey`)
- Highlighting: Editor-Selektion → SVG-Element hervorheben
- Beide Punkte erfordern DOM-Event-Handler und sind im Web-Frontend (Phase 5) zu implementieren

---

## Tests

`packages/core/src/testing/__tests__/SvgEngine.spec.ts` — 28 Tests:

- Ellipse: filled, empty, dotted, hasbarover, Farbe
- FlowLine: solid, dashed, dotted
- Glyph: Pfad, Hintergrund-Rect, dotted, unbekannter Name
- Path: filled, unfilled, leerer Pfad
- Annotation: Text, Sonderzeichen-Escaping, Mehrzeilen, Font-Size
- Image: href, URL-Escaping
- Integration: gemischtes Sheet, Snapshots
