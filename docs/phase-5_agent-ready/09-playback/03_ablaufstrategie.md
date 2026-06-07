# Playback-Ablaufstrategie

## Ziel

Dieses Dokument beschreibt die fachliche Ablaufstrategie fuer Playback in Phase 5.

Die Kernidee ist:

- Die Selection bezieht sich immer auf den **notierten Score**.
- Der musikalische Ablauf wird anschliessend als **expandierter Ablauf** mit Wiederholungen, Volten und Spruengen berechnet.
- Playback filtert oder startet danach auf diesem expandierten Ablauf.

Damit wird vermieden, dass Selection und Ablauf-Logik in zwei getrennten Playern auseinanderlaufen.

## Grundregel

Es gibt drei Playback-Faelle:

- keine Selection
- Punktselektion
- Bereichsselektion

Die Bedeutung ist:

- `none`
  - das ganze Stueck wird im expandierten Ablauf gespielt
- `point`
  - Playback startet an der ersten passenden Ablaufstelle dieser notierten Note
- `range`
  - Playback spielt alle Ablauf-Events, deren Ursprung zwischen Start und Ende der Selection liegt

## Datenmodell

Die Selection fuer Playback soll fachlich so gelesen werden:

```ts
type PlaybackSelection =
  | { kind: 'none' }
  | { kind: 'point'; znId: string }
  | { kind: 'range'; startZnId: string; endZnId: string }
```

Wichtig:

- `range` ist nur gueltig, wenn Anfang und Ende gesetzt sind
- `startZnId` muss im notierten Material vor `endZnId` liegen
- Mehrfach- oder disjunkte Selektionen gehoeren nicht in den ersten Schritt

## Algorithmus

Die Ablaufstrategie besteht aus drei Schritten:

1. Notiertes Material lesen
2. Vollstaendigen musikalischen Ablauf expandieren
3. Selection auf diesen Ablauf projizieren

In pseudocode:

```ts
const flow = expandPlaybackFlow(scoreOrSong)

switch (selection.kind) {
  case 'none':
    return flow
  case 'point':
    return flow.slice(firstOccurrenceOf(selection.znId))
  case 'range':
    return flow.filter((event) =>
      isBetween(event.originZnId, selection.startZnId, selection.endZnId),
    )
}
```

Dabei gilt:

- `originZnId` bleibt die Referenz auf die notierte Ursprungsnote
- derselbe `originZnId` kann im expandierten Ablauf mehrfach vorkommen
- genau dadurch werden Wiederholungen und Volten korrekt abgebildet

## Erweiterung: Durchlaufmarker im expandierten Ablauf

Der expandierte Ablauf sollte zusaetzlich den Ablaufkontext pro Event tragen.

Empfohlenes Zielmodell:

```ts
interface PlaybackEvent {
  originZnId: string
  time: number
  flowIndex: number
  passIndex: number
  repeatCycle?: number
  voltaNumber?: number
}
```

Bedeutung:

- `originZnId`
  - Referenz auf die Ursprungsnote im notierten Score
- `flowIndex`
  - laufender Index im expandierten Ablauf
- `passIndex`
  - in welchem Durchlauf das Event liegt
- `repeatCycle`
  - optionale Kennzeichnung der uebergeordneten Wiederholungsschleife
- `voltaNumber`
  - optionale Kennzeichnung der Volte im expandierten Ablauf

Warum das sinnvoll ist:

- dieselbe notierte Note kann mehrfach im Ablauf vorkommen
- die Wiedergabe kann spaeter gezielt auf den ersten oder zweiten Durchlauf eingeschraenkt werden
- Wiederholungs- und Voltenverhalten wird debugbar
- Selection bleibt trotzdem auf dem notierten Score definiert

Moegliche spaetere Policies:

- `all-occurrences`
  - alle Treffer im expandierten Ablauf spielen
- `first-occurrence-only`
  - nur den ersten Treffer spielen
- `current-pass-only`
  - nur Treffer eines bestimmten Durchlaufs spielen

Der wichtige Architekturpunkt ist:

- der Durchlaufmarker gehoert in den expandierten Ablauf
- nicht in die Selection selbst

## Bedeutung fuer Wiederholungen

Wenn eine Selection innerhalb eines Wiederholungsbereichs liegt, wird sie im Playback entsprechend mehrfach gehoert.

Das bedeutet nicht:

- die Selection wird kuenstlich wiederholt

Sondern:

- der expandierte Ablauf enthaelt dieselben notierten Ursprungsnoten mehrfach
- die Selection trifft deshalb auf mehrere Ablauf-Events

## Beispiele

### Beispiel 1: Keine Selection

Notierter Ablauf:

```text
|: Takt 1 | Takt 2 | Takt 3 :|
```

Expandierter Ablauf:

```text
1, 2, 3, 1, 2, 3
```

Playback:

- spielt `1, 2, 3, 1, 2, 3`

### Beispiel 2: Punktselektion in Wiederholung

Notierter Ablauf:

```text
|: Takt 1 | Takt 2 | Takt 3 :|
```

Selection:

- Punktselektion auf einer Note in `Takt 2`

Expandierter Ablauf:

```text
1, 2, 3, 1, 2, 3
```

Playback-Regel:

- starte an der ersten passenden Ablaufstelle

Playback:

```text
2, 3, 1, 2, 3
```

### Beispiel 3: Bereichsselektion innerhalb einer Wiederholung

Notierter Ablauf:

```text
|: Takt 1 | Takt 2 | Takt 3 :|
```

Selection:

- Bereich von `Takt 2` bis `Takt 3`

Expandierter Ablauf:

```text
1, 2, 3, 1, 2, 3
```

Playback:

```text
2, 3, 2, 3
```

Die Selection wird also nicht "selbst wiederholt", sondern sie erscheint zweimal, weil der Ablauf diese Takte zweimal durchlaeuft.

### Beispiel 4: Erste und zweite Volte

Notierter Ablauf:

```text
|: A | B | [1 C :| [2 D |]
```

Expandierter Ablauf:

```text
A, B, C, A, B, D
```

#### Bereich in gemeinsamem Teil

Selection:

- Bereich `A` bis `B`

Playback:

```text
A, B, A, B
```

#### Bereich in erster Volte

Selection:

- Bereich nur auf `C`

Playback:

```text
C
```

#### Bereich in zweiter Volte

Selection:

- Bereich nur auf `D`

Playback:

```text
D
```

### Beispiel 5: Punktselektion in zweiter Volte

Notierter Ablauf:

```text
|: A | B | [1 C :| [2 D | E
```

Selection:

- Punktselektion auf `D`

Expandierter Ablauf:

```text
A, B, C, A, B, D, E
```

Playback:

```text
D, E
```

Die erste Volte wird hier nicht gespielt, weil die Punktselektion auf die erste passende Ablaufstelle von `D` aufloest.

## Stimmen und Extracts

Die Ablaufstrategie ist getrennt von der Stimmenauswahl.

Das bedeutet:

- der expandierte Ablauf bestimmt die zeitliche Reihenfolge
- der Playback-Scope bestimmt, welche Stimmen daraus erklingen

Beispiel:

- `all-score`
  - alle Stimmen
- `active-extract`
  - nur die Stimmen des aktiven Extracts
- `selection`
  - nur die Stimmen des aktiven Extracts, aber mit derselben Ablaufstrategie

Damit bleibt die Ablauf-Logik einmalig, auch wenn sich der Scope aendert.

## Audio / Instrument

Die Umschaltung des Instruments ist nur eine Indikation fuer den Modus:

- ganzes Stueck -> neutrales Score-/Piano-Klangbild
- Selection / Extract -> harfenaehnlicher Klang

Das Instrument darf aber **nicht** ueber die Ablaufstrategie entscheiden.

## Konsequenzen fuer die Implementierung

- Wiederholungen und Volten muessen zentral in einem gemeinsamen Playback-Flow aufgeloest werden
- Selection wird danach auf diesen Flow projiziert
- Selection-Playback darf keine zweite, vereinfachte Ablauflogik bekommen
- Ein spezieller Harfenklang ist optional und nur Audio-Output, nicht fachlicher Player

## Offene Folgefragen

- Welche Quelle expandiert den Ablauf spaeter: abc2svg direkt oder ein eigenes TS-Flow-Modell?
- Wie werden Spruenge wie Da Capo, Segno, Fine in Phase 5 priorisiert?
- Ob `active-extract` ohne Selection als eigener Scope zusaetzlich angeboten wird, ist noch zu entscheiden
