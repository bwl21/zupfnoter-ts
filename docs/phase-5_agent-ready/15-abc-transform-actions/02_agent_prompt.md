# Agent Prompt: ABC Transform Actions

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **ABC Transform Actions**.

## Architekturstand


- AbcTransformActions liegen im Core.
- Sie arbeiten auf ABC + zentraler Selection + Kontext.
- Output ist `TextEdit[]`.
- CodeMirror führt TextEdits aus, berechnet sie aber nicht.
- Transformationen berücksichtigen Voice-Kontext, `L:`, Transposition und ABC-Kontext.
- Quelle der Selection ist egal.


## Aufgabe


- `TextEdit`-Typ prüfen/definieren.
- `AbcTransformAction`-Interface definieren.
- Erste Actions als pure functions vorbereiten.
- Mehrklang-Aktionen portieren oder als Skeleton anlegen.
- Tests mit ABC-Input/Selection/TextEdit-Output schreiben.


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
interface TextEdit {
  from: number
  to: number
  insert: string
}

interface AbcTransformContext {
  abcText: string
  selection: SelectionState
  voice?: string
  unitLength?: string
  transposition?: unknown
}

interface AbcTransformAction {
  id: string
  label: string
  canApply(context: AbcTransformContext): boolean
  apply(context: AbcTransformContext): TextEdit[]
}
```


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung ABC Transform Actions

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
- ABC parser/model
- existing editor context actions
- packages/core
- apps/web editor commands
