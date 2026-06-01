# Agent Prompt: File Model / Dokumentmodell

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **File Model / Dokumentmodell**.

## Architekturstand


- Dokument = ABC + eingebettete Config + eingebettete Ressourcen.
- Dokument kennt keinen Speicherort.
- Dateiname wird aus `F:` abgeleitet.
- Dirty bedeutet Änderung am ABC-File: ABC, Config oder eingebettete Ressourcen.
- ActiveExtract, Perspektive, Panelgrößen, Zoom, Playback-Speed, Selection und Console-Zustand machen nicht dirty.
- Geladener Dateiname ist nicht automatisch der spätere Speicherdateiname.


## Aufgabe


- Dokumentmodell explizit definieren.
- `filenameFromF` ermitteln.
- Dirty-Tracking auf ABC-Datei-Inhalt beschränken.
- Keine Pfadinformation ins Dokumentmodell aufnehmen.
- Save-Logik auf `activeStoragePath + filenameFromF` vorbereiten.


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
# Umsetzung File Model / Dokumentmodell

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
- ABC Parser / Metadata
- DocumentStore
- Storage-/Save-Code
- Recovery
