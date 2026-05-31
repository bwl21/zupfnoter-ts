# Vertikale Layout-Pipeline (Legacy / Ruby) — Beat → Y-Position in mm

Beschreibt, wie das **Legacy-Zupfnoter** (Ruby/Opal,
`bwl21/zupfnoter` Repo, `harpnotes.rb`) eine musikalische Beat-Position in
eine vertikale Pixel-/Millimeterposition auf dem Notenblatt übersetzt.

Dieses Dokument ist das Pendant zu
[vertikales-layout-pipeline.md](vertikales-layout-pipeline.md) (TypeScript-Port)
und dient als Referenz dafür, was im neuen System zu reproduzieren ist.

Quelldatei: `200_zupfnoter/30_sources/SRC_Zupfnoter/src/harpnotes.rb`,
Modul `Harpnotes::Layout`, Klasse `Default` (ab Zeile 1305).

Die horizontale Achse (`pitch → x`) wird hier **nicht** behandelt; sie wird im
Legacy über `@pitch_to_xpos = lambda { |pitch| (pitchoffset + pitch) * xspacing + xoffset }`
in `set_instrument_handlers` (ab Zeile 1430) gesetzt und ist unabhängig vom
Packer.

---

## Überblick

Die vertikale Position einer Note wird in **drei Stufen** berechnet, vollständig
über die globale `$conf` (Confstack) konfiguriert:

```
╭───────────────────────╮     ╭──────────────────────╮     ╭──────────────────────╮     ╭───────────────────────╮
│ music.voices /        │────▶│ compute_beat_        │────▶│ _layout_voices       │────▶│ compressed_beat_      │
│ music.beat_maps       │     │ compression          │     │ Spread:              │     │ layout_proc.call(beat)│
│ (musikalische Beats)  │     │ pack_method 0/1/2/3/ │     │ @beat_spacing-Update │     │ → mm                  │
│                       │     │ 10                   │     │ via DRAWING_AREA +   │     │                       │
│                       │     │                      │     │ pack_max_spreadfactor│     │                       │
╰───────────────────────╯     ╰──────────────────────╯     ╰──────────────────────╯     ╰───────────────────────╯
```

| Stufe | Eingabe | Ausgabe | Einheit |
|-------|---------|---------|---------|
| 1 — `compute_beat_compression` | `music`, `layout_lines`, `$conf` | `beat_compression_map` (Hash) | interne Beat-Einheit (`@conf_beat_resolution × sizeFactor`) |
| 2 — Spread in `_layout_voices` | Map, `@y_offset`, `$conf` | aktualisiertes `@beat_spacing` | mm pro interne Einheit |
| 3 — `compressed_beat_layout_proc` | `beat`, Map, `@beat_spacing`, `@y_offset` | `y` | mm |

---

## Stufe 1 — `compute_beat_compression()`

Dispatcher in `harpnotes.rb` ab Zeile 2933:

```ruby
def compute_beat_compression(music, layout_lines)
  result = compute_beat_compression_1(music, layout_lines)  if $conf.get('layout.packer.pack_method') == 1
  result = compute_beat_compression_2(music, layout_lines)  if $conf.get('layout.packer.pack_method') == 2
  result = compute_beat_compression_3(music, layout_lines)  if $conf.get('layout.packer.pack_method') == 3
  result = compute_beat_compression_10(music, layout_lines) if $conf.get('layout.packer.pack_method') == 10
  result = compute_beat_compression_0(music, layout_lines)  if ($conf.get('layout.packer.pack_method') || 0) == 0
  result
end
```

Übergeben wird `layout_lines` aus `_layout_voices`:

```ruby
layoutlines = (@print_options_hash[:voices] + @print_options_hash[:layoutlines]).uniq
```

Also die Vereinigung aus den **gerenderten** Stimmen (`extract.<n>.voices`)
und den nur **layout-relevanten** Stimmen (`extract.<n>.layoutlines`). Im
Legacy sind das **0-basierte Indizes** in `music.voices`.

### Gemeinsamer Aufbau aller pack-Methoden

```ruby
relevant_notes = layout_lines
  .map { |voice_id| music.voices[voice_id] }
  .inject([]) { |result, voice| result.push(voice) }
  .flatten
  .select { |note| note.is_a? Harpnotes::Music::Playable }

relevant_sp    = relevant_notes
  .select { |note| note.is_a? Harpnotes::Music::SynchPoint }
  .map { |sp| sp.notes }

relevant_notes = relevant_notes.push(relevant_sp).flatten
relevant_beats = relevant_notes.group_by { |playable| playable.beat }
```

Pro Beat (sortiert) wird ein **Inkrement** berechnet und auf den laufenden
`newbeat` aufaddiert. Ergebnis: `compression_map = { beat => vertical_position_indicator }`.
Der Wert ist **noch nicht in mm**, sondern in der internen Einheit
`@conf_beat_resolution × sizeFactor`. Skaliert wird erst durch `@beat_spacing`
in Stufe 3. Genau das beschreibt der Doc-Kommentar oberhalb von
`compute_beat_compression_0`:

> *vertical_position_indicator scales like beats but can be fractions; they
> need to be scaled to the absolute position on the sheet later. This scaling
> cannot be done here since it depends on the relative radii of the music on
> the sheet.*

### Konfigurations-Zugriffe (alle pack-Methoden)

| Pfad | Default | Bedeutung |
|------|---------|-----------|
| `layout.packer.pack_method` | `0` | Auswahl der Strategie |
| `layout.DURATION_TO_STYLE` | `init_conf.rb` | `[sizeFactor, fill, dotted]` pro Notendauer |
| `layout.BEAT_RESOLUTION` | `192` | gespeichert in `@conf_beat_resolution` (im `initialize`) |
| `layout.packer.pack_min_increment` | `0` | × `@conf_beat_resolution` → `conf_min_increment` |
| `notebound.minc` | `{}` | gelesen in `_layout_prepare_options` als `@layout_minc`; pro Zeitposition `minc_f` als zusätzlicher Faktor |

`get_minc_factor(time, increment)` (Zeile 3016) liest `@layout_minc[time.to_s][:minc_f]`
und multipliziert mit `increment`.

> **Hinweis zur `minc`-Semantik:** Die ausführliche Erklärung
> (wirkt nur in Stufe 1, kein Per-Note-Offset, mm-Effekt skaliert mit
> Spread und `Y_SCALE/BEAT_RESOLUTION`, Methode 2 ignoriert `minc`) steht
> einmal zentral im TS-Doku unter
> [vertikales-layout-pipeline.md → Manuelle Inkremente (`minc`) — Semantik](vertikales-layout-pipeline.md#manuelle-inkremente-minc--semantik).
> Verhalten ist zwischen Legacy und TS in allen 5 Pack-Methoden identisch.

### Pack-Methoden im Vergleich

| Methode | Default-Increment | Sonderfälle | Zweck |
|---|---|---|---|
| **0 Standard** (`compute_beat_compression_0`, Z. 3045) | `(size + last_size) / 2` mit `size = @conf_beat_resolution * duration_to_style[duration_to_id(max_duration_on_beat)].first` | `+ defaultincrement` bei `first_in_part?`, `+ /4` bei `measure_start?`, `+ get_minc_factor(...)` | Notengrößen-bewusste Default-Kompression |
| **1 Collision** (`compute_beat_compression_1`, Z. 3101) | `nextincrement` (Carry vom Vor-Beat); nach Auswertung `nextincrement = conf_min_increment` | Pitch-Kollision (`collision_stack[note.pitch] >= newbeat - conf_min_increment`) → voller `defaultincrement`; "Inversion" (Linie nicht monoton, ignoriert wenn `next_first_in_part`) → `nextincrement = defaultincrement / 2`; Part `+= defaultincrement` (resettet `nextincrement`); `+ /4` bei measure_start | Vermeidet Überlappung gleicher Pitches und scharfe Linienknicke |
| **2 Linear** (`compute_beat_compression_2`, Z. 2943) | `compression_map[beat] = beat * 8` | — | Reines Debug-/Referenz-Layout |
| **3 Collision v2** (`compute_beat_compression_3`, Z. 3188) | bei Kollision: `largest_increment[:inc] = @conf_beat_resolution * sizeFactor(note.duration)`; sonst `conf_min_increment` | Kollisionsstack arbeitet mit **Pitch-Range** zwischen `prev_pitch..pitch`; `prev_pitch` wird wieder gelöscht (`result.delete(note.prev_pitch)`); Typ-Tags `:note` / `:line`, gültige Kollisionstypen `note-note, note-line, line-note, dline-line`; Part `+= defaultincrement`, `+ /4` bei measure_start | Erkennt auch Flowline-Kreuzungen, nicht nur Notenpunkt-Kollisionen |
| **10 Legacy Standard** (`compute_beat_compression_10`, Z. 2962) | wie 0, aber Iteration über `music.beat_maps` statt direkt über `voices`; `relevant_keys = music.beat_maps.flatten.uniq.sort` | `+ /4` bei measure_start, `+ increment` (statt `+ defaultincrement`) bei Part; `+ get_minc_factor(time, increment)` mit dem **gerade berechneten `increment`** statt mit `defaultincrement` | Älteste Variante, vor Refactoring auf direkte Voice-Iteration |

Wichtige Detail-Unterschiede zum TS-Port:

- Methode 10 nutzt `get_minc_factor(time, increment)` mit dem **aktuellen
  Increment** als Skala, nicht mit `defaultincrement` wie Methoden 0/1/3.
- Methode 1 hat einen **Carry-Mechanismus** (`nextincrement`) — der
  berechnete halbe Increment bei "Inversion" wird auf den **nächsten** Beat
  übertragen.
- Methode 3 setzt `defaultincrement` bei Kollision auf `largest_increment[:inc]`,
  also auf die Notengröße des **kollidierenden** Beats, nicht des aktuellen
  (`collisions.sort_by { |i| i[:inc] }.first`).

### Kollisions- und Inversionserkennung

Methode 1:

```ruby
collisions = notes.select do |note|
  ((collision_stack[note.pitch] || -1) >= newbeat - conf_min_increment)
end

inversions = notes.select do |note|
  a      = [note.prev_pitch || note.pitch, note.pitch, note.next_pitch || note.pitch]
  result = !((a.sort.reverse == a) or (a.sort == a))
  result = false if note.next_first_in_part   # ignoriere Part-übergreifende Inversionen
  result
end
```

Methode 3 erweitert das auf den **gesamten Pitch-Bereich** zwischen
`prev_pitch` und `pitch`, jeweils mit Tag `:note` (= Notenkopf-Position) oder
`:line` (= dazwischenliegende Flowline):

```ruby
collision_range = notes.inject({}) do |result, note|
  Range.new(*[note.prev_pitch, note.pitch].sort).each do |pitch|
    result[pitch] = {beat: newbeat, note: note, pitch: pitch,
                     kind: note.pitch == pitch ? :note : :line}
  end
  result.delete(note.prev_pitch) unless note.pitch == note.prev_pitch
  result
end
```

`prev_pitch` und `next_pitch` werden im Legacy als **persistente Felder** auf
jeder `MusicEntity` gehalten (`@next_playable`/`@prev_playable`-Verkettung pro
Stimme, `harpnotes.rb`). Der TS-Port hat die Felder direkt am `Playable`,
gefüllt durch `AbcToSong`.

---

## Stufe 2 — Spread in `_layout_voices()`

Im Legacy gibt es **keine separate Funktion** wie `applyLegacyBeatSpread`.
Der Spread passiert **inline** in `_layout_voices` (`harpnotes.rb`, Z. 2593–2625):

```ruby
def _layout_voices(beat_layout, music, print_variant_nr)
  beat_compression_map = nil
  $log.benchmark("compute beat compression map") do
    layoutlines          = (@print_options_hash[:voices] + @print_options_hash[:layoutlines]).uniq
    beat_compression_map = compute_beat_compression(music, layoutlines)
  end

  maximal_beat      = beat_compression_map.values.max || 0
  full_beat_spacing = ($conf.get('layout.DRAWING_AREA_SIZE').last - @y_offset) / maximal_beat

  if full_beat_spacing < @beat_spacing
    factor = (@beat_spacing / full_beat_spacing)
    $log.warning("note distance too small (factor #{factor})")
  end

  @beat_spacing = [
    full_beat_spacing,
    $conf.get('layout.packer.pack_max_spreadfactor') * @beat_spacing
  ].min  # limit beat spacing to twice of optimal spacing
  ...
end
```

`@beat_spacing` ist im `initialize` (Z. 1407–1422) initial gesetzt auf:

```ruby
@beat_spacing = $conf.get('layout.Y_SCALE') * 1.0 / $conf.get('layout.BEAT_RESOLUTION')
```

Das ist die **Optimal-Skala** (mm pro interne Einheit), die der TS-Port als
`baseBeatSpacing` bezeichnet.

Schritte des Spread:

1. `maximal_beat = beat_compression_map.values.max` — größte gepackte Position.
2. `full_beat_spacing = (DRAWING_AREA_SIZE.last − @y_offset) / maximal_beat`
   — wieviel mm pro Einheit verfügbar wäre, wenn die Seite vertikal voll
   ausgeschöpft würde. `DRAWING_AREA_SIZE.last` ist die Höhe (zweiter Wert,
   z. B. `[400, 282]`).
3. **Warnung** in den Log, falls die optimale Skala größer ist als das, was die
   Seite hergibt (`full_beat_spacing < @beat_spacing`). Das Layout wird dann
   trotzdem produziert, aber Noten stehen enger als optimal.
4. `@beat_spacing = min(full_beat_spacing, pack_max_spreadfactor × @beat_spacing)`
   — die finale mm-pro-Einheit-Skala für diese Seite. Effekt:
   - Lange Stücke: `full_beat_spacing < pack_max_spreadfactor × @beat_spacing`
     → `@beat_spacing` wird **kleiner** als die Optimal-Skala (komprimiert).
   - Kurze Stücke: `full_beat_spacing > pack_max_spreadfactor × @beat_spacing`
     → `@beat_spacing` wird auf das gedeckelte Maximum gesetzt (vertikal
     gestreckt, aber nicht mehr als `pack_max_spreadfactor`-fach).

Nach diesem Schritt ist `@beat_spacing` der **finale mm-pro-Einheit-Faktor**
für diese Extrakt-Variante.

### Unterschied zum TS-Port

Im TS-Port wird der Faktor **direkt auf die Map** angewendet
(`applyLegacyBeatSpread` multipliziert die Werte) und `Y_SCALE / BEAT_RESOLUTION`
bleibt der Umrechner in `beatToY`. Im Legacy bleibt die Map unverändert; statt
dessen wird `@beat_spacing` selbst aktualisiert.

Mathematisch ist das äquivalent:

```
Legacy:  y = compression_map[beat] * @beat_spacing + @y_offset
                                     ^^^^^^^^^^^^^
                                     enthält schon den Spread-Faktor

TS:      y = (compression_map[beat] * spread_factor) * (Y_SCALE / BEAT_RESOLUTION) + startpos
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                ^^^^^^^^^^^^^^^^^^^^^^^^^
              spread auf der Map angewendet                        baseBeatSpacing unverändert
```

---

## Stufe 3 — `compressed_beat_layout_proc`

Im Anschluss an den Spread wird in `_layout_voices` (Z. 2610–2625) ein **Lambda**
gebaut, das pro Beat die mm-Position liefert:

```ruby
unless $conf.get('layout.bottomup')
  beat_layout = beat_layout || Proc.new do |beat|
    r = %x{#{beat} * #{@beat_spacing} + #{@y_offset}}
  end
else
  beat_layout = beat_layout || Proc.new do |beat|
    r = %x{#{@y_size} - #{beat} * #{@beat_spacing}}
  end
end

compressed_beat_layout_proc = Proc.new { |beat| beat_layout.call(beat_compression_map[beat]) }
```

Der `%x{...}`-Block ist Opal-Inline-JavaScript (= `beat * @beat_spacing + @y_offset`
in JS, schneller als die Ruby-Variante).

`compressed_beat_layout_proc` wird dann an `layout_voice` übergeben (Z. 2650)
und ist die einzige Schnittstelle, mit der die Voice-Layout-Methoden Y-Koordinaten
berechnen — das Pendant zu `beatToY` im TS-Port.

`@y_offset` kommt aus `@print_options_hash[:startpos]` (gesetzt in
`_layout_prepare_options`, Z. 2692), `@y_size` aus
`$conf.get('layout.DRAWING_AREA_SIZE').last` (Z. 2693).

### Bottomup-Modus

Der Legacy hat einen `layout.bottomup`-Schalter, der die Y-Achse spiegelt:
Beat 0 erscheint dann **unten** auf der Seite. Diese Option **fehlt im
TS-Port**; alle TS-Layouts sind topdown.

---

## Integration: `layout` und `_layout_prepare_options`

Die Reihenfolge der Aufrufe in `Default#layout` (`harpnotes.rb` ab Z. 1542):

```
layout(music, beat_layout, print_variant_nr, page_format)
  └── _layout_prepare_options(print_variant_nr)
        ├── @print_options_raw  = get_print_options(...)        # Konfig-Stack pushen
        ├── @print_options_hash = @print_options_raw.get
        ├── $conf.push({layout: ...}); $conf.push({printer: ...})
        ├── initialize                                          # @beat_spacing aus Y_SCALE/BEAT_RESOLUTION
        ├── @layout_minc = @print_options_raw['notebound.minc']
        ├── @y_offset    = @print_options_hash[:startpos]
        ├── @y_size      = $conf.get('layout.DRAWING_AREA_SIZE').last
        └── set_instrument_handlers                             # @pitch_to_xpos lambda
  └── _layout_voices(beat_layout, music, print_variant_nr)
        ├── compute_beat_compression(music, layoutlines)        # Stufe 1
        ├── @beat_spacing = min(full_beat_spacing,              # Stufe 2 (Spread)
        │                       pack_max_spreadfactor * @beat_spacing)
        ├── compressed_beat_layout_proc = Proc.new { |b|        # Stufe 3 (Lambda)
        │     beat_layout.call(beat_compression_map[b])
        │   }
        └── music.voices.each_with_index.map { |v, idx|         # für jede aktive Stimme:
              layout_voice(v, compressed_beat_layout_proc, ...) #   gemeinsame Map verwenden
            }
```

### Wichtige Invarianten

- **Eine gemeinsame `beat_compression_map` für alle aktiven Stimmen.**
  Synchrone Zeitpunkte landen damit garantiert auf derselben Y-Koordinate
  — Voraussetzung für korrekte Synchlines zwischen Stimmen.
- **`extract.<n>.layoutlines`** definiert, welche Stimmen den Packer **füttern**
  dürfen, ohne selbst gerendert zu werden. So beeinflussen z. B. unsichtbare
  Begleitstimmen die vertikale Verteilung der sichtbaren Stimmen.
- **Stimmennummern sind 0-basiert** in `music.voices`. Die externe
  Konfiguration (`extract.<n>.voices`) verwendet ebenfalls 0-basierte Indizes
  — anders als im TS-Port, wo extern 1-basiert ist und intern in
  `song.voices[voiceNr]` (Index 0 ist Legacy-V1-Duplikat) zugegriffen wird.
- **Defaults stammen aus** `init_conf.rb`; Auflösung läuft ausschließlich über
  den globalen `$conf` (`Confstack`). Push/Pop in `_layout_prepare_options`
  sorgt für die Print-Variant-spezifischen Overrides.
- **`@beat_spacing` wird in `initialize` zurückgesetzt**, daher ruft `layout`
  bei jeder Print-Variante neu `initialize` (Kommentar oberhalb der Methode:
  *"note that initiallize is called in method layout once more in order to get
  the correct configuration values"*).

---

## Verwandte Dokumente

- [vertikales-layout-pipeline.md](vertikales-layout-pipeline.md) —
  Pendant für den TypeScript-Port
- [docs/phase-3/spec-beatpacker.md](../phase-3/spec-beatpacker.md) — Spec der
  TS-Packer-Implementierung
- [docs/phase-3/spec-layout.md](../phase-3/spec-layout.md) — Spec des
  TS-HarpnotesLayout
- Legacy-Quellcode: `200_zupfnoter/30_sources/SRC_Zupfnoter/src/harpnotes.rb`
  (`Harpnotes::Layout::Default` ab Z. 1310, Pack-Methoden ab Z. 2933)
- Legacy-Defaults: `200_zupfnoter/30_sources/SRC_Zupfnoter/src/init_conf.rb`
