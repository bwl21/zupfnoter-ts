# ADR: Umsetzung von Ruby `Vector` in TypeScript

## Problem

Im Legacy-Ruby-Code (`harpnotes.rb`) gibt es eine `Vector`-Klasse für 2D-Vektoroperationen.
Sie wird für Koordinatenberechnungen im Layout verwendet — insbesondere für Jumplines,
Tuplet-Klammern und Sheetmarks.

Diese Spec dokumentiert, wie `Vector` im TypeScript-Rewrite umgesetzt wurde.

---

## Was ist `Vector` im Legacy-Code?

Die Ruby-`Vector`-Klasse (aus der Standardbibliothek) bietet:

```ruby
v = Vector[x, y]
v + Vector[dx, dy]   # Addition
v - Vector[dx, dy]   # Subtraktion
v * scalar           # Skalierung
v.normalize          # Einheitsvektor
v.magnitude          # Länge (Betrag)
v.inner_product(w)   # Skalarprodukt
```

Im Legacy-Layout wird `Vector` verwendet für:
- Berechnung von Kontrollpunkten für Bezier-Kurven (Slurs/Ties, Tuplet-Bögen)
- Offset-Berechnungen für Annotationspositionen
- Normalisierung von Richtungsvektoren

---

## Umsetzung in TypeScript

### Entscheidung: Kein dediziertes `Vector`-Modul

Im TypeScript-Rewrite wurde **keine eigene `Vector`-Klasse** eingeführt.
Stattdessen werden Koordinaten durchgehend als `[number, number]`-Tupel dargestellt
und Berechnungen inline als einfache Arithmetik ausgeführt.

**Begründung:** Die Vektoroperationen im Layout sind einfach genug (Addition, Offset),
dass eine eigene Klasse mehr Overhead als Nutzen bringt.

---

### Koordinatendarstellung

Alle 2D-Positionen im Drawing-Modell sind `[number, number]`-Tupel (x, y in mm):

```typescript
// @zupfnoter/types – drawing.ts
interface Ellipse {
  center: [number, number]   // [x, y]
  size:   [number, number]   // [rx, ry]
}
interface FlowLine {
  from: [number, number]
  to:   [number, number]
}
interface Path {
  path: [number, number][]   // Folge von Punkten
}
interface Annotation {
  center: [number, number]
}
```

---

### Koordinaten-Hilfsfunktionen (Ersatz für `Vector`)

In `HarpnotesLayout.ts` gibt es zwei module-level Pure Functions, die die
Haupttransformationen aus dem Legacy-Code ersetzen:

```typescript
// Pitch (MIDI) → X-Position in mm
// Legacy: (-start_scale + pitch) * x_spacing + x_offset
function pitchToX(pitch: number, layout: LayoutConfig): number {
  return (pitch + layout.PITCH_OFFSET) * layout.X_SPACING + layout.X_OFFSET
}

// Beat → Y-Position in mm via BeatCompressionMap
function beatToY(beat: number, beatMap: BeatCompressionMap, layout: LayoutConfig, startpos: number): number {
  const compressed = beatMap[beat] ?? beat
  return compressed * layout.Y_SCALE + startpos
}
```

---

### Inline-Arithmetik statt Vektoroperationen

Überall wo Legacy-Code `Vector`-Operationen nutzt, steht im TS-Code direkte Arithmetik:

| Legacy (Ruby) | TypeScript |
|---|---|
| `pos = Vector[x, y] + Vector[dx, dy]` | `[x + dx, y + dy]` |
| `center = (a + b) / 2` | `[(x1 + x2) / 2, (y1 + y2) / 2]` |
| `offset = pos + Vector[0, ellipse_h + 2]` | `[x, y + layout.ELLIPSE_SIZE[1] + 2]` |
| `label_pos = Vector[x - ellipse_w - 1, y]` | `[x - layout.ELLIPSE_SIZE[0] - 1, y]` |

Konkrete Beispiele aus `HarpnotesLayout.ts`:

```typescript
// Lyrics-Position: unterhalb der Note
center: [x, y + layout.ELLIPSE_SIZE[1] + 2]

// Taktnummer: links der Note
center: [x - layout.ELLIPSE_SIZE[0] - 1, y]

// Tuplet-Beschriftung: Mitte zwischen Start und Ende
center: [(x1 + x2) / 2, bracketY - 1]
```

---

### Path-Typ: Punkte statt SVG-Kommandos

Im Legacy-Code enthält `Path` SVG-Kommandos als Arrays (`["M", x, y]`, `["c", ...]`).
Im TypeScript-Rewrite ist `Path.path` ein einfaches Array von Punkten `[number, number][]`.

`SvgEngine` konvertiert diese Punkte in SVG-Pfad-Strings:

```typescript
// SvgEngine.ts
function pathFromPoints(points: [number, number][]): string {
  const [first, ...rest] = points
  return `M${first[0]},${first[1]} ` + rest.map(([x, y]) => `L${x},${y}`).join(' ')
}
```

**Konsequenz:** Bezier-Kurven (die im Legacy-Code für Slurs/Ties und Tuplet-Bögen
verwendet werden) sind im aktuellen TS-Code **nicht implementiert** — Slurs und
gebogene Flowline-Segmente fehlen noch (Phase 3.3 ist ein vereinfachter Port).
Jumplines sind im Legacy-Code L-förmige Geradenzüge (kein Bezier).

---

### Jumplines (Gotos)

Legacy: L-förmiger Geradenzug (kein Bezier). Pfeilspitze am Ziel.

TypeScript: identisch — L-förmiger Pfad aus 4 Punkten + gefülltes Dreieck als Pfeilspitze:

```typescript
// HarpnotesLayout._layoutVoiceGotos
path: [
  [fromX, fromY],          // Startpunkt (Note)
  [vertX, fromY],          // horizontales Segment
  [vertX, toY],            // vertikales Segment
  [toX,   toY],            // horizontales Segment zum Ziel
]

// Pfeilspitze (gefülltes Dreieck)
path: [
  [toX,             toY],
  [toX - arrowSize, toY - arrowSize],
  [toX + arrowSize, toY - arrowSize],
]
```

---

## Zusammenfassung

| Aspekt | Legacy (Ruby) | TypeScript |
|--------|--------------|------------|
| Koordinatentyp | `Vector[x, y]` | `[number, number]` |
| Vektoraddition | `v1 + v2` | `[x1+x2, y1+y2]` (inline) |
| Normalisierung | `v.normalize` | nicht benötigt |
| Bezier-Kurven | Ja — für Slurs/Ties und Tuplet-Bögen | Nicht implementiert (fehlt noch) |
| Jumplines | L-förmige Geradenzüge (kein Bezier) | L-förmige Geradenzüge (identisch) |
| Path-Format | SVG-Kommandos `["M",x,y]`, `["c",...]` | Punkte `[x,y][]` (nur Geraden) |
| Dediziertes Modul | `Vector` (stdlib) | keines |
