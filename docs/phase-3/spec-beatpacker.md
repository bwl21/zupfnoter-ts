# Spec: BeatPacker (Phase 3.2)

## Problem

Der BeatPacker konvertiert Beat-Nummern in vertikale Positionen auf dem Notenblatt.
Er komprimiert die vertikale Achse so, dass kurze Noten weniger Platz einnehmen
als lange Noten, ohne dass Noten kollidieren.

---

## Implementierung

`packages/core/src/BeatPacker.ts` — `computeBeatCompression(song, layoutLines, conf)`

### Pack-Methoden

| Methode | Beschreibung |
|---------|-------------|
| 0 | Standard: Notengrößen, Taktanfänge, Abschnittswechsel |
| 1 | Kollision: Pitch-Kollisionsprüfung (horizontale Überlappung) |
| 2 | Linear: `beat * 8` |
| 3 | Kollision v2: Pitch-Range-Kollisionsprüfung |
| 10 | Legacy-Standard: via BeatMaps |

### Manuelle Inkremente (`minc`)

Über `pack_min_increment` in der Konfiguration können pro Zeitposition
manuelle Mindest-Inkremente gesetzt werden.

---

## Abhängigkeiten

- `prevPitch` / `nextPitch` auf `Playable` (für Methoden 1 + 3)
- `prevPlayable` / `nextPlayable` auf `Playable` (für Layout-Engine, Phase 3.3)
- `buildConfstack` für Konfigurationsauflösung

---

## Akzeptanzkriterien

1. Alle 5 Pack-Methoden implementiert
2. `getMincFactor()` für manuelle Inkremente
3. Unit-Tests für alle Methoden in `BeatPacker.spec.ts`
4. 106 Tests grün

---

## Branch

`feature/phase-3-beatpacker`
