# Zupfnoter TS – Fortführung der Fixture-Driven Parity-Strategie

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

Die neue Parity-Strategie erweitert diese Infrastruktur um harte, nachvollziehbare Normalisierung und Reports pro Case.

---

# Problem

Bisher konnte Codex oder die Vergleichslogik implizit entscheiden, welche Felder relevant sind.

Das ist zu schwach.

Wenn `song.legacy-raw.json` mehr Informationen enthält als `_ts_output/song.json`, dann ist ein späterer Sheet- oder SVG-Vergleich nicht zuverlässig interpretierbar.

Deshalb gilt ab jetzt:

```text
Keine Sheet-/SVG-Parity-Debuggingarbeit ohne belastbare Song-Parity.
```

---

# Neue Leitentscheidung

Nicht neues Parallelverzeichnis einführen wie:

```text
fixtures/parity/song/<case-id>/
```

sondern bestehende Case-Struktur erweitern:

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

Für spätere Stufen analog:

```text
fixtures/cases/<test-case>/_parity/sheet/
fixtures/cases/<test-case>/_parity/svg/
```

Begründung:

- der vorhandene Discovery-Mechanismus über `fixtures/cases/*/input.abc` bleibt erhalten
- Legacy-Referenzen bleiben kanonisch
- `_ts_output/` bleibt generiert
- Parity-Artefakte liegen direkt beim betroffenen Case
- manuelles Review wird leichter

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
- ABC-Source-Referenzen
- alle Felder, die Sheet/Layout/SVG später nutzt

Fehlt ein Feld, ist das ein Gap.

---

# Contract statt impliziter Relevanz

Es wird ein expliziter Contract eingeführt:

```text
fixtures/contracts/song-field-contract.json
```

Oder, falls besser zur bestehenden Struktur passend:

```text
fixtures/song-field-contract.json
```

Der Contract enthält:

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

- Kein Feld darf stillschweigend ignoriert werden.
- Ignorierte Felder müssen explizit in `ignored` stehen.
- Toleranzen müssen explizit definiert werden.
- Der Report muss ignorierte Felder aufführen.
- Required-Feldabweichungen führen zu Testfehlern.

---

# Adapter / Normalizer

## Adapter werden nicht produktiv verwendet

Nicht:

```text
ABC → Song → normalize → Sheet
```

Sondern nur im Test-/Parity-Pfad:

```text
song.legacy-raw.json ┐
                     ├─ normalizeLegacySong()
_ts_output/song.json ┘
                     ├─ normalizeTsSong()
                     ├─ compareNormalizedSongs()
                     └─ _parity/song/reports/song-gap-report.md
```

Produktiv bleibt:

```text
ABC → Song → Sheet → SVG/PDF
```

---

# Wann werden Adapter aufgerufen?

Adapter werden nach der TS-Pipeline-Ausführung aufgerufen.

Im vorhandenen Testfluss also nach:

```text
AbcParser → AbcToSong → _ts_output/song.json
```

Dann:

```text
normalizeLegacySong(song.legacy-raw.json)
normalizeTsSong(_ts_output/song.json)
compareNormalizedSongs(...)
```

Der bestehende Song-Vergleich `matchSong(...)` kann entweder:

1. intern auf diese neue Infrastruktur umgestellt werden, oder
2. zunächst parallel ergänzt werden als strenger Parity-Report.

Empfehlung:

```text
Erst parallel einführen, danach alten matchSong schrittweise ersetzen.
```

---

# NormalizedSong-Format

Das Format soll auf Reviewbarkeit optimiert sein.

Beispiel:

```ts
type NormalizedSong = {
  meta: {
    caseId: string
    source: 'legacy' | 'ts'
    schemaVersion: string
  }
  voices: NormalizedVoice[]
  events: NormalizedEvent[]
  diagnostics: NormalizationDiagnostic[]
}

type NormalizedVoice = {
  voiceId: string
  legacyVoiceId?: string
  tsVoiceId?: string
  name?: string
  clef?: string
  eventIds: string[]
}

type NormalizedEvent = {
  stableKey: string
  kind: 'note' | 'rest' | 'bar' | 'synch' | 'goto' | 'annotation' | 'lyric' | 'unknown'

  voiceId?: string
  voiceIndex?: number
  indexInVoice?: number
  globalIndex?: number

  measure?: number
  beat?: number
  absBeat?: number
  duration?: number

  abcStart?: number
  abcEnd?: number
  abcText?: string

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

Das genaue Format darf beim Implementieren angepasst werden, aber diese Anforderungen müssen bleiben:

- stabile manuelle Reviewbarkeit
- eindeutige JSON-Pfade
- Matchbarkeit von Legacy- und TS-Events
- Debug-Möglichkeit mit Rohdaten
- keine versteckten Feldverluste

---

# Matching-Strategie

Nicht nur Array-Index vergleichen.

Matching-Reihenfolge:

```text
1. voice + kind + abcStart + abcEnd
2. voice + kind + measure + beat + duration
3. voice + kind + pitch/rest + duration + Nähe im Array
4. lokaler Sequenz-Diff
5. unmatched legacy / unmatched ts
```

Jedes Match bekommt eine Qualität:

```text
exact-source
exact-position
near-position
sequence
unmatched
ambiguous
```

---

# Gap-Kategorien

Mindestens:

```text
missing-event
extra-event
missing-field
extra-field
different-value
different-array-order
different-length
different-type
matching-ambiguous
ignored-by-contract
normalization-warning
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
- Legacy value
- TS value
- Match quality
- Impact / downstream relevance
```

Zusätzlich Debug-Dateien:

```text
fixtures/cases/<case>/_parity/song/debug/matched-events.json
fixtures/cases/<case>/_parity/song/debug/unmatched-legacy-events.json
fixtures/cases/<case>/_parity/song/debug/unmatched-ts-events.json
fixtures/cases/<case>/_parity/song/debug/matching-trace.json
```

---

# Verhältnis zu fixtures/reports/*.md

Die bestehenden globalen Reports bleiben:

```text
fixtures/reports/song-gap-report.md
fixtures/reports/sheet-gap-report.md
fixtures/reports/svg-gap-report.md
```

Neue Bedeutung:

- globale Reports geben die Übersicht über alle Cases
- Case-Reports enthalten die Details für manuelles Debugging

Der globale Song-Report soll auf die Case-Reports verweisen.

Beispiel:

```text
## 3015_reference_sheet

Status: failed
Gaps: 14
Details:
fixtures/cases/3015_reference_sheet/_parity/song/reports/song-gap-report.md
```

---

# Verhältnis zu fixtures/openImplementations.ts

`fixtures/openImplementations.ts` bleibt manuell gepflegte Liste systematischer Lücken.

Aber:

- ein einzelner Gap im Case-Report wird nicht automatisch zu einem `openImplementations`-Eintrag
- erst nach Analyse wird eine systematische Lücke manuell dort eingetragen
- erledigte Einträge werden manuell entfernt

Workflow:

```text
1. pnpm parity:song <case>
2. Case-Report lesen
3. Ursache klassifizieren
4. wenn systematisch: openImplementations.ts ergänzen
5. Implementierung fixen
6. Report erneut erzeugen
7. Eintrag entfernen, wenn erledigt
```

---

# CLI-Erweiterung

Es soll neue oder erweiterte Befehle geben:

```bash
pnpm parity:song <case-id>
pnpm parity:song --all
```

Alternativ können bestehende Befehle erweitert werden:

```bash
pnpm test:dump:song
pnpm test:gaps
```

Empfehlung:

- `pnpm parity:song <case-id>` für fokussiertes Debugging
- `pnpm parity:song --all` für Überblick
- `pnpm test:gaps` erzeugt zusätzlich globale Zusammenfassung

---

# Erster Case

Wenn vorhanden, zuerst der konkrete Case mit den zwei Song-Dateien, die angeblich paritätisch sind, aber manuell abweichen.

Falls der Case nicht eindeutig ist:

```text
3015 Reference Sheet
```

Warum:

- repräsentativer Referenzfall
- geeignet für Song → Sheet → SVG
- später ohnehin wichtig für SVG-Parität

Danach:

```text
output.extract-0
```

als Spezialfall für SVG/Hitbox/Black-Rect-Themen.

---

# Neue Arbeitsreihenfolge

## Phase 1 – Song-Parity-Infrastruktur

- Contract-Datei
- Normalizer
- Comparator
- Case-Artefakte unter `_parity/song/`
- Markdown-/JSON-Reports
- CLI-Befehl

## Phase 2 – Ein Case hart analysieren

- nur einen Case
- Report muss Abweichungen zeigen
- keine stillschweigend ignorierten Felder

## Phase 3 – TS Song vervollständigen

- fehlende required-Felder in TS-Song ergänzen
- keine Sheet/SVG-Fixes vorziehen
- Case muss Song-grün werden

## Phase 4 – 3015 Reference Sheet

- Song-Parity prüfen
- erst danach Sheet-Parity
- dann SVG-Parity

## Phase 5 – Alle Song-Fixtures

- systematische Lücken gruppieren
- `openImplementations.ts` pflegen
- globale Reports aktualisieren

---

# Codex-Prompt

```text
Aufgabe:
Erweitere die bestehende fixture-driven Testing Strategy von Zupfnoter TS um eine harte, case-basierte Song-Parity-Infrastruktur.

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

Stattdessen soll pro Case ein neues Artefaktverzeichnis ergänzt werden:

fixtures/cases/<test-case>/_parity/song/
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

Problem:
Die bisherige Paritätsprüfung ist zu weich. Codex hat mehrfach behauptet, Legacy- und TS-Song seien paritätisch, obwohl Felder fehlen oder Strukturen abweichen.
Dadurch ist Sheet-/SVG-Debugging schwer oder irreführend.

Ziel:
Vor weiterer Sheet-/SVG-Arbeit muss Song-Parity hart und nachvollziehbar geprüft werden.

Wichtige Regel:
Codex darf nicht selbst entscheiden, welche Felder relevant sind.
Es muss einen expliziten Song Field Contract geben.

Aufgaben:

1. Lies die vorhandene Teststrategie und bestehende Fixture-Konventionen:
   - fixtures/cases/*
   - _ts_output/
   - fixtures/reports/*
   - fixtures/openImplementations.ts
   - bestehende legacy_comparison.spec.ts Tests
   - bestehende matchSong / semanticMatch Helfer

2. Führe einen Song Field Contract ein:
   fixtures/contracts/song-field-contract.json
   oder einen zum Repo passenden Pfad.
   Der Contract muss enthalten:
   - required
   - optional
   - ignored
   - tolerances
   - aliases

   Wichtig:
   Kein Feld darf stillschweigend ignoriert werden.
   Ignorierte Felder müssen explizit im Contract stehen und im Report erscheinen.

3. Implementiere Normalizer:
   - normalizeLegacySong(rawLegacy, context)
   - normalizeTsSong(rawTs, context)

   Diese Funktionen werden nur im Parity-/Test-/Debug-Pfad verwendet.
   Sie dürfen nicht in die Produktivpipeline ABC → Song → Sheet eingebaut werden.

4. Erzeuge ein NormalizedSong-Format mit:
   - meta
   - voices
   - events
   - diagnostics

   Events sollen, soweit verfügbar, enthalten:
   - stableKey
   - kind
   - voiceId / voiceIndex
   - indexInVoice / globalIndex
   - measure
   - beat / absBeat
   - duration
   - abcStart / abcEnd / abcText
   - pitch / octave / string / fret
   - decorations
   - lyrics
   - variant / repeatInfo / gotoInfo
   - sourcePath
   - optional raw/debug

5. Implementiere einen Comparator:
   compareNormalizedSongs(legacy, ts, contract)

   Matching nicht nur per Array-Index.

   Matching-Reihenfolge:
   1. voice + kind + abcStart + abcEnd
   2. voice + kind + measure + beat + duration
   3. voice + kind + pitch/rest + duration + Nähe im Array
   4. lokaler Sequenz-Diff
   5. unmatched legacy / unmatched ts

   Match-Qualitäten:
   - exact-source
   - exact-position
   - near-position
   - sequence
   - unmatched
   - ambiguous

6. Unterstütze mindestens diese Gap-Kategorien:
   - missing-event
   - extra-event
   - missing-field
   - extra-field
   - different-value
   - different-array-order
   - different-length
   - different-type
   - matching-ambiguous
   - ignored-by-contract
   - normalization-warning

7. Schreibe pro Case Artefakte nach:
   fixtures/cases/<case>/_parity/song/normalized/
   fixtures/cases/<case>/_parity/song/reports/
   fixtures/cases/<case>/_parity/song/debug/

   Der Markdown-Report muss manuell reviewbar sein.
   Pro Gap ausgeben:
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
   - Legacy value
   - TS value
   - Match quality
   - Impact / downstream relevance

8. Ergänze einen fokussierten CLI-Befehl:
   pnpm parity:song <case-id>
   pnpm parity:song --all

   Falls das Repo andere Script-Konventionen nutzt, passe dich an.

   Ablauf:
   - vorhandenen Case laden
   - input.abc lesen
   - TS-Pipeline ausführen
   - _ts_output/song.json schreiben
   - song.legacy-raw.json laden
   - beide normalisieren
   - normalized JSONs schreiben
   - vergleichen
   - Markdown-/JSON-Reports schreiben
   - Debug-Dateien schreiben
   - Exit-Code != 0 bei required-Gaps

9. Integriere mit bestehenden Reports:
   - fixtures/reports/song-gap-report.md bleibt globaler Überblick
   - globale Reports sollen auf Case-Reports verweisen
   - openImplementations.ts bleibt manuell gepflegte Liste systematischer Lücken

10. Starte mit genau einem Case:
   - zuerst der aktuell problematische Song-Case, der angeblich paritätisch ist, aber manuell abweicht
   - falls unklar: 3015 Reference Sheet

11. Wichtig:
   Jetzt NICHT SvgEngine.ts refactoren.
   Jetzt NICHT Sheet/SVG-Gaps beheben.
   Erst Song-Parity beweisbar machen.

Akzeptanzkriterien:
- bestehende Fixture-Struktur bleibt erhalten
- pro Case gibt es _parity/song Artefakte
- normalisierte Legacy- und TS-Song-Dateien werden erzeugt
- Markdown- und JSON-Gap-Reports werden erzeugt
- Matching ist nachvollziehbar
- fehlende Felder werden sichtbar
- required-Gaps führen zu Fehlerstatus
- keine Felder werden stillschweigend ignoriert
- Produktivpipeline bleibt unverändert
```
