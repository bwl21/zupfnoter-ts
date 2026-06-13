# Agent Prompt: Shortcuts

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Shortcuts**.

## Architekturstand


- Phase 5 verwendet CodeMirror als Editor-Basis.
- Globale Workbench-Shortcuts werden im Capture-Handler abgefangen.
- Behandelte globale Shortcuts müssen `preventDefault()` und `stopPropagation()` ausführen.
- Ein Shortcut darf niemals zusätzlich Text in den Editor schreiben.
- Editor-spezifische Shortcuts gehören in CodeMirror-Keymaps.
- Shortcuts lösen Commands aus, keine eigene Fachlogik.


## Aufgabe


- `ShortcutService` vorbereiten.
- Globale Shortcuts registrierbar machen.
- Konflikt mit Editor-Fokus explizit behandeln.
- `Cmd+P`-Fall als Test/Regression absichern.
- Shortcuts auf Command IDs mappen.


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


## Kritischer Testfall

Wenn der Benutzer `Cmd+P` im Editor-Fokus auslöst, darf kein `p` in den ABC-Text geschrieben werden.


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Shortcuts

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
- Editor-Komponenten
- App-root keydown listener
- CommandProcessor
- CodeMirror-Integration
