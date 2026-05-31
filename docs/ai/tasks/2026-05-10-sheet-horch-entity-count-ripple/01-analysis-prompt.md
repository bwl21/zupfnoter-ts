# Repo-Analyse-Prompt

Analysiere ausschließlich folgendes Thema aus dem Repo-Kontext.

## Thema

sheet.horch-entity-count-ripple

## Goal

Sheet-Legacy-Vergleichstest für 246_Horch-was-kommt-von-draussen-rein extract 0 läuft grün.

## Current Status (2026-05-10)

- **BeatPacker._packMethod0** hatte einen Bug (`isContinuationAfterPart`-Logik, die es in Ruby nicht gibt) — gefixt in `8a71f38`. Dieser Fix betraf aber nur pack_method 0, nicht pack_method 1.
- **Horch verwendet `pack_method: 1`** (Collision-basiert). Der Fix hat Horch daher nicht direkt beeinflusst.
- **Child-Zahlen passen:** 1290 children, FlowLine/Path/Annotation/Glyph/Ellipse-Zählungen stimmen mit Legacy überein.
- **Annotation-Hintergrundgrößen passen** (Countnote-Text smit schmalen Glyphen).
- **Pause-decorations** werden korrekt kopiert (10 fehlende decorations restored).
- **Rest-Pitch** wird korrekt gesetzt (center/next/previous).
- **Verbleibender Fehler:** ~0.4mm residualer Y-Drift (accumulierend über viele Beats) sowie vereinzelte X-Positions-Fehler (z. B. children[1230] mit X: 57.46 vs 66.46).
- **Beat_maps im Legacy** speichern Roh-Zeit (`@beat === time`), nicht das Kompressionsergebnis. Ein direkter Vergleich von `computeBeatCompression` gegen `@beat` ist daher nicht sinnvoll.

## Notes

- Fehler liegt vermutlich in `_packMethod1()` (Collision Detection) oder in der Interaktion zwischen `_packMethod1` und `applyLegacyBeatSpread`.
- Horch-Konfiguration: `pack_method: 1, pack_max_spreadfactor: 2, pack_min_increment: 0.30`.
- Die pack_method-1-Logik in TS wurde direkt aus `compute_beat_compression_1()` portiert — aber es könnte Detailunterschiede in der Kollisionserkennung geben (z. B. prevPitch vs prevPlayable, Inversionslogik).
- pack_methods 1, 3, 10 haben keine `isContinuationAfterPart`-Logik (nur method 0 hatte diesen Bug).

## Auftrag

Liefere nur belegbare Fakten aus dem Repo:

- betroffene Dateien
- relevante Typen, Klassen, Funktionen
- bestehende Zustände und Datenflüsse
- Legacy-Referenzen
- vorhandene Tests und Fixtures
- offene GAPs oder TODOs
- Risiken bei Änderungen

## Grenzen

- Keine Implementierung vorschlagen.
- Keine Refactorings vorschlagen.
- Keine Architektur neu entwerfen.
- Keine Dateien ändern.
- Wenn etwas unklar ist, explizit als unklar markieren.
