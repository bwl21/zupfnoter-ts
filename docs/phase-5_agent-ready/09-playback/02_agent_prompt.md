# Agent Prompt: Playback Architecture

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Playback Architecture**.

## Architekturstand


- Player arbeitet mit PlayerModel, Selection, activeExtract und Tempo.
- Keine Selection: gesamte ABC-/Score-Wiedergabe im Klaviersound.
- Eine Note: ab selektierter Note im aktuellen Extract im Harfensound.
- Bereich: selektierter Bereich im aktuellen Extract im Harfensound.
- PlaybackHighlight ist getrennt von Selection.
- Speed kann während Playback geändert werden.
- Dokumentänderung stoppt Playback.
- Editor-PlaybackHighlight ist optional und darf Editor-Selection nicht verändern.


## Aufgabe


- `PlaybackState` modellieren.
- `PlaybackHighlight` modellieren.
- PlaybackModeResolver aus Selection + activeExtract.
- Player Events für aktuelle Note(n) verarbeiten.
- Highlight in Score/Harp Preview anbinden.
- Stop bei Dokumentänderung.
- Speed-Control im Footer anbinden.


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
interface PlaybackState {
  status: 'stopped' | 'playing' | 'paused'
  mode?: 'all-score' | 'from-note-harp' | 'range-harp'
  speedFactor: number
  baseTempoFromQ?: number
  activeExtract: number
  documentVersion: number
}

interface PlaybackHighlight {
  activeZnIds: string[]
  activeStartChar?: number
  activeTime?: string
}
```


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Playback Architecture

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
- Player-/Audio-Code
- Footer speed controls
- SelectionStore
- Preview highlight components
