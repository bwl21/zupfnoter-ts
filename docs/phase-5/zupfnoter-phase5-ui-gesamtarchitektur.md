# Zupfnoter – Phase‑5 UI-, Controller- und Anbindungsarchitektur

## Status des Dokuments

Dieses Dokument fasst die bisherigen Architekturüberlegungen zur grafischen UI‑Anbindung von Zupfnoter zusammen.

Es dient als fortschreibbare Arbeitsgrundlage für:

- UI-Architektur
- Controller-Architektur
- Undo-/Redo-Konzept
- Core-UI-Schnittstellen
- Render-/Selektionsmodell
- Vergleichs- und Debugging-Werkzeuge
- Integration von abc2svg, Wiedergabe und Assistenten

---

# 1. Zielbild

Die grafische UI von Zupfnoter soll so angebunden werden, dass:

- die Fachlogik im Core bleibt
- die UI nur über klar definierte Schnittstellen arbeitet
- SVG-Selektion und Editor-Selektion denselben fachlichen Bezug haben
- Vergleiche zwischen Legacy und TypeScript reproduzierbar sind
- spätere Erweiterungen nicht an impliziten DOM-Tricks hängen

---

# 2. Gesamtarchitektur

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

Zusätzliche Mapping-Schicht:

```text
ABC-Position
  ↔ Song-Entity
  ↔ Sheet-Element
  ↔ Render-Element
  ↔ SVG-Node
```

---

# 3. Anwendungen

## Web-Anwendung

- Editor für ABC-Text
- SVG-Vorschau
- Konfigurationseditor
- Interaktive Bedienung

## CLI-Anwendung

- SVG/PDF-Export
- Fixture-Erzeugung
- Batch-Verarbeitung
- CI/CD

## Worker-Anwendung

- Hintergrundrendering
- Queue-Verarbeitung
- Serverbetrieb

---

# 4. Schichtentrennung

## Core

Verantwortlich für:

- Parser
- Song-Modell
- Sheet-Modell
- Layout
- Rendering
- RenderMaps
- fachliche IDs

Der Core kennt keine UI-Technologien.

## Application Layer

Verantwortlich für:

- Commands
- Undo/Redo
- Zustandsverwaltung
- Synchronisierung

## UI

Verantwortlich für:

- Vue-Komponenten
- Editor
- SVG-Ansichten
- Toolbars
- Panels

---

# 5. Controller-Architektur

Bestehende Controller:

- controller.rb
- controller-cli.rb
- controller-nw.rb
- controller_command_definitions.rb

Langfristige Zielstruktur:

```text
Core
Application Layer
UI Layer
```

---

# 6. Core-Fassade

```ts
interface ZupfnoterCoreFacade {
  parseDocument(...)
  renderExtract(...)
  renderClassicalScore(...)
  resolveFromSourceRange(...)
  resolveFromRenderElement(...)
  compareWithLegacy(...)
}
```

---

# 7. Selektionsmodell

Gemeinsamer Selektionsbegriff für:

- Editor
- Harpnotes-SVG
- abc2svg-SVG
- Player
- Harmony-Assistent

Die UI synchronisiert nur Zustände.
Die fachliche Auflösung bleibt im Core.

---

# 8. Extrakt-Auswahl

Extrakte werden als fachliche Objekte behandelt.

```ts
interface ExtractDescriptor {
  id: string;
  title: string;
  voices: string[];
}
```

---

# 9. abc2svg-Integration

abc2svg liefert den klassischen Notensatz.

Die Ansicht soll:

- SourceRanges liefern
- fachliche IDs referenzieren
- Selektion synchronisieren

---

# 10. Wiedergabe / Player

Relevantes Legacy-Artefakt:

- harpnote_player.rb

Playback soll:

- Selektion synchronisieren
- Stimmen berücksichtigen
- Positionen zurückmelden

---

# 11. Harmony-Assistent

Der Harmony-Assistent benötigt:

- Zugriff auf Song-/Sheet-Modell
- gemeinsame Selektion
- Undo-/Redo-Integration
- reproduzierbare Commands

---

# 12. Undo-/Redo-Konzept

Aktuell existieren drei Undo-Stacks:

1. Editor-Undo
2. Konfigurationseditor-Undo
3. Globales Undo

Ziel:

- reproduzierbare Aktionen
- persistente History
- Replaybarkeit
- Worker-Kompatibilität

---

# 13. Shortcut-Architektur

```text
Shortcut
  → Command Dispatcher
  → Application Layer
  → Core Operation
  → State Update
```

---

# 14. Vergleich Legacy ↔ TypeScript

Die UI soll unterstützen:

- parallele Renderings
- strukturierte Vergleichsdaten
- selektionsbasierte Diff-Analyse
- fixturebasierte Reproduzierbarkeit

---

# 15. Zielarchitektur

```text
                ┌─────────────────────┐
                │        UI           │
                └─────────┬───────────┘
                          │
                ┌─────────▼───────────┐
                │  Application Layer  │
                └─────────┬───────────┘
                          │
                ┌─────────▼───────────┐
                │        Core         │
                └─────────┬───────────┘
                          │
                ┌─────────▼───────────┐
                │    SVG / PDF        │
                └─────────────────────┘
```

---

# 16. Zweck dieses Dokuments

Dieses Dokument dient als gemeinsame Architekturgrundlage für:

- weitere UI-Konzeption
- Codex-Prompts
- Refactoring-Strategien
- Phase‑5-Implementierung
- Fixture- und Vergleichsstrategien
