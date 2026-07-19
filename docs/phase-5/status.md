# Phase 5 – Status

Stand: 2026-07-19

Phase 5 ist funktional weit fortgeschritten. Die verbleibende Arbeit betrifft
vor allem Konsolidierung, lokale Datei-Integration und Produktpolitur.

## 5.1 Layout und Haupttoolbar

Status: `weitgehend umgesetzt`

Vorhanden sind Workbench-Layout, Haupttoolbar, Datei-Menü, Status-/Fußzeile,
About-, Console-, Storage-, Open-, Save-, PDF- und Mirror-Ansichten. Aktionen
sind über Commands, Menü und Toolbar verbunden; Tooltips und Icons sind Teil
der produktiven Oberfläche.

## 5.2 ABC-Editor

Status: `funktional`

Vorhanden sind CodeMirror, ABC-Diagnosen, externe Textselektion, Undo/Redo-
Anbindung und Playback-Highlighting. Selection-Projektionen und echte
bearbeitbare Mehrfachselektionen bleiben ein Konsolidierungsthema.

## 5.3 Vorschauen

Status: `weitgehend umgesetzt`

Score- und Harfennoten-Vorschau unterstützen Zoom, Pan, Lupe, Auswahl,
Playback-Highlighting, Takt-/Positionsbezug sowie Mirror-/Mehrfensteransichten.

## 5.4 Konfigurationseditor

Status: `funktional, Ausbau offen`

Der Editor bearbeitet die Konfiguration text- und baumorientiert, kennt
fachliche Namen, Auswahlwerte, Diagnosen und Undo/Redo. Formular- und
Bedienungspolitur für häufige Einstellungen bleibt offen.

## 5.5 Command-System und Shortcuts

Status: `weitgehend umgesetzt`

CommandStack, Console, Toolbar-/Menübindung, zentraler ShortcutManager,
Logger, Undo/Redo und typisierte Fehlerbehandlung sind vorhanden. Weitere
Vereinheitlichung von Projektionen und UI-Kommandos ist möglich.

## 5.6 Datei- und Storage-Integration

Status: `Dropbox produktiv, lokal noch offen`

Vorhanden sind:

- persistente Verbindungsprofile
- mehrere Profile pro Anbieter
- Dropbox-OAuth pro Verbindung
- Root-Pfad und umschaltbarer Schreibschutz
- Verbindungsdialog als Tabelle mit Aktivieren, Bearbeiten, Löschen und
  Ordnerbrowser
- Öffnen-Dialog mit ABC-Dateien und Vorschauen
- Speichern mit Konfigurationsanhang, PDF-/HTML-/ABC-Ausgaben und Fortschritt

Offen bleiben lokales Öffnen/Speichern als gleichwertiger Provider und die
abschließende Dateinamens-/Pfadpolitur.

## 5.7 Playback

Status: `weitgehend umgesetzt`

Vorhanden sind expandierte Timeline, Repeat-/Volta-Flow, Auswahl- und
Stimmenscopes, Stereo-Panning, Harfe/Piano/Gitarre/Oszillator, Soundfont-
Ladezustand, Playback-Highlighting, Takt-/Durchlaufspur, Metronom und
Playback-Link-Export. Gebundene Noten werden für Audio verlängert; ihr
Highlight-Lebenszyklus bleibt getrennt von Takt- und Audioereignissen.

Offen sind weitere Tests auf mobilen Geräten und die abschließende
Konsolidierung der Selection-/Playback-Projektionen.

## 5.8 Stores und Komponenten

Status: `teilweise konsolidiert`

Selection- und Playback-Stores sind vorhanden. Weitere Zustände liegen noch in
der Workbench und sollen bei Bedarf in klar geschnittene Stores überführt
werden. Das Design-System liegt in `packages/design-system`; Storybook ist als
eigene App unter `apps/storybook` eingerichtet.

## Bekannte Architekturthemen

### Selection-Projektionen

Issue: [#36](https://github.com/bwl21/zupfnoter-ts/issues/36)

`selectionManager` kennt noch konkrete Perspektiven und übernimmt neben der
fachlichen Selection auch Projektionsaufgaben. Diese Aufgaben sollen bei einer
gezielten Überarbeitung in eigene Module verschoben werden.

### Stabile Stimmenidentität

Die Stimmenidentität ist implementiert und durch
`docs/adr/stabile-stimmenidentitaet.md` dokumentiert. Sie bleibt eine
Querschnittsinvariante für Core, Web, Player und CLI.

## Bewusst außerhalb des aktuellen Abschlusses

- Voice Styles
- vollständige lokale Datei-Provider-Integration
- vollständiger CLI-Exportweg für alle Web-Funktionen
- Worker-Architektur ohne nachgewiesenen Bedarf
