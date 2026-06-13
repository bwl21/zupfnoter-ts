# Agent Prompt: Commands / CommandProcessor / Console

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Commands / CommandProcessor / Console**.

## Architekturstand


- Command = vom CommandProcessor bereitgestellter Befehl.
- Commands können Dokument, Workbench, Storage, Playback oder Rendering betreffen.
- Menüs, Toolbars, Shortcuts, ContextActions und Console lösen Commands aus.
- Undo-Fähigkeit ist optional und hängt an einer inversen Operation.
- Command Journal protokolliert `do: command(payload)`.
- Console ist primär Journal/Log, sekundär Command Shell.


## Aufgabe


- Command-Typ und CommandRegistry/Processor definieren.
- CommandSource modellieren: menu, toolbar, shortcut, context, console, system.
- CommandJournal mit Zeitpunkt, Quelle, Payload, Ergebnis, Fehler.
- UndoableCommand nur bei inverser Operation.
- ConsolePanel als Journal-Anzeige vorbereiten.


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
interface CommandRequest {
  id: string
  payload?: unknown
  source: 'menu' | 'toolbar' | 'shortcut' | 'context' | 'console' | 'system'
}

interface CommandResult {
  ok: boolean
  message?: string
  error?: unknown
}

interface CommandJournalEntry {
  timestamp: string
  command: CommandRequest
  result?: CommandResult
}
```


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Commands / CommandProcessor / Console

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
- Legacy command processor analysis
- Existing menu/shortcut code
- Console components
- Stores / services
