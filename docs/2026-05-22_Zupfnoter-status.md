# Zupfnoter Status

**Stand:** 2026-05-22

## 1. Erledigt

- Horch-Sheet-Parität ist für `246_Horch-was-kommt-von-draussen-rein` wieder grün.
- Der eigentliche Root Cause im Beat-Packer war behoben:
  - `extract.notebound.minc` wird jetzt korrekt als Layout-Minc berücksichtigt.
  - `pack_method 1` verwendet wieder die Legacy-nahe Kollisions-/Carry-Semantik.
- Die jsPDF-nahe Annotationstext-Metrik ist sauberer verdrahtet:
  - `createDefaultAnnotationTextMetrics()` bleibt im Core erhalten.
  - Es gibt jetzt eine explizite jsPDF-Factory im Core.
  - `apps/demo` reicht die Metrik explizit an `HarpnotesLayout` durch.
- Die Fixture-Vergleichstests verwenden jetzt eine test-only Legacy-Metrik-Implementierung, ohne den Produktions-Fallback zu verbiegen.
- Der Core-Typecheck ist wieder grün, nachdem `packages/types` neu gebaut wurde.

## 2. Offen

- `Twostaff` bleibt im Sheet-Legacy-Vergleich rot.
- Der offene Gap liegt derzeit nicht mehr in Horch oder im Typecheck, sondern in der Multi-Stimm-/Sheet-Parität von `Twostaff`.

## 3. Relevante Dateien und Entscheidungen

- `packages/core/src/BeatPacker.ts`
  - Fix für `extract.notebound.minc` und Legacy-nahe pack_method-1-Semantik.
- `packages/core/src/TextMetrics.ts`
  - `AnnotationTextMetrics`-Abstraktion bleibt im Core.
  - `createDefaultAnnotationTextMetrics()` bleibt als Default erhalten.
  - `createJsPdfAnnotationTextMetrics(...)` macht die jsPDF-Quelle explizit.
- `packages/core/src/testing/fixtureLoader.ts`
  - Sheet-Vergleichstests bekommen eine test-only Metrik-Injektion.
- `packages/core/src/testing/legacyAnnotationTextMetrics.ts`
  - Test-only Legacy-Metrikadapter für Fixture-Vergleiche.
- `apps/demo/src/DemoView.vue`
  - Demo reicht die Annotation-Metrik explizit an `HarpnotesLayout` weiter.
- `packages/types`
  - Gebaute Typdeklarationen mussten frisch erzeugt werden, damit `core` wieder sauber typecheckt.

## 4. Risiken und offene Fragen

- Die Test-/Vergleichs-Metrik ist absichtlich von der Produktionsmetrik getrennt; wenn künftig weitere SVG/PDF-Abweichungen auftreten, muss klar entschieden werden, ob sie aus echter jsPDF-Parität oder aus Test-Fallbacks stammen.
- Der `Twostaff`-Gap ist noch nicht analysiert; dort ist unklar, ob die Ursache in Layout-Reihenfolge, Multi-Staff-Handling oder einer weiteren Metrik-/Abstandsregel liegt.
- Die Workspace-Typen sind korrekt, aber nur, weil `packages/types` gebaut wurde; das ist ein Build-Schritt, kein Quellcode-Fix.

## 5. Nächster kleinster Schritt

- `Twostaff` isoliert im Sheet-Legacy-Test analysieren, den ersten konkreten Divergenzpunkt bestimmen und nur die dazugehörige Layout-Regel in `packages/core/src/HarpnotesLayout.ts` korrigieren.
