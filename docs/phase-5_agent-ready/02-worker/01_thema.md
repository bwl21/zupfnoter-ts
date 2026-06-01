# Worker / Dokument-Engine

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Der Worker wurde im Legacy ursprünglich aus Performancegründen extrahiert. In der Diskussion wurde geklärt, dass er trotzdem nicht nur als Renderer verstanden werden sollte.

Der Worker hält keine dauerhafte Wahrheit. Die UI besitzt den aktuellen Dokumentzustand. Trotzdem ist der Worker eine Dokument-Engine: Aus ABC und Config erzeugt er je nach Auftrag Song, Sheet, SVG, PDF, PlayerModel, Extract-Zusammenfassungen, Debug-JSON und Diagnostics.

Wichtig war die Performance-Frage: Nicht jeder Job muss alles erzeugen. Beim Bearbeiten braucht man z.B. PDF nicht sofort. PDF kann lazy beim Öffnen der PDF-Vorschau oder beim Export erzeugt werden.


## Entscheidungen


- Worker ist zustandslos.
- Worker ist eine asynchrone Dokument-Engine, nicht nur Renderer.
- Worker-Jobs enthalten konkrete Targets.
- Song und Sheet sind transiente Pipeline-Ergebnisse.
- Song/Sheet können zu Debug-/Parity-Zwecken exportiert werden.
- PDF wird lazy erzeugt.
- Worker liefert Diagnostics und Logs zurück.
- UI muss veraltete Worker-Responses über Job-/Dokumentversion ignorieren können.


## Implementierungsaufträge


- `DocumentEvaluationJob` mit `jobId`, `documentVersion`, `extractId`, `abcText`, `config`, `targets` definieren.
- `DocumentEvaluationResult` definieren.
- Target-Konzept vorbereiten: `score-svg`, `harp-svg`, `pdf`, `player-model`, `debug-song`, `debug-sheet`, `extract-summary`, `diagnostics`.
- WorkerBridge/Scheduler vorbereiten, falls noch nicht vorhanden.
- Veraltete Ergebnisse ignorierbar machen.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- `packages/core/src/`
- `apps/web/src/worker*`
- `apps/web/src/services/`
- `apps/web/src/stores/`
- bestehende Render-/Worker-Bridge-Dateien
