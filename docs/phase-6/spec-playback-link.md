# Phase 6 – Playback-Link für Zupfnoter-TS

## Ziel

Zupfnoter-TS erzeugt einen kompakten, versionierten Datensatz für eine eigenständige Player-Webanwendung. Der Datensatz dient ausschließlich der Wiedergabe. Er ist kein Austauschformat für ABC, MIDI oder Zupfnoter-Dokumente.

Der Link wird vollständig ohne Serverzustand übertragen:

```text
Playback-Timeline
        ↓
Playback-Export pro Auszug
        ↓
Binärformat mit Audio- und Ablaufereignissen
        ↓
Deflate Raw
        ↓
Base64URL
        ↓
https://play.zupfnoter.de/#p=...
```

Der Player stellt eine Timeline mit Taktnummer und Durchlauf dar. Ein Bereich wie `27.1-3.2` kann direkt zur Wiedergabe ausgewählt werden. Die zweite Zahl ist die Durchlaufnummer.

## Bestehende Quelle und Auszugsbildung

Die vollständige `PlaybackStep[]`-Timeline aus `apps/web/src/workbench/playback.ts` ist die einzige Quelle. Sie wird nicht erneut pro Auszug erzeugt.

Für jeden konfigurierten `produce`-Auszug wird die vorhandene Timeline anhand der `originVoiceIds` projiziert. Die Auszugskonfiguration liefert die aktiven Stimmen. Ohne `produce` wird Auszug 0 verwendet.

Die bestehende Playback-Erzeugung bleibt für die Timeline verantwortlich. Der Export darf nur:

- Stimmen aus bereits vorhandenen `PlaybackStep`-Objekten filtern,
- `activeNotes` in Exportereignisse abflachen,
- Takt-/Durchlaufdaten übernehmen,
- Zeitwerte quantisieren und codieren.

Nur `PlaybackNote`-Einträge mit `attack === true` werden exportiert. Gebundene Noten sind bereits über `durationMs` zusammengeführt. Pausen und reine Flow-Schritte erzeugen keine Audioereignisse.

## Ablaufposition

Jedes Audioereignis trägt seine eigene Ablaufposition. Es gibt keinen separaten Positions- oder Marker-Stream.

```ts
interface PlaybackPosition {
  measureNumber: number
  passIndex: number
}
```

Die Taktnummer stammt aus `VoiceEntity.measureCount` der bereits transformierten Song-Daten. Für eine gemeinsame `sourceTime` wird zuerst die erste sichtbare Stimme mit einer Taktnummer verwendet; fehlt sie, wird die kleinste positive Taktnummer der verfügbaren Stimmen verwendet. Fehlende Werte fallen auf Takt 1 zurück.

Die Wiederholungslogik liefert `passIndex` bereits über `PlaybackFlowStep`/`PlaybackStep`. Eine Wiederholung erzeugt deshalb beispielsweise:

```text
27.1
28.1
27.2
28.2
3.2
```

Die Ereignisreihenfolge bleibt die tatsächliche Playback-Reihenfolge (`flowIndex`), nicht die numerische Reihenfolge der Taktnummern.

## Portable Ereignisse

Das logische Exportmodell lautet:

```ts
interface PortablePlaybackEvent {
  dt: number
  d: number
  p: number
  v: number
  m: number
  r: number
}
```

Bedeutung:

- `dt`: Zeit seit dem vorherigen Ereignisstart
- `d`: Dauer
- `p`: MIDI-Tonhöhe, 0–127
- `v`: Velocity, Version 1 immer 127
- `m`: Taktnummer
- `r`: Durchlaufnummer

Mehrere gleichzeitig startende Töne erhalten `dt = 0` und dieselben Werte für `m` und `r`.

Die Zeitwerte werden standardmäßig auf 10 ms quantisiert. Positive Dauern werden mindestens auf eine Zeiteinheit angehoben. Die Exportreihenfolge ist stabil: zuerst Startzeit, dann Pitch.

## Binärformat Version 1

Der Header ist unkomprimiert:

```text
Magic             3 Bytes: ZNP
Formatversion     1 Byte: 1
Flags             1 Byte: Deflate Raw aktiviert
Zeitauflösung     VarUInt, Millisekunden
Event Count       VarUInt
```

Danach folgt die Deflate-Raw-Payload. Pro Ereignis werden geschrieben:

```text
Delta-Zeit        VarUInt
Dauer             VarUInt
MIDI-Pitch        1 Byte
Velocity          1 Byte
Taktnummer        VarUInt
Durchlauf         VarUInt
```

Das Format enthält keine ABC-Daten, Zupfnoter-IDs, Stimmen, Konfiguration, Layoutdaten, Wiederholungsobjekte, Bindungen, Annotationen oder Editorpositionen.

Der Decoder validiert Magic, Version, Flags, VarUInt-Grenzen, Event-Anzahl, Pitch-/Velocity-Bereiche und eine maximale entpackte Payload-Größe.

Die CLI bietet in der ersten Umsetzung den Befehl `playback-link` für eine bereits
materialisierte Timeline-Datei an. Die JSON-Datei enthält ausschließlich ein Array
von `PlaybackEvent`-Objekten; die Erzeugung der Timeline bleibt Aufgabe der
Anwendungspipeline. Damit kann die CLI denselben Binary-Encoder und denselben
Deflate-Raw-Codec verwenden, ohne eine zweite ABC-/Song-/Playback-Transformation
zu implementieren:

```text
zupfnoter playback-link \
  --events timeline.json \
  --player-url https://play.zupfnoter.de/ \
  --output playback-url.txt
```

## Shared-Paket und APIs

Ein neues kleines Paket `packages/playback` kapselt Binary-Format, Kompression, Base64URL und URL-Erzeugung. Es kennt weder Song-, ABC- noch Layouttypen.

```ts
interface PlaybackEvent {
  startMs: number
  durationMs: number
  pitch: number
  velocity?: number
  position: PlaybackPosition
}

interface PlaybackLinkOptions {
  playerUrl: string
  timeResolutionMs?: number
  compression?: 'deflate-raw'
}

interface PlaybackLinkResult {
  url: string
  payload: Uint8Array
  encodedPayload: string
}

export function exportPlaybackLink(
  events: readonly PlaybackEvent[],
  options: PlaybackLinkOptions,
): Promise<PlaybackLinkResult>
```

Die Web-Anwendung stellt zusätzlich einen Adapter von `PlaybackStep[]` zu `PlaybackEvent[]` bereit. Der Adapter projiziert die bestehende Timeline pro Auszug und erzeugt keine neue Timeline.

Deflate Raw wird im Browser über `CompressionStream`/`DecompressionStream` und im CLI über `node:zlib` bereitgestellt. Beide Implementierungen lesen und schreiben denselben Payload.

## Player-App

Eine neue Anwendung `apps/player` liest `location.hash` im Format `#p=<base64url>`.

Der Player:

1. liest den Parameter `p`,
2. decodiert Base64URL,
3. prüft Header und Formatversion,
4. dekomprimiert Deflate Raw,
5. validiert und materialisiert die Ereignisse,
6. baut daraus die Timeline,
7. spielt die MIDI-Tonhöhen über WebAudio/Soundfont ab.

Die Player-Timeline zeigt mindestens:

- Position `Taktnummer.Durchlauf`, beispielsweise `27.1`,
- relative oder absolute Zeit,
- aktive Tonhöhen,
- aktuellen Wiedergabepunkt.

### Bereichsauswahl

Unterstützt werden:

```text
27.1
27.1-3.2
```

Die Werte werden anhand der Ereignisreihenfolge aufgelöst. `27.1-3.2` ist ein inklusiver Bereich vom Beginn des ersten passenden Ereignisses in Takt 27/Durchlauf 1 bis zum Ende des letzten passenden Ereignisses in Takt 3/Durchlauf 2. Dadurch funktionieren Bereiche über einen Wiederholungsübergang hinweg.

Nicht vorhandene Positionen, ungültige Durchlaufnummern und ein Bereich mit Start nach Ende werden verständlich als Eingabefehler angezeigt.

Die Bereichswiedergabe startet zeitlich bei 0 ms, auch wenn der Bereich später in der Gesamttimeline liegt.

## Web- und CLI-Export

Für ein Dokument mit `produce` werden standardmäßig alle Auszüge exportiert. Mit einer expliziten Auszugsnummer wird genau dieser Auszug exportiert.

Web und CLI erzeugen je Auszug:

```text
stück-extract-0.playback.url
```

Der CLI-Befehl lautet:

```text
zupfnoter playback-link <input.abc> \\
  --player-url https://play.zupfnoter.de/ \\
  --output <target-folder> \\
  [--extract <number>] \\
  [--qr svg|png|pdf]
```

Ohne `--qr` wird nur der Link geschrieben. Mit `--qr` wird pro Auszug zusätzlich erzeugt:

```text
stück-extract-0.playback.qr.svg
stück-extract-0.playback.qr.png
stück-extract-0.playback.qr.pdf
```

Die Web-Anwendung bietet QR-SVG und QR-PDF an. Das CLI unterstützt zusätzlich PNG. Der QR-Code enthält exakt denselben Playback-Link wie die URL-Datei.

Bei zu großer QR-Payload bleibt die URL verfügbar; nur das QR-Artefakt erhält einen konkreten Kapazitätsfehler. Ein serverseitiger Kurzlink ist in Version 1 nicht vorgesehen.

## Tests

### Timeline und Positionsdaten

- Takt-/Durchlaufwerte werden aus dem bestehenden Flow übernommen.
- Wiederholungen erzeugen dieselben Taktnummern mit unterschiedlichen Durchläufen.
- `PlaybackStep[]` wird nur einmal erzeugt.
- Auszüge filtern nur vorhandene `originVoiceIds`.
- Gebundene Noten werden als ein Ereignis mit verlängerter Dauer exportiert.
- Pausen erzeugen keine Ereignisse.
- Gleichzeitige Töne erhalten `dt = 0`.

### Binärformat

- Header, Magic, Version und Flags
- VarUInt-Grenzwerte
- Zeitquantisierung auf 10 ms
- Pitch-/Velocity-Grenzen
- Takt-/Durchlaufdaten an jedem Ereignis
- Deflate-Raw-Roundtrip
- deterministische Ausgabe
- Base64URL ohne Padding
- unbekannte Versionen und beschädigte Payloads

### Player

- gültiger Link wird geladen und abgespielt
- Timeline zeigt `measure.pass`
- `27.1-3.2` wird korrekt ausgewählt
- Wiederholungen bleiben in Playback-Reihenfolge sichtbar
- mehrere Ereignisse mit `dt = 0` starten gemeinsam
- ungültige Links und ungültige Bereiche werden angezeigt
- Player benötigt keine ABC- oder Konfigurationsdaten

### QR und CLI

- Links und QR-Artefakte werden pro Auszug erzeugt
- SVG, PNG und PDF enthalten denselben Link
- Dateinamen verwenden die Auszugsnummer
- `produce`-Fallback auf Auszug 0
- expliziter Einzelauszug
- Fehler eines Auszugs werden gemeldet und führen zu einem passenden CLI-Exit-Code

## Annahmen

- `p` ist eine MIDI-Tonhöhe.
- `v` ist in Version 1 immer 127.
- Deflate Raw ist die einzige Kompression in Version 1.
- Der Player wird als `apps/player` im selben Monorepo angelegt.
- Takt und Durchlauf stehen direkt an jedem Audioereignis.
- Die Ablaufordnung wird durch die Ereignisreihenfolge bestimmt.
- `27.1-3.2` ist inklusiv.
- Es gibt keinen serverseitigen Kurzlink- oder Payload-Speicher in Version 1.
