# Zupfnoter TS – Fixture-Driven Song Parity Strategy (Extended)

## Ausgangspunkt

Die bestehende Teststrategie ist fixture-driven und versioniert Legacy-Referenzen unter:

```text
fixtures/cases/<test-case>/
  input.abc
  song.legacy-raw.json
  sheet.extract-<nr>.json
  output.extract-<nr>.svg
  _ts_output/
    song.json
    sheet.extract-<nr>.json
    output.extract-<nr>.svg
```

Die TypeScript-Ausgabe wird bei Testläufen neu erzeugt und unter `_ts_output/` abgelegt.

Die vorhandenen Vergleichsstufen sind:

```text
ABC-Datei + Config
    ↓
[Stufe 1: AbcParser]
    ↓
[Stufe 2: AbcToSong]      → song.legacy-raw.json vs _ts_output/song.json
    ↓
[Stufe 3: HarpnotesLayout]→ sheet.extract-N.json vs _ts_output/sheet.extract-N.json
    ↓
[Stufe 4: SvgEngine]      → output.extract-N.svg vs _ts_output/output.extract-N.svg
```

Wichtig: Diese vorhandene Struktur soll nicht ersetzt werden.

Die neue Strategie erweitert diese Infrastruktur um harte, nachvollziehbare Parity-Artefakte pro Case.

---

# Problem

Bisher konnte Codex oder die Vergleichslogik implizit entscheiden, welche Felder relevant sind.

Das ist zu schwach.

Wenn `song.legacy-raw.json` mehr Informationen enthält als `_ts_output/song.json`, dann ist ein späterer Sheet- oder SVG-Vergleich nicht zuverlässig interpretierbar.

Zusätzlich gibt es bereits Probleme, `abcStart` und `abcEnd` wirklich paritätisch zu halten.

Dadurch wird manuelles Review extrem schwierig, weil korrespondierende Stellen kaum auffindbar sind.

---

# Neue Leitentscheidung

Keine Sheet-/SVG-Parity-Debuggingarbeit ohne belastbare Song-Parity.

Wichtig:

```text
Song-Parity wird jetzt source-position-basiert abgesichert.
```

Das bedeutet:

- `istart` / `iend` werden zentrale Vergleichsfelder
- der originale ABC-Text wird in die Normalisierung einbezogen
- der relevante ABC-Substring wird explizit extrahiert
- Reports enthalten direkten ABC-Kontext

---

# Bestehende Fixture-Struktur erweitern

Nicht neues Parallelverzeichnis wie:

```text
fixtures/parity/song/<case-id>/
```

einführen.

Stattdessen:

```text
fixtures/cases/<test-case>/
  input.abc
  song.legacy-raw.json
  _ts_output/song.json

  _parity/
    song/
      normalized/
        legacy.normalized-song.json
        ts.normalized-song.json

      reports/
        song-gap-report.md
        song-gap-report.json

      debug/
        matched-events.json
        unmatched-legacy-events.json
        unmatched-ts-events.json
        matching-trace.json
```

---

# Song-Parity zuerst

## Ziel

TS Song muss alles enthalten, was Legacy Song für spätere Stufen liefert.

Dazu gehören mindestens:

- Voices
- Notes
- Pauses / Rests
- SynchPoints
- Gotos
- Measures
- Beat-/Zeitpositionen
- Duration
- Pitch/Fret/String/Octave
- Lyrics
- Decorations
- Variants
- Repeat-/Goto-Informationen
- ABC-Quellreferenzen
- Source-Positionen
- alle Felder, die Sheet/Layout/SVG später nutzt

Fehlt ein Feld, ist das ein Gap.

---

# Contract statt impliziter Relevanz

Es wird ein expliziter Contract eingeführt:

```text
fixtures/contracts/song-field-contract.json
```

Beispiel:

```json
{
  "required": [],
  "optional": [],
  "ignored": [],
  "tolerances": {},
  "aliases": {}
}
```

Regeln:

- Kein Feld darf stillschweigend ignoriert werden
- Ignorierte Felder müssen explizit in `ignored` stehen
- Toleranzen müssen explizit definiert werden
- Required-Feldabweichungen führen zu Testfehlern

---

# Source-Positions-Parity

## Wichtigste Ergänzung

`istart` und `iend` werden primäre Matching- und Debug-Felder.

Warum:

- `abcStart/abcEnd` allein reichen nicht
- manuelles Review ist sonst extrem mühsam
- identische musikalische Events müssen direkt im ABC-Text lokalisierbar sein

---

# ABC-Text in die Normalisierung einbeziehen

Der originale ABC-Text aus:

```text
fixtures/cases/<case>/input.abc
```

wird an beide Normalizer übergeben:

```ts
normalizeLegacySong(rawLegacy, { caseId, abcText })
normalizeTsSong(rawTs, { caseId, abcText })
```

---

# ABC-Substring extrahieren

Wenn ein Event enthält:

```text
istart
iend
```

dann wird automatisch erzeugt:

```ts
abcText = inputAbc.slice(istart, iend)
```

Zusätzlich:

```ts
abcContextBefore
abcContextAfter
```

Beispiel:

```text
Context:
"... B/c/ B/A/ G/A/ | G3 ..."
```

Dadurch wird manuelles Matching wesentlich einfacher.

---

# Erweiterung des NormalizedEvent-Formats

```ts
type NormalizedEvent = {
  stableKey: string

  kind:
    | 'note'
    | 'rest'
    | 'bar'
    | 'synch'
    | 'goto'
    | 'annotation'
    | 'lyric'
    | 'unknown'

  // Source positions
  istart?: number
  iend?: number

  abcStart?: number
  abcEnd?: number

  abcText?: string
  abcContextBefore?: string
  abcContextAfter?: string

  sourceLine?: number
  sourceColumn?: number

  // Musical position
  voiceId?: string
  voiceIndex?: number
  measure?: number
  beat?: number
  absBeat?: number
  duration?: number

  pitch?: string
  octave?: number
  string?: number
  fret?: number

  decorations?: string[]
  lyrics?: string[]

  variant?: string
  repeatInfo?: unknown
  gotoInfo?: unknown

  sourcePath: string

  raw?: unknown
}
```

---

# Matching-Strategie

Nicht nur Array-Index vergleichen.

Neue Matching-Reihenfolge:

```text
1. voice + kind + istart + iend
2. voice + kind + abcText + Nähe im Eventstrom
3. voice + kind + measure + beat + duration
4. voice + kind + pitch/rest + duration + Nähe im Array
5. lokaler Sequenz-Diff
6. unmatched
```

Match-Qualitäten:

```text
exact-source
exact-position
near-position
sequence
unmatched
ambiguous
```

---

# Neue Gap-Kategorien

Zusätzlich zu bisherigen Kategorien:

```text
missing-source-position
different-source-position
different-source-text
invalid-source-slice
```

---

# Reports pro Case

Für jeden Case:

```text
fixtures/cases/<case>/_parity/song/reports/song-gap-report.md
fixtures/cases/<case>/_parity/song/reports/song-gap-report.json
```

Der Markdown-Report muss manuell reviewbar sein.

Pro Gap:

```text
- Case-ID
- Stage: song
- Kategorie
- Voice
- Measure
- Beat
- Event kind
- Stable key
- Legacy JSON path
- TS JSON path
- istart/iend legacy
- istart/iend ts
- abcText legacy
- abcText ts
- Match quality
- Impact / downstream relevance
```

Beispiel:

```text
## different-source-position

Case: 3015_reference_sheet
Voice: T1
Measure: 12
Beat: 2.5
Event: note

Legacy:
istart=384
iend=391
abcText="B/A/"

TS:
istart=386
iend=393
abcText="A/ G/"

Context:
"... B/c/ B/A/ G/A/ | G3 ..."
```

---

# Verhältnis zu bestehenden Reports

Die bestehenden globalen Reports bleiben erhalten:

```text
fixtures/reports/song-gap-report.md
fixtures/reports/sheet-gap-report.md
fixtures/reports/svg-gap-report.md
```

Neue Bedeutung:

- globale Reports = Übersicht
- Case-Reports = Detailanalyse

---

# Verhältnis zu openImplementations.ts

`fixtures/openImplementations.ts` bleibt die manuell gepflegte Liste systematischer Lücken.

Workflow:

```text
1. parity report erzeugen
2. Case analysieren
3. Ursache klassifizieren
4. wenn systematisch:
   openImplementations.ts ergänzen
5. Fix implementieren
6. Report erneut erzeugen
7. Eintrag entfernen
```

---

# CLI-Erweiterung

Neue oder erweiterte Befehle:

```bash
pnpm parity:song <case-id>
pnpm parity:song --all
```

Ablauf:

```text
1. input.abc lesen
2. TS-Pipeline ausführen
3. _ts_output/song.json erzeugen
4. song.legacy-raw.json laden
5. beide normalisieren
6. normalized/*.json schreiben
7. compareNormalizedSongs()
8. Markdown-/JSON-Reports schreiben
9. Debug-Dateien schreiben
10. Exit-Code != 0 bei required-Gaps
```

---

# Erster Case

Zuerst genau EINEN Case vollständig analysieren.

Empfehlung:

```text
3015 Reference Sheet
```

Danach:

```text
output.extract-0
```

als SVG-/Hitbox-Spezialfall.

---

# Neue Arbeitsreihenfolge

## Phase 1 – Song-Parity-Infrastruktur

- Contract-Datei
- Source-Positions-Normalisierung
- ABC-Substring-Extraktion
- Normalizer
- Comparator
- Reports
- CLI

## Phase 2 – Einen Case hart analysieren

- keine stillschweigend ignorierten Felder
- Source-Positionen sichtbar machen
- ABC-Kontext anzeigen

## Phase 3 – TS Song vervollständigen

- fehlende required-Felder ergänzen
- keine SVG-Fixes vorziehen

## Phase 4 – 3015 Reference Sheet

- Song-Parity
- danach Sheet-Parity
- danach SVG-Parity

---

# Codex-Prompt

```text
Aufgabe:
Erweitere die bestehende fixture-driven Testing Strategy von Zupfnoter TS um eine harte, source-position-basierte Song-Parity-Infrastruktur.

Wichtiger Kontext:
Es gibt bereits eine etablierte Fixture-Struktur:

fixtures/cases/<test-case>/
  input.abc
  song.legacy-raw.json
  sheet.extract-<nr>.json
  output.extract-<nr>.svg
  _ts_output/
    song.json
    sheet.extract-<nr>.json
    output.extract-<nr>.svg

Diese Struktur darf NICHT durch ein neues paralleles fixtures/parity-System ersetzt werden.

Stattdessen soll pro Case ergänzt werden:

fixtures/cases/<test-case>/_parity/song/
  normalized/
  reports/
  debug/

Problem:
Die bisherige Paritätsprüfung ist zu weich.
Codex hat mehrfach behauptet, Legacy- und TS-Song seien paritätisch, obwohl Felder fehlen oder Strukturen abweichen.

Zusätzlich sind abcStart/abcEnd allein nicht ausreichend robust.
Wir müssen istart/iend und den tatsächlichen ABC-Text stärker einbeziehen.

Ziel:
Vor weiterer Sheet-/SVG-Arbeit muss Song-Parity hart und nachvollziehbar geprüft werden.

Wichtige Regeln:
- Kein Feld stillschweigend ignorieren
- Source-Positionen explizit vergleichen
- Reports müssen manuell reviewbar sein
- Produktivpipeline nicht verändern

Aufgaben:

1. Lies die bestehende fixture-driven Teststrategie und vorhandene Tools:
   - fixtures/cases/*
   - _ts_output/
   - fixtures/reports/*
   - fixtures/openImplementations.ts
   - bestehende Song-/Sheet-/SVG-Parity-Tests

2. Führe einen Song Field Contract ein:
   fixtures/contracts/song-field-contract.json

   Enthält:
   - required
   - optional
   - ignored
   - tolerances
   - aliases

3. Implementiere:
   normalizeLegacySong(rawLegacy, context)
   normalizeTsSong(rawTs, context)

   context enthält mindestens:
   - caseId
   - abcText aus fixtures/cases/<case>/input.abc

4. Erweitere NormalizedEvent um:
   - istart
   - iend
   - abcStart
   - abcEnd
   - abcText
   - abcContextBefore
   - abcContextAfter
   - sourceLine
   - sourceColumn

5. Wenn istart/iend vorhanden:
   abcText = inputAbc.slice(istart, iend)

6. Implementiere compareNormalizedSongs(...)

   Matching-Reihenfolge:
   1. voice + kind + istart + iend
   2. voice + kind + abcText + Nähe im Eventstrom
   3. voice + kind + measure + beat + duration
   4. voice + kind + pitch/rest + duration + Nähe im Array
   5. lokaler Sequenz-Diff
   6. unmatched

7. Unterstütze zusätzliche Gap-Kategorien:
   - missing-source-position
   - different-source-position
   - different-source-text
   - invalid-source-slice

8. Schreibe pro Case:
   fixtures/cases/<case>/_parity/song/normalized/*
   fixtures/cases/<case>/_parity/song/reports/*
   fixtures/cases/<case>/_parity/song/debug/*

9. Der Markdown-Report muss enthalten:
   - istart/iend legacy
   - istart/iend ts
   - abcText legacy
   - abcText ts
   - ABC-Kontext
   - JSON-Pfade
   - Match-Qualität
   - downstream impact

10. Ergänze:
    pnpm parity:song <case-id>
    pnpm parity:song --all

11. Beginne mit genau einem Case:
    bevorzugt 3015 Reference Sheet

12. Wichtig:
    Jetzt NICHT SvgEngine.ts refactoren.
    Jetzt zuerst Song-Parity beweisbar machen.

Akzeptanzkriterien:
- bestehende Fixture-Struktur bleibt erhalten
- pro Case existiert _parity/song
- normalisierte Dateien werden erzeugt
- Markdown-/JSON-Reports werden erzeugt
- Source-Positionen werden sichtbar
- ABC-Text wird extrahiert
- fehlende Felder werden sichtbar
- required-Gaps führen zu Fehlerstatus
- keine stillschweigenden Ignorierungen
- Produktivpipeline bleibt unverändert
```


---

# Zusätzlicher Codex-Prompt – Sheet-Parity

```text
Aufgabe:
Erweitere die bestehende fixture-driven Parity-Infrastruktur um eine harte Sheet-Parity-Stufe.

Wichtiger Kontext:
Die Song-Parity-Infrastruktur existiert bereits oder wird gerade eingeführt.

Die Reihenfolge bleibt:

ABC → Song → Sheet
                 ├─ SvgEngine → SVG Preview / GUI
                 └─ PdfEngine → PDF Export

Sheet-Parity darf erst ernsthaft bewertet werden,
wenn Song-Parity für den Case grün ist.

Die bestehende Fixture-Struktur:

fixtures/cases/<test-case>/
  input.abc
  song.legacy-raw.json
  sheet.extract-<nr>.json
  output.extract-<nr>.svg
  _ts_output/
    song.json
    sheet.extract-<nr>.json
    output.extract-<nr>.svg

soll NICHT ersetzt werden.

Stattdessen pro Case ergänzen:

fixtures/cases/<test-case>/_parity/sheet/
  normalized/
  reports/
  debug/

Ziel:
Sheet-Parity muss nachvollziehbar und semantisch vergleichbar werden,
bevor SVG-Gaps interpretiert werden.

Problem:
Aktuell sind Sheet-Diffs schwer lesbar.
Schon kleine Strukturverschiebungen erzeugen große JSON-Diffs.
Korrespondierende Objekte sind schwer auffindbar.

Wichtige Regel:
Nicht nur rohe JSON-Strukturen vergleichen.
Es braucht:
- Normalisierung
- semantisches Matching
- stabile Schlüssel
- lesbare Reports

Aufgaben:

1. Untersuche die bestehende Sheet-Struktur:
   - sheet.extract-*.json
   - _ts_output/sheet.extract-*.json
   - HarpnotesLayout-Ausgabe
   - bestehende Vergleichslogik

2. Implementiere:
   normalizeLegacySheet(rawSheet, context)
   normalizeTsSheet(rawSheet, context)

   Diese Funktionen dürfen NICHT in die Produktivpipeline eingebaut werden.

3. Das NormalizedSheet-Format soll möglichst enthalten:
   - pages
   - systems
   - staffs
   - voices
   - beats
   - noteheads
   - pauses/rests
   - flowlines
   - synchlines
   - annotations
   - decorations
   - barlines
   - cutmarks
   - layout boxes
   - coordinates
   - dimensions
   - z-order
   - source references
   - abc references
   - optional raw/debug references

4. Wichtige Felder pro Element:
   - stableKey
   - kind
   - page
   - system
   - voice
   - measure
   - beat
   - x/y
   - width/height
   - boundingBox
   - source references
   - related song event
   - sourcePath

5. Stable Keys möglichst ableiten aus:
   - song stableKey
   - voice
   - measure
   - beat
   - element kind

6. Implementiere semantisches Matching:
   Nicht nur Array-Index.

   Matching-Reihenfolge:
   1. stableKey
   2. related song event
   3. measure + beat + voice + kind
   4. räumliche Nähe (x/y)
   5. lokaler Sequenz-Diff
   6. unmatched

7. Unterstütze Gap-Kategorien:
   - missing-element
   - extra-element
   - missing-field
   - extra-field
   - different-value
   - different-position
   - different-size
   - different-z-order
   - different-layout-box
   - matching-ambiguous
   - normalization-warning

8. Erzeuge pro Case:
   fixtures/cases/<case>/_parity/sheet/normalized/*
   fixtures/cases/<case>/_parity/sheet/reports/*
   fixtures/cases/<case>/_parity/sheet/debug/*

9. Der Markdown-Report muss manuell reviewbar sein.

   Pro Gap ausgeben:
   - Case-ID
   - Stage: sheet
   - Kategorie
   - Element kind
   - Stable key
   - Voice
   - Measure
   - Beat
   - Legacy JSON path
   - TS JSON path
   - x/y legacy
   - x/y ts
   - boundingBox legacy
   - boundingBox ts
   - Match quality
   - downstream impact

10. Ergänze:
    pnpm parity:sheet <case-id>
    pnpm parity:sheet --all

11. Integration mit globalen Reports:
    fixtures/reports/sheet-gap-report.md
    soll auf die Case-Reports verweisen.

12. Wichtige Architekturregel:
    SvgEngine.ts jetzt noch NICHT groß refactoren.
    Sheet-Parity zuerst stabilisieren.

13. Wichtig:
    Nicht versuchen, sofort Byte-Parität der JSON-Dateien zu erreichen.

    Ziel ist:
    - semantische Sheet-Parität
    - nachvollziehbare Unterschiede
    - stabile Matchbarkeit
    - gute manuelle Reviewbarkeit

14. Beginne mit:
    3015 Reference Sheet

15. Danach:
    output.extract-0

Akzeptanzkriterien:
- pro Case existiert _parity/sheet
- normalisierte Dateien werden erzeugt
- Markdown-/JSON-Reports werden erzeugt
- Matching ist nachvollziehbar
- Positionierungsprobleme werden sichtbar
- Z-Order-Unterschiede werden sichtbar
- Sheet-Struktur wird semantisch vergleichbar
- Produktivpipeline bleibt unverändert
```
