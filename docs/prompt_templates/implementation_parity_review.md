Arbeite im Branch legacy-faithful-port.

Ziel:
Verifiziere ausschließlich die Aussagen zu Confstack und buildConfstack aus der Legacy-Port-Bestandsaufnahme.

Scope:
- Vergleiche die genannten Ankerdateien direkt.
- Ziehe zusätzlich alle relevanten Consumer, Tests und Fixtures heran, wenn die Semantik über die Datei hinaus wirkt.
- Begrenze den Review nicht künstlich auf einzelne Dateien, wenn API-Signatur, Callsites oder Konfigurationsfluss davon betroffen sind.

Regeln:
- Keine Codeänderungen.
- Keine Refactorings.
- Keine Commits.
- Nur Analyse und Bericht.

Aufgaben:
1. Vergleiche Ruby `confstack2.rb` mit TS `Confstack.ts`.
2. Prüfe exakt:
    - push-Semantik
    - get/lookup-Semantik
    - API-Signatur von `get()` inkl. optionalem Schlüssel und `options[:resolve]`
    - set/[]= Semantik
    - pop-Verhalten
    - deep_dup/deep_merge
    - delete/DeleteMe-Semantik, falls vorhanden
3. Vergleiche Ruby `_layout_prepare_options` mit TS `buildConfstack.ts`.
4. Prüfe exakt:
    - Push-Reihenfolge
    - extract.0 vs Ziel-Extract
    - layout/printer Priorität
    - beams / DURATION_TO_BEAMS
    - Reinitialisierung nach Config-Aufbau
5. Suche alle produktiven Aufrufe von `conf.set`, `push`, `pop`, `buildConfstack`.
6. Erstelle einen Bericht:
    - Welche Abweichungen sind sicher belegt?
    - Welche sind nur Vermutung?
    - Welche Tests/Fixtures würden die Abweichung sichtbar machen?
    - Was wäre der kleinste sichere Fix?
    - Welche API-Signatur-Unterschiede sind bereits auf der Oberflächenebene belegt?
7. speichere den Bericht in docs

Keine Änderungen durchführen.
