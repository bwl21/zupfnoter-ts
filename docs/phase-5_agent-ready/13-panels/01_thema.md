# Panels

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Panels wurden als feste Vue-Komponenten definiert. Es gibt zunächst keine dynamische Panel-Erzeugung durch Benutzer. Panels visualisieren zentrale Modelle und besitzen keinen fachlichen Eigenzustand.

Eine interne PanelRegistry kann für Entwicklung sinnvoll sein, ist aber kein Benutzer-Plugin-System. Mehrere Harfennoten-Sichten sind ein möglicher Zukunftspunkt, aber nicht initial.


## Entscheidungen


- Panels sind feste Vue-Komponenten.
- Keine dynamische Panel-Erzeugung durch Benutzer.
- Panels visualisieren Stores/Fachmodelle.
- Panels besitzen keinen fachlichen Eigenzustand.
- Perspektiven steuern Sichtbarkeit und Layout.
- Neue Panels können durch Entwicklung ergänzt werden.


## Implementierungsaufträge


- Panel-Komponenten als feste Shells anlegen.
- Einheitliche Panel-API über Slots/Props definieren.
- Panel-State auf UI-Zustände begrenzen.
- Keine fachliche Wahrheit in Panels speichern.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- Workbench layout
- components/panels
- design-system components
