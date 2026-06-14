# Audio Playback Current State

## Aktiver Pfad

Die Web-App verwendet aktuell `soundfont-player` für die MIDI-/Soundfont-Wiedergabe.

Aktive Stelle:

- [apps/web/src/workbench/useAudioPlayer.ts](/Users/beweiche/beweiche_noTimeMachine/zupfnoter-ts/apps/web/src/workbench/useAudioPlayer.ts)

Konkrete Parameter:

- Instrumentenwahl: `sound harp | piano | western-guitar`
- Standardinstrument: `harp`
- Soundfont: `FluidR3_GM`
- Lautstärke: `gain = 2.0`

## Aktuelle Kommandos

Die Klangwahl erfolgt über das Legacy-Kommando-System:

- `sound harp`
- `sound piano`
- `sound grandPiano`
- `sound western-guitar`
- deutsche Aliase:
  - `sound harfe`
  - `sound klavier`
  - `sound gitarre`

## Nicht mehr aktiv

Die lokale Legacy-Datei `apps/web/public/soundfont/zupfnoter/25.js` wurde wieder entfernt.

Sie war ein aus dem Legacy-Projekt übernommenes `MIDI.js`-Soundfont-Artefakt und wurde von `soundfont-player` nicht direkt akzeptiert.

## Relevante Beobachtung

Im Legacy-Projekt kam der Harfenklang aus einer eigenen Soundfont-Pipeline:

- Quelle: `.sf2`
- Build: Base64-Wrapper nach `public/soundfont/zupfnoter/*.js`
- Laufzeit: der damalige Player lud genau dieses Verzeichnis

Im aktuellen TS-Stand ist davon nur die Web-Abspiellogik aktiv. Das eigentliche Legacy-Soundfont-Build ist hier noch nicht nachgebaut.

## Nächste sinnvolle Richtung

Falls ein eigener Harfenklang gebaut werden soll, braucht es entweder:

- eine neue, browser-kompatible Soundfont-Erzeugung
- oder eine separate Konvertierung der vorhandenen Sample-/SF2-Quellen in ein Format, das `soundfont-player` versteht
- oder einen alternativen Sampler-Player, falls `soundfont-player` langfristig zu eng wird
