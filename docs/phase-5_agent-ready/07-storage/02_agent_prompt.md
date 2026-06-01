# Agent Prompt: Storage

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Storage**.

## Architekturstand


- StoragePath ist ein Zielverzeichnis, keine Datei.
- Format: `{system}//{path}`.
- Save target = `activeStoragePath + filenameFromF`.
- Dropbox ist nur ein Provider.
- Eigener Zupfnoter FilePicker statt Dropbox Chooser als primäre UI.
- Zupfnoter ist kein Dateimanager: kein Delete/Rename/Move als Kernziel.


## Aufgabe


- `StoragePath` parse/format implementieren.
- `StorageProvider`-Interface vorbereiten.
- Dropbox-spezifische Logik kapseln.
- `activeStoragePath` als Workbench-/Session-Zustand modellieren.
- `filenameFromF` mit SaveTarget verbinden.
- FilePicker als providerneutrale UI vorbereiten.


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


## Zieltypen

```ts
interface StoragePath {
  system: string
  path: string
}

interface StorageProvider {
  system: string
  read(path: StoragePath, filename: string): Promise<string>
  write(path: StoragePath, filename: string, content: string): Promise<void>
}
```


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Storage

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
- Dropbox-Anbindung
- Storage-/File-Services
- Footer / Speicherpfad UI
- DocumentStore
