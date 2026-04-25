# Phase 5 – Demo-View: Bugfixes und Erkenntnisse

**Datum:** 2026-04-25  
**Branch:** `feature/phase-5-demo-view`

---

## Kontext

Beim Aufbau der minimalen SVG-Demo (`apps/web/src/views/DemoView.vue`) wurden drei
Bugs in der Core-Pipeline entdeckt, die erst durch das End-to-End-Rendering im Browser
sichtbar wurden. Die Pipeline produzierte zwar ein SVG, aber die Noten lagen außerhalb
des sichtbaren Bereichs.

---

## Bug 1: BeatPacker – falscher Skalierungsfaktor (`beatResolution` statt `shortestNote`)

**Datei:** `packages/core/src/BeatPacker.ts`

**Problem:**  
In allen `_packMethod`-Funktionen wurde `size = beatResolution * sizeFactor` berechnet.
`BEAT_RESOLUTION = 384` ist der abc2svg-interne Wert für eine ganze Note. Damit ergab
sich `size = 384 * 0.9 = 345.6` — viel zu groß für Beat-Einheiten.

**Ursache:**  
`BEAT_RESOLUTION` und `SHORTEST_NOTE` wurden verwechselt. Im Legacy-System ist
`SHORTEST_NOTE` (= 96, eine Viertelnote in abc2svg-Units) die Basis für die
Schrittgröße der Kompression.

**Fix:**  
```typescript
// vorher
const size = beatResolution * sizeFactor

// nachher
const shortestNote = (conf.get('layout.SHORTEST_NOTE') as number) ?? beatResolution / 4
const size = shortestNote * sizeFactor
```

Gilt für alle vier Pack-Methoden (0, 1, 3, 10).

---

## Bug 2: HarpnotesLayout – 1-basierte Stimmnummern nicht konvertiert

**Datei:** `packages/core/src/HarpnotesLayout.ts`

**Problem:**  
`layoutlineVoices` enthält 1-basierte Stimmnummern aus der Config (z.B. `[1, 2, 3, 4]`).
`computeBeatCompression` erwartet 0-basierte Indizes in `song.voices`. Die Übergabe
ohne Konvertierung führte dazu, dass `song.voices[1]` (Stimme 2) statt `song.voices[0]`
(Stimme 1) gelesen wurde — und `song.voices[4]` war `undefined`.

**Folge:**  
`collectRelevantPlayables` fand keine Noten → `BeatCompressionMap` war leer →
`beatMap[beat]` gab immer `undefined` zurück → Fallback auf rohen Beat-Wert.

Die Snapshots wurden in diesem kaputten Zustand erstellt und spiegelten unkomprimierte
Beat-Werte wider (`y = beat * Y_SCALE + startpos`).

**Fix:**  
```typescript
// vorher
const beatCompressionMap = computeBeatCompression(song, layoutlineVoices, conf)

// nachher
const layoutlineIndices = layoutlineVoices.map(v => v - 1)
const beatCompressionMap = computeBeatCompression(song, layoutlineIndices, conf)
```

---

## Bug 3: Y_SCALE – falscher Wert in defaultConfig

**Datei:** `packages/core/src/testing/defaultConfig.ts`

**Problem:**  
`Y_SCALE = 1.0` bedeutet: komprimierte Beat-Werte (in abc2svg-Units, ~54 für eine
Viertelnote) werden 1:1 als mm-Koordinaten verwendet. Eine Viertelnote landet damit
bei y ≈ 54mm, vier Noten bei y ≈ 328mm — außerhalb des A3-Blatts (282mm).

**Ursache:**  
`Y_SCALE` ist der Konversionsfaktor von Beat-Units auf mm. Der korrekte Wert ergibt
sich aus der Anforderung, dass ein typisches Stück (26 Noten) auf ein A3-Blatt passt:

```
26 Noten × (SHORTEST_NOTE × sizeFactor / 2) × Y_SCALE ≤ DRAWING_AREA_SIZE[1] - startpos
26 × 48 × Y_SCALE ≤ 267
Y_SCALE ≤ 0.215
```

`Y_SCALE = 0.1` ergibt ~8.6mm pro Viertelnote — realistisch für ein Harfennoten-Blatt.

**Fix:**  
```typescript
Y_SCALE: 0.1,  // war: 1.0
```

---

## Browser-Kompatibilität: abc2svg-Loader

**Datei:** `packages/core/vendor/abc2svg-browser.ts` (neu)

**Problem:**  
`AbcParser.ts` verwendete `createRequire` aus `node:module` und `vm.runInNewContext`
(via `abc2svg-loader.cjs`) um abc2svg zu laden. Diese Node.js-APIs sind im Browser
nicht verfügbar.

**Lösung:**  
Neuer Browser-kompatibler Wrapper `abc2svg-browser.ts`:
- Lädt abc2svg-Quelltext via Vite's `?raw`-Import (funktioniert in Browser und Node.js)
- Führt den Code in einem `new Function()`-Scope mit gefaktem `module`/`exports` aus
- Der CJS-Check in abc2svg (`typeof module=='object'&&typeof exports=='object'`) greift
  korrekt → Exports werden gesetzt

```typescript
import abc2svgSource from './abc2svg-1.js?raw'

function loadAbc2svg() {
  const mod = { exports: {} }
  const fn = new Function('module', 'exports', abc2svgSource)
  fn(mod, mod.exports)
  return mod.exports
}
```

`AbcParser.ts` importiert jetzt `abc2svg-browser.ts` statt `abc2svg-loader.cjs`.

---

## Vite-Konfiguration für Workspace-Pakete

**Datei:** `apps/web/vite.config.ts`

Damit Vite die Workspace-Pakete (`@zupfnoter/core`, `@zupfnoter/types`) im Dev-Modus
direkt aus den TypeScript-Quellen auflöst (ohne Build-Schritt):

```typescript
resolve: {
  conditions: ['source', 'import', 'module', 'browser', 'default'],
},
optimizeDeps: {
  exclude: ['@zupfnoter/core', '@zupfnoter/types'],
},
```

Die `package.json` beider Pakete erhält einen `"source"`-Export-Eintrag:

```json
"exports": {
  ".": {
    "source": "./src/index.ts",
    "import": "./dist/index.js",
    "types": "./dist/index.d.ts"
  }
}
```

---

## Ergebnis

Die Demo-View rendert das Vater-Lied (4 Stimmen, 424 Noten, 1199 Drawables) korrekt
als SVG im Browser. Die Pipeline `AbcParser → AbcToSong → HarpnotesLayout → SvgEngine`
ist End-to-End verifiziert.

Die abc2svg-Warnungen (`Bad tie`, `Different bars`) sind Inkonsistenzen im ABC-Quelltext
und blockieren das Rendering nicht.
