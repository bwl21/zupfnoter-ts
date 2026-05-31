# Vertikale Layout-Pipeline — Abweichungen TS-Port ↔ Legacy

Begleitdokument zu
[vertikales-layout-pipeline.md](vertikales-layout-pipeline.md) (TS) und
[vertikales-layout-pipeline-legacy.md](vertikales-layout-pipeline-legacy.md) (Ruby).

Listet alle Stellen auf, an denen `packages/core/src/BeatPacker.ts` bzw.
`packages/core/src/HarpnotesLayout.ts` vom Verhalten in
`200_zupfnoter/30_sources/SRC_Zupfnoter/src/harpnotes.rb` abweichen.

**Status:** reine Bestandsaufnahme. Kein Code-Change. Soll als
Arbeitsgrundlage für gezielte Angleichung (jeweils mit Fixture-Diff
vorher/nachher) dienen.

Schwere:

- 🔴 ändert berechnete Y-Positionen sichtbar
- 🟡 verändert Verhalten in Randfällen / hängt von AbcToSong-Parität ab
- 🟢 fehlende Funktion oder Diagnose, ohne Effekt auf bestehende Fixtures

---

## 🔴 1. Methode 0 — `isNewPart` hat zusätzliche Quellen

### Legacy

`harpnotes.rb` Zeilen 3070, 3086:

```ruby
is_new_part = notes.select { |n| n.first_in_part? }
...
increment += defaultincrement unless is_new_part.empty?
```

Genau **eine** Bedingung: `n.first_in_part?` (gesetzt in
`abc2svg_to_harpnotes.rb`).

### TS

`packages/core/src/BeatPacker.ts` Zeilen 220–222, 230:

```ts
const hasPartStart = notes.some(n => partStartPlayables.has(n))
const isContinuationAfterPart = breakAfterPart && !hasPartStart
const isNewPart = notes.some(n => n.firstInPart) || hasPartStart || isContinuationAfterPart
...
if (isNewPart) increment += defaultIncrement
```

Drei zusätzliche Quellen, keine davon im Legacy:

1. `partStartPlayables` enthält **NewPart-`companion` und Goto-Targets**
   (siehe `collectPartStartPlayables`, BeatPacker.ts Z. 84–98).
2. `isContinuationAfterPart` — ein **Carry-Over-Flag** `breakAfterPart`,
   das den Folge-Beat nach einem Part-Start ebenfalls als Part-Start markiert.
3. Auch ohne `firstInPart` reicht eines der beiden anderen Kriterien.

### Effekt

Y-Positionen werden bei Goto-Targets, NewPart-Companions oder Beats
unmittelbar nach einem Part-Start zusätzlich um `defaultincrement` nach
unten verschoben. Legacy macht das **nicht**.

### Soll-Verhalten

```ts
const isNewPart = notes.some(n => n.firstInPart)
```

`partStartPlayables` und `breakAfterPart` ersatzlos streichen.

---

## 🔴 2. Methode 3 — `defaultincrement` bei Kollision

### Legacy

`harpnotes.rb` Zeilen 3224–3260:

```ruby
collisions = collision_candidate_keys.map do |k|
  size = @conf_beat_resolution * duration_to_style[duration_to_id(collision_range[k][:note].duration)].first
  collisiontype = "#{collision_stack[k][:kind]}-#{collision_range[k][:kind]}"
  if ["note-note", "note-line", "line-note", "dline-line"].include? collisiontype
    if collision_range[k][:beat] <= collision_stack[k][:beat] + conf_min_increment
      result = collision_range[k]
      result[:inc] = size              # size der KOLLIDIERENDEN Note
    end
  end
  result
end.compact

defaultincrement = conf_min_increment
if collisions[0]
  largest_increment = collisions.sort_by { |i| i[:inc] }.first
  defaultincrement = largest_increment[:inc]
else
  defaultincrement = conf_min_increment
end
```

`defaultincrement` bei Kollision = `:inc` der **kollidierenden** Note (über
`collision_range[k][:note].duration` bestimmt).

Nebenbemerkung: `largest_increment = ... .sort_by { |i| i[:inc] }.first` —
`.first` nach aufsteigendem Sort liefert das **kleinste** `inc`. Trotz
Variablenname: dieser Bug/Feature ist Bestandteil des Legacy-Verhaltens und
muss reproduziert werden.

### TS

`packages/core/src/BeatPacker.ts` Zeilen 441–470:

```ts
const collisions = collisionCandidateKeys
  .map(k => {
    ...
    return { ...rangeEntry, inc: size }
  })
  .filter(...)

const maxDuration = Math.max(...notes.map(n => n.duration))
const sizeFactor = getSizeFactor(maxDuration, durationToStyle)
const sizeIncrement = beatResolution * sizeFactor

let defaultIncrement: number
if (isFirst || collisions.length > 0) {
  defaultIncrement = Math.max(sizeIncrement, confMinIncrement)
} else {
  defaultIncrement = confMinIncrement
}
```

Zwei Abweichungen:

1. `defaultIncrement` bei Kollision verwendet `sizeIncrement` der
   **aktuellen** Note (`maxDuration` der `notes`-Gruppe), nicht der
   kollidierenden Note. Die berechneten `collisions[].inc`-Werte werden
   gar nicht genutzt.
2. `isFirst`-Branch — beim allerersten Beat wird unbedingt
   `max(sizeIncrement, confMinIncrement)` verwendet. Im Legacy gibt es
   diesen Sonderfall nicht; bei beat 0 gilt schlicht der Default
   `conf_min_increment`.

### Effekt

Bei Kollisionen, in denen die aktuelle Note kürzer/länger ist als die
kollidierende, weichen Y-Positionen ab. Erster Beat beginnt im TS schon
mit einer Note-Größe Abstand vom `startpos`, im Legacy mit
`conf_min_increment` (oft 0).

### Soll-Verhalten

`collisions[].inc` durchreichen, dann analog Legacy:

```ts
let defaultIncrement = confMinIncrement
if (collisions.length > 0) {
  const sorted = [...collisions].sort((a, b) => a.inc - b.inc)
  defaultIncrement = sorted[0].inc   // .first nach sort_by
}
// kein isFirst-Branch
```

---

## 🟡 3. Methode 1 — `isNewPart` hat zusätzliche Quelle

### Legacy

`harpnotes.rb` Zeile 3154:

```ruby
is_new_part = notes.select { |n| n.first_in_part? }
```

### TS

`packages/core/src/BeatPacker.ts` Zeile 357:

```ts
const isNewPart = notes.some(n => n.firstInPart || partStartPlayables.has(n))
```

Wie unter (1): `partStartPlayables` enthält Goto-Targets und
NewPart-Companions, die im Legacy nicht in `is_new_part` einfließen.

### Soll-Verhalten

```ts
const isNewPart = notes.some(n => n.firstInPart)
```

---

## 🟡 4. Methode 1 — Inversion: andere Datenquelle für "next is part start"

### Legacy

`harpnotes.rb` Zeile 3148:

```ruby
result = false if note.next_first_in_part   # ignoriere Cross-Part-Inversionen
```

`next_first_in_part` ist ein **persistentes Attribut**, gesetzt in
`abc2svg_to_harpnotes.rb` Zeile 903:

```ruby
@previous_note.next_first_in_part = true if part_label
```

Also: gesetzt **genau dann, wenn die Folge-Note ein `part_label`** trägt
(ABC-Construct `[P:...]`).

### TS

`packages/core/src/BeatPacker.ts` Zeilen 353–354:

```ts
const nextStartsPart = note.nextPlayable
  ? namedPartStartPlayables.has(note.nextPlayable)
  : false
```

`namedPartStartPlayables` enthält die NewPart-`companion`-Noten (also Noten,
auf die ein `NewPart`-Eintrag in der Voice zeigt — siehe
`collectNamedPartStartPlayables`, Z. 100–112).

### Bewertung

Beide Mechanismen meinen "die nächste Note startet einen benannten Part".
Sie fallen nur dann auseinander, wenn `AbcToSong` `NewPart` setzt, ohne
dass die Quelle ein `part_label` hatte (oder umgekehrt). In den
existierenden Fixtures liegen die Fälle vermutlich gleichauf, sollte aber
verifiziert werden.

### Soll-Verhalten

Eigenes Attribut `nextFirstInPart` im `Playable`-Typ, gesetzt in
`AbcToSong` an exakt der Stelle, an der Legacy es setzt — dann
`note.nextFirstInPart` direkt im Packer verwenden, kein Set-Lookup.

---

## 🟡 5. Methode 1 — doppelte Pitch-Quelle

### Legacy

`harpnotes.rb` Zeile 3145:

```ruby
a = [note.prev_pitch || note.pitch, note.pitch, note.next_pitch || note.pitch]
```

Eine Quelle: `note.prev_pitch` / `note.next_pitch`.

### TS

`packages/core/src/BeatPacker.ts` Zeilen 343–344:

```ts
const prev = note.prevPlayable?.pitch ?? note.prevPitch ?? note.pitch
const next = note.nextPlayable?.pitch ?? note.nextPitch ?? note.pitch
```

Erst `nextPlayable.pitch`, dann Fallback auf `nextPitch`. Solange beide
Felder konsistent von `AbcToSong` befüllt werden, identisch — sind sie das
nicht (z. B. SynchPoints, unsichtbare Stimmen), weicht das Ergebnis ab.

### Soll-Verhalten

Quelle vereinheitlichen — entweder ausschließlich `prevPitch`/`nextPitch`
verwenden (wie Legacy) oder dokumentieren, warum die Doppelung gewollt
ist. Das hängt direkt mit den Referenzfeldern aus AGENTS.md zusammen
(*"@next_playable/@prev_playable in TS bewusst nicht als persistente
Felder"*) — der Punkt ist, dass `prevPitch`/`nextPitch` vom Legacy gefüllt
werden und die einzige Quelle sind.

---

## 🟢 6. Stufe 2 — fehlende Log-Warnung beim Spread

### Legacy

`harpnotes.rb` Zeilen 2602–2604:

```ruby
if full_beat_spacing < @beat_spacing
  factor = (@beat_spacing / full_beat_spacing)
  $log.warning("note distance too small (factor #{factor})")
end
```

Diagnose-Output, wenn das Stück so lang ist, dass die Optimal-Skala nicht
mehr passt und komprimiert werden muss.

### TS

`packages/core/src/HarpnotesLayout.ts` Zeilen 67–84 (`applyLegacyBeatSpread`)
— keine entsprechende Warnung.

### Soll-Verhalten

`console.warn(...)` oder ein Logger-Hook in `applyLegacyBeatSpread`
auslösen, wenn `fullBeatSpacing < baseBeatSpacing`. Kein Effekt auf
Y-Positionen.

---

## 🟢 7. `layout.bottomup` fehlt komplett

### Legacy

`harpnotes.rb` Zeilen 2610–2622:

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
```

`layout.bottomup` invertiert die Y-Achse: Beat 0 oben → Beat 0 unten.

### TS

`packages/core/src/HarpnotesLayout.ts` `beatToY` (Zeilen 62–65) — nur
topdown.

### Bewertung

Wird in den aktuellen Fixtures vermutlich nicht getriggert (Default-Config
hat `bottomup: false`). Trotzdem fehlt das Feature.

### Soll-Verhalten

`beatToY` und `applyLegacyBeatSpread` um `bottomup`-Branch erweitern;
braucht zusätzlich `@y_size` (= `DRAWING_AREA_SIZE[1]`) als Eingabe.

---

## ✅ 8. Methode 10 — `get_minc_factor`-Skala (KEIN Bug)

Ursprünglich als Abweichung notiert; ist aber konform.

### Legacy

`harpnotes.rb` Zeile 3005:

```ruby
increment += get_minc_factor(notes_on_beat.first.time, increment)
```

### TS

`packages/core/src/BeatPacker.ts` Zeile 290:

```ts
increment += getMincFactor(
  requireDefined(notesOnBeat[0], '...').time,
  increment,
  layoutMinc,
)
```

Beide übergeben `increment` (nicht `defaultIncrement`). ✓ Übereinstimmung.

---

## Übersicht

| # | Schwere | Bereich | Kurzbeschreibung | Effekt |
|---|---------|---------|------------------|--------|
| 1 | 🔴 | Packer Methode 0 | `isNewPart` mit Goto/Companion/Carry-Over | Y-Versatz bei Goto-Targets, Folge-Beats |
| 2 | 🔴 | Packer Methode 3 | `defaultIncrement` aus aktueller statt kollidierender Note + `isFirst`-Branch | Y-Versatz bei Kollisionen und am Sheet-Anfang |
| 3 | 🟡 | Packer Methode 1 | `isNewPart` mit Goto/Companion | Y-Versatz an Goto-Targets |
| 4 | 🟡 | Packer Methode 1 | Inversion: `namedPartStartPlayables` statt `next_first_in_part`-Attribut | hängt von AbcToSong-Parität ab |
| 5 | 🟡 | Packer Methode 1 | Doppelte Pitch-Quelle `prevPlayable.pitch` ?? `prevPitch` | nur Effekt, wenn beide Felder divergieren |
| 6 | 🟢 | Spread (Stufe 2) | fehlende Log-Warnung | Diagnose, nichts am Output |
| 7 | 🟢 | `beatToY` / Spread | `layout.bottomup` fehlt | Feature-Lücke, derzeit nicht aktiv |

---

## Vorgeschlagenes Vorgehen für die Korrektur

1. Pro Punkt einen separaten Commit (kleine, isolierte Änderungen).
2. Reihenfolge: erst 🔴 (1, 2), dann 🟡 (3, 4, 5), zuletzt 🟢 (6, 7).
3. Vor jeder Korrektur: `pnpm test` ausführen, Fixture-Diff in
   `fixtures/reports/gap-report.md` festhalten (Snapshot vor → Snapshot nach).
4. Punkt 4 (Inversion-Datenquelle) erfordert eine Änderung in
   `@zupfnoter/types` (`Playable.nextFirstInPart`) und in `AbcToSong` —
   Reihenfolge: erst Typ, dann AbcToSong, dann Packer.
5. Punkt 7 (`bottomup`) erfordert zusätzlich `@y_size`-Äquivalent in der
   `beatToY`-Signatur — separater Schritt nach den Korrekturen.

---

## Aufwandsabschätzung

Grobe Schätzung in **Tool-Roundtrips** und **Amp-Credits ($)** pro Punkt.
Ein Roundtrip umfasst typischerweise 2–6 Tool-Calls (Lesen, Edit, Test,
Fixture-Diff prüfen, ggf. Snapshot-Update) und kostet bei dieser Art Arbeit
erfahrungsgemäß **~$0.10–$0.50**, je nach Token-Volumen der gelesenen
Fixtures. Eine exakte Zahl lässt sich nicht angeben, da der größte
Kostentreiber die **Fixture-Diff-Untersuchungen** sind — die hängen davon ab,
wie viele bestehende Snapshots durch die jeweilige Änderung kippen.

| # | Schwere | Roundtrips | Schätzung ($) | Hauptkosten |
|---|---------|------------|---------------|-------------|
| 1 | 🔴 Methode 0 | ~6–10 | $1–$5 | Fixture-Snapshots können breit kippen → Diff-Analyse |
| 2 | 🔴 Methode 3 | ~8–14 | $2–$7 | Collision-Logik umbauen + Fixture-Diff in mehreren Cases |
| 3 | 🟡 Methode 1 isNewPart | ~3–5 | $0.50–$2 | kleine Änderung, evtl. wenig Snapshot-Impact |
| 4 | 🟡 Inversion-Quelle | ~10–18 | $3–$9 | **cross-package**: Types + AbcToSong + Tests + Packer; Legacy-`part_label`-Trigger nachvollziehen |
| 5 | 🟡 Pitch-Quelle | ~3–5 | $0.50–$2 | klein, AbcToSong-Konsistenz prüfen |
| 6 | 🟢 Log-Warnung | ~2–3 | $0.20–$1 | trivial |
| 7 | 🟢 `bottomup` | ~6–10 | $1–$5 | `LayoutConfig`, `beatToY`-Signatur, `applyLegacyBeatSpread`-Branch + Test |

**Summe: ~38–65 Roundtrips, geschätzt $8–$30** für 1–7 zusammen, mit
deutlicher Streuung nach oben falls Punkt 2 oder 4 breite Fixture-Anpassungen
auslösen. Im Worst Case (viele Snapshots kippen, mehrfache Iteration zur
Stabilisierung) sind **$50+** möglich.

### Kostenrisiken

- **Punkt 4** ist der teuerste Einzelpunkt — Änderung in `@zupfnoter/types` +
  `AbcToSong` + Verifikation, dass das gesetzte Attribut die Legacy-`part_label`-
  Semantik exakt trifft.
- **Punkt 2** kann Snapshot-Updates in vielen Fixtures auslösen, jeder will
  einzeln verifiziert sein (sonst maskieren wir andere Bugs).
- **Punkt 1** kann ähnlich breit wirken, ist aber konzeptionell einfacher.

### Empfehlungen zur Kostenkontrolle

1. **Pro Punkt ein eigener Thread/Handoff** statt alles in einem. Hält Kontext
   klein, Diffs nachvollziehbar, und nach jedem Punkt kann entschieden werden,
   ob weitergemacht wird.
2. **Reihenfolge 6 → 3 → 5 → 1 → 7 → 2 → 4** statt strikt nach Schwere — beginnt
   mit den billigen, sicheren Punkten. Nach den ersten ~3 Punkten ist die
   Snapshot-Stabilität bekannt.
3. **Zwischenschritt nach Punkt 1**: erst evaluieren, wie viele Snapshots
   gekippt sind, bevor Punkt 2 startet.
4. Punkt 6 (Log-Warnung) als billigster Probelauf liefert einen ersten
   Datenpunkt für die echten Kosten.

---

## Strategische Optionen: Sanieren vs. Neu portieren

Beim Umsetzen der Korrekturen gibt es drei realistische Strategien.

### A) Sanieren (chirurgische Fixes der 7 Punkte) — $8–$30

- Jeder Fix isoliert und einzeln gegen Fixtures verifizierbar.
- Kleine Diffs, leicht reviewbar.
- **Risiko:** Die Audit-Liste der 7 Punkte ist nicht garantiert vollständig.
  Subtile Edge-Cases (Tuplet-Behandlung, `dline-line`-Kollisionstyp,
  `prev_pitch`-Initialisierung an Voice-Anfängen) könnten übersehen worden sein.

### B) Komplette Neu-Portierung von BeatPacker + Spread — $20–$50

- Zeile-für-Zeile Ruby → TS aus `compute_beat_compression_0/1/2/3/10` und
  dem Spread-Block in `_layout_voices`.
- **Vorteil:** Keine offenen Audit-Lücken — Korrektheit ergibt sich aus
  1:1-Übersetzung.
- **Vorteil:** Geringere kognitive Last — kein "warum war hier diese
  Abweichung", einfach Legacy.
- **Nachteil:** Snapshot-Kippung trifft trotzdem alle Fixtures, weil die
  Punkte 1+2 (🔴) genau das verursachen.
- **Nachteil:** Risiko, neue Übersetzungsfehler einzuführen — vor allem bei
  Ruby-Idiomen wie `sort_by{...}.first` (kleinster Wert, trotz Variablenname
  `largest_increment`) oder Hash-Iterations-Reihenfolge.

### C) Hybrid (Empfehlung) — $12–$35

Ports der Methoden, die wirklich abweichen, plus chirurgische Patches für
den Rest.

| Schritt | Aktion | Kosten |
|---------|--------|--------|
| 1 | **Punkt 6** (Log-Warning) als Probelauf — kalibriert echte Kosten | $0.20–$1 |
| 2 | **Methode 0 neu portieren** (statt Punkt 1 zu fixen) — klarer als chirurgischer Fix | $3–$8 |
| 3 | **Methode 3 neu portieren** (statt Punkt 2 zu fixen) | $4–$10 |
| 4 | **Methode 1 neu portieren oder fixen** — entscheiden nach Schritt 2+3 | $3–$6 |
| 5 | **Punkt 4** (`nextFirstInPart`-Attribut) als cross-package-Schritt | $3–$9 |
| 6 | **Punkt 7** (`bottomup`) als letzter Schritt | $1–$5 |

Methode 2 (Linear) und Methode 10 (Legacy Standard) bleiben unverändert —
laufen schon konform. Punkt 5 (Pitch-Quelle) wird durch den Methode-1-Rewrite
miterledigt.

### Wichtige Faktoren — egal welche Option

1. **Fixture-Kosten dominieren.** Sowohl Sanieren als auch Rewrite müssen
   jeden gekippten Snapshot einzeln gegen das Legacy-Gold validieren. Die
   Code-Änderung ist der billige Teil.
2. **Die 7-Punkte-Audit-Liste ist eine Investition, die schon getätigt
   wurde** — alle drei Optionen profitieren davon. Bei Option B (voller
   Rewrite) wird sie weniger genutzt, ist aber als Test-Checklist trotzdem
   wertvoll.
3. **Bei Rewrite/Hybrid Ruby-Edge-Cases bewusst übersetzen.** Beispiele aus
   dem Legacy-Code, die der aktuelle TS-Port teils richtig hat (also nicht
   verlieren!):
   - `relevant_notes.push(relevant_sp).flatten` (push mit Array → flatten =
     SynchPoint-Note doppelt drin: einmal als SP-Wrapper, einmal als Inhalt)
   - `Range.new(*[a, b].sort).each` mit `result.delete(note.prev_pitch) unless
     note.pitch == note.prev_pitch` — die Reihenfolge ist wichtig
   - `notes.first.time` bei leerem `notes` → Ruby gibt `nil`, TS muss explizit
     prüfen (siehe `requireDefined`-Pattern)
4. **Snapshots sind Legacy-Gold.** Die Fixtures unter `fixtures/cases/*/sheet.extract-*.json`
   sind die Legacy-Referenz. Tests in
   `packages/core/src/testing/__tests__/sheet/legacy_comparison.spec.ts`
   validieren TS-Output dagegen. Beide Strategien müssen am Ende gegen diese
   Goldstandards bestehen — egal wie der Weg dorthin aussieht.

---

## Verwandte Dokumente

- [vertikales-layout-pipeline.md](vertikales-layout-pipeline.md) — TS-Pipeline
- [vertikales-layout-pipeline-legacy.md](vertikales-layout-pipeline-legacy.md) — Legacy-Pipeline
- [docs/phase-3/spec-beatpacker.md](../phase-3/spec-beatpacker.md) — TS-Packer-Spec
- [docs/phase-3/spec-layout.md](../phase-3/spec-layout.md) — TS-Layout-Spec
- [fixtures/reports/gap-report.md](../../fixtures/reports/gap-report.md) — bestehende Fixture-Diffs
