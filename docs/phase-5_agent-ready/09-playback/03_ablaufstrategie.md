# Playback-Ablaufstrategie

## Ziel

Dieses Dokument beschreibt die fachliche Ablaufstrategie fuer Playback in Phase 5.

Die Kernidee ist:

- Die Selection bezieht sich immer auf den **notierten Score**.
- Der musikalische Ablauf wird anschliessend als **expandierter Ablauf** mit Wiederholungen, Volten, Spruengen und optionaler Part-Reihenfolge berechnet.
- Playback filtert oder startet danach auf diesem expandierten Ablauf.

Damit wird vermieden, dass Selection und Ablauf-Logik in zwei getrennten Playern auseinanderlaufen.

## Architekturentscheidung

Der Rewrite zielt **nicht** auf den eingebauten `abc2svg`-Player als Zielsystem.

`abc2svg` kann dabei hilfreich sein als:

- Referenz fuer Legacy-Verhalten
- temporaere Uebergangsloesung
- Debug- und Vergleichswerkzeug

Die Zielarchitektur fuer Phase 5 ist jedoch:

- eigener `PlaybackFlowBuilder`
- eigener Scope-Resolver fuer `none` / `point` / `range`
- eigener Audio-Adapter

Grund dafuer ist:

- Selection soll auf notiertem Material definiert bleiben
- Wiederholungen, Volten und Spruenge sollen zentral expandiert werden
- Extracts und Part-Reihenfolgen sollen in denselben Ablauf eingehen
- spaetere Durchlauf-Policies brauchen explizite Ablaufmetadaten

Der `abc2svg`-Player ist dafuer zu eng auf Standard-Score-Playback zugeschnitten und bietet nicht die benoetigte fachliche Steuerbarkeit.

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

Schritt 2 ist dabei bewusst weiter gefasst als reine Wiederholungsexpansion. Der Ablauf kann aus mehreren fachlichen Quellen aufgebaut werden:

- Standard-Scorelogik
- Wiederholungen
- Volten
- Spruenge
- explizite Part-Reihenfolge

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
  partName?: string
  partIteration?: number
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
- `partName`
  - aus welchem Part des Stuecks das Event stammt
- `partIteration`
  - der wievielte Durchlauf dieses Parts im erzeugten Ablauf ist
- `repeatCycle`
  - optionale Kennzeichnung der uebergeordneten Wiederholungsschleife
- `voltaNumber`
  - optionale Kennzeichnung der Volte im expandierten Ablauf

Warum das sinnvoll ist:

- dieselbe notierte Note kann mehrfach im Ablauf vorkommen
- Events koennen eindeutig einem Part-Durchlauf zugeordnet werden
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

## Part-Reihenfolge als Ablaufquelle

Manche Stuecke markieren Parts im notierten Material und definieren zusaetzlich eine explizite Reihenfolge, in der diese Parts gespielt werden sollen.

Diese Information sollte in derselben Ablaufarchitektur genutzt werden wie Wiederholungen und Volten.

Das bedeutet:

- Part-Markierungen sind nicht nur Anzeigeinformation
- Part-Reihenfolgen koennen echte Eingaben fuer die Ablaufgenerierung sein
- die Ablaufgenerierung baut daraus einen konkreten `PlaybackFlow`

Empfohlenes Zielbild:

```ts
interface PlaybackPlan {
  parts?: string[]
}
```

Beispiel:

- notierte Parts: `A`, `B`, `C`
- explizite Abfolge: `A A B C`

Dann wird der expandierte Ablauf nicht nur aus Repeat-Logik gebildet, sondern aus:

- notierter Grundstruktur
- Wiederholungen/Volten
- zusaetzlicher Part-Abfolge

Ein Event im Ablauf koennte dadurch zum Beispiel tragen:

```ts
{
  originZnId: 'note-4711',
  flowIndex: 38,
  passIndex: 2,
  partName: 'A',
  partIteration: 2,
}
```

Das schafft spaeter weitere Steuerungsmoeglichkeiten:

- nur einen bestimmten Part abspielen
- nur den zweiten Durchlauf eines Parts abspielen
- Selection auf einen Part-Durchlauf eingrenzen
- Debug-Ausgaben fuer den gesamten erzeugten Ablauf verbessern

## Audio / Instrument

Die Umschaltung des Instruments ist nur eine Indikation fuer den Modus:

- ganzes Stueck -> neutrales Score-/Piano-Klangbild
- Selection / Extract -> harfenaehnlicher Klang

Das Instrument darf aber **nicht** ueber die Ablaufstrategie entscheiden.

## Konsequenzen fuer die Implementierung

- Wiederholungen und Volten muessen zentral in einem gemeinsamen Playback-Flow aufgeloest werden
- Part-Reihenfolgen muessen in dieselbe Ablaufgenerierung einfliessen
- Selection wird danach auf diesen Flow projiziert
- Selection-Playback darf keine zweite, vereinfachte Ablauflogik bekommen
- Ein spezieller Harfenklang ist optional und nur Audio-Output, nicht fachlicher Player

## Offene Folgefragen

- Welche Quelle expandiert den Ablauf spaeter: abc2svg direkt oder ein eigenes TS-Flow-Modell?
- Wie werden Spruenge wie Da Capo, Segno, Fine in Phase 5 priorisiert?
- Wie wird eine explizite Part-Reihenfolge im Datenmodell des Rewrites repraesentiert?
- Ob `active-extract` ohne Selection als eigener Scope zusaetzlich angeboten wird, ist noch zu entscheiden
