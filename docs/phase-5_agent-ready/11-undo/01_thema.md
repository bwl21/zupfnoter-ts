# Undo / Redo

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Undo wurde ausdrücklich entkoppelt. Es soll keine globale zeitliche Vereinheitlichung von Editor Undo, Config Undo und Command Undo geben.

Ein Command ist undo-fähig, wenn er eine inverse Operation bereitstellt. Undo-Tiefe ist konzeptionell unbegrenzt; technische Begrenzungen bei Recovery oder neu geöffnetem Fenster sind erlaubt.

Dirty ist davon getrennt: Dirty bedeutet Änderung am ABC-File.


## Entscheidungen


- Editor Undo, Config Undo und Global Command Undo bleiben getrennt.
- Keine globale zeitliche Vermischung.
- UndoableCommand benötigt inverse Operation.
- Undo-Tiefe konzeptionell unbegrenzt.
- Recovery darf Undo-Stacks begrenzen oder verwerfen.
- Dirty-Tracking ist nicht identisch mit Undo.


## Implementierungsaufträge


- Bestehende Undo-Mechanismen erfassen.
- Editor-Undo bei CodeMirror belassen.
- Config-Undo separat halten.
- Command-Undo nur für Commands mit inverser Operation.
- Dirty-Tracking unabhängig definieren.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- CodeMirror integration
- Config Editor
- CommandProcessor
- DocumentStore dirty state
