# Agent Prompt: Diagnostics & Error Handling

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Diagnostics & Error Handling**.

## Architekturstand


- Fehler/Warnungen werden als Diagnostics modelliert.
- Worker/Pipeline-Fehler werden zurückgemeldet.
- Config-Schema-Fehler erscheinen im Config Editor.
- Editor kann Gutter-Symbole/Wellenlinien anzeigen.
- Toast/Modal für akute oder blockierende Fehler.
- Console/Log erhält Einträge.
- Preview-Overlays sind optional.


## Aufgabe


- `Diagnostic`-Typ definieren.
- DiagnosticsStore anlegen.
- WorkerResult Diagnostics übernehmen.
- Config Validation Diagnostics aufnehmen.
- Editor Decoration/Gutter vorbereiten.
- Console/Toast-Anbindung vorbereiten.


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


## Zielmodell

```ts
interface Diagnostic {
  severity: 'info' | 'warning' | 'error'
  source: 'abc' | 'song' | 'layout' | 'svg' | 'pdf' | 'config' | 'storage' | 'editor'
  code: string
  message: string
  location?: {
    abcStart?: number
    abcEnd?: number
    znId?: string
    confKey?: string
  }
}
```


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Diagnostics & Error Handling

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
- Worker result types
- Config validation
- Editor decorations
- Console/logging
