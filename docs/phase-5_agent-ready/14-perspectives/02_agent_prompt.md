# Agent Prompt: Perspectives

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Perspectives**.

## Architekturstand


- Perspektiven sind zunächst Layout-Presets.
- Perspektiven steuern Sichtbarkeit und Anordnung.
- Perspektiven machen das Dokument nicht dirty.
- Perspektiven ändern keine Core-/Worker-Fachlogik.
- Spätere Toolset-/Workflow-Reduktion muss über Commands/Actions laufen.


## Aufgabe


- PerspectiveState modellieren.
- Perspektiven als Layout-/Visibility-Presets vorbereiten.
- Umschaltung über Command ermöglichen.
- Keine Fachlogik an Perspektiven koppeln.


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



## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Perspectives

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
- Workbench layout
- UI store
- menu/view commands
