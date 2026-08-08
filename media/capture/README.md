# Aufnahmehilfen

Die Aufnahmehilfen werden nur beim Erzeugen von Screencasts in die Seite
eingebunden. Sie sind kein Bestandteil der normalen Zupfnoter-ts-Oberfläche.

## Startsequenz

Die endgültige Startsequenz wird erst festgelegt, wenn die Anforderungen an
Start-URLs geklärt sind. Dabei müssen Welcome-Screen, Wiederherstellung eines
gespeicherten Dokuments und das aus dem Legacy bekannte Öffnen eines Stücks per
URL gemeinsam betrachtet werden. Das Aufnahmeverfahren darf hierfür keine
zusätzliche Produktsemantik vorwegnehmen.

## Klick-Rückmeldung

`scripts/click-feedback.js` ergänzt bei jedem Mausklick:

- einen dauerhaft sichtbaren orangefarbenen Mauszeiger,
- einen deutlich aufleuchtenden, orangefarbenen Klickring,
- einen dezenten synthetischen Klickton.

Das Skript wird als Initialisierungsskript in die Aufnahmesitzung eingebunden.
Es verändert keine Dateien oder Einstellungen der Anwendung. Für den
Filmschnitt wird der Klickton zusätzlich als eigene Tonspur behandelt, damit
seine Lautstärke unabhängig von Sprechertext und Musik geregelt werden kann.

## Tonspuren

Die Produktion verwendet getrennte Spuren für:

1. Sprechertext,
2. „Ich steh an deiner Krippen hier“ aus dem Zupfnoter-Player,
3. Klicktöne,
4. gegebenenfalls weitere kurze Bediengeräusche.

Die Player-Musik wird einmal sauber aufgenommen und anschließend leise unter
den gesamten Film gelegt. Sie wird nicht bei jedem Szenenschnitt neu gestartet.

Für lokale Rohfassungen erzeugt `scripts/render-promotion-soundtrack.mjs` eine
vorläufige Instrumentalfassung der Melodie aus dem Demo-Stück. Vor der
Freigabe wird diese Spur durch eine Aufnahme aus dem Zupfnoter-Player ersetzt.

## Rohfassung erzeugen

`scripts/record-promotion-scenes.mjs` nimmt die wiederverwendbaren
Anwendungsszenen auf. Danach erzeugen
`scripts/render-promotion-soundtrack.mjs` und
`scripts/render-promotion-film.mjs` Tonspuren und Filmschnitt unter
`media-work/`. Dieses Arbeitsverzeichnis wird nicht versioniert.
