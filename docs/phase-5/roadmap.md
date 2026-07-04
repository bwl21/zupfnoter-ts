# Phase 5 – Roadmap

## Zweck

Dieses Dokument ordnet die verbleibende Arbeit in Phase 5 nach Priorität.

Es ist bewusst kurz und arbeitsorientiert.

## Jetzt

### 1. Selection-Projektionen entkoppeln

Issue: [#36](https://github.com/bwl21/zupfnoter-ts/issues/36)

Ziel:

- `selectionManager` auf fachliche Selection und Eventlogik begrenzen
- Editor-/Score-/Playback-Projektionen in eigene Module auslagern

Warum jetzt:

- reduziert erneute Scope-/Projektionsfehler
- schafft die Basis für weitere Editierfunktionen

### 2. Store-Schnitt der Workbench schärfen

Ziel:

- Zuständigkeiten von Workbench-Komponente und Stores klären
- Render-/Editor-/Config-/Playback-Zustände bewusster schneiden

Warum jetzt:

- verhindert weiteres Anwachsen von `ZupfnoterWorkbench.vue`

### 3. Datei-Integration fachlich fertigziehen

Ziel:

- lokales Öffnen/Speichern
- Dropbox als Provider sauber einordnen
- Speicherpfad-/Dateiname-Modell klären
- Auto-Save entscheiden und umsetzen

Warum jetzt:

- für tägliche Nutzung wichtiger als weitere Detailfunktionen

### 4. Undo-/Redo-Ebenen abschließen

Ziel:

- Editor-Undo
- Config-Undo
- globales Command-Undo

Warum jetzt:

- reduziert UI-Unklarheit
- schafft eine belastbare Bedienlogik

## Danach in Phase 5

### 5. Konfigurationseditor ausbauen

Ziel:

- häufige Einstellungen formularbasiert bearbeitbar machen

### 6. Command-UI weiter vereinheitlichen

Ziel:

- Buttons, Menüs, Console und Shortcuts sauber zusammenführen

### 7. Worker-Architektur weiter abschließen

Ziel:

- rechenintensive Schritte konsistenter aus dem UI-Thread ziehen

## Nach Phase 5

### 8. Echte Mehrbereichsselektion im Editor

Voraussetzung:

- nicht nur Anzeige, sondern echte bearbeitbare Multi-Range-Selektion

### 9. Voice Styles

Bewusst außerhalb des aktuellen Migrationskerns.

### 10. Weitere Folgephasen

- CLI-Endausbau
- PDF-Endausbau
- weitere Post-Migrations-Themen

## Arbeitsregel

Für den jeweils aktuellen Block gilt:

- genaue Arbeitsgrenze in `spec.md`
- nach Abschluss Rückführung in die Phase-5-Dokumente
