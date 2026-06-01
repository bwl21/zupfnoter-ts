# Storage

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Legacy kennt `dlAbc`, Dropbox Login, Dropbox speichern und Dropbox File Chooser. Für Phase 5 soll Dropbox nicht mehr das UI-Modell bestimmen.

Bernhard stellte klar: Der aktive Speicherpfad ist nur das Verzeichnis, ohne Dateiname. Der Dateiname kommt aus `F:`. Wenn man ein Dokument woandershin kopieren will, öffnet man es, ändert den Speicherpfad und speichert. Löschen passiert außerhalb von Zupfnoter, z.B. direkt in Dropbox.

Für spätere Provider soll der Speicherpfad providerneutral sein: `{system}//{path}`.


## Entscheidungen


- StoragePath ist ein Zielverzeichnis, keine Datei.
- Format: `{system}//{path}`.
- Save target = `activeStoragePath + filenameFromF`.
- Dropbox ist nur ein Provider.
- Eigener Zupfnoter FilePicker statt Dropbox Chooser als primäre UI.
- Zupfnoter ist kein Dateimanager: kein Delete/Rename/Move als Kernziel.


## Implementierungsaufträge


- `StoragePath` parse/format implementieren.
- `StorageProvider`-Interface vorbereiten.
- Dropbox-spezifische Logik kapseln.
- `activeStoragePath` als Workbench-/Session-Zustand modellieren.
- `filenameFromF` mit SaveTarget verbinden.
- FilePicker als providerneutrale UI vorbereiten.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- Dropbox-Anbindung
- Storage-/File-Services
- Footer / Speicherpfad UI
- DocumentStore
