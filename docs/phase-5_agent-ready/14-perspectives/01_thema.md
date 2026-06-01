# Perspectives

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Perspektiven ändern im Legacy nur die Anordnung der Oberfläche. Wegen der vielen Bedienelemente kann es später sinnvoll sein, auch Toolsets oder Arbeitsabläufe einzubeziehen, aber nicht über versteckte Komponentensonderlogik.

Die bestätigte Architekturregel lautet: Perspektiven ändern keine Fachlogik.


## Entscheidungen


- Perspektiven sind zunächst Layout-Presets.
- Perspektiven steuern Sichtbarkeit und Anordnung.
- Perspektiven machen das Dokument nicht dirty.
- Perspektiven ändern keine Core-/Worker-Fachlogik.
- Spätere Toolset-/Workflow-Reduktion muss über Commands/Actions laufen.


## Implementierungsaufträge


- PerspectiveState modellieren.
- Perspektiven als Layout-/Visibility-Presets vorbereiten.
- Umschaltung über Command ermöglichen.
- Keine Fachlogik an Perspektiven koppeln.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- Workbench layout
- UI store
- menu/view commands
