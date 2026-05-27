# Fixtures

Referenz-Daten für Legacy-Vergleichstests. Die JSON-Fixtures wurden einmalig aus dem
Legacy-System (`bwl21/zupfnoter`, Branch `feature/voice-styles_and-other-concepts`)
exportiert und sind versioniert. Sie ändern sich nur bei bewussten fachlichen Änderungen
(Commit-Kommentar muss die Änderung begründen).

Diese Datei beschreibt die **praktische Nutzung** der Fixtures:
- Verzeichnisstruktur
- Export
- konkrete Test-Kommandos
- generierte Reports unter `fixtures/reports/`

Für das **Konzept** hinter dem fixture-driven Testing, den Ablauf der Vergleichstests
und den Gap-Workflow siehe
[docs/testing/fixture-driven-testing.md](/Users/beweiche/beweiche_noTimeMachine/zupfnoter-ts/docs/testing/fixture-driven-testing.md:1).

## Verzeichnisstruktur

```
fixtures/
└── cases/
    ├── single_note/
    │   ├── input.abc       # ABC-Notation, optional mit %%%%zupfnoter.config
    │   ├── song.legacy-raw.json # Stufe-2-Referenz: Rohdump aus Legacy-CLI (@music_model.to_json)
    │   ├── sheet.extract-0.json # Stufe-3-Referenz für Extrakt 0
    │   ├── output.extract-0.svg # Stufe-4-Referenz für Extrakt 0
    │   └── _ts_output/     # generierte TS-Ausgabe, nicht Referenz
    │   └── _parity/song/   # harte Song-Parity-Artefakte (normalisiert, Report, Debug)
    └── ...
```

Die Tests scannen `fixtures/cases/*/input.abc` automatisch. Ein neuer Testfall wird
für Song-Vergleiche aufgenommen, sobald zusätzlich `song.legacy-raw.json` existiert; für
Sheet-Vergleiche entsprechend mit mindestens einer `sheet.extract-<nr>.json`; für
SVG-Vergleiche mit mindestens einer `output.extract-<nr>.svg`.

Bekannte, noch nicht portierte Legacy-Aspekte werden nicht testfallspezifisch im
Fixture-Verzeichnis gepflegt, sondern zentral im Testcode als globale Capability-Liste.
Vergleichstests bleiben aktiv; bei Fehlschlägen wird diese stage-spezifische Liste an die
Fehlermeldung angehängt, damit sichtbar bleibt, welche Paritätslücken systemweit noch offen
sind.

## Bestehende Testfälle

| Ordner | Testet |
|-------|--------|
| `single_note` | Eine Note, eine Stimme |
| `two_voices` | Zwei Stimmen, Synchlines |
| `repeat` | Wiederholung mit Volta-Klammern |
| `pause` | Pausen verschiedener Längen |
| `tuplet` | Triolen |
| `tie` | Bindebögen |
| `decoration` | Fermata, Dynamik |
| `lyrics` | Liedtext (w:-Zeilen) |
| `Twostaff` | Legacy-Testcase aus `30_sources/SRC_Zupfnoter/testcases/` |

## Fixtures neu erzeugen (Legacy-Export)

Voraussetzung: Laufendes Legacy-System (`bwl21/zupfnoter`,
Branch `feature/voice-styles_and-other-concepts`) mit dem CLI-Modus
`--export-fixtures`.

Bequemer Wrapper aus diesem Repo:

```bash
npm run test:loadsample
```

Standardmäßig verwendet der Wrapper den Legacy-CLI-Pfad
`../200_zupfnoter/30_sources/SRC_Zupfnoter/src/zupfnoter-cli.js`
relativ zum Repo-Root.

Ohne Glob verwendet der Wrapper standardmäßig `fixtures/cases/*/input.abc`.
Falls nötig kann der CLI-Pfad überschrieben werden, entweder per Environment oder
als zweites Argument:

```bash
export ZUPFNOTER_LEGACY_CLI=/pfad/zu/zupfnoter-cli.min.js
npm run test:loadsample

npm run test:loadsample -- "~/Dropbox/RuthVeehNoten/78*.abc"
npm run test:loadsample -- "~/Dropbox/RuthVeehNoten/78*.abc" "/pfad/zu/zupfnoter-cli.min.js"
```

Der Wrapper expandiert den Glob selbst und schreibt standardmäßig nach
`fixtures/cases/`. Mit `ZUPFNOTER_FIXTURE_OUTDIR` kann das Ziel überschrieben werden.
Für jede aufgelöste ABC-Datei ruft er die Legacy-CLI einzeln auf als
`node zupfnoter-cli.min.js --export-fixtures <input.abc> <target-dir>`.

### 1. TS-Ausgabe als Referenz erzeugen (optional)

Die TS-Pipeline-Ausgabe kann als Vergleichsbasis erzeugt werden:

```bash
pnpm test
```

`pnpm test` führt die normalen Workspace-Tests aus und schreibt dabei zusätzlich die
TS-Dumps nach `fixtures/cases/<name>/_ts_output/`.

Für gezielte Einzel-Dumps gibt es zusätzlich:

```bash
pnpm test:dump:song
pnpm test:dump:sheet
pnpm test:dump:svg
```

Für harte Song-Parity-Vergleiche gibt es den dedizierten Runner:

```bash
pnpm parity:song 3015_reference_sheet
pnpm parity:song --all
```

Der Runner schreibt pro Case Artefakte nach
`fixtures/cases/<name>/_parity/song/`:

- `normalized/legacy.normalized-song.json`
- `normalized/ts.normalized-song.json`
- `reports/song-gap-report.md`
- `reports/song-gap-report.json`
- `debug/matched-events.json`
- `debug/unmatched-legacy-events.json`
- `debug/unmatched-ts-events.json`
- `debug/matching-trace.json`

Diese Dateien sind **nicht** die Referenz-Fixtures. Sie zeigen nur, was die TS-Pipeline
aktuell produziert. Vergleiche sie mit dem Legacy-Export, um Abweichungen zu finden.

### 2. Legacy-Fixtures exportieren

Der Legacy-Exporter nimmt ABC-Dateien und erzeugt pro Datei ein Testfall-Verzeichnis:

```bash
cd ../200_zupfnoter/30_sources/SRC_Zupfnoter/src
node --max_old_space_size=4096 zupfnoter-cli.js \
  --export-fixtures \
  "/path/to/zupfnoter-ts/fixtures/cases/<test-case>/input.abc" \
  /path/to/zupfnoter-ts/fixtures/cases
```

Für jede Eingabedatei wird geschrieben:

```text
fixtures/cases/<test-case>/input.abc
fixtures/cases/<test-case>/song.legacy-raw.json
fixtures/cases/<test-case>/sheet.extract-<nr>.json
fixtures/cases/<test-case>/output.extract-<nr>.svg
```

Wenn die Eingabe `fixtures/cases/<name>/input.abc` heißt, verwendet der Exporter
`<name>` als Testfallnamen. Für andere ABC-Dateien wird der Dateiname ohne `.abc`
als Testfallname verwendet.

### 3. Fixtures einchecken

```bash
git add fixtures/cases/
git commit -m "fixtures: populate legacy reference snapshots

Reason: <Begründung der Änderung>"
```

### 4. Tests grün machen

Nach dem Befüllen der Fixtures:

```bash
pnpm test
pnpm test:gaps
```

Schlagen Tests fehl, zeigt `formatMismatches` den genauen Pfad der Abweichung:
```
voices[0].entities[2].pitch:
  expected: 60
  actual:   48
```

`pnpm test:gaps` erzeugt drei stufenbezogene Markdown-Reports unter
`fixtures/reports/`:

- `song-gap-report.md` (Stufe 2, registry-basiert)
- `sheet-gap-report.md` (Stufe 3, registry-basiert)
- `svg-gap-report.md` (Stufe 4, strukturelle Tag-Count-Analyse)

Der Song-Report ist ein globaler Index auf die case-basierten `_parity/song`
Artefakte und verweist zusätzlich auf die manuelle Gap-Liste in
`fixtures/openImplementations.ts`. Der SVG-Report
vergleicht für jedes Fixture die Tag-Typ-Verteilung der Legacy-Ausgabe gegen die
TS-Ausgabe und zeigt die ersten positionalen Tag-Abweichungen.

## TS-Ausgabe als Bootstrap-Referenz

Solange das Legacy-System nicht verfügbar ist, können die Fixtures aus der TS-Pipeline
selbst erzeugt werden (Bootstrap-Ansatz). Die Ausgabe dient als Regressionsbasis —
nicht als Verifikation gegen das Legacy-System.

```bash
# Song-Fixtures (Stufe 2):
pnpm test:dump:song
cp fixtures/cases/<name>/_ts_output/song.json fixtures/cases/<name>/song.legacy-raw.json

# Sheet-Fixtures (Stufe 3):
pnpm test:dump:sheet
cp fixtures/cases/<name>/_ts_output/sheet.extract-0.json fixtures/cases/<name>/sheet.extract-0.json

# SVG-Fixtures (Stufe 4):
pnpm test:dump:svg
cp fixtures/cases/<name>/_ts_output/output.extract-0.svg fixtures/cases/<name>/output.extract-0.svg
```

## Fixture-Format

### Song (Stufe 2)

```json
{
  "meta_data": {
    "title": "...",
    "composer": "...",
    "meter": "4/4",
    "key": "C"
  },
  "voices": [
    {
      "entities": [
        { "type": "Note",  "pitch": 48, "duration": 384, "beat": 0,   "variant": 0, "visible": true },
        { "type": "Pause", "duration": 384,               "beat": 384, "variant": 0, "visible": true }
      ]
    }
  ],
  "beat_maps": [
    { "0": 0, "384": 1 }
  ]
}
```

### Sheet (Stufe 3)

```json
{
  "children": [
    { "type": "Ellipse",  "center": [25.4, 10.0], "size": [3.5, 1.7], "fill": false, "color": "black" },
    { "type": "FlowLine", "from":   [25.4, 10.0], "to":   [25.4, 15.0], "style": "solid", "color": "black" },
    { "type": "Glyph",    "center": [25.4, 20.0], "size": [4.0, 2.0],   "glyphName": "rest_4", "color": "black" },
    { "type": "Annotation","center": [10.0, 5.0], "text": "Legende",    "style": "bold",  "color": "black" }
  ]
}
```

Die Sheet-Referenzen liegen als `sheet.extract-<nr>.json` im Testfallordner.
Die Sheet-Vergleichstests iterieren über diese Extrakt-Fixtures einzeln.

## Vergleichsstrategie

Semantischer Vergleich — nur fachlich relevante Felder werden geprüft:

| Stufe | Felder | Toleranz |
|-------|--------|----------|
| Song | `type`, `pitch`, `duration`, `beat`, `variant`, `visible` | exakt |
| Sheet `center`, `from`, `to` | Positionen (mm) | ±0.1 mm |
| Sheet `size` | Größen (mm) | ±0.05 mm |
| Sheet `type`, `fill`, `color`, `style`, `glyphName` | — | exakt |
| Sheet Anzahl `children` | — | exakt |
