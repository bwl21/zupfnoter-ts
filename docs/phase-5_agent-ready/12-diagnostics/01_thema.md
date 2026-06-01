# Diagnostics & Error Handling

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Diagnostics wurden als zentrales Modell für Fehler und Warnungen festgelegt. Sie kommen aus Worker/Pipeline, Config Validator, Storage oder Editor Checks und werden je nach Kontext dargestellt.

Bernhard nannte konkrete Darstellungen: Symbole im Editor inklusive rote Wellen unter fehlerhaftem Text, Modal/Toast bei akuten Fehlern, Log/Console-Eintrag, Config-Editor-Seite „Konfigurationsfehler“, optional Overlays in Klaviernoten/Harfennoten.


## Entscheidungen


- Fehler/Warnungen werden als Diagnostics modelliert.
- Worker/Pipeline-Fehler werden zurückgemeldet.
- Config-Schema-Fehler erscheinen im Config Editor.
- Editor kann Gutter-Symbole/Wellenlinien anzeigen.
- Toast/Modal für akute oder blockierende Fehler.
- Console/Log erhält Einträge.
- Preview-Overlays sind optional.


## Implementierungsaufträge


- `Diagnostic`-Typ definieren.
- DiagnosticsStore anlegen.
- WorkerResult Diagnostics übernehmen.
- Config Validation Diagnostics aufnehmen.
- Editor Decoration/Gutter vorbereiten.
- Console/Toast-Anbindung vorbereiten.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- Worker result types
- Config validation
- Editor decorations
- Console/logging
