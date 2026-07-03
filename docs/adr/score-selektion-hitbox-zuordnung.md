# Architektur-Issue: Eindeutige Score-Hitbox-Zuordnung im `SheetObjectIndex`

## Status

Offen.

Dieses Dokument beschreibt ein priorisiertes Architektur- und
Implementierungsproblem im Selection-System. Es ist noch **keine**
umgesetzte ADR-Entscheidung, sondern ein gezielt formulierter Arbeitsauftrag.

## Problem

Die Selection in den Klaviernoten (`score-preview`) funktioniert aktuell nur
teilweise konsistent:

- ein Klick in Stimme 1 verhält sich korrekt
- ein Klick in späteren Stimmen verhält sich nicht korrekt
- die Editor-Selektion zeigt dabei oft den erwarteten Quelltextbereich
- die anschließende Scope-Erweiterung (`Stimme` / `Auszug` / `Alle`) kann aber
  auf falscher oder unvollständiger fachlicher Identität aufsetzen

Das Problem ist nicht die grundsätzliche Scope-Logik, sondern die
fachliche Auflösung eines Score-Klicks.

## Konkreter Befund

Beim Stück `0013_jesus-wir-sehen-auf-dich.abc` in `Extract 2` zeigte die
Diagnose:

- sichtbare Score-Hitboxes liefern `textRange`s wie `716:717`
- zu diesen Ranges existiert im `SheetObjectIndex` nur ein `score-object`
- zu denselben Ranges existiert **keine direkte** `music-entity`
- die Selection kann daher den Editorbereich markieren, aber nicht sicher auf
  `voiceId`, `musicTime` und `znId` zurückführen

Gleichzeitig funktioniert derselbe fachliche Pfad, sobald ein echter
`music-entity`-Range aus dem `Song` verwendet wird.

Daraus folgt:

- die bestehende Scope-Logik ist im Kern verwendbar
- die Zuordnung `score-hitbox -> fachliche Musik-Entity` ist unvollständig

## Ziel

Jedes selektierbare `score-object` muss im `SheetObjectIndex` auf eine
fachliche musikalische Identität zurückführbar sein.

Mindestens auflösbar sein müssen:

- `voiceId`
- `musicTime`
- optional `znId`

Die Perspektiven sollen dabei schlank bleiben:

- `score-preview` liefert nur seine konkrete Hitbox-Information
- die fachliche Auflösung erfolgt zentral im `SheetObjectIndex`
- `selectionStore` und `SelectionManager` arbeiten danach nur noch auf
  eindeutiger fachlicher Basis

## Nicht-Ziel

Dieses Issue ist **kein** Auftrag für:

- einen neuen globalen Music-Object-Store
- eine grundlegende Ablösung des `SheetObjectIndex`
- eine breite Umstrukturierung der Perspektiven

Die bestehende Architektur mit zentralem `SheetObjectIndex` bleibt erhalten.
Es fehlt nur die vollständige Score-Zuordnung.

## Vermutete Ursache

Die von `abc2svg` erzeugten Score-Hitboxes referenzieren aktuell kleine
Quelltextbereiche, die nicht immer direkt mit `sourceOffsets` einer
`music-entity` übereinstimmen.

Dadurch scheitert die aktuelle Rückführung:

`score-hitbox -> textRange -> music-entity`

zumindest für bestimmte Stimmen und/oder bestimmte Arten von Score-Hitboxes.

## Zielbild

Beim Aufbau des `SheetObjectIndex` wird jedes `score-object` mit einer
eindeutigen fachlichen Zuordnung versehen oder darüber auflösbar gemacht.

Mögliche Umsetzungsrichtungen:

1. `score-object` direkt mit fachlicher Referenz anreichern
2. Score-Hitbox-ID oder Ordinal stabil in den Index übernehmen und darüber
   zentral auflösen
3. eine zentrale Matching-Regel beim Index-Aufbau einführen, die
   `score-object` und `music-entity` einmalig zusammenführt

Wichtig:

- **nicht** beim Klick die `Song.voices` durchsuchen
- **nicht** perspektivenspezifische Heuristiken in `ScorePreviewPanel.vue`
  einbauen
- **nicht** spätere Scope-Logik mit Sonderfällen aufblasen

## Akzeptanzkriterien

Das Problem gilt erst dann als ausreichend gelöst, wenn:

1. ein Klick in Stimme 1, 2, 3 und 4 jeweils auf die richtige fachliche
   Ursprungstimme aufgelöst wird
2. `Stimme` nur die Ursprungstimme markiert
3. `Auszug` genau die Stimmen des aktuellen Auszugs markiert
4. `Alle` alle Stimmen markiert
5. dieselbe fachliche Zuordnung zentral über den `SheetObjectIndex` erfolgt
6. keine ad-hoc-Suche durch `Song.voices` im Klickpfad nötig ist

## Nächste Umsetzungsschritte

1. Diagnose-Fall aus `0013_jesus-wir-sehen-auf-dich.abc`, `Extract 2` als
   Regressionstest festhalten
2. prüfen, welche Information aus der Score-Hitbox bereits stabil verfügbar ist
3. `buildSheetObjectIndex(...)` so erweitern, dass `score-object` fachlich
   einer Stimme bzw. `music-entity` zugeordnet werden kann
4. Origin-Auflösung der Score-Selektion auf diese zentrale Zuordnung umstellen
5. Browser-Validierung für Klicks in mehreren Stimmen nachziehen

## Betroffene Bereiche

- `apps/web/src/workbench/selectionIndex.ts`
- `apps/web/src/workbench/selectionManager.ts`
- `apps/web/src/workbench/panels/ScorePreviewPanel.vue`
- `apps/web/src/workbench/rendering/renderPipeline.ts`
- indirekt `packages/core/src/AbcParser.ts` bzw. Score-Hitbox-Metadaten
