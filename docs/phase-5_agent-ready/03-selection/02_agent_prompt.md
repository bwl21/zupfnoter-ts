# Agent Prompt: Selection Architecture

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Selection Architecture**.

## Architekturstand


- Selection ist transienter Fachzustand.
- Selection kann aus Editor, Klaviernoten oder Harfennoten entstehen.
- Alle Sichten spiegeln dieselbe zentrale Selection.
- Selection kann MusicEntity, Notenbereich, ABC-Element, ABC-Bereich oder Config-Objekt betreffen.
- `znId`, `startpos/endpos`, `startChar` und `confKey` sind getrennte Konzepte.
- PlaybackHighlight ist ein separater Zustand und überschreibt Selection nicht.


## Aufgabe


- `SelectionState` definieren.
- `SelectionStore` anlegen oder vorhandenen Store erweitern.
- Methoden vorbereiten: `setSelection`, `clearSelection`, `selectZnId`, `selectTextRange`, `selectConfigKey`.
- Adapter für Editor, ScorePreview, HarpPreview vorbereiten.
- SelectionChanged-Mechanismus definieren.
- Keine lokale Sonder-Selection in einzelnen Panels als Wahrheit verwenden.


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


## Erwartetes Datenmodell

```ts
interface SelectionState {
  kind: 'none' | 'music-range' | 'abc-range' | 'abc-element' | 'config-object'
  znIds?: string[]
  textRange?: { startpos: number; endpos: number }
  startChar?: number
  confKey?: string
  abcElementKind?: string
  source: 'abc-editor' | 'score-preview' | 'harp-preview' | 'player' | 'command'
}
```


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Selection Architecture

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
- `apps/web/src/stores/`
- Editor-Komponenten
- SVG-/Preview-Komponenten
- Typen in `packages/types/`
