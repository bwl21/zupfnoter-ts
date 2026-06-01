# UI-Bibliothek / Styleguide

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Die Frage war, ob Phase 5 mit einer Vue UI-Bibliothek oder wieder mit w2ui gebaut werden sollte.

Die Entscheidung fiel gegen w2ui als Fundament. w2ui passt nicht gut zum Vue-Komponentenmodell und würde wieder die Gefahr erhöhen, UI-Logik in Widget-Konfigurationen oder DOM-Tricks zu verstecken.

Auch eine große UI-Bibliothek wurde nicht als tragendes Fundament beschlossen. Zupfnoter braucht eine spezialisierte musikalische Workbench. Hilfsbibliotheken sind erlaubt, aber gekapselt.


## Entscheidungen


- Kein w2ui als Phase-5-Basis.
- Keine große UI-Bibliothek als tragendes Fundament.
- Vue 3 + eigene Zupfnoter-Komponenten.
- Eigener Styleguide / Design-System.
- Externe Hilfen nur gekapselt hinter `Zn*`-Komponenten.


## Implementierungsaufträge


- Styleguide-Grundlagen dokumentieren.
- Eigene `Zn*`-Komponenten verwenden.
- Third-party imports aus Fachkomponenten vermeiden.
- Design-System als eigenes Arbeitspaket pflegen.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- package.json UI dependencies
- apps/web components
- design-system folder
