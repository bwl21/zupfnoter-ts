# Agent Prompt: UI-Anbindung / Workbench

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **UI-Anbindung / Workbench**.

## Architekturstand


- Die Phase-5-UI ist eine Single-Document-Workbench.
- Vue-Komponenten sind Views und Interaktionspunkte, nicht Träger der Fachlogik.
- Zentrale fachliche/transiente Zustände liegen in Stores oder Core-/Worker-Resultaten.
- Panels sind feste Vue-Komponenten.
- Perspektiven steuern Layout und Sichtbarkeit.
- Menüs, Toolbar, Shortcuts, ContextActions und Console lösen Commands aus.
- UI-Komponenten sollen über definierte Adapter mit Editor/SVG/Worker/Commands sprechen.


## Aufgabe


- Workbench-Shell strukturieren.
- Zentrale Bereiche anlegen: linker Arbeitsbereich, Score Preview, Harp/PDF Preview, Console, Footer.
- Panel-Komponenten als Shells anlegen.
- UI-State von Dokument-/Fachzustand trennen.
- Keine fachliche Berechnung in Panel-Komponenten einbauen.


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
# Umsetzung UI-Anbindung / Workbench

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
- `apps/web/src/`
- `apps/web/src/components/`
- `apps/web/src/stores/`
- `apps/web/src/App.vue`
- `apps/web/src/main.ts`
