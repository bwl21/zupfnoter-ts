# Zupfnoter: Allgemeines Modell für Einzählen und Zählen

Analysiere die bestehende Zupfnoter-Implementierung für Player, Metronom, Hauptschläge, halbe Schläge, Taktarten, Auftakte und Taktwechsel und entwirf darauf aufbauend eine möglichst kleine Erweiterung.

Das Ziel ist ausdrücklich **kein großes Preset- oder Strategy-System**. Nach der fachlichen Analyse soll das eigentliche Modell auf wenige Parameter reduziert werden.

## 1. Terminologie

Wir unterscheiden:

* **Einzählen**: Alles, was vor dem ersten musikalischen Spieleinsatz hörbar gezählt/geklickt wird.
* **Vorzählen**: Zählung vor dem eigentlichen Startbereich zur Vorgabe von Tempo und Metrum.
* **Einsatzzählen / Entry Count**: Zählung bis zum tatsächlichen ersten Spieleinsatz. Dieser Bereich kann einen Teil eines Taktes, einen Takt oder auch mehrere Takte umfassen.
* **Spielzählen / Play Count**: Zählen während der laufenden Wiedergabe.

Wichtig:

Ein klassischer Auftakt ist nur ein Spezialfall des Einsatzzählens.

Das Einsatzzählen darf deshalb nicht auf einen einzelnen Takt begrenzt sein.

---

# 2. Einzählen: nur zwei Parameter

Das Einzählen soll im Kern durch nur zwei gespeicherte Parameter beschrieben werden:

```ts
interface CountInSettings {
    minLeadIn: number;
    bandPreCount: boolean;
}
```

Die konkreten Namen dürfen an bestehende Zupfnoter-Konventionen angepasst werden.

## `minLeadIn`

`minLeadIn` ist die Mindestanzahl von Schlägen, die vor dem tatsächlichen ersten Spieleinsatz hörbar gezählt werden müssen.

Es handelt sich um eine positive ganze Zahl.

Beispiele:

### 4/4

`minLeadIn = 2`

=> mindestens zwei Schläge vor dem Einsatz.

Einsatz auf Schlag 3:

`1 2 -> Einsatz`

Einsatz auf Schlag 2:

Nur `1` wäre zu wenig.

Deshalb muss der vorhergehende Takt einbezogen werden:

`1 2 3 4 | 1 -> Einsatz`

### 3/4

`minLeadIn = 2`

Einsatz auf Schlag 3:

`1 2 -> Einsatz`

Einsatz auf Schlag 2:

`1` reicht nicht.

Daher:

`1 2 3 | 1 -> Einsatz`

### 12/8

`minLeadIn` kann beispielsweise auch `4`, `6` oder `12` sein.

Der Wert ist bewusst keine freie Taktbruchzahl wie `0.5` oder `0.7`, sondern eine diskrete Anzahl der für Zupfnoter relevanten Schläge.

Die Engine bestimmt aus Einsatzposition, Taktstruktur und `minLeadIn`, wie weit sie für das Einzählen zurückgehen muss.

## Wichtig bei Auftakten

Es wird nicht gespeichert:

* "ein Auftakttakt"
* "ein halber Takt"
* "ein Vorzähltakt plus Auftakt"

Stattdessen wird vom tatsächlichen Spieleinsatz aus ermittelt, ob bereits mindestens `minLeadIn` Schläge davor vorhanden sind.

Falls nicht, wird entsprechend weiter zurückgegangen.

Damit sollen Auftakte und längere Bereiche vor dem ersten Einsatz mit derselben Logik funktionieren.

---

# 3. Band-Vorzähler

`bandPreCount` ist ein bewusst expliziter Sonderfall.

```ts
bandPreCount: boolean
```

Wenn `false`:

Normales Einzählen gemäß `minLeadIn`.

Wenn `true`:

Vor das normale Einzählen wird zusätzlich der definierte Zupfnoter-Band-Vorzähler gesetzt.

Wichtig:

Versuche NICHT, den Band-Vorzähler künstlich aus `division`, `subdivision`, einer Dichte oder einer mathematischen Verallgemeinerung abzuleiten.

Die Band-Konvention ist ein bewusstes Preset/Sondermuster.

Für einen typischen 4/4 soll der zusätzliche Band-Vorzähler beispielsweise zwei hohe/trockene Stick-Klicks auf den musikalischen Positionen 1 und 3 erzeugen:

`1 - 3 - | normales Einzählen | Einsatz`

Wie dieser Sonderfall bei anderen Metren behandelt wird, soll explizit und nachvollziehbar definiert werden.

Falls die bestehende Zupfnoter-Logik dafür bereits geeignete metrische Informationen liefert, diese verwenden.

Für Metren, bei denen die Band-Konvention "1 und 3" musikalisch nicht sinnvoll oder nicht darstellbar ist, soll ein klar definierter Fallback verwendet werden.

Nicht versuchen, durch komplizierte allgemeine Mathematik jede Taktart in diese Band-Konvention zu zwingen.

---

# 4. Normales Zählen: `division` und `subdivision`

Das normale Klick-/Zählsystem soll unabhängig vom Einzählen durch zwei Parameter beschrieben werden:

```ts
interface CountSettings {
    division: number;
    subdivision: number;
}
```

Beide Werte sind positive ganze Zahlen.

## `division`

`division` definiert die Anzahl der großen Zählschläge pro Takt.

Beispiele:

### 4/4

```text
division = 4
subdivision = 1
```

=> vier Zählschläge:

`1 2 3 4`

### 3/4

```text
division = 3
subdivision = 1
```

=> drei Zählschläge:

`1 2 3`

### 6/8

Typische Zählweise:

```text
division = 2
subdivision = 3
```

Der Takt wird in zwei große Zählschläge geteilt, jeder davon besitzt drei gleichmäßige Unterteilungen.

Ergebnis:

`1 2 3 | 4 5 6`

mit Hauptbetonungen auf:

`X . . | X . .`

also auf Achtelposition 1 und 4.

### 9/8

Typisch:

```text
division = 3
subdivision = 3
```

=> drei große Zählschläge mit je drei Unterteilungen.

### 12/8

Typisch:

```text
division = 4
subdivision = 3
```

=> vier große Zählschläge mit je drei Unterteilungen.

## `subdivision`

`subdivision` definiert, in wie viele gleichmäßige hörbare Impulse jeder durch `division` erzeugte Zählschlag unterteilt wird.

Beispiele:

```text
subdivision = 1
```

Nur der Zählschlag selbst.

```text
subdivision = 2
```

Zählschlag plus Halb-Unterteilung.

```text
subdivision = 3
```

Dreierunterteilung.

Für 6/8:

```text
division = 2
subdivision = 3
```

ergibt:

`X . . | X . .`

---

# 5. Validierung von division/subdivision

Nicht jede beliebige Kombination muss für jeden Takt gültig sein.

Bitte definiere eine klare Validierung.

Die zeitliche Aufteilung eines Taktes muss mit `division * subdivision` sinnvoll darstellbar sein.

Beispielsweise ist für einen normalen 6/8:

```text
division = 2
subdivision = 3
```

natürlich passend.

Ungültige oder musikalisch/zeitlich nicht exakt darstellbare Kombinationen dürfen nicht stillschweigend zu unregelmäßigen Zeitpositionen führen.

Prüfe dabei, welche Zeitbasis der bestehende Zupfnoter-Player bereits verwendet.

---

# 6. Taktwechsel

Der Zupfnoter-Player kann bereits Taktwechsel.

Das neue Zählsystem muss diese bestehende Fähigkeit nutzen.

Beispiel:

`4/4 -> 6/8 -> 3/4 -> 12/8`

Für jeden Takt werden die CountEvents anhand des aktuell gültigen Taktes sowie der für diesen Bereich gültigen `division/subdivision` berechnet.

Keine feste Annahme wie "ein Stück hat vier Beats pro Takt" verwenden.

Falls `division/subdivision` aus dem Blatt bzw. aus vorhandenen Taktinformationen automatisch bestimmt werden können, soll dies unterstützt werden.

---

# 7. Klang-/Eventklassen

Zeitberechnung und Klangfarbe strikt trennen.

CountEvents sollen mindestens folgende semantische Klassen unterscheiden:

```text
PRE_COUNT
BAR_START
MAIN_BEAT
SUBDIVISION
```

Bedeutung:

* `PRE_COUNT`: zusätzlicher Band-Vorzähler
* `BAR_START`: erster Zählschlag eines Taktes
* `MAIN_BEAT`: weiterer großer Zählschlag
* `SUBDIVISION`: Unterteilung

Gewünschte Klangcharakteristik:

* `PRE_COUNT`: sehr hoher/trockener Stick-Klick
* `BAR_START`: deutlich hervorgehobener Klick
* `MAIN_BEAT`: normaler Klick
* `SUBDIVISION`: leichter Klick

Zusätzlich:

```ts
isLastBeforeEntry: boolean
```

Das letzte hörbare CountEvent unmittelbar vor dem ersten musikalischen Spieleinsatz erhält:

```text
isLastBeforeEntry = true
```

Dafür kann die Audioseite einen eigenen Startsignal-Klang verwenden.

Dieses Flag ist unabhängig vom Eventtyp.

Ein `MAIN_BEAT` oder eine `SUBDIVISION` kann also gleichzeitig `isLastBeforeEntry` sein.

---

# 8. Datenmodell

Prüfe nach Analyse der bestehenden Codebasis, ob sich das Modell ungefähr auf Folgendes reduzieren lässt:

```ts
interface CountInSettings {
    minLeadIn: number;
    bandPreCount: boolean;
}

interface CountSettings {
    division: number;
    subdivision: number;
}
```

Dabei soll `CountSettings` möglichst für Vor-/Einsatzzählen und Spielzählen dieselbe vorhandene Player-Engine verwenden.

Keine zusätzlichen Parameter einführen, solange ein konkreter musikalischer Fall sie nicht zwingend benötigt.

---

# 9. UI

Wir wollen zunächst kein komplexes Schnelleinstellungs-/Preset-System.

Die zwei Einzählparameter sind bereits relativ verständlich.

Sinngemäß könnte die UI anbieten:

```text
Mindestens einzählen: [ 4 ] Schläge
Band-Vorzähler:       [x]
```

Für das normale Zählen:

```text
Zählschläge pro Takt: [ 2 ]
Unterteilungen:       [ 3 ]
```

Beispiel 6/8:

```text
Zählschläge pro Takt: 2
Unterteilungen:       3
```

Optional können UI-Hilfen wie "½ Takt" oder "1 Takt" später lediglich passende Werte für `minLeadIn` setzen.

Diese UI-Hilfen sind keine eigenen gespeicherten Strategien.

---

# 10. Blattvorgabe und Player

Die Einstellungen sollen beim Erstellen des Blattes als Empfehlung gespeichert werden können.

Der Player übernimmt zunächst die Blattvorgabe.

Der Übende darf sie lokal überschreiben.

Der lokale Player-Override darf die Blattvorgabe nicht verändern.

---

# 11. Tests

Mindestens folgende Fälle testen:

### Einzählen

* 4/4, `minLeadIn=2`, Einsatz auf 1
* 4/4, `minLeadIn=2`, Einsatz auf 2
* 4/4, `minLeadIn=2`, Einsatz auf 3
* 4/4, `minLeadIn=4`, verschiedene Einsätze
* 3/4, `minLeadIn=2`, Einsatz auf 2
* 3/4, `minLeadIn=2`, Einsatz auf 3
* 12/8 mit verschiedenen `minLeadIn`
* erster Spieleinsatz erst nach mehreren Takten
* Band-Vorzähler an/aus
* `isLastBeforeEntry`
* Taktwechsel nach einem verkürzten Wiederholungsendtakt: Der alte Takt endet
  auf Schlag 1, der Auftakt der neuen Taktart setzt auf Schlag 2 ein

### Zählen

* 4/4: division=4, subdivision=1
* 4/4 mit Unterteilungen
* 3/4: division=3
* 6/8: division=2, subdivision=3
* 9/8: division=3, subdivision=3
* 12/8: division=4, subdivision=3
* Taktwechsel innerhalb eines Stücks
* ungültige division/subdivision-Kombinationen

---

# 12. Vorgehen

Bitte zuerst die vorhandene Zupfnoter-Implementierung untersuchen.

Insbesondere:

1. Wie werden Taktart und Taktwechsel intern dargestellt?
2. Was bedeutet im aktuellen Player "Hauptschlag"?
3. Wie werden "halbe Schläge" aktuell erzeugt?
4. Welche Zeitbasis verwendet der Player?
5. Wo wird der Metronom-/Klick-Sound erzeugt?
6. Wie wird der erste tatsächliche Spieleinsatz bestimmt?
7. Welche vorhandenen Datenstrukturen können für `division/subdivision` wiederverwendet werden?
8. Wo können Blattvorgaben und lokale Player-Overrides sauber gespeichert werden?

Danach zunächst einen Implementierungsplan liefern.

Bevor zusätzliche Strategy-Klassen, Modi oder Parameter eingeführt werden, bitte anhand eines konkreten musikalischen Falls begründen, warum die vier Kernparameter

`minLeadIn`
`bandPreCount`
`division`
`subdivision`

nicht ausreichen.

---

# 13. Taktwechsel nach einem verkürzten Wiederholungsendtakt

Dieser Fall ist für die spätere Übernahme in das Benutzerhandbuch festgehalten.
Er betrifft nicht die Metronom-Konfiguration, sondern die Interpretation der
ABC-Taktstruktur.

## Fachlich gewünschte Schreibweise

```abc
M:4/4
[P:A – Auftakt und Wiederholung] z2 G2 A2 | C2 D2 E2 F2 | B2 :]
[M:3/4] [P:B – Dreier- und Zweiertakt] D2 E2 |: F2 G2 A2 |
```

Die Schlagfolge lautet:

```text
4/4: 2 3 4 | 1 2 3 4 | 1 :]
3/4:                         2 3 | 1 2 3 |
```

Dabei gelten folgende Regeln:

1. `z2 G2 A2` ist ein dreischlägiger 4/4-Auftakt auf den Schlägen 2, 3 und 4.
2. `B2` ist der ein-schlägige 4/4-Schlusstakt und ergänzt diesen Auftakt.
3. Der Wiederholungssprung nach `B2` führt zum Anfang zurück. Dort gilt wieder
   die quellpositionsabhängige Taktart `M:4/4` aus dem Kopf des Stücks.
4. `M:3/4` steht außerhalb des wiederholten Bereichs und wird deshalb erst nach
   dem letzten Wiederholungsdurchlauf wirksam.
5. `D2 E2` ist ein zweischlägiger 3/4-Auftakt auf den Schlägen 2 und 3.
6. Mit `F2 G2 A2` beginnt der folgende vollständige 3/4-Takt auf Schlag 1.
7. Falls eine Positionsanzeige die lineare Taktnummer zeigt, muss sie nach
   `B2` auf die nächste Taktnummer wechseln. `D2 E2` gehören dabei zum selben
   angezeigten Takt wie der nachfolgende vollständige Takt `F2 G2 A2`, analog
   zum Auftakt am Beginn eines Stücks.

## Nicht äquivalente Alternative

```abc
... | [M:3/4] B2 :]
[P:B – Dreier- und Zweiertakt] D2 E2 | ...
```

Diese Schreibweise ist nicht gleichbedeutend. Der Taktwechsel liegt hier im
wiederholten Bereich, sodass bereits `B2` unter 3/4 steht. Beim Sprung zum
Anfang muss wieder die dort gültige Quell-Taktart 4/4 verwendet werden. Diese
Variante beschreibt nicht den oben festgelegten Fall, in dem `B2` den alten
4/4-Takt abschließt.

## Legacy und aktueller TypeScript-Stand

Legacy aktualisiert bei dem nach `:]` notierten `M:3/4` sofort `wmeasure` und
`countby`, ohne die bisherige Schlagphase zurückzusetzen. Dadurch erhalten
`D2 E2` die Zählwerte 2 und 3. Weil der verkürzte Wiederholungsendtakt intern
nicht als regulärer Taktanfang gilt, meldet Legacy zusätzlich die Warnung
„Taktänderung mitten im Takt“.

Der aktuelle TypeScript-Stand berechnet für die Noten ebenfalls die Zählwerte
2 und 3. Die Playback-Positionsspur überträgt die neue Taktart und die nächste
lineare Taktnummer jedoch erst beim folgenden vollständigen Takt
`F2 G2 A2`. Während `D2 E2` kann deshalb in Workbench und Player noch die alte
4/4-Taktart beziehungsweise die vorherige Taktnummer wirksam erscheinen.
Das ist eine bekannte Abweichung und wird hier nur dokumentiert; eine
Codeänderung ist mit dieser Festlegung nicht verbunden.

## Hinweis für das Benutzerhandbuch

Bei der späteren Übernahme soll das Handbuch die fachlich gewünschte
Schreibweise empfehlen und beide Teilauftakte grafisch oder als Schlagfolge
erklären. Die technische Legacy-Warnung und interne Playback-Datenstrukturen
gehören nicht in die Benutzeranleitung; relevant ist dort nur:

- Taktwechsel nach dem Wiederholungsende schreiben,
- verkürzten 4/4-Schlusstakt und folgenden 3/4-Auftakt getrennt verstehen,
- `B2` als Schlag 1 in 4/4 sowie `D2 E2` als Schläge 2 und 3 in 3/4 zählen.
