# Phase 5 – Umsetzungsstrategie

## Ziel

Frühzeitig eine sichtbare und benutzbare Zupfnoter-Workbench schaffen, ohne zunächst alle komplexen Fachthemen vollständig zu lösen.

## Grundsatz

Wir bauen zuerst eine sichtbare Workbench-Shell und hängen danach schrittweise die Fachfunktionen an.

## Stufe 1 – Workbench Shell

- [ ] Design Tokens definieren
- [ ] `Zn*`-Basiskomponenten erstellen
- [ ] Workbench-Layout aufbauen
- [ ] feste Panels als Shells anlegen
- [ ] Footer / Statusbar anlegen
- [ ] Perspektiven als Layout-Presets vorbereiten

Ergebnis: Eine sichtbare App, die noch nicht vollständig fachlich arbeitet.

## Stufe 2 – Fachkomponenten einsetzen

- [ ] CodeMirror in `AbcEditorPanel`
- [ ] SVG-Platzhalter durch Preview-Komponenten ersetzen
- [ ] Config-Editor-Shell vorbereiten
- [ ] Console als Log/Journaling-Sicht vorbereiten

## Stufe 3 – Architektur anbinden

- [ ] SelectionStore
- [ ] WorkerBridge / DocumentEvaluationJob
- [ ] CommandProcessor / CommandJournal
- [ ] Undo getrennt nach Editor, Config, Commands
- [ ] PlaybackController / PlaybackHighlight
- [ ] DiagnosticsStore

## Stufe 4 – Dokument & Storage

- [ ] Dokumentmodell `ABC + eingebettete Config`
- [ ] `StoragePath = {system}//{path}`
- [ ] `filenameFromF`
- [ ] StorageProvider-Abstraktion
- [ ] Recovery-Slots

## Stufe 5 – Legacy-Parität

- [ ] Extracts
- [ ] Player-Verhalten
- [ ] Context Actions
- [ ] Shortcuts
- [ ] Config-Editor-Funktionen
- [ ] PDF/Export-Verhalten

## MVP Definition

Ein MVP ist erreicht, wenn vorhanden:

- [ ] Design-System
- [ ] Workbench sichtbar
- [ ] Panels vorhanden
- [ ] CodeMirror sichtbar
- [ ] SVG-Vorschau sichtbar
- [ ] Console sichtbar
- [ ] Footer sichtbar
- [ ] Dokument bearbeitbar

Noch nicht erforderlich:

- [ ] vollständige Worker-Parität
- [ ] Playback vollständig
- [ ] Storage vollständig
- [ ] Recovery vollständig
- [ ] Legacy-Parität vollständig
