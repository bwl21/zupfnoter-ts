# Commands / CommandProcessor / Console

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Anhand eines Legacy-Sitzungsverlaufs wurde geklärt, dass Commands viel breiter sind als reine Dokumentänderungen. Beispiele waren `dlogin`, `dreconnect`, `editconf`, `view`, `addsnippet`, `togglesetting`, `autorefresh`, `render`, `dchoose`, `dopenfn`, `adddecoration`, `saveformat`, `speed`.

Commands sind also protokollierbare Bedienaktionen. Sie können Dokument, Workbench, Storage, Rendering, Config oder Playback betreffen.

Die Console ist primär Log-Anzeige, aber kann auch Commands entgegennehmen, wenn noch keine UI existiert.


## Entscheidungen


- Command = vom CommandProcessor bereitgestellter Befehl.
- Commands können Dokument, Workbench, Storage, Playback oder Rendering betreffen.
- Menüs, Toolbars, Shortcuts, ContextActions und Console lösen Commands aus.
- Undo-Fähigkeit ist optional und hängt an einer inversen Operation.
- Command Journal protokolliert `do: command(payload)`.
- Console ist primär Journal/Log, sekundär Command Shell.


## Implementierungsaufträge


- Command-Typ und CommandRegistry/Processor definieren.
- CommandSource modellieren: menu, toolbar, shortcut, context, console, system.
- CommandJournal mit Zeitpunkt, Quelle, Payload, Ergebnis, Fehler.
- UndoableCommand nur bei inverser Operation.
- ConsolePanel als Journal-Anzeige vorbereiten.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- Legacy command processor analysis
- Existing menu/shortcut code
- Console components
- Stores / services
