# Vertikale Layout-Pipeline (Beat → Y-Position in mm)

Beschreibt, wie eine musikalische Beat-Position (`Song`) in eine vertikale
Pixel-/Millimeterposition auf dem Notenblatt (`Sheet`) übersetzt wird.

Die horizontale Achse (`pitch → x`) wird hier **nicht** behandelt; sie ist eine
unabhängige Funktion `pitchToX(pitch, layout)` ohne Packer-Beteiligung.

---

## Überblick

Die vertikale Position einer Note wird in **drei Stufen** berechnet, vollständig
konfigurationsgetrieben über den `Confstack`:

```
╭───────────────────────╮     ╭──────────────────╮     ╭────────────────╮     ╭─────────╮
│ Song.voices/beatMaps  │────▶│ BeatPacker       │────▶│ Spread (Layout)│────▶│ beatToY │
│ (musikalische Beats)  │     │ pack_method 0/1/ │     │ Y_SCALE +      │     │ → mm    │
│                       │     │ 2/3/10           │     │ pack_max_      │     │         │
│                       │     │                  │     │ spreadfactor   │     │         │
╰───────────────────────╯     ╰──────────────────╯     ╰────────────────╯     ╰─────────╯
```

| Stufe | Eingabe | Ausgabe | Einheit |
|-------|---------|---------|---------|
| 1 — Packer | `Song`, `layoutLines`, `Confstack` | `BeatCompressionMap` | interne Beat-Einheit (`BEAT_RESOLUTION × sizeFactor`) |
| 2 — Spread | `BeatCompressionMap`, `LayoutConfig`, `startpos` | gestreckte `BeatCompressionMap` | gleiche interne Einheit, ggf. skaliert |
| 3 — `beatToY` | `beat`, Map, `LayoutConfig`, `startpos` | `y` | mm |

Quelldateien:

- [packages/core/src/BeatPacker.ts](../../packages/core/src/BeatPacker.ts)
- [packages/core/src/HarpnotesLayout.ts](../../packages/core/src/HarpnotesLayout.ts)

---

## Stufe 1 — `computeBeatCompression()`

`BeatPacker.ts` exportiert eine reine Funktion:

```ts
computeBeatCompression(
  song: Song,
  layoutLines: number[],   // 0-basierte Voice-Indizes (siehe Hinweis unten)
  conf: Confstack,
): BeatCompressionMap      // Record<beat, position>
```

Sie dispatched über `layout.packer.pack_method` aus dem Confstack auf eine von
fünf Strategien (0, 1, 2, 3, 10).

### Gemeinsamer Aufbau aller pack-Methoden

1. `collectRelevantPlayables(song, layoutLines)` zieht alle `Playable`-Entities
   aus den ausgewählten Stimmen. SynchPoint-Noten werden flach mitgenommen.
2. `groupByBeat(playables)` gruppiert nach `entity.beat` (musikalische Zeitachse
   aus dem Song-Modell — diskrete ganze Zahlen, keine Sekunden).
3. Für jeden Beat (sortiert) wird ein **Inkrement** berechnet und auf den
   laufenden `newbeat` aufaddiert.
4. Ergebnis: `BeatCompressionMap = Record<beat, position>`. Die `position` ist
   **noch nicht in mm**, sondern in der internen Einheit
   `BEAT_RESOLUTION × sizeFactor`.

### Konfigurations-Zugriffe (alle pack-Methoden)

| Pfad | Default | Bedeutung |
|------|---------|-----------|
| `layout.packer.pack_method` | `0` | Auswahl der Strategie |
| `layout.DURATION_TO_STYLE` | aus `initConf` | `sizeFactor` pro Notendauer (`d96`, `d64`, …) |
| `layout.BEAT_RESOLUTION` | `192` | Multiplikator für `sizeFactor` → interne Einheit |
| `layout.packer.pack_min_increment` | `0` | Minimaler Beat-Abstand (×`BEAT_RESOLUTION`) |
| `notebound.minc` | `{}` | Pro Zeitposition: manueller `minc_f` als zusätzlicher Faktor |

### Pack-Methoden im Vergleich

| Methode | Default-Increment | Sonderfälle | Zweck |
|---|---|---|---|
| **0 Standard** | `(size + lastSize) / 2` mit `size = BEAT_RESOLUTION × sizeFactor(maxDuration)` | `+ defaultIncrement` bei NewPart, `+ /4` bei MeasureStart, `+ minc` | Notengrößen-bewusste Default-Kompression |
| **1 Collision** | `max(default, pack_min_increment × BEAT_RESOLUTION)` | Pitch-Kollision → voller Default; nicht-monotone Linie ("Inversion") → halbierter Default; `nextIncrement`-Carry für Folge-Beat | Vermeidet Überlappung gleicher Pitches und scharfe Linienknicke |
| **2 Linear** | `position = beat × 8` | — | Reines Debug-/Referenz-Layout |
| **3 Collision v2** | `max(sizeIncrement, pack_min_increment × BEAT_RESOLUTION)` falls Kollision oder erster Beat, sonst nur `pack_min_increment × BEAT_RESOLUTION` | Kollisionsstack arbeitet mit **Pitch-Range** zwischen `prevPitch..pitch` und Typ-Tags `note`/`line` | Erkennt auch Flowline-Überschneidungen, nicht nur Notenpunkt-Kollisionen |
| **10 Legacy Standard** | wie 0, aber Iteration über `song.beatMaps` statt direkt über `voices` | wie 0 | Reine Legacy-Reproduktion |

### Manuelle Inkremente (`minc`) — Semantik

Konfigurationspfad: `notebound.minc.<time>.minc_f`. `time` ist die Zeitposition
des Beats (`PlayableEntity.time`), `minc_f` ein Multiplikator.

`getMincFactor(time, scale, layoutMinc)` liefert `entry.minc_f * scale` und
wird **innerhalb der Beat-Schleife jeder pack-Methode** auf `increment`
addiert — vor `newbeat += increment`.

**Skala je Pack-Methode:**

| Methode | Skala-Argument | Bemerkung |
|---|---|---|
| 0 / 1 / 3 | `defaultIncrement` | konstant für den Beat |
| 10 | `increment` | bereits inkl. Part-/Measure-Bonus |
| 2 | — | Linear-Layout ignoriert `minc` (Legacy & TS) |

#### Konsequenzen — was `minc` ist und was nicht

- **Wirkt nur in Stufe 1 (BeatPacker).** Spread (Stufe 2) und `beatToY`
  (Stufe 3) sehen `minc` nicht direkt; sie verarbeiten den bereits durch `minc`
  modifizierten Eintrag in der `BeatCompressionMap`.
- **Kein Per-Note-Y-Offset.** `minc` schiebt den **Beat selbst** nach unten —
  damit alle **folgenden** Beats automatisch mit. Eine isolierte Verschiebung
  einer einzelnen Note ohne Verschiebung der Folgenoten ist im aktuellen
  Pipeline-Modell nicht vorgesehen.
- **`minc_f: 1` bedeutet nicht "1 mm".** Das addierte Inkrement steht in der
  internen Beat-Einheit (`BEAT_RESOLUTION × sizeFactor`). Der mm-Effekt ergibt
  sich erst nach Stufe 2 (Spread-Faktor) und Stufe 3 (`Y_SCALE/BEAT_RESOLUTION`).
  Konkret: Bei einem typischen `defaultIncrement ≈ BEAT_RESOLUTION × 0.5` und
  Default-Skala entspricht `minc_f: 1` grob `Y_SCALE × 0.5 ≈ 2 mm` —
  variiert aber je nach Stück (Spread) und Notendauer am Beat (`sizeFactor`).
- **Verhalten ist identisch zwischen TS und Legacy** in allen 5 Pack-Methoden
  (siehe Tabelle oben). Keine Drift.

### Kollisions- und Inversionserkennung (Methoden 1 und 3)

Methode 1 prüft je Note, ob ihr Pitch zuletzt auf einem Beat lag, der näher als
`pack_min_increment` zurückliegt — dann gilt es als Kollision. Zusätzlich gilt
eine Note als "Inversion", wenn `prevPitch ≤ pitch ≤ nextPitch` bzw. die
umgekehrte Monotonie verletzt ist (Melodie-Knick) und die Folge-Note keinen
neuen Part eröffnet.

Methode 3 erweitert das auf den **gesamten Pitch-Bereich zwischen `prevPitch`
und `pitch`**, markiert jeden Eintrag als `note` oder `line` und erkennt damit
auch Kreuzungen mit Flowlines.

---

## Stufe 2 — `applyLegacyBeatSpread()`

In [HarpnotesLayout.ts](../../packages/core/src/HarpnotesLayout.ts) reproduziert
diese Funktion den Legacy-Spread aus `harpnotes.rb`:

```ts
function applyLegacyBeatSpread(
  beatMap: BeatCompressionMap,
  layout: LayoutConfig,
  startpos: number,
): BeatCompressionMap
```

Schritte:

1. `maximalBeat = max(values(beatMap))` — größte gepackte Position.
2. `baseBeatSpacing = Y_SCALE / BEAT_RESOLUTION` (mm pro interner Einheit).
3. `fullBeatSpacing = (DRAWING_AREA_SIZE.height − startpos) / maximalBeat`
   — wieviel mm pro Einheit verfügbar wäre, wenn die Seite vertikal voll
   ausgeschöpft würde.
4. `effectiveBeatSpacing = min(fullBeatSpacing, pack_max_spreadfactor × baseBeatSpacing)`.
5. `factor = effectiveBeatSpacing / baseBeatSpacing`.
6. Ist `factor > 1`, wird die ganze Map mit `factor` multipliziert; sonst
   unverändert zurückgegeben.

Effekt: Kurze Stücke werden vertikal gestreckt, lange Stücke aber **nicht**
weiter komprimiert. Die maximale Streckung ist durch `pack_max_spreadfactor`
gedeckelt.

Der Schritt wird **einmal** auf die gemeinsame Map aller aktiven Stimmen
angewendet, bevor die einzelnen Voices gelayoutet werden.

---

## Stufe 3 — `beatToY()`

Letzte Konvertierung in Millimeter pro einzelner Note/Drawable:

```ts
function beatToY(
  beat: number,
  beatMap: BeatCompressionMap,
  layout: LayoutConfig,
  startpos: number,
): number {
  const compressed = beatMap[beat] ?? beat
  return compressed * (layout.Y_SCALE / layout.BEAT_RESOLUTION) + startpos
}
```

- `startpos` kommt aus `extract.startpos` (Default `15` mm) und ist der obere
  Rand des Notenfelds.
- Der Fallback `?? beat` garantiert eine deterministische Y-Position auch für
  Beats, die nicht in der Map stehen (z. B. unsichtbare Hilfs-Beats).
- Die Multiplikation `Y_SCALE / BEAT_RESOLUTION` ist genau der Punkt, an dem
  die interne Beat-Einheit in Millimeter umgerechnet wird — derselbe Faktor,
  den die Spread-Stufe als `baseBeatSpacing` verwendet.

---

## Integration in `_layoutVoices()`

`_layoutVoices` in [HarpnotesLayout.ts](../../packages/core/src/HarpnotesLayout.ts)
verbindet die drei Stufen:

```
extract.voices ∪ extract.layoutlines (1-basierte Stimmennummern)
        │
        ▼
computeBeatCompression(song, indices, conf)
        │  pack_method aus Confstack
        │  Map<beat, packed_units>
        ▼
applyLegacyBeatSpread(map, layout, startpos)
        │  Y_SCALE, DRAWING_AREA_SIZE, pack_max_spreadfactor
        │  Map<beat, packed_units * spreadFactor>
        ▼
beatMaps.set(voiceNr, map)   // dieselbe Map für jede aktive Stimme
        │
        ▼
_layoutVoice(...)
        │
        ▼
playableCenter → beatToY(beat, map, layout, startpos)  → mm
```

### Wichtige Invarianten

- **Eine gemeinsame Map für alle aktiven Stimmen.** Synchrone Zeitpunkte
  landen damit garantiert auf derselben Y-Koordinate — Voraussetzung für
  korrekte Synchlines zwischen Stimmen.
- **`extract.layoutlines`** definiert, welche Stimmen den Packer **füttern**
  dürfen, ohne selbst gerendert zu werden. So beeinflussen z. B. unsichtbare
  Begleitstimmen die vertikale Verteilung der sichtbaren Stimmen.
- **Stimmennummern sind 1-basiert** in der Konfiguration und werden direkt
  als Indizes in `song.voices` verwendet (Index `0` ist der Legacy-V1-Duplikat,
  siehe Kommentar in `_layoutVoices`).
- **Defaults stammen ausschließlich aus** [initConf.ts](../../packages/core/src/initConf.ts);
  Auflösung läuft über den Confstack, kein lokales Merging.

---

## Verwandte Dokumente

- [docs/phase-3/spec-beatpacker.md](../phase-3/spec-beatpacker.md) — Spec der
  Packer-Implementierung
- [docs/phase-3/spec-layout.md](../phase-3/spec-layout.md) — Spec des
  HarpnotesLayout
- [docs/phase-3/konzept_json_serialisierung.md](../phase-3/konzept_json_serialisierung.md)
  — Sheet-JSON-Schema
