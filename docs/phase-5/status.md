# Phase 5 – Status

## Zweck

Dieses Dokument beschreibt den aktuellen Ist-Stand von Phase 5 (`apps/web`).

Es ist keine Zielspezifikation, sondern eine knappe Arbeitsgrundlage:

- Was ist funktional bereits weit?
- Was ist nur teilweise umgesetzt?
- Was ist noch offen?
- Welche Architekturthemen sind bewusst als Restschuld markiert?

## Gesamtbild

Phase 5 ist funktional bereits weit fortgeschritten.

Insbesondere vorhanden sind:

- laufende Workbench mit Editor und Vorschauen
- Selection-System mit zentralem Store und Scope-Konzept
- Playback mit Highlighting, Scope-Auswertung und Instrumentpfaden
- Command- und Console-Grundlage
- Dropbox-Anbindung

Offen ist vor allem nicht mehr die bloße Funktion, sondern die systematische
Fertigstellung und architektonische Bereinigung.

## Status nach Teilbereichen

### 5.1 Layout-Grundstruktur

Status: `weit fortgeschritten`

Vorhanden:

- Workbench-Layout
- Footer/Statusbereich
- Panel-Struktur
- About-/Console-/PDF-/Mirror-Ansichten

### 5.2 ABC-Editor

Status: `funktional gut, architektonisch noch nicht fertig`

Vorhanden:

- CodeMirror-Integration
- Syntax-Highlighting
- Cursor-/Selection-Sync
- Playback-Highlight im Editor

Offen:

- echte bearbeitbare Mehrbereichsselektion
- sauberere Trennung zwischen fachlicher Selection und Editor-Projektion

### 5.3 Vorschau-Panel

Status: `weit fortgeschritten`

Vorhanden:

- Score-Preview
- Harp-Preview
- Zoom/Pan
- Harfen-Lupe
- Selection- und Playback-Highlighting
- Mirror-/Multi-Window-Grundlage

### 5.4 Konfigurationseditor

Status: `teilweise umgesetzt`

Vorhanden:

- Konfigurationspanel
- textbasierte Bearbeitung

Offen:

- formularbasierte Bearbeitung häufiger Einstellungen

### 5.5 Command-System

Status: `weit fortgeschritten`

Vorhanden:

- Command-Stack
- Legacy-Command-Anbindung
- Console-Integration
- Undo/Redo-Grundlage

Offen:

- Phase-5-Endform der UI-Bindung
- bewusste Abschlussentscheidung für globale Undo-/Redo-Bedienung

### 5.6 Datei-Integration

Status: `teilweise umgesetzt`

Vorhanden:

- Dropbox-Provider
- Login/Open/Save

Offen:

- lokales Dateiöffnen/-speichern als gleichwertiger Pfad
- klares Speicherpfad-/Dateinamemodell
- Auto-Save

### 5.7 Playback

Status: `weit fortgeschritten`

Vorhanden:

- expandierte Playback-Timeline
- Repeat-/Volta-Flow
- Selection-gesteuertes Playback
- Scope-gesteuertes Playback
- Stereo-Panning
- Oszillator- und Soundfont-Wiedergabe

Offen:

- weitere Konsolidierung der Architekturgrenzen zwischen Selection,
  Projektionen und Playback

### 5.8 Stores

Status: `teilweise umgesetzt`

Vorhanden:

- `selection` Store
- `playback` Store

Offen:

- geplante Endstruktur für Editor-/Config-/Render-/Player-Zustände
- Entlastung von `ZupfnoterWorkbench.vue`

## Bekannte Architekturthemen

### Selection-Projektionen

Issue: [#36](https://github.com/bwl21/zupfnoter-ts/issues/36)

Aktuell kennt der `selectionManager` noch konkrete Perspektiven und übernimmt
neben Event-/State-Logik auch Projektionsaufgaben.

Ziel ist:

- `selectionManager` für fachliche Selection begrenzen
- Editor-/Score-/Playback-Projektionen in eigene Module ziehen

### Stabile Stimmenidentität

Referenz:

- [docs/adr/stabile-stimmenidentitaet.md](../adr/stabile-stimmenidentitaet.md)

Das Thema ist deutlich stabiler als zuvor, bleibt aber weiterhin eine
Querschnittsinvariante über Core, Web und CLI.

## Nicht-Ziele innerhalb des aktuellen Phase-5-Abschlusses

- Voice Styles
- echte Mehrbereichsselektion im Editor
- größere Folgephasen wie CLI-/PDF-Endausbau

## Verwandte Dokumente

- [roadmap.md](./roadmap.md)
- [architektur_selection_perspektiven.md](./architektur_selection_perspektiven.md)
- [spec-selection.md](./spec-selection.md)
- [spec-playback-selection.md](./spec-playback-selection.md)
