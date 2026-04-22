# Fixtures

Referenz-Daten für Legacy-Vergleichstests. Die JSON-Fixtures wurden einmalig aus dem
Legacy-System (`bwl21/zupfnoter`, Branch `feature/voice-styles_and-other-concepts`)
exportiert und sind versioniert. Sie ändern sich nur bei bewussten fachlichen Änderungen
(Commit-Kommentar muss die Änderung begründen).

## Verzeichnisstruktur

```
fixtures/
├── abc/
│   ├── minimal/    # Gezielt konstruierte Minimal-Fixtures (je ein Feature)
│   └── legacy/     # Ausgewählte Testcases aus bwl21/zupfnoter
├── song/           # Stufe-2-Fixtures: Song-JSON (ABC → Musikmodell)
└── sheet/          # Stufe-3-Fixtures: Sheet-JSON (Song → Drawing-Modell)
```

## ABC-Fixtures

### Minimal

| Datei | Testet |
|-------|--------|
| `single_note.abc` | Eine Note, eine Stimme |
| `two_voices.abc` | Zwei Stimmen, Synchlines |
| `repeat.abc` | Wiederholung mit Volta-Klammern |
| `pause.abc` | Pausen verschiedener Längen |
| `tuplet.abc` | Triolen |
| `tie.abc` | Bindebögen |
| `decoration.abc` | Fermata, Dynamik |
| `lyrics.abc` | Liedtext (w:-Zeilen) |

### Legacy

| Datei | Quelle |
|-------|--------|
| `02_twoStaff.abc` | `30_sources/SRC_Zupfnoter/testcases/` |
| `Twostaff.abc` | `30_sources/SRC_Zupfnoter/testcases/` |

## Fixtures neu erzeugen (Legacy-Export)

Voraussetzung: Laufendes Legacy-System (`bwl21/zupfnoter`).

### 1. Export-Funktion im Legacy-System aktivieren

Im Legacy-System (`controller.rb`) nach `load_music_model` und `layouter.layout(...)` 
temporär einfügen:

```ruby
# Nach load_music_model (Zeile ~929):
File.write("song_export.json", @music_model.to_json)

# Nach layouter.layout(...) (Zeile ~877):
File.write("sheet_export.json", result.to_json)
```

### 2. Export für jede Fixture ausführen

```bash
# Im Legacy-Repo-Verzeichnis:
for abc in path/to/zupfnoter-ts/fixtures/abc/minimal/*.abc \
           path/to/zupfnoter-ts/fixtures/abc/legacy/*.abc; do
  name=$(basename "$abc" .abc)
  ruby zupfnoter_export.rb "$abc"
  cp song_export.json  path/to/zupfnoter-ts/fixtures/song/${name}.json
  cp sheet_export.json path/to/zupfnoter-ts/fixtures/sheet/${name}.json
done
```

### 3. Fixtures einchecken

```bash
git add fixtures/song/ fixtures/sheet/
git commit -m "fixtures: update legacy reference snapshots

Reason: <Begründung der Änderung>"
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
