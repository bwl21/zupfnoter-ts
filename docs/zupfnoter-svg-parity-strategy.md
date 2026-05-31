# Zupfnoter TS – SVG Legacy Parity Strategy

## Hintergrund

Die aktuelle TypeScript-Portierung von Zupfnoter erzeugt SVG-Dateien,
die visuell teilweise von der Legacy-Implementierung abweichen.

Ziel ist:

- möglichst hohe Legacy-Parität
- gleiche visuelle Darstellung
- gleiche semantische SVG-Struktur
- langfristig gleiche Interaktionsmöglichkeiten
- gute Basis für GUI/Player
- gute automatisierte Gap-Analyse

Wichtig:

PDF wird NICHT aus SVG erzeugt.

Die Architektur soll weiterhin sein:

```text
ABC → Song → Sheet
                 ├─ SvgEngine → SVG Preview / GUI
                 └─ PdfEngine → PDF Export
```

SVG ist also NICHT das kanonische Zwischenformat.

---

# Erkenntnisse aus der SVG-Analyse

## Schwarze Rechtecke hinter Noten

Die schwarzen Hintergründe stammen sehr wahrscheinlich NICHT
vom eigentlichen Notenlayout.

Im Legacy-SVG existieren viele interaktive Hitbox-Rechtecke:

```svg
<rect class="abcref znref _222_"
      onclick="..."
      onmouseover="..."
      ... />
```

Viele dieser `rect`-Elemente besitzen:

- kein `fill`
- kein `stroke`

In SVG bedeutet fehlendes `fill`:

```text
fill = black
```

Wenn CSS oder bestimmte Browserregeln fehlen,
werden diese Hitboxen sichtbar.

---

# Unterschiede zwischen Legacy und TS SVG

## Legacy SVG

Merkmale:

- viele `<g>`-Gruppen
- viele `<rect>`-Hitboxen
- IDs und Klassen
- `abcref`, `znref`, `_123_`
- Inline-Events
- starke semantische Gruppierung
- implizite Z-Order

## Neue TS SVG

Merkmale:

- flacher SVG-Aufbau
- direkte primitive Elemente
- kaum `<g>`
- keine IDs/Klassen
- keine Interaktionslayer
- reine Geometrie-Ausgabe

---

# Architekturentscheidung

## Empfehlung: Hybrid-Ansatz

Nicht empfohlen:

- kompletter Rewrite von `SvgEngine.ts`
- vollständiger Opal-/DOM-1:1-Port

Empfohlen:

- Rendering-Semantik möglichst legacy-nah
- DOM-/Eventlogik entkoppeln

---

# Zielarchitektur

## SvgEngine

SvgEngine erzeugt:

- sichtbare Geometrie
- semantische `<g>`-Gruppen
- stabile IDs
- Klassen
- data-Attribute
- definierte Z-Order
- explizite fill/stroke Defaults

NICHT:

- onclick
- hover-Handler
- drag/drop
- GUI-Logik
- DOM-Manipulation

## Interaction Layer

Spätere GUI-/Player-Schicht:

```text
SVG DOM
   ↓
SvgInteractionLayer
```

Diese Schicht übernimmt:

- Click
- Hover
- Drag & Drop
- Highlighting
- Playback-Synchronisation
- Editor-Mapping

---

# Rolle der <g>-Gruppen

Die vielen `<g>`-Elemente im Legacy-SVG sind vermutlich wichtig.

Sie bündeln:

- sichtbare Elemente
- Hitboxen
- Referenzen
- Highlight-Ziele
- spätere DOM-Operationen

---

# PDF-Strategie

PDF soll NICHT aus SVG erzeugt werden.

Stattdessen:

```text
Sheet → PdfEngine
```

SVG bleibt primär:

```text
Preview-/GUI-Format
```

---

# Strategie für die Gap-Analyse

Nicht byteidentische SVGs anstreben,
sondern semantische SVG-Parität.

## Mehrstufige Vergleichsstrategie

### 1. Pixel-Diff

```text
SVG → PNG → Bildvergleich
```

Mit:

- weißem Hintergrund
- gleicher Größe
- gleichen Fonts
- Antialiasing-Toleranz

### 2. SVG-Struktur-Diff

Vergleichen:

- Anzahl rect/path/ellipse/line/text/g
- Styles
- fill/stroke
- Reihenfolge
- viewBox
- Klassen
- IDs

### 3. Semantischer SVG-Diff

Elemente klassifizieren:

- notehead
- rest
- flowline
- glyph
- annotation
- text
- hitbox
- decoration
- synchline
- barline

### 4. Interaktions-Diff

Vergleichen:

- abcref
- znref
- IDs
- Klassen
- data-Attribute
- Hitbox-Bounding-Boxes

---

# Fixture-Strategie

## Erster Hauptcase

```text
3015 Reference Sheet
```

Ziel:

- grundlegende SVG-Parität
- semantische Gruppen
- stabile Struktur
- explizite Styles

## Zweiter Spezialcase

```text
output.extract-0.svg
```

Ziel:

- schwarze Hitboxen
- Interaktionslayer
- fill/stroke Defaults
- Layering-Probleme

---

# Empfehlungen für SvgEngine.ts

Nicht komplett löschen.

Stattdessen:

- bestehende Geometrie nutzen
- intern refactoren
- semantische Layer ergänzen
- Legacy-Struktur schrittweise annähern

---

# Prompt für einen neuen Codex-Thread

```text
Ziel:
Herstellung von Legacy-Parität für die SVG-Ausgabe von Zupfnoter TS.

Wichtige Architekturentscheidung:
SVG ist nicht nur sichtbares Rendering, sondern enthält semantische Gruppen und spätere Interaktionsanker.
Interaktionslogik selbst soll jedoch NICHT mehr direkt im SVG-Renderer implementiert werden.

Wichtige Ziele:
- visuelle Legacy-Parität
- semantische SVG-Parität
- stabile Gruppenstruktur
- IDs/Klassen/data-Attribute
- explizite fill/stroke Defaults
- spätere GUI-/Player-Kompatibilität
- gute automatisierte Gap-Analyse

Nicht Ziel:
- byteidentische SVGs
- vollständiger Opal-/DOM-1:1-Port
- SVG→PDF Pipeline

Architektur:
ABC → Song → Sheet
                 ├─ SvgEngine → SVG Preview / GUI
                 └─ PdfEngine → PDF Export

PDF wird NICHT aus SVG erzeugt.

Erster Hauptcase:
3015 Reference Sheet

Zweiter Spezialcase:
output.extract-0.svg
(black hitbox regression)

Aufgaben:

1. Analysiere den aktuellen SvgEngine.ts Aufbau.
2. Vergleiche Legacy- und TS-SVG strukturell.
3. Identifiziere:
   - fehlende <g>-Gruppen
   - fehlende IDs/Klassen
   - fehlende data-Attribute
   - implizite fill/stroke Defaults
   - Z-Order Unterschiede
4. Führe semantische SVG-Gruppen ein.
5. Führe stabile Klassen/Referenzanker ein.
6. Stelle sicher, dass unsichtbare Hitboxen explizit transparent sind.
7. Baue eine Vergleichsinfrastruktur:
   - Pixel-Diff
   - SVG-Struktur-Diff
   - semantischer SVG-Diff
   - Interaktions-Diff
8. Erzeuge Gap-Reports pro Fixture.
9. Arbeite zuerst nur an 3015 Reference Sheet.
10. Danach output.extract-0.svg.
11. Erst danach alle weiteren Fixtures evaluieren.
```
