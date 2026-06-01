# Selection Architecture

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Selection begann als scheinbar einfaches UI-Thema, wurde aber zu einem zentralen fachlichen Subsystem.

Bernhards Klarstellung war entscheidend: Eine Note oder ein Notenbereich kann in allen drei Sichten selektiert werden – im ABC-Editor als Text-Selektion, in den Klaviernoten per Shift-Klick und in den Harfennoten ebenfalls per Shift-Klick. Da eine zentrale Selection existiert, ist die Quelle der Selection für fachliche Aktionen nicht entscheidend.

Selection betrifft außerdem nicht nur Noten. In den Klaviernoten können auch Vorzeichen, Tonart, Schlüssel, Dekorationen und ABC-Kopfzeilen relevant sein. Daher reicht `selectedZnId` nicht aus. Selection muss auch ABC-Textbereiche, ABC-Elemente und Config-Bezüge adressieren können.


## Entscheidungen


- Selection ist transienter Fachzustand.
- Selection kann aus Editor, Klaviernoten oder Harfennoten entstehen.
- Alle Sichten spiegeln dieselbe zentrale Selection.
- Selection kann MusicEntity, Notenbereich, ABC-Element, ABC-Bereich oder Config-Objekt betreffen.
- `znId`, `startpos/endpos`, `startChar` und `confKey` sind getrennte Konzepte.
- PlaybackHighlight ist ein separater Zustand und überschreibt Selection nicht.


## Implementierungsaufträge


- `SelectionState` definieren.
- `SelectionStore` anlegen oder vorhandenen Store erweitern.
- Methoden vorbereiten: `setSelection`, `clearSelection`, `selectZnId`, `selectTextRange`, `selectConfigKey`.
- Adapter für Editor, ScorePreview, HarpPreview vorbereiten.
- SelectionChanged-Mechanismus definieren.
- Keine lokale Sonder-Selection in einzelnen Panels als Wahrheit verwenden.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- `apps/web/src/stores/`
- Editor-Komponenten
- SVG-/Preview-Komponenten
- Typen in `packages/types/`
