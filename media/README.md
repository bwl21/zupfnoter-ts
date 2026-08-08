# Medienproduktion für Zupfnoter-ts

Dieses Verzeichnis enthält die versionierbaren Quellen für wiederverwendbare
Video-Szenen. Die fachlichen Botschaften und vollständigen Drehbücher liegen
unter [`docs/promotion/`](../docs/promotion/README.md).

## Inhalt

- `catalog/scenes/`: fachlich abgegrenzte Szenenmanifeste
- `catalog/productions/`: Zusammenstellung konkreter Filme
- `capture/profiles/`: verbindliche Aufnahmeparameter
- `narration/`: später ausgelagerte Sprechertexte und Sprachvarianten
- `overlays/`: Quellen für Einblendungen und Kapitelkarten
- `diagrams/`: Quellen für erklärende Grafiken

Freigegebene, weboptimierte Endfassungen werden als Produktassets nach
`apps/web/public/media/videos/` übernommen. Rohaufnahmen, Schnittprojekte und
Zwischenstände gehören nicht in dieses Repository.

## Statuswerte

- `planned`: fachlich beschrieben, aber noch nicht aufgenommen
- `verified`: Ablauf im aktuellen Build geprüft
- `recorded`: Rohszene aufgenommen
- `approved`: redaktionell und fachlich freigegeben
- `stale`: nach einer Produktänderung erneut zu prüfen
