# Playback Architecture

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Der Player arbeitet mit PlayerModel und Selection. Die Wiedergabe hängt davon ab, ob und was selektiert ist.

Bernhard stellte drei Modi klar: Keine Selection spielt die ABC-Noten mit allen Scores im Klaviersound über abc2svg-Mechanismen. Eine Note spielt die Stimmen des aktuellen Extracts ab dieser Note im Harfensound. Ein Bereich spielt diesen Bereich im Harfensound.

Die Wiedergabegeschwindigkeit kommt aus `Q:` plus Footer-Menü (normal/langsamer/schneller) und kann während der Wiedergabe geändert werden.

PlaybackHighlight ist ein zweites Highlight in anderer Farbe. Es überschreibt Selection nicht. Nach Stop wird es gelöscht, Selection bleibt erhalten. Im Legacy läuft es aus Performancegründen nicht im Editor; in Phase 5 kann Editor-Highlight optional als CodeMirror Decoration kommen.


## Entscheidungen


- Player arbeitet mit PlayerModel, Selection, activeExtract und Tempo.
- Keine Selection: gesamte ABC-/Score-Wiedergabe im Klaviersound.
- Eine Note: ab selektierter Note im aktuellen Extract im Harfensound.
- Bereich: selektierter Bereich im aktuellen Extract im Harfensound.
- PlaybackHighlight ist getrennt von Selection.
- Speed kann während Playback geändert werden.
- Dokumentänderung stoppt Playback.
- Editor-PlaybackHighlight ist optional und darf Editor-Selection nicht verändern.


## Implementierungsaufträge


- `PlaybackState` modellieren.
- `PlaybackHighlight` modellieren.
- PlaybackModeResolver aus Selection + activeExtract.
- Player Events für aktuelle Note(n) verarbeiten.
- Highlight in Score/Harp Preview anbinden.
- Stop bei Dokumentänderung.
- Speed-Control im Footer anbinden.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- Player-/Audio-Code
- Footer speed controls
- SelectionStore
- Preview highlight components
