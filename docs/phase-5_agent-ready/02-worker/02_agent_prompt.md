# Agent Prompt: Worker / Dokument-Engine

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Worker / Dokument-Engine**.

## Architekturstand


- Worker ist zustandslos.
- Worker ist eine asynchrone Dokument-Engine, nicht nur Renderer.
- Worker-Jobs enthalten konkrete Targets.
- Song und Sheet sind transiente Pipeline-Ergebnisse.
- Song/Sheet können zu Debug-/Parity-Zwecken exportiert werden.
- PDF wird lazy erzeugt.
- Worker liefert Diagnostics und Logs zurück.
- UI muss veraltete Worker-Responses über Job-/Dokumentversion ignorieren können.


## Aufgabe


- `DocumentEvaluationJob` mit `jobId`, `documentVersion`, `extractId`, `abcText`, `config`, `targets` definieren.
- `DocumentEvaluationResult` definieren.
- Target-Konzept vorbereiten: `score-svg`, `harp-svg`, `pdf`, `player-model`, `debug-song`, `debug-sheet`, `extract-summary`, `diagnostics`.
- WorkerBridge/Scheduler vorbereiten, falls noch nicht vorhanden.
- Veraltete Ergebnisse ignorierbar machen.


## Arbeitsweise

1. Analysiere zuerst die vorhandene Projektstruktur.
2. Verwende bestehende Konventionen, statt neue Parallelstrukturen zu erfinden.
3. Implementiere in kleinen Schritten.
4. Vermeide große Refactorings außerhalb des Arbeitspakets.
5. Ergänze Tests oder dokumentiere, warum noch keine Tests sinnvoll möglich sind.
6. Aktualisiere am Ende `01_thema.md` mit dem Bearbeitungsstatus.

## Akzeptanzkriterien

- Die Umsetzung verletzt keine Architekturentscheidung dieses Arbeitspakets.
- Es entstehen keine versteckten UI-Sonderlogiken, die später Core/Worker/Stores ersetzen.
- Fachlogik bleibt dort, wo sie laut Architektur hingehört.
- Typecheck/Lint/Test laufen oder Abweichungen sind dokumentiert.

## Nicht-Ziele

- Keine vollständige Legacy-Parität in einem Schritt.
- Keine großen Umbauten außerhalb der direkt notwendigen Dateien.
- Keine Einführung einer schwergewichtigen Architektur, wenn ein kleiner Adapter reicht.


## Erwartete Zieltypen

```ts
type EvaluationTarget =
  | 'score-svg'
  | 'harp-svg'
  | 'pdf'
  | 'player-model'
  | 'debug-song'
  | 'debug-sheet'
  | 'extract-summary'
  | 'diagnostics'

interface DocumentEvaluationJob {
  jobId: string
  documentVersion: number
  extractId: string
  abcText: string
  serializedConfig: unknown
  targets: EvaluationTarget[]
}

interface DocumentEvaluationResult {
  jobId: string
  documentVersion: number
  extractId: string
  status: 'success' | 'error'
  outputs: Record<string, unknown>
  diagnostics: Diagnostic[]
  logs?: unknown[]
}
```


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Worker / Dokument-Engine

## Angelegte/geänderte Dateien

...

## Entscheidungen

...

## Tests / Checks

...

## Nicht umgesetzt

...

## Nächste Schritte

...
```

## Mögliche Dateien / Suchorte

Mögliche Suchorte:
- `packages/core/src/`
- `apps/web/src/worker*`
- `apps/web/src/services/`
- `apps/web/src/stores/`
- bestehende Render-/Worker-Bridge-Dateien
