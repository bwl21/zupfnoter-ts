# Spec: Legacy-Vergleichstests für Zupfnoter-TS

## Problem

Der TypeScript-Rewrite von Zupfnoter muss fachlich korrekte Ergebnisse liefern.
Da die Transformationskette komplex ist (ABC → Song → Sheet), brauchen wir eine
Teststrategie, die sicherstellt, dass die TS-Implementierung semantisch äquivalent
zum Legacy-System (Ruby/Opal) ist — ohne das Legacy-System im CI betreiben zu müssen.

---

## Teststrategie: Überblick

```
Legacy-System (einmalig, lokal)          zupfnoter-ts (CI)
────────────────────────────────         ──────────────────────────────
ABC-Fixture → Song.toJSON()   ──────►   fixtures/song/<name>.json
ABC-Fixture → Sheet.toJSON()  ──────►   fixtures/sheet/<name>.json
                                         │
                                         ▼
                                    Vitest: TS-Ausgabe vs. Fixture
                                    (semantischer Vergleich)
```

Fixtures werden **einmalig manuell** aus dem laufenden Legacy-System exportiert
und ins Repository eingecheckt. Im CI läuft nur der TS-seitige Vergleich.

---

## Vergleichsstufen

Verglichen wird auf **beiden** Transformationsstufen:

| Stufe | Legacy-Objekt | Fixture-Datei | TS-Klasse |
|-------|--------------|---------------|-----------|
| 2 | `Harpnotes::Music::Song` | `fixtures/song/<name>.json` | `Song` |
| 3 | `Harpnotes::Drawing::Sheet` | `fixtures/sheet/<name>.json` | `Sheet` |

---

## ABC-Fixtures

Zwei Kategorien:

### Minimale Fixtures (neu erstellt)

Kleine, gezielt konstruierte ABC-Stücke, die einzelne Features isoliert testen.
Abgelegt unter `fixtures/abc/minimal/`.

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

### Legacy-Testcases (aus `bwl21/zupfnoter`)

Ausgewählte Dateien aus `30_sources/SRC_Zupfnoter/testcases/`.
Abgelegt unter `fixtures/abc/legacy/`.

| Datei | Testet |
|-------|--------|
| `02_twoStaff.abc` | Mehrstimmigkeit, Parts |
| `Twostaff.abc` | Standardfall |

---

## Fixture-Erzeugung (einmalig, manuell)

### Voraussetzung

Laufendes Legacy-System (`bwl21/zupfnoter`, Branch `feature/voice-styles_and-other-concepts`).

### Vorgehen

1. Im Legacy-System eine Export-Funktion aktivieren (oder temporär einbauen), die
   nach der Transformation `Song#to_json` und `Sheet#to_json` in Dateien schreibt.
2. Für jede ABC-Fixture-Datei ausführen:
   ```
   zupfnoter export --abc fixtures/abc/minimal/single_note.abc \
     --song fixtures/song/single_note.json \
     --sheet fixtures/sheet/single_note.json
   ```
3. Erzeugte JSON-Dateien ins Repository einchecken.
4. Fixtures gelten als **stabil** — sie werden nur bei bewussten fachlichen Änderungen
   aktualisiert (mit Commit-Kommentar, der die Änderung begründet).

### Fixture-Format Song (Stufe 2)

```json
{
  "meta_data": { "title": "...", "composer": "...", "meter": "4/4", "key": "G" },
  "voices": [
    {
      "entities": [
        { "type": "Note", "pitch": 60, "duration": 384, "beat": 0, "znId": "1-0" },
        { "type": "Pause", "duration": 384, "beat": 384 }
      ]
    }
  ],
  "beat_maps": [ { "0": 0, "384": 1 } ]
}
```

### Fixture-Format Sheet (Stufe 3)

```json
{
  "children": [
    { "type": "Ellipse", "center": [25.4, 10.0], "size": [3.5, 1.7], "fill": false, "color": "black" },
    { "type": "FlowLine", "from": [25.4, 10.0], "to": [25.4, 15.0], "style": "solid" }
  ]
}
```

---

## Vergleichsstrategie: Semantischer Vergleich

Kein exakter JSON-Vergleich. Geprüft werden nur fachlich relevante Felder.

### Song-Vergleich (Stufe 2)

Pro Entity in jeder Stimme werden verglichen:

| Feld | Toleranz | Begründung |
|------|----------|-----------|
| `type` | exakt | Note/Pause/SynchPoint muss stimmen |
| `pitch` | exakt | MIDI-Pitch ist diskret |
| `duration` | exakt | Notenwert ist diskret |
| `beat` | exakt | Zeitposition ist diskret |
| `variant` | exakt | Wiederholungsvariante |
| `visible` | exakt | Sichtbarkeit |

Nicht verglichen: interne IDs, Quelltext-Positionen (`startPos`/`endPos`), Implementierungsdetails.

### Sheet-Vergleich (Stufe 3)

Pro Drawable in `children`:

| Feld | Toleranz | Begründung |
|------|----------|-----------|
| `type` | exakt | Ellipse/FlowLine/Glyph/Annotation/Path |
| `center` | ±0.1 mm | Fließkomma-Layoutberechnung |
| `size` | ±0.05 mm | Fließkomma |
| `fill` | exakt | Boolean |
| `color` | exakt | String |
| `style` | exakt | solid/dashed/dotted |
| Anzahl children | exakt | Kein Element darf fehlen oder hinzukommen |

Nicht verglichen: `confKey`, `draginfo`, interne Referenzen.

### Hilfsfunktion `semanticMatch`

```typescript
// packages/core/src/testing/semanticMatch.ts
function matchSong(actual: Song, fixture: SongFixture): MatchResult
function matchSheet(actual: Sheet, fixture: SheetFixture): MatchResult

interface MatchResult {
  passed: boolean
  mismatches: Mismatch[]
}

interface Mismatch {
  path: string      // z.B. "voices[0].entities[3].pitch"
  expected: unknown
  actual: unknown
}
```

---

## Anforderungen

### Muss

- [ ] Fixture-Verzeichnisstruktur anlegen (`fixtures/abc/`, `fixtures/song/`, `fixtures/sheet/`)
- [ ] Minimale ABC-Fixtures erstellen (8 Dateien, siehe oben)
- [ ] Legacy-ABC-Fixtures kopieren (2 Dateien aus `bwl21/zupfnoter`)
- [ ] Export-Skript für Legacy-System dokumentieren (README in `fixtures/`)
- [ ] `semanticMatch`-Hilfsfunktionen implementieren (`matchSong`, `matchSheet`)
- [ ] Vitest-Tests für Stufe 2 (Song): je eine Testdatei pro ABC-Fixture
- [ ] Vitest-Tests für Stufe 3 (Sheet): je eine Testdatei pro ABC-Fixture
- [ ] Fixture-JSON für alle ABC-Fixtures einchecken (initial: Platzhalter, befüllt nach Legacy-Export)

### Kann (später)

- [ ] Update-Skript: Fixtures automatisch aus Legacy neu generieren
- [ ] Diff-Report: HTML-Ausgabe bei Abweichungen

---

## Akzeptanzkriterien

1. `npm run test:unit` läuft ohne Legacy-System durch.
2. Für jede ABC-Fixture existiert ein Song-Fixture und ein Sheet-Fixture.
3. `matchSong` und `matchSheet` schlagen bei bekannten Abweichungen fehl und
   geben einen lesbaren Pfad zur Abweichung aus.
4. Float-Toleranz von ±0.1 mm für Positionen, ±0.05 mm für Größen.
5. Fehlende oder zusätzliche Drawables im Sheet führen immer zum Fehler.
6. Fixtures sind versioniert und ändern sich nur durch bewusste Commits.

---

## Verzeichnisstruktur

```
fixtures/
├── README.md                  # Anleitung zur Fixture-Erzeugung aus Legacy
├── abc/
│   ├── minimal/
│   │   ├── single_note.abc
│   │   ├── two_voices.abc
│   │   ├── repeat.abc
│   │   ├── pause.abc
│   │   ├── tuplet.abc
│   │   ├── tie.abc
│   │   ├── decoration.abc
│   │   └── lyrics.abc
│   └── legacy/
│       ├── 02_twoStaff.abc
│       └── Twostaff.abc
├── song/
│   ├── single_note.json
│   ├── two_voices.json
│   └── ...
└── sheet/
    ├── single_note.json
    ├── two_voices.json
    └── ...

packages/core/src/testing/
├── semanticMatch.ts           # matchSong, matchSheet
└── __tests__/
    ├── song/
    │   ├── single_note.spec.ts
    │   ├── two_voices.spec.ts
    │   └── ...
    └── sheet/
        ├── single_note.spec.ts
        ├── two_voices.spec.ts
        └── ...
```

---

## Implementierungsschritte

1. `fixtures/`-Verzeichnisstruktur anlegen
2. Minimale ABC-Fixtures erstellen
3. Legacy-ABC-Fixtures kopieren
4. `fixtures/README.md` schreiben (Anleitung Legacy-Export)
5. Platzhalter-JSON für alle Fixtures anlegen (leere Struktur, damit Tests kompilieren)
6. `semanticMatch.ts` implementieren (`matchSong`, `matchSheet`, Float-Toleranz)
7. Vitest-Tests für Song-Stufe schreiben (gegen Platzhalter-Fixtures)
8. Vitest-Tests für Sheet-Stufe schreiben (gegen Platzhalter-Fixtures)
9. Legacy-Export durchführen und Fixture-JSON befüllen
10. Tests gegen befüllte Fixtures grün machen
