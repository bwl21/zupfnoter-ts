# Analyse und Optimierung des Playback-Link-Encodings

## Ist-Pipeline

Die Workbench projiziert die bereits berechnete `PlaybackStep[]`-Timeline in
`PlaybackEvent[]`. Danach läuft die Exportpipeline in
`packages/playback/src/index.ts`:

```text
PlaybackEvent[]
→ Normalisierung und Quantisierung auf 10 ms
→ Binärformat ZNP
→ Deflate Raw auf dem Eventbereich
→ Header vor dem komprimierten Bereich anhängen
→ Base64URL ohne Padding
→ URL-Fragment #p=...
```

Eine Obfuscation-Schicht ist im aktuellen Code nicht vorhanden. Die Daten sind
komprimiert und Base64URL-kodiert, aber nicht verschlüsselt oder absichtlich
verschleiert. Das Format enthält weder ABC noch Zupfnoter-IDs, Voices,
Instrumentnamen oder Layoutdaten.

## Format v2

Der Header bleibt unkomprimiert:

| Feld | Bedeutung |
| --- | --- |
| `ZNP` | Magic Value |
| Version | `2` |
| Flags | Deflate Raw, Velocity vorhanden, mehrere Durchläufe vorhanden |
| VarUInt | Zeitauflösung in Millisekunden |
| VarUInt | Eventanzahl |

Ein Event enthält:

```text
delta time · duration · pitch · event flags · optionale Positionswerte · optionale Velocity
```

Die Event-Flags bedeuten:

- Bit 0: Taktnummer folgt; sonst bleibt die vorherige Taktnummer erhalten.
- Bit 1: Durchlauf folgt; sonst bleibt der vorherige Durchlauf erhalten.
- Bit 2: Velocity-Feld ist im gesamten Payload aktiv.

Velocity `127` wird nicht mehr pro Event geschrieben. Das Positionsmodell ist
zustandsbasiert: Wiederholte Takt- und Durchlaufwerte entfallen. Der Decoder
unterstützt weiterhin Payloads der Version 1; neue Links werden in Version 2
geschrieben.

## Byte-Statistik

Die Analyse im Playback-Link-Toast basiert auf den tatsächlich geschriebenen
Bytes des unkomprimierten Binärformats. Sie weist aus:

- Events, Header und Gesamtgröße
- Zeitdaten, Tonhöhen und Dauern
- Velocity, Flags und sonstige Metadaten
- Instrument, Voice, IDs und Marker — aktuell jeweils `0 Byte`, weil diese
  Informationen für den Player nicht exportiert werden
- Bytes/Event
- Größe nach Deflate und Base64URL-Länge

Die Prozentwerte beziehen sich auf die Gesamtgröße vor Deflate. Der aktuelle
Metadatenanteil besteht damit nur aus dem Header, den Event-Flags und den
geänderten Takt-/Durchlaufwerten; Instrument, Voice, IDs und Marker sind keine
versteckten Bestandteile des Formats.

## Benchmark

Reproduzierbare Benchmarks laufen mit:

```text
pnpm --filter @zupfnoter/playback build
pnpm exec node tools/playback-encoding-benchmark.mjs
```

Der eingebaute `example-565`-Fall ist ein synthetischer Referenzfall mit 565
Events. Für reale Stücke kann zusätzlich eine Timeline-Datei übergeben werden:

```text
pnpm exec node tools/playback-encoding-benchmark.mjs timeline.json
```

Gemessene Werte mit dem synthetischen Referenzfall:

| Fall |  | Binär | Deflate | Base64URL | URL-Länge |
| --- | --- | ---: | ---: | ---: | ---: |
| 565 Events | vorher | 3.398 B | 1.131 B | 1.508 | 1.557 |
| 565 Events | nachher | 2.339 B | 310 B | 414 | 463 |
| Ersparnis |  | 1.059 B | 821 B | 1.094 | 1.094 |

Der Zahlenwert ist kein Ersatz für die Analyse eines konkreten Stücks: Die
Deflate-Größe hängt stark von Tonhöhen, Zeitabständen und Positionswechseln ab.
Der Toast im Editor zeigt deshalb die autoritativen Werte des gerade erzeugten
Links.

## QR-Bewertung

Die URL-Länge wird im Toast nach diesen Schwellen bewertet:

| Länge | Bewertung |
| ---: | --- |
| unter 1.500 | gut |
| 1.500–1.999 | dicht, aber brauchbar |
| 2.000–2.499 | kritisch |
| ab 2.500 | eher ungeeignet |

## Verbleibende Optionen

Die größte einfache Redundanz ist mit der v2-Positionskompression und dem
Entfall der Default-Velocity entfernt. Weitere Änderungen sollten erst an
realen Timeline-Benchmarks gemessen werden. Mögliche nächste Schritte wären
Delta-Kodierung der Taktwerte oder eine gemeinsame Dauer-Tabelle; beide können
durch ihre zusätzlichen Zustands- oder Tabellenflags nach Deflate auch neutral
oder schlechter ausfallen. Instrument und Voice dürfen nicht ergänzt werden,
solange der Player diese Informationen nicht benötigt.
