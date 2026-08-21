# Web-Anwendung

Storybook für isolierte Komponenten liegt als eigene Workspace-App unter
`apps/storybook/`.

## Übungs-QR-Code

Der reservierte Bildname `$player_qr` kann in der normalen Bildkonfiguration
als „Übungs-QR-Code“ ausgewählt werden. Position, Sichtbarkeit und Bildhöhe
werden wie bei jedem anderen Bild konfiguriert. Beim SVG- oder PDF-Export wird
aus dem aktuellen Playback-Link temporär ein JPG erzeugt und an dieser Stelle
eingebettet. Die JPG-Datei wird weder gespeichert noch hochgeladen.

## Unsichtbare Zeichen im ABC-Editor

In der ABC-Toolbar kann „Unsichtbare Zeichen“ aktiviert werden. Dann werden
Tabs und relevante Unicode-Zeichen sichtbar markiert; normale ASCII-
Leerzeichen bleiben unverändert. Die Anzeige wird nur als CodeMirror-Dekoration
über den Text gelegt;
der ABC-Text selbst bleibt unverändert und wird nicht in Zwischenablage,
Undo-Historie oder Parser-Pipeline verändert.
