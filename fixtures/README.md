# Fixtures

Referenz-Daten für Legacy-Vergleichstests. Die JSON-Fixtures wurden einmalig aus dem
Legacy-System (`bwl21/zupfnoter`, Branch `feature/voice-styles_and-other-concepts`)
exportiert und sind versioniert. Sie ändern sich nur bei bewussten fachlichen Änderungen
(Commit-Kommentar muss die Änderung begründen).

## Verzeichnisstruktur

```
fixtures/
└── cases/
    ├── single_note/
    │   ├── input.abc       # ABC-Notation, optional mit %%%%zupfnoter.config
    │   ├── song.json       # Stufe-2-Referenz: Song
    │   ├── sheet.json      # Stufe-3-Referenz: Sheet
    │   └── _ts_output/     # generierte TS-Ausgabe, nicht Referenz
    └── ...
```

Die Tests scannen `fixtures/cases/*/input.abc` automatisch. Ein neuer Testfall wird
für Song-Vergleiche aufgenommen, sobald zusätzlich `song.json` existiert; für
Sheet-Vergleiche entsprechend mit `sheet.json`.

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
| `02_twoStaff` | Legacy-Testcase aus `30_sources/SRC_Zupfnoter/testcases/` |
| `Twostaff` | Legacy-Testcase aus `30_sources/SRC_Zupfnoter/testcases/` |

## Fixtures neu erzeugen (Legacy-Export)

Voraussetzung: Laufendes Legacy-System (`bwl21/zupfnoter`,
Branch `feature/voice-styles_and-other-concepts`) mit dem CLI-Modus
`--export-fixtures`.

Bequemer Wrapper aus diesem Repo:

```bash
npm run test:loadsample -- "~/Dropbox/RuthVeehNoten/78*.abc"
```

Standardmäßig verwendet der Wrapper den Legacy-CLI-Pfad
`../200_Zupfnotenprojekte/10_Harfenfreizeit-Monbachtal/zupfnoter-cli.min.js`
relativ zum Repo-Root.

Falls nötig kann der CLI-Pfad überschrieben werden, entweder per Environment oder
als zweites Argument:

```bash
export ZUPFNOTER_LEGACY_CLI=/pfad/zu/zupfnoter-cli.min.js
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
cd packages/core
npx vitest run src/testing/__tests__/song/dump_ts_output.spec.ts
# Schreibt: fixtures/cases/<name>/_ts_output/song.json
```

Diese Dateien sind **nicht** die Referenz-Fixtures — sie zeigen nur, was die TS-Pipeline
aktuell produziert. Vergleiche sie mit dem Legacy-Export, um Abweichungen zu finden.

### 2. Legacy-Fixtures exportieren

Der Legacy-Exporter nimmt ABC-Dateien und erzeugt pro Datei ein Testfall-Verzeichnis:

```bash
cd ../200_zupfnoter/30_sources/SRC_Zupfnoter/src
node --max_old_space_size=4096 zupfnoter-cli.js \
  --export-fixtures \
  "/path/to/zupfnoter-ts/fixtures/cases/*/input.abc" \
  /path/to/zupfnoter-ts/fixtures/cases
```

Für jede Eingabedatei wird geschrieben:

```text
fixtures/cases/<test-case>/input.abc
fixtures/cases/<test-case>/song.json
fixtures/cases/<test-case>/sheet.json
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
pnpm --filter @zupfnoter/core run test:unit
```

Schlagen Tests fehl, zeigt `formatMismatches` den genauen Pfad der Abweichung:
```
voices[0].entities[2].pitch:
  expected: 60
  actual:   48
```

## TS-Ausgabe als Bootstrap-Referenz

Solange das Legacy-System nicht verfügbar ist, können die Fixtures aus der TS-Pipeline
selbst erzeugt werden (Bootstrap-Ansatz). Die Ausgabe dient als Regressionsbasis —
nicht als Verifikation gegen das Legacy-System.

```bash
# Song-Fixtures (Stufe 2):
cd packages/core
npx vitest run src/testing/__tests__/song/dump_ts_output.spec.ts
cp fixtures/cases/<name>/_ts_output/song.json fixtures/cases/<name>/song.json

# Sheet-Fixtures (Stufe 3):
npx vitest run src/testing/__tests__/sheet/dump_ts_output.spec.ts
cp fixtures/cases/<name>/_ts_output/sheet.json fixtures/cases/<name>/sheet.json
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

## Vergleichsstrategie

Semantischer Vergleich — nur fachlich relevante Felder werden geprüft:

| Stufe | Felder | Toleranz |
|-------|--------|----------|
| Song | `type`, `pitch`, `duration`, `beat`, `variant`, `visible` | exakt |
| Sheet `center`, `from`, `to` | Positionen (mm) | ±0.1 mm |
| Sheet `size` | Größen (mm) | ±0.05 mm |
| Sheet `type`, `fill`, `color`, `style`, `glyphName` | — | exakt |
| Sheet Anzahl `children` | — | exakt |
