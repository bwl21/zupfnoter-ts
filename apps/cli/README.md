# Zupfnoter CLI

Der Batch-Renderer liest ABC-Dateien, verwendet die eingebettete Konfiguration
und erzeugt pro `produce`-Auszug SVG- und PDF-Ausgaben:

```bash
pnpm --filter @zupfnoter/cli exec node dist/index.js \
  /pfad/zu/*.abc /zielordner \
  --format A3-A4 \
  --player-url https://zupfnoter-player.csweichel.dev/
```

Wenn ein Auszug das reservierte Bild `$player_qr` enthält, wird der
Player-Link während des Renderns aus dem aktuellen Auszug und seinen aktiven
Stimmen erzeugt. Der QR-Code wird als temporäres JPG in das normale
Bild-Asset eingesetzt; es wird keine QR-Datei gespeichert oder hochgeladen.

Ohne `--player-url` bleibt das reservierte Bild leer und der Batchlauf meldet
den übersprungenen QR-Code. Die Ausgabe verwendet die konfigurierten
`produce`-Auszüge und deren `filenamepart`.
