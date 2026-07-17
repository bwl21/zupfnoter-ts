# Shortcuts

## Status

☑ Architektur besprochen  
☑ Implementiert

## Diskussion


Auslöser war ein Legacy-Problem: `Cmd+P` konnte manchmal zusätzlich ein `p` im Editor auslösen und damit das ABC-File beschädigen.

Für Phase 5 wurde festgelegt, dass eher CodeMirror als Editor angenommen wird. Damit muss das Shortcut-System zweistufig gedacht werden: globale Workbench-Shortcuts und editornahe CodeMirror-Keymaps.


## Entscheidungen


- Phase 5 verwendet CodeMirror als Editor-Basis.
- Globale Workbench-Shortcuts werden im Capture-Handler abgefangen.
- Behandelte globale Shortcuts müssen `preventDefault()` und `stopPropagation()` ausführen.
- Ein Shortcut darf niemals zusätzlich Text in den Editor schreiben.
- Editor-spezifische Shortcuts gehören in CodeMirror-Keymaps.
- Shortcuts lösen Commands aus, keine eigene Fachlogik.


## Implementierungsaufträge


- `ShortcutService` vorbereiten.
- Globale Shortcuts registrierbar machen.
- Konflikt mit Editor-Fokus explizit behandeln.
- `Cmd+P`-Fall als Test/Regression absichern.
- Shortcuts auf Command IDs mappen.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- Editor-Komponenten
- App-root keydown listener
- CommandProcessor
- CodeMirror-Integration
