# Extracts

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Ein Extract wurde im Workshop fachlich definiert: Es ist eine Ausgabevariante derselben Musik. Die Auswahl erfolgt über extract-spezifische effektive Konfiguration.

Das ist wichtig, weil Extracts keine eigenen Dokumente sind. Sie verändern nicht das ABC und nicht den Song als Musikmodell. Sie beeinflussen, welche Stimmen, Layouts, Notizen, Flowlines, Lyrics, Instrumente, Druckeinstellungen usw. in Sheet/SVG/PDF wirksam sind.


## Entscheidungen


- Extract = Ausgabevariante derselben Musik.
- ABC und Song sind extract-unabhängig.
- Sheet, SVG und PDF sind extract-abhängig.
- Extract-Auswahl erfolgt über effektive Config.
- Beim Laden eines Dokuments wird `activeExtract = 0` gesetzt.
- Der aktuelle Extract ist kein dokumentpersistenter Zustand.


## Implementierungsaufträge


- `ExtractSummary` modellieren.
- Extract-Auswahl im UI als transienten Zustand führen.
- Worker-Jobs mit `extractId` versehen.
- Beim Dokumentladen Extract 0 aktivieren.
- Sicherstellen, dass Extract-Wechsel nicht dirty macht.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- Config-/Confstack-Logik
- RenderJob/Worker-Aufrufe
- UI Footer / Extract-Menü
