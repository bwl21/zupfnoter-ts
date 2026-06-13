# Selection Architecture

## Status

☑ Architektur besprochen  
☑ `SelectionIndex` als explizites Mapping-Modell eingeführt  
☑ `SelectionStore` an `SelectionIndex` angebunden  
☑ Klaviernoten auf `abc2svg`-Annotationen und `charRange` umgestellt  
☑ Editor-Selection spiegelt direkt in den zentralen `SelectionStore`  
☑ Playback-Highlight wird über denselben `SelectionIndex` in die Views projiziert

## Diskussion


Selection begann als scheinbar einfaches UI-Thema, wurde aber zu einem zentralen fachlichen Subsystem.

Bernhards Klarstellung war entscheidend: Eine Note oder ein Notenbereich kann in allen drei Sichten selektiert werden – im ABC-Editor als Text-Selektion, in den Klaviernoten per Shift-Klick und in den Harfennoten ebenfalls per Shift-Klick. Da eine zentrale Selection existiert, ist die Quelle der Selection für fachliche Aktionen nicht entscheidend.

Selection betrifft außerdem nicht nur Noten. In den Klaviernoten können auch Vorzeichen, Tonart, Schlüssel, Dekorationen und ABC-Kopfzeilen relevant sein. Daher reicht `selectedZnId` nicht aus. Selection muss auch ABC-Textbereiche, ABC-Elemente und Config-Bezüge adressieren können.

Die aktuelle Playback- und Preview-Arbeit zeigt zusätzlich, dass ein zentrales Mapping zwischen mehreren Identitätsräumen gebraucht wird:

- `znId`
- `startChar` / `endChar`
- `line:column`
- später auch Playback-bezogene Identitäten

Der Selection-Teil braucht daher nicht nur einen Store, sondern auch eine eigene Orchestrierungsschicht. Details dazu stehen in [03_selection-manager.md](./03_selection-manager.md).


## Entscheidungen


- Selection ist transienter Fachzustand.
- Selection kann aus Editor, Klaviernoten oder Harfennoten entstehen.
- Alle Sichten spiegeln dieselbe zentrale Selection.
- Selection kann MusicEntity, Notenbereich, ABC-Element, ABC-Bereich oder Config-Objekt betreffen.
- `znId`, `startpos/endpos`, `startChar` und `confKey` sind getrennte Konzepte.
- PlaybackHighlight ist ein separater Zustand und überschreibt Selection nicht.
- Ein `SelectionManager` soll die Übersetzung zwischen `znId`, `charRange`, `line:column` und späteren Playback-Identitäten zentralisieren.
- Der `SelectionManager` manipuliert kein DOM direkt, sondern liefert Projektionen für die Views.


## Implementierungsaufträge


- `SelectionState` definieren.
- `SelectionStore` anlegen oder vorhandenen Store erweitern.
- Methoden vorbereiten: `setSelection`, `clearSelection`, `selectZnId`, `selectTextRange`, `selectConfigKey`.
- Adapter für Editor, ScorePreview, HarpPreview vorbereiten.
- SelectionChanged-Mechanismus definieren.
- Keine lokale Sonder-Selection in einzelnen Panels als Wahrheit verwenden.
- `SelectionIndex` und `SelectionManager` als nächste Ausbaustufe modellieren.


## Offene Punkte

- Editor noch von zentraler Selection aus aktiv nachführen, wenn Selection aus Score oder Harfe kommt.
- Mehrsegment-Selection für Klaviernoten und Editor noch nicht modelliert.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- `apps/web/src/stores/`
- Editor-Komponenten
- SVG-/Preview-Komponenten
- Typen in `packages/types/`
