# Selection-Manager und Identitaetsprojektion

## Ziel

Dieses Dokument beschreibt die Zielarchitektur fuer Selection in Phase 5 und den aktuellen Umsetzungsstand.

Die Kernidee ist:

- Selection ist zentraler fachlicher Zustand.
- Unterschiedliche Sichten arbeiten mit unterschiedlichen Identitaeten.
- Eine eigene Mapping- und Orchestrierungsschicht projiziert dieselbe Selection in alle Sichten.

Damit wird vermieden, dass Editor, Klaviernoten, Harfennoten und Playback jeweils eigene Sonderlogik fuer Selection und Highlighting aufbauen.

## Ist-Stand

Die zentrale Selection ist inzwischen nicht mehr als gemischter Zustand aus `znId`/`charRange` modelliert, sondern als fluechtige Referenz auf einen aktuellen `SheetObjectIndex`.

Aktuell umgesetzt:

- `SelectionStore` haelt `selectedIndexes`
- `SheetObjectIndex` beschreibt den aktuellen Renderzustand
- Editor und Score arbeiten ueber Textspannen (`startpos` / `endpos`)
- Harfenvorschau arbeitet ueber `znId`, `confKey` und fuer Editor-Quellen zusaetzlich ueber die passende Stimme
- Playback bleibt als eigener Zustand getrennt

Wichtig:

- Die Selection ist an den aktuellen `SheetObjectIndex` gebunden.
- Bei neuem Render kann die Selection bewusst verloren gehen.
- Die Mehrstimmen-Selection aus dem Editor ist nicht mehr implizit, sondern soll spaeter als eigenes Verhalten im Selection-Manager/Editor-Flow abgebildet werden.

## Ausgangslage

In Phase 5 existieren bereits mehrere Identitaetsraeume:

- Editor
  - `line:column`
  - `startChar` / `endChar`
- Klaviernoten
  - `startChar` / `endChar` aus `abc2svg`-Annotationen
- Harfennoten
  - `znId`
  - indirekt auch `origin.startChar` / `origin.endChar`
- Playback
  - aktive `znId`
  - spaeter eventuell `time`, `flowIndex`, `passIndex`

Die Legacy-Klaviernoten kennen dabei keine `znId`. Dort wird Selection ueber `abc2svg`-Annotationen und deren `startChar` / `endChar` aufgeloest.

Die aktuelle TS-Implementierung folgt dieser Trennung bereits teilweise:

- Score-Preview reagiert auf `textRange`
- Harfenvorschau reagiert auf `znId` und `confKey`
- Editor-Selektion wird ueber `textRange` auf den aktuellen Index aufgeloest
- `SelectionStore` verwaltet dabei keine pane-spezifische DOM-Logik

## Architekturentscheidung

Die Uebersetzung zwischen diesen Identitaeten gehoert in eine eigene Selection-Schicht.

Arbeitsname:

- `SelectionManager`

Der `SelectionManager` ist kein UI-Controller und manipuliert kein DOM direkt. Er ist eine fachliche Orchestrierungsschicht, die:

- Selection-Anfragen aus verschiedenen Sichten annimmt
- sie in eine kanonische Selection ueberfuehrt
- abgeleitete Projektionen fuer andere Sichten bereitstellt
- Playback-Highlight getrennt von Selection orchestriert

Die Sichten bzw. Panels melden dem Manager dabei ihre Faehigkeiten:

- welche Identitaeten sie lesen koennen
- welche Identitaeten sie erzeugen koennen
- welche Identitaeten sie visualisieren koennen

Der Manager kennt also nicht die konkreten Panels als UI-Elemente, sondern nur deren Capability-Profil.

## Grundregel

Selection und PlaybackHighlight bleiben getrennte Zustaende.

- `Selection`
  - beschreibt, was der Benutzer aktuell ausgewaehlt hat
- `PlaybackHighlight`
  - beschreibt, was waehrend der Wiedergabe aktiv ist

Beide duerfen denselben Mapping-Index benutzen, aber nicht dasselbe State-Objekt sein.

Aus Sicht der Projektion bedeutet das:

- `SelectionProjection` beschreibt die Darstellung der Benutzer-Selection
- `PlaybackProjection` beschreibt die Darstellung des aktuellen Wiedergabezustands

Beide Projektionen koennen parallel aktiv sein und auf dieselben oder unterschiedliche
Elemente zeigen. Die View entscheidet nur ueber die visuelle Prioritaet, nicht ueber
die fachliche Trennung.

## Zielbild

Die Selection-Schicht besteht aus vier Teilen:

1. `SelectionIndex`
2. `SelectionStore`
3. `PlaybackStore`
4. `SelectionManager`

## 1. SelectionIndex

`SelectionIndex` ist die reine Mapping-Struktur fuer den aktuellen Renderzustand.

Er enthaelt keine View-Logik und keine DOM-Referenzen, sondern nur Beziehungen zwischen Identitaeten.

Beispiele:

- `znId -> char range`
- `char range -> znIds`
- `char range -> line:column`
- `abc2svg annotation id -> char range`

Spaeter moeglich:

- `znId -> playback events`
- `playback event -> char range`
- `playback event -> flow metadata`

## 2. SelectionStore

`SelectionStore` haelt die aktuelle Benutzer-Selection als zentralen fachlichen Zustand.

Die Selection ist dabei nicht als vollstaendige kanonische Objektmenge modelliert, sondern als fluechtige Menge von Index-Referenzen auf den aktuellen `SelectionIndex`.

Aktuelles Modell:

```ts
interface SelectionState {
  selectedIndexes: number[]
  source: SelectionSource
  anchorIndex?: number
}
```

Wichtig:

- die Auswahl bleibt absichtlich schmal
- die Aufloesung in `znId`, `confKey` oder `textRange` passiert ueber den `SelectionIndex`
- wenn ein neuer `SheetObjectIndex` gerendert wird, wird die alte Selection verworfen

## 3. PlaybackStore

`PlaybackStore` bleibt fuer den Laufzeitzustand des Players zustaendig.

Er enthaelt unter anderem:

- `PlaybackState`
- `PlaybackHighlight`

Beispiel:

```ts
interface PlaybackHighlight {
  activeZnIds: string[]
  activeStartChar?: number
  activeTime?: string
}
```

## 4. SelectionManager

`SelectionManager` benutzt den `SelectionIndex`, um Eingaben aus einer Sicht in die zentrale Selection und in Projektionen fuer andere Sichten zu ueberfuehren.

Typische Eingaben:

- `selectByZnId(...)`
- `selectByZnIds(...)`
- `selectByCharRange(...)`
- `selectByLineColumnRange(...)`
- spaeter `selectByPlaybackEvent(...)`

Der Manager kann ausserdem abgeleitete Sichten bereitstellen:

- Editor-Projektion als `charRange`
- Klaviernoten-Projektion als `charRange`
- Harfennoten-Projektion als `znIds` und `confKeys`
- Playback-Projektion als `znIds`

In der aktuellen Implementierung sind diese Projektionen bereits teilweise direkt in `SelectionStore` und den pane-nahen Hilfsfunktionen verdrahtet. Der naechste saubere Schritt bleibt, diese Projektionen als klar benannte Schicht zu konsolidieren.

### Separate Projektionen

Der Manager sollte Selection und Playback nicht zu einem gemeinsamen Highlight-Zustand verschmelzen.

Stattdessen liefert er getrennte Projektionen, zum Beispiel:

- `resolveSelectionProjection(...)`
- `resolvePlaybackProjection(...)`

Die View kann beide gleichzeitig anwenden, muss aber die Stilregeln getrennt halten:

- Selection bleibt der Benutzerwahl zugeordnet
- Playback bleibt dem aktuellen Abspielzustand zugeordnet
- bei Ueberschneidungen entscheidet das Rendering, nicht der State

### Capability-Modell

Jedes Panel meldet dem Manager ein Capability-Profil, zum Beispiel:

- `reads: ['textRange', 'znId', 'confKey']`
- `writes: ['textRange']`

Der Manager nutzt dieses Profil, um nur die Projektionen anzubieten, die das Panel auch darstellen oder erzeugen kann.

Beispiele:

- Editor: `reads` und `writes` fuer `textRange`
- Score: `reads` und `writes` fuer `textRange`
- Harfenvorschau: `reads` und `writes` fuer `znId` und `confKey`, `reads` optional fuer `textRange`
- Playback: `reads` fuer `znId`, kein `writes` fuer Benutzer-Selection

## Beispiel: Klaviernote anklicken

Der Legacy-Fall fuer die Klaviernoten ist:

- `abc2svg` liefert in `anno_stop` nur `startChar` / `endChar`
- eine `znId` ist dort nicht vorhanden

Mit `SelectionManager` wird daraus:

1. Klaviernoten liefern `startChar` / `endChar`
2. `SelectionManager.selectByCharRange(...)` wird aufgerufen
3. der Manager bestimmt passende `znIds`
4. Editor bekommt die Text-Selection
5. Harfennoten bekommen die passende `znId`-Selection

Damit muss `anno_stop` weiterhin keine `znId` kennen.

## Beispiel: Harfennote anklicken

1. Harfenvorschau liefert `znId`
2. `SelectionManager.selectByZnId(...)` wird aufgerufen
3. der Manager bestimmt die passende `charRange`
4. Editor und Klaviernoten highlighten ueber dieselbe Textspanne

## Beispiel: Editor-Selektion

1. Editor liefert `startChar` / `endChar` oder `line:column`
2. `SelectionManager.selectByCharRange(...)` oder `selectByLineColumnRange(...)`
3. der Manager bestimmt passende `znIds`
4. Harfenvorschau und Klaviernoten spiegeln dieselbe Selection

## Beispiel: Playback-Highlight

Playback arbeitet ueberwiegend mit `znId`.

Der `SelectionManager` oder ein eng benachbarter Projektor kann daraus ableiten:

- Harfennoten-Highlight ueber `activeZnIds`
- Editor-Highlight ueber `charRange`
- Klaviernoten-Highlight ueber `charRange`

Wichtig bleibt:

- PlaybackHighlight veraendert die Benutzer-Selection nicht

## Abgrenzung

Der `SelectionManager` soll nicht:

- DOM-Elemente finden
- CSS-Klassen setzen
- Scrollen ausloesen
- Panel-spezifische Renderdetails kennen

Diese Aufgaben bleiben in den Views oder in panelnahen Adaptern.

Der Manager liefert nur:

- zentrale Selection
- abgeleitete Projektionen
- konsistente Uebersetzung zwischen Identitaetsraeumen
- Capability-basierte Auswahl der passenden Projektionen

## Nutzen

Die Schicht loest mehrere Probleme gleichzeitig:

- Klaviernoten brauchen keine `znId`
- Harfennoten und Editor bleiben trotzdem synchron
- PlaybackHighlight kann dieselben Mappings nutzen
- Identitaetslogik bleibt testbar und nicht in Panels verteilt
- spaetere Erweiterungen wie `time`, `flowIndex` oder `passIndex` bekommen einen sauberen Andockpunkt

## Konsequenz fuer die Umsetzung

Die aktuelle `SelectionStore`-Implementierung ist ein sinnvoller Startpunkt und bildet die Phase-5-Zwischenloesung bereits ab. Fuer die dauerhafte Zielarchitektur fehlt noch die sauber getrennte Orchestrierungsschicht.

Der naechste Ausbauschritt sollte sein:

1. `SelectionIndex` explizit modellieren
2. `SelectionManager` als Mapping-Schicht einfuehren
3. Editor, Klaviernoten und Harfennoten auf dessen Projektionen umstellen
4. PlaybackHighlight ueber dieselbe Index-Schicht projizieren

## Offene Punkte

- Exaktes Datenmodell fuer `SelectionIndex` und `SelectionManager` dokumentieren
- Umgang mit mehrdeutigen Editor-Selektionen ueber mehrere Stimmen
- Ob die pane-nahen Projektionen langfristig in einen eigenen Service oder in Store-Helper wandern
- Wie das Capability-Profil der Panels konkret typisiert wird
- Wie `PlaybackHighlight` und Selection weiter sauber getrennt bleiben, wenn weitere Identitaetsraeume dazukommen

## Noch umzusetzen

Diese Punkte sind im aktuellen Code noch nicht als eigene, explizite Schicht umgesetzt und sollten entweder
in einer naechsten Iteration implementiert oder als bewusste Zwischenloesung dokumentiert werden:

- `SelectionManager` als eigenstaendige Orchestrierungsschicht einfuehren
- Capability-Registrierung der Panels formal typisieren
- getrennte Public-APIs fuer `resolveSelectionProjection(...)` und `resolvePlaybackProjection(...)` bereitstellen
- pane-nahe Hilfslogik aus den Views in den Manager oder in klar benannte Adapter verschieben
- Mehrstimmen-Selection im Editor als bewusstes Feature modellieren, nicht als Nebeneffekt
- die aktuelle transiente `SelectionStore`-Logik gegen spaetere Persistenz- oder Rebind-Anforderungen abgrenzen
