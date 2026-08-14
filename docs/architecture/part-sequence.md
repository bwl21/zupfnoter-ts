# Parts, Abspielreihenfolge und Seitenbeschriftungen

## Status

Entwurf einer Fachspezifikation.

## Ziel

Die Abspielreihenfolge eines Stücks soll aus dem standardisierten ABC-Header
`P:` übernommen werden können, ohne die bisher verwendeten sichtbaren
Part-Bezeichnungen in bestehenden ABC-Dateien zu ändern.

Die Partbezeichnungen im Notenbild bleiben die sichtbare Darstellung der
einzelnen Parts. Die Header-Sequenz ist ausschließlich Playback-Metadaten und
wird nicht nochmals über eine Seitenbeschriftung ausgegeben.

## ABC-Quellen

abc2svg liefert zwei voneinander unabhängige Informationen:

```abc
P:(AB)2C
```

steht in `info.P` und beschreibt die Abspielreihenfolge. Die Sequenz wird zu
`A, B, A, B, C` expandiert.

Ein eingebetteter Marker:

```abc
[P:Teil A]
```

wird an der gemeinsamen musikalischen Zeitposition als Partmarker geliefert.
Der Marker ist damit für das Notenbild und die Synchronisierung der Stimmen
geeignet, aber nicht selbst eindeutig einer Header-ID wie `A` zugeordnet.

Ein `T:`-Statement innerhalb des Notentextes ist dafür nicht geeignet. abc2svg
liefert es als allgemeinen Textblock und nicht als Partinformation.

## Partmodell

Der `AbcParser` liest und expandiert ausschließlich die Partfolge aus dem
Header. Eine Zuordnung von sichtbaren `[P:...]`-Markertexten zu Header-IDs ist
keine Parseraufgabe, sondern wird über die Konfiguration vorgenommen.

Nach der Normalisierung besitzt jeder Part folgende fachlichen Werte:

```ts
interface PartMarker {
  /** Eindeutige ID für die Header-Sequenz, z. B. `A`. */
  id: string
  /** Text für Notenbild, Player und Seitenbeschriftungen, z. B. `Teil A`. */
  displayName: string
  /** Gemeinsame ABC-Zeitposition des Partbeginns. */
  time: number
}
```

Die Zeitposition ist stimmenübergreifend. Ein Partwechsel wird daher niemals
pro Stimme separat geplant. Alle Stimmen, die an dieser Zeitposition
spielbare Entitäten besitzen, gehören zum selben Partwechsel.

## Schreibweisen

### Bestehende Schreibweise

Bestehende Dateien bleiben gültig:

```abc
[P:Teil A]
[P:Teil B]
[P:Teil C]
```

Die sichtbaren Parttexte bleiben unabhängig von der Headerfolge. Ihre
Zuordnung zu Header-IDs wird in `extract.<nr>.playback.parts` konfiguriert.
Damit funktioniert beispielsweise:

```abc
P:(AB)2C

[P:Teil A]
[P:Teil B]
[P:Teil C]
```

Ohne Header `P:` gibt es keine Partfolge für die Wiedergabe. Die Marker
werden weiterhin als sichtbare Partnamen verarbeitet.

### Zuordnung der Marker

Es wird keine zusätzliche Zupfnoter-Syntax innerhalb des Markers eingeführt.
Die bestehende Form `[P:<Text>]` bleibt unverändert.

Ein Marker wird wie folgt zugeordnet:

```abc
P:(AB)2C

[P:A]       % direkte ID A
[P:Teil 1]  % benannter Part, erhält B
[P:]        % kein Part für die Playback-Zuordnung
```

Die Header-Sequenz wird zu `A, B, A, B, C` expandiert. Die Konfiguration
ordnet die Header-IDs den sichtbaren Markertexten zu. Wiederholte Vorkommen
desselben Textes verwenden dieselbe konfigurierte Zuordnung.

`[P:]` bleibt als sichtbarer beziehungsweise layoutrelevanter Marker
zulässig, verbraucht aber keine ID und erzeugt keinen Playback-Part.

Die Zuordnung erfolgt auf den gemeinsamen musikalischen Zeitpositionen aller
Stimmen. Die sichtbare Bezeichnung bleibt vollständig erhalten; die
konfigurierte ID ist interne Playback-Metadaten.

## Abspielreihenfolge

### Explizite Zuordnung über die Konfiguration

Die Zuordnung wird im dynamischen Konfigurationspfad
`extract.<nr>.playback.parts.*` gespeichert:

```json
{
  "extract": {
    "0": {
      "playback": {
        "parts": {
          "A": "Teil A",
          "B": "Teil 1",
          "C": "HUGO hrimrt"
        }
      }
    }
  }
}
```

Der Schlüssel ist die Header-ID, der Wert ist der sichtbare Text des
`[P:...]`-Markers. Diese Konfiguration ist die einzige Quelle für die
Zuordnung. Sie wird über die generische
Schema-/Confstack-UI bearbeitet und nicht als zusätzliche Syntax in den
Notentext geschrieben.

Die Header-Sequenz wird zentral in der Playback-Flow-Pipeline ausgewertet:

```text
ABC → AbcParser.info.P → Konfiguration der Part-IDs
    → gemeinsame Part-Zeitpositionen
    → PlaybackFlow → PlaybackTimeline und Player
```

Die Abspielwiederholungen werden aus den Part-IDs und den gemeinsamen
Zeitpositionen gebildet. Die Playback-Pipeline darf für diese Funktion keine
zweite, vom Export unabhängige Part-Timeline erzeugen.

### Durchlaufzähler

Der `passIndex` beschreibt, in welchem Durchlauf ein Flow-Schritt tatsächlich
abgespielt wird. Wird ein Part in der konfigurierten Partfolge erneut
abgespielt, erhält diese Vorkommnis einen erhöhten Durchlaufzähler. Beispiel:

```text
Partfolge: A, B, A, B, C
Durchlauf: 1, 1, 2, 2, 1
```

Der Zähler aus normalen ABC-Wiederholungen bleibt dabei erhalten und wird mit
dem zusätzlichen Part-Durchlauf kombiniert. `flowIndex` bleibt unabhängig
davon die eindeutige Position des Schritts im expandierten Ablauf.

## Validierungsregeln

1. Kein Header `P:`: bestehende Wiedergabe und bestehende Partnamen bleiben
   unverändert.
2. Header `P:` ohne Partmarker: Warnung; die Sequenz kann nicht auf
   musikalische Zeitpositionen abgebildet werden.
3. Nicht konfigurierte Parttexte erzeugen eine Warnung und werden nicht als
   Playback-Part verwendet.
4. Header-IDs ohne passenden Marker erzeugen eine Warnung und werden in der
   Playback-Folge übersprungen; dadurch wird kein unmarkierter Vorspann
   abgespielt.
5. `[P:]` verbraucht keine Header-ID.
6. Stimmen ohne eigenen Marker erben den Partmarker der gemeinsamen
   Zeitposition.

## Rückwärtskompatibilität

Die vorhandenen Dateien mit `[P:Teil A]` müssen ohne Migration weiterhin

- denselben Text im gedruckten Notenbild anzeigen,
- denselben Text in der Wiedergabe anzeigen,
- Partwechsel in allen Stimmen synchronisieren.

Es gibt keine neue Schreibweise zu migrieren. Die Zuordnung wird ausschließlich
in der Konfiguration ergänzt und lässt die bisherigen Marker unverändert.

## Tests

Die Implementierung benötigt mindestens folgende Paritätstests:

- bestehende Datei mit `[P:Teil A]`, `[P:Teil B]`, `[P:Teil C]` und
  `P:(AB)2C` ergibt `A, B, A, B, C`;
- die Partmarker werden an denselben Zeiten in zwei Stimmen erkannt;
- die konfigurierte Zuordnung von `[P:A]` beziehungsweise `[P:Teil 1]` wird
  für die Wiedergabe verwendet;
- `[P:]` wird für die Playback-Zuordnung ignoriert;
- fehlende oder widersprüchliche Zuordnungen werden in der Konfiguration
  sichtbar;
- eine Datei ohne Header `P:` bleibt gegenüber dem bisherigen Verhalten
  unverändert.
