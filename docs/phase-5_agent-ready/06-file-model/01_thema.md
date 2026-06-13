# File Model / Dokumentmodell

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Das Dokumentmodell wurde intensiv geklärt. Ein Zupfnoter-Dokument ist ABC + eingebetteter Config-Block in einer Textdatei. Ressourcen wie Bilder liegen ebenfalls in der Config.

Wichtig war die Trennung von Dokument und Speicherort: Das Dokument kennt seinen Speicherort nicht. Wenn eine Datei kopiert wird, ist es ein neues, identisches geklontes Dokument.

Der Dateiname kommt aus der `F:`-Zeile. Wenn `F:` geändert und gespeichert wird, entsteht ein neuer Dateiname. Auch wenn eine Datei aus einem anderen Pfad geladen wurde, gilt beim Speichern die `F:`-Zeile, nicht der geladene Dateiname.


## Entscheidungen


- Dokument = ABC + eingebettete Config + eingebettete Ressourcen.
- Dokument kennt keinen Speicherort.
- Dateiname wird aus `F:` abgeleitet.
- Dirty bedeutet Änderung am ABC-File: ABC, Config oder eingebettete Ressourcen.
- ActiveExtract, Perspektive, Panelgrößen, Zoom, Playback-Speed, Selection und Console-Zustand machen nicht dirty.
- Geladener Dateiname ist nicht automatisch der spätere Speicherdateiname.


## Implementierungsaufträge


- Dokumentmodell explizit definieren.
- `filenameFromF` ermitteln.
- Dirty-Tracking auf ABC-Datei-Inhalt beschränken.
- Keine Pfadinformation ins Dokumentmodell aufnehmen.
- Save-Logik auf `activeStoragePath + filenameFromF` vorbereiten.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- ABC Parser / Metadata
- DocumentStore
- Storage-/Save-Code
- Recovery
