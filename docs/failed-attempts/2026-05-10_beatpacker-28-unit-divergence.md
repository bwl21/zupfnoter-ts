# BeatPacker maximalBeat: 28-Unit-Divergenz zwischen TS und Legacy

## Ausgangslage

Im `HarpnotesLayout`-Snapshot-Test für `246_Horch-was-kommt-von-draussen-rein` weichen
die Y-Positionen zwischen TS und Legacy um ca. 0.2 % ab. Die Ursache: der `maximalBeat`
(Rohwert vor Spread) unterscheidet sich um 28 Einheiten (TS: 13128, Legacy: ~13156).

Der Spread-Algorithmus (`applyLegacyBeatSpread`) ist korrekt portiert — das Problem
liegt in den Rohwerten des `BeatPacker._packMethod1`.

## Versuchte Ansätze

### 1. Analyse der pack_method 1 (collision)

**Vergleich Ruby vs. TS** (`harpnotes.rb:3101–3184` vs `BeatPacker.ts:304–393`):

Beide Implementationen wurden Zeile für Zeile verglichen. Die Logik ist strukturell
identisch:
- Gleiche Schleifenstruktur (beats sortiert, pro Beat)
- Gleiche Gruppierung (`groupByBeat` / `relevant_beats.group_by`)
- Gleiche Kollisionserkennung
- Gleiche Inversionserkennung (monoton fallend/steigend)
- Gleiche Maß-Anfangs-Erhöhung (`increment += increment / 4`)

**Ergebnis**: Keine strukturelle Abweichung gefunden.

### 2. `?? -1` vs `|| -1` in collisionStack (Zeile 335)

In Ruby/OpalJS: `(collision_stack[note.pitch] || -1)` — `0 || -1 = -1` (0 ist falsy).
In TS: `collisionStack[note.pitch] ?? -1` — `0 ?? -1 = 0` (0 ist nicht nullish).

Dies ist ein semantischer Unterschied, aber die Analyse ergab:
- `collisionStack[pitch]` ist nur im ersten Iterationsschritt `0`
- Für Horch wiederholt sich kein Pitch innerhalb der `confMinIncrement`-Distanz von 57.6
- Daher hat dieser Unterschied **keinen messbaren Effekt** auf Horch

### 3. `Math.max(defaultIncrement, confMinIncrement)` (Zeile 328)

In TS: `Math.max((size + lastSize) / 2, confMinIncrement)`.
In Ruby: `(size + last_size) / 2`.

Die Untergrenze durch `confMinIncrement` könnte in Randfällen wirken, aber für Horch
sind alle `defaultIncrement`-Werte > 57.6 = `confMinIncrement`.
Daher hat auch dieser Unterschied **keinen Effekt**.

### 4. DURATION_TO_STYLE-Format

Geprüft, ob der Config-Stack DURATION_TO_STYLE als Arrays `[0.75, "filled"]` (Ruby-
Format) oder als Objekte `{sizeFactor: 0.75, fill: "filled"}` (TS-Format) liefert.

Ergebnis: Der Stack liefert korrekt das TS-Objekt-Format aus den `initConf`-Defaults.
Die `getSizeFactor`-Funktion arbeitet korrekt.

### 5. Voice-Index-Konvention

Geprüft, ob die 1-basierten Voice-Nummern aus dem Config korrekt in Array-Indizes
übersetzt werden. Der `Song.voices`-Array hat einen Dummy bei Index 0 (Kopie von V1),
sodass `song.voices[1]` = Voice 1, `song.voices[2]` = Voice 2.

Ergebnis: Die Indizes sind korrekt. Der Kommentar "computeBeatCompression expects 0-based
indices" in `HarpnotesLayout.ts:515` ist irreführend — die Funktion arbeitet mit den
1-basierten Werten aus dem Config direkt, was dank des Dummy-Eintrags korrekt ist.

### 6. `collectRelevantPlayables`-Reihenfolge

Geprüft, ob SynchPoint-Notes in anderer Reihenfolge eingefügt werden (TS: inline im
Voice-Loop vs. Ruby: append at end). Da `groupByBeat` nach Beat sortiert, ist die
Reihenfolge innerhalb eines Beats für die Kompression irrelevant.

### 7. Debug-Instrumentierung

`_packMethod1` wurde temporär mit detailliertem per-Beat-Logging versehen (size,
defaultIncrement, collisions, inversions, measureStart, increment). Ausgabe für die
ersten 10 von 146 Beats analysiert.

Ergebnis: Die Werte sind kohärent und entsprechen dem erwarteten Algorithmus in allen
detailgeprüften Fällen.

## Warum gescheitert

Die Differenz von 28/13128 = 0.2 % ist zu klein, um auf einen einzelnen Code-Unterschied
zurückgeführt werden zu können. Alle bekannten semantischen Unterschiede (`??` vs `||`,
`Math.max`-Wrapper) wurden isoliert betrachtet und haben für den Horch-Testfall keinen
Effekt. Die Algorithmen sind strukturell identisch.

Mögliche nicht ausgeschlossene Ursachen:
- Ein sehr subtiler Unterschied im Floating-Point-Akkumulationsverhalten über 146
  Iterationen hinweg (Betrag < 0.2 Einheiten/Beat)
- Ein Unterschied in der Entity-Menge oder den Beat-Werten zwischen TS- und Legacy-Song
  (wurde nicht Beat-für-Beat validiert, da kein direkter Legacy-Fixure-Vergleich möglich)
- Ein Konfig-Unterschied, der über mehrere Confstack-Layer hinweg subtil wirkt
  (z. B. `packer.pack_min_increment` vs. `packer.pack_method`)

## Empfohlenes weiteres Vorgehen

1. `?? -1` → `|| -1` in `_packMethod1` ändern (korrekte Semantik, auch wenn für Horch irrelevant)
2. `Math.max(defaultIncrement, confMinIncrement)` → `(size+lastSize)/2` ändern (korrekte Semantik)
3. Alle drei `_packMethod*`-Varianten auf gleiche Abweichungen prüfen
4. Per-Beat-Instrumentierung erweitern: **sämtliche 146 Beats dumpen** und mit einer
   Neuberechnung per Ruby vergleichen (oder per Legacy-Song-Fixture validieren)
5. Falls keine Ursache: größeren Testfall suchen, der die Divergenz verstärkt,
   oder Floating-Point-Arithmetik in TS gegen Ruby/OpalJS kalibrieren
