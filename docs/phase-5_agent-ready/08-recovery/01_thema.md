# Recovery and Session Management

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Recovery wurde aus dem Problem mehrerer Browser-Tabs abgeleitet. Phase 5 bleibt Single-Document, aber mehrere Tabs können parallel existieren und dürfen sich nicht gegenseitig Recovery-Daten überschreiben.

Tab-isoliertes Recovery löst ein technisches Problem, erzeugt aber ein UX-Problem: Nach Browser-Neustart muss der Benutzer wissen, welchen Slot er wiederherstellen will. Deshalb braucht der Recovery-Dialog Informationen wie Session-ID, Dateiname, StoragePath, lokale Änderungszeit und Cloud-Speicherzeit.

Noch offene Tabs sollen nicht als Recovery-Kandidaten angeboten werden. Dafür braucht es konzeptionell Liveness/Heartbeat.


## Entscheidungen


- Phase 5 bleibt Single-Document.
- Recovery-Slots sind tab-/sessionbezogen.
- Mehrere Tabs überschreiben sich nicht.
- Offene Tabs werden nicht zur Recovery angeboten.
- Dokumentwechsel ersetzt den Recovery-Slot der aktuellen Session.
- Recovery-Dialog zeigt Session-ID, Filename, Titel, StoragePath, localUpdatedAt, cloudSavedAt, Dirty.


## Implementierungsaufträge


- `RecoverySlot` modellieren.
- Session-ID pro Tab verwalten.
- RecoverySlot bei Dokumentänderung aktualisieren.
- Dokumentwechsel ersetzt Slot.
- Liveness/Heartbeat-Konzept vorbereiten.
- Recovery-Dialog mit Slot-Auswahl vorbereiten.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- localStorage/IndexedDB Nutzung
- DocumentStore
- StorageStore
- App startup
