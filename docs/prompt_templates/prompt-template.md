# Prompt Templates für Zupfnoter-TS

## Grundprinzipien
- Prompt steuert, erklärt nicht
- Scope zuerst nennen
- kleine Änderungen
- Guardrails setzen

---

## Template: Code-Änderung

Datei: <pfad/zur/datei>

Änderung:
- <konkrete Änderung 1>
- <konkrete Änderung 2>

Constraints:
- keine weiteren Änderungen
- kein Refactoring
- keine Imports ändern

Output:
- nur geänderten Code zeigen

---

## Template: Interface (TypeScript)

Datei: <types-datei>

Ändere Interface <Name>:
- JSDoc ergänzen
- Einheiten dokumentieren (mm)
- keine Inline-Kommentare für Semantik

Constraints:
- keine Strukturänderung
- keine neuen Felder

Output:
- nur geändertes Interface

---

## Template: Bugfix

Datei: <datei>

Problem:
- <kurz beschreiben>

Fix:
- minimaler Fix

Constraints:
- kein Refactoring

Tests:
- Test ergänzen

Output:
- Fix + Test

---

## Template: Analyse

Frage:
- Wo wird <X> verwendet?

Output:
- kurze Liste
- keine Erklärungen

---

## Template: Minimal-Diff

Ändere nur:
- <konkreter Punkt>

Constraints:
- keine weiteren Änderungen

Output:
- minimaler Diff

---

## Anti-Patterns

- zu viel Kontext wiederholen
- mehrere Tasks mischen
- "mach sauber"
- unscharfe Anforderungen

---

## Gold-Standard

Datei: packages/types/src/Drawing.ts

Ändere Ellipse:
- center und size mit JSDoc dokumentieren
- Einheit mm

Constraints:
- keine weiteren Änderungen
- kein Refactoring

Output:
- nur geänderten Code

## goal prompt

/new

/goal Fix 246_Horch-was-kommt-von-draussen-rein in song/legacy_comparison.spec.ts

Requirements:
- analyze legacy Ruby behavior first
- identify where BeatPacker input diverges
- preserve existing TypeScript architecture
- minimal invasive change
- avoid formatting-only diffs

Acceptance criteria:
- target fixture matches legacy output
- no unrelated fixture changes
- explain root cause before implementing