# Specs (Index)

Spezifikationen sind nach Phase geordnet in `docs/<phase>/spec.md` abgelegt.

| Datei | Inhalt |
|-------|--------|
| [docs/phase-0/spec.md](docs/phase-0/spec.md) | Phase 0 – Monorepo-Setup |
| [docs/phase-1/spec.md](docs/phase-1/spec.md) | Phase 1 – `@zupfnoter/types` |
| [docs/fixtures/spec.md](docs/fixtures/spec.md) | Legacy-Vergleichstests (fixtures/) |
| [docs/phase-2/spec.md](docs/phase-2/spec.md) | Phase 2 – ABC → Song |
| [docs/phase-3/spec-confstack.md](docs/phase-3/spec-confstack.md) | Phase 3.1 – Confstack |
| [docs/phase-3/spec-beatpacker.md](docs/phase-3/spec-beatpacker.md) | Phase 3.2 – BeatPacker |
| [docs/phase-3/spec-layout.md](docs/phase-3/spec-layout.md) | Phase 3.3 – HarpnotesLayout |
| [docs/phase-4/spec-svg.md](docs/phase-4/spec-svg.md) | Phase 4.1 – SvgEngine |
| [docs/adr/vector-umsetzung.md](docs/adr/vector-umsetzung.md) | ADR: Ruby `Vector` → TypeScript |

Neue Specs werden im jeweiligen Phase-Ordner abgelegt.
Die aktuelle Arbeits-Spec wird von Ona direkt in dieser Datei verwaltet und nach Abschluss archiviert.

| [docs/phase-5/demo-view-bugfixes.md](docs/phase-5/demo-view-bugfixes.md) | Demo-View: Browser-Kompatibilität, BeatPacker-Bugs, Y_SCALE |

---

# Aktuelle Arbeits-Spec: Sheet-Fixtures bootstrappen und Tests aktivieren

## Problem

Die Sheet-Vergleichstests (`fixtures/sheet/legacy_comparison.spec.ts`) sind alle mit
`.skip()` deaktiviert, weil `fixtures/sheet/*.json` leere Platzhalter sind. Das
Legacy-Ruby-System ist in dieser Umgebung nicht verfügbar, daher können die Fixtures
nicht direkt aus dem Legacy-Export befüllt werden.

Ohne aktive Sheet-Tests gibt es keine Regressionssicherung für Stufe 3
(Song → Drawing-Modell). Jede Änderung an `HarpnotesLayout.ts` oder `BeatPacker.ts`
kann unbemerkt die Ausgabe verändern.

## Lösung: Bootstrap-Ansatz

Die TS-Pipeline läuft einmal und erzeugt die Sheet-Fixtures aus ihrer eigenen Ausgabe.
Diese Fixtures werden eingefroren und dienen als Regressionsbasis. Sobald das
Legacy-Ruby-System verfügbar ist, werden die Fixtures durch echte Legacy-Referenzen
ersetzt (via `tools/legacy-sheet-to-fixture.mjs`).

## Anforderungen

### R1 – `sheetToFixture()` in `fixtureLoader.ts`

Neue Exportfunktion analog zu `songToFixture()`:

```typescript
export function sheetToFixture(sheet: Sheet): SheetFixture {
  return {
    children: sheet.children
      .filter(c => c.visible !== false)
      .map(c => {
        const entry: DrawableFixture = { type: c.type }
        if ('center'    in c) entry.center    = c.center
        if ('size'      in c) entry.size      = c.size
        if ('fill'      in c) entry.fill      = c.fill
        if ('from'      in c) entry.from      = c.from
        if ('to'        in c) entry.to        = c.to
        if ('style'     in c) entry.style     = c.style
        if ('glyphName' in c) entry.glyphName = c.glyphName
        if ('text'      in c) entry.text      = c.text
        if ('color'     in c) entry.color     = c.color
        return entry
      }),
  }
}
```

Felder die **nicht** ins Fixture übernommen werden: `confKey`, `lineWidth`, `origin`,
`visible` (bereits gefiltert), `draginfo`.

### R2 – `dump_ts_output.spec.ts` für Sheet (neues File)

Neues Spec-File `packages/core/src/testing/__tests__/sheet/dump_ts_output.spec.ts`
analog zum Song-Dump:

```typescript
// Schreibt: fixtures/sheet/_ts_output/<name>.json
// Ausführen: npx vitest run src/testing/__tests__/sheet/dump_ts_output.spec.ts
```

Für alle 10 Fixtures (8 minimal + 2 legacy). Ausgabe in `fixtures/sheet/_ts_output/`.

### R3 – Sheet-Fixtures befüllen (Bootstrap)

Die 10 `fixtures/sheet/*.json`-Platzhalter werden mit der aktuellen TS-Ausgabe befüllt.
Dazu wird der Dump-Spec einmalig ausgeführt und die Ausgabe in `fixtures/sheet/` kopiert.

Format pro Fixture:
```json
{
  "children": [
    { "type": "Ellipse", "center": [60.3, 16.4], "size": [2.45, 1.19], "fill": "filled", "color": "black" },
    { "type": "FlowLine", "from": [60.3, 16.4], "to": [60.3, 19.2], "style": "solid", "color": "black" },
    ...
  ]
}
```

Kein `_comment`-Feld in den befüllten Fixtures (nur in Platzhaltern).

### R4 – Sheet-Tests aktivieren (`.skip()` entfernen)

In `packages/core/src/testing/__tests__/sheet/legacy_comparison.spec.ts`:
- Alle `it.skip(...)` → `it(...)` ändern
- Tests müssen nach dem Bootstrap grün sein

### R5 – `tools/legacy-sheet-to-fixture.mjs` (neues Tool)

Konvertierungstool für den späteren Legacy-Export, analog zu `legacy-song-to-fixture.mjs`.

Eingabe: Legacy-Sheet-JSON (Ruby `result.to_json` nach `layouter.layout(...)`)
Ausgabe: `SheetFixture`-Format für `fixtures/sheet/<name>.json`

Mapping der Legacy-Klassen auf TS-Typen:

| Legacy-Klasse | TS-Typ |
|---------------|--------|
| `Harpnotes::Drawing::Ellipse` | `Ellipse` |
| `Harpnotes::Drawing::FlowLine` | `FlowLine` |
| `Harpnotes::Drawing::Glyph` | `Glyph` |
| `Harpnotes::Drawing::Annotation` | `Annotation` |
| `Harpnotes::Drawing::Path` | `Path` |
| `Harpnotes::Drawing::Image` | `Image` |

Felder-Mapping (Legacy Ruby → TS):

| Legacy-Feld | TS-Feld | Typ |
|-------------|---------|-----|
| `@center` | `center` | `[number, number]` |
| `@size` | `size` | `[number, number]` |
| `@fill` | `fill` | `'filled' \| 'empty'` |
| `@from` | `from` | `[number, number]` |
| `@to` | `to` | `[number, number]` |
| `@style` | `style` | `'solid' \| 'dashed' \| 'dotted'` |
| `@glyph_name` | `glyphName` | `string` |
| `@text` | `text` | `string` |
| `@color` | `color` | `string` |

Nicht übernommen: `@line_width`, `@conf_key`, `@visible` (nur sichtbare Elemente exportieren).

Usage:
```bash
node tools/legacy-sheet-to-fixture.mjs <input.sheet.json> [output.json]
```

## Akzeptanzkriterien

1. `sheetToFixture(sheet)` gibt ein valides `SheetFixture`-Objekt zurück
2. `dump_ts_output.spec.ts` (Sheet) schreibt 10 Dateien nach `fixtures/sheet/_ts_output/`
3. Alle 10 `fixtures/sheet/*.json` sind befüllt (kein `"children": []` mehr)
4. Alle 10 Sheet-Vergleichstests laufen ohne `.skip()` und sind grün
5. `tools/legacy-sheet-to-fixture.mjs` existiert und ist dokumentiert
6. Alle bestehenden Tests (151) bleiben grün

## Implementierungsschritte

1. `sheetToFixture()` in `fixtureLoader.ts` implementieren
2. `packages/core/src/testing/__tests__/sheet/dump_ts_output.spec.ts` erstellen
3. Dump-Spec ausführen → `fixtures/sheet/_ts_output/` befüllen
4. `_ts_output`-Dateien nach `fixtures/sheet/` kopieren (Bootstrap)
5. `.skip()` in `sheet/legacy_comparison.spec.ts` entfernen
6. Tests ausführen und grün verifizieren
7. `tools/legacy-sheet-to-fixture.mjs` erstellen
8. `fixtures/README.md` um Sheet-Export-Anleitung ergänzen
