# Web-Anwendung

Storybook für isolierte Komponenten liegt als eigene Workspace-App unter
`apps/storybook/`.

## Player-QR-Code

Der reservierte Bildname `$player_qr` kann in der normalen Bildkonfiguration
als „Player-QR-Code“ ausgewählt werden. Position, Sichtbarkeit und Bildhöhe
werden wie bei jedem anderen Bild konfiguriert. Beim SVG- oder PDF-Export wird
aus dem aktuellen Playback-Link temporär ein JPG erzeugt und an dieser Stelle
eingebettet. Die JPG-Datei wird weder gespeichert noch hochgeladen.
