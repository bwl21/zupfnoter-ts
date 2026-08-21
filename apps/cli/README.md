# Zupfnoter CLI

Der Batch-Renderer liest ABC-Dateien, verwendet die eingebettete Konfiguration
und erzeugt pro `produce`-Auszug SVG- und PDF-Ausgaben:

```bash
pnpm --filter @zupfnoter/cli exec node dist/index.js \
  /pfad/zu/*.abc /zielordner \
  --format A3-A4 \
  --practice-url https://practice.zupfnoter.de/
```

Wenn ein Auszug das reservierte Bild `$player_qr` enthält, wird der
Übungslink während des Renderns aus dem aktuellen Auszug und seinen aktiven
Stimmen erzeugt. Der QR-Code wird als temporäres JPG in das normale
Bild-Asset eingesetzt; es wird keine QR-Datei gespeichert oder hochgeladen.

Ohne `--practice-url` bleibt das reservierte Bild leer und der Batchlauf meldet
den übersprungenen QR-Code. Die Ausgabe verwendet die konfigurierten
`produce`-Auszüge und deren `filenamepart`.
