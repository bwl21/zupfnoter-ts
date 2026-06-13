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
- `SelectionManager` stellt systemweite Projektionen fuer Selection und Playback bereit
- `SelectionTargetCapabilities` typisieren, welche Identitaeten ein Target lesen und schreiben kann
- Editor und Score arbeiten ueber Textspannen (`startpos` / `endpos`)
- Harfenvorschau arbeitet ueber `textRange` und `confKey`; fuer Editor-Quellen standardmaessig ueber die passende Stimme
- Playback bleibt als eigener Zustand getrennt

Wichtig:

- Die Selection ist an den aktuellen `SheetObjectIndex` gebunden.
- Bei neuem Render kann die Selection bewusst verloren gehen.
- Die Mehrstimmen-Selection aus dem Editor ist nicht mehr implizit, sondern als explizite Voice-Scope-Option modelliert.

## Ausgangslage

In Phase 5 existieren bereits mehrere Identitaetsraeume:

- Editor
  - `line:column`
  - `startChar` / `endChar`
- Klaviernoten
  - `startChar` / `endChar` aus `abc2svg`-Annotationen
- Harfennoten
  - `confKey`
  - `textRange` via `data-start-char` / `data-end-char` auf SVG-Hitboxen
- Playback
  - aktive `textRange`
  - spaeter eventuell `time`, `flowIndex`, `passIndex`

Die Legacy-Klaviernoten kennen dabei keine `znId`. Dort wird Selection ueber `abc2svg`-Annotationen und deren `startChar` / `endChar` aufgeloest.

Die aktuelle TS-Implementierung folgt dieser Trennung bereits teilweise:

- Score-Preview reagiert auf `textRange`
- Harfenvorschau reagiert auf `textRange` und `confKey`
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

- `textRange -> confKeys`
- `textRange -> line:column`
- `abc2svg annotation id -> textRange`

Spaeter moeglich:

- `playback event -> textRange`
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
- die Aufloesung in `confKey` oder `textRange` passiert ueber den `SelectionIndex`
- wenn ein neuer `SheetObjectIndex` gerendert wird, wird die alte Selection verworfen

## 3. PlaybackStore

`PlaybackStore` bleibt fuer den Laufzeitzustand des Players zustaendig.

Er enthaelt unter anderem:

- `PlaybackState`
- `PlaybackHighlight`

Beispiel:

```ts
interface PlaybackHighlight {
  activeTextRanges: Array<{ startpos: number; endpos: number }>
  activeTime?: string
}
```

## 4. SelectionManager

`SelectionManager` benutzt den `SelectionIndex`, um Eingaben aus einer Sicht in die zentrale Selection und in Projektionen fuer andere Sichten zu ueberfuehren.

Typische Eingaben:

- `selectByCharRange(...)`
- `selectByLineColumnRange(...)`
- spaeter `selectByPlaybackEvent(...)`

Der Manager kann ausserdem abgeleitete Sichten bereitstellen:

- Editor-Projektion als `textRange`
- Klaviernoten-Projektion als `textRange`
- Harfennoten-Projektion als `textRanges` und `confKeys`
- Playback-Projektion als `textRanges`

In der aktuellen Implementierung sind diese Projektionen als `SelectionManager`-APIs benannt und werden von Workbench und Playback genutzt.

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

- `reads: ['textRange', 'confKey']`
- `writes: ['textRange']`

Der Manager nutzt dieses Profil, um nur die Projektionen anzubieten, die das Panel auch darstellen oder erzeugen kann.

Beispiele:

- Editor: `reads` und `writes` fuer `textRange`
- Score: `reads` und `writes` fuer `textRange`
- Harfenvorschau: `reads` und `writes` fuer `textRange` und `confKey`
- Playback: `reads` fuer `textRange`, kein `writes` fuer Benutzer-Selection

## Beispiel: Klaviernote anklicken

Der Legacy-Fall fuer die Klaviernoten ist:

- `abc2svg` liefert in `anno_stop` nur `startChar` / `endChar`
- eine `znId` ist dort nicht vorhanden

Mit `SelectionManager` wird daraus:

1. Klaviernoten liefern `startChar` / `endChar`
2. `SelectionManager.selectByCharRange(...)` wird aufgerufen
3. Der Manager legt die Selection als `textRange` an
4. Editor, Harfennoten und Klaviernoten highlighten ueber dieselbe `textRange`

Damit muss `anno_stop` weiterhin keine `znId` kennen.

## Beispiel: Harfennote anklicken

1. Harfenvorschau liefert `textRange` aus `data-start-char` / `data-end-char` der Hitbox
2. `SelectionManager.selectTextRange(...)` wird aufgerufen
3. der Manager bestimmt die passende `textRange` und `confKeys`
4. Editor und Klaviernoten highlighten ueber dieselbe Textspanne

## Beispiel: Editor-Selektion

1. Editor liefert `startChar` / `endChar` oder `line:column`
2. `SelectionManager.selectByCharRange(...)` oder `selectByLineColumnRange(...)`
3. der Manager bestimmt passende `confKeys`
4. Harfenvorschau und Klaviernoten spiegeln dieselbe Selection

## Beispiel: Playback-Highlight

Playback arbeitet ueberwiegend mit `textRange`.

Der `SelectionManager` oder ein eng benachbarter Projektor kann daraus ableiten:

- Harfennoten-Highlight ueber `activeTextRanges`
- Editor-Highlight ueber `textRange`
- Klaviernoten-Highlight ueber `textRange`

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

Die aktuelle `SelectionStore`-Implementierung bleibt der transiente Zustandstraeger. Die Orchestrierungsschicht liegt jetzt im `SelectionManager`, waehrend Views nur noch Projektionen konsumieren oder Selection-Ereignisse einspeisen.

Der naechste sinnvolle Ausbauschritt ist:

1. weitere Views oder Commands direkt auf die Manager-APIs umstellen
2. die Eingabeseite (`selectBy...`) ebenfalls unter dem Manager zusammenziehen
3. Mehrstimmen-Selection im Editor per UI oder Command explizit nutzbar machen
4. spaetere Identitaeten wie `time` oder `flowIndex` in dieselbe Projektionsebene aufnehmen

## Offene Punkte

- Ob die Eingabeseite des Managers (`selectByCharRange`, ...) explizit eingefuehrt wird
- Wie Mehrstimmen-Selection im Editor an die UI oder an Commands angebunden wird
- Wie spaetere Identitaeten wie `time` oder `flowIndex` in das Capability-Modell aufgenommen werden
- Ob `SheetObjectIndex` langfristig als eigener Typname bestehen bleibt oder sprachlich wieder auf `SelectionIndex` gezogen wird

## Noch umzusetzen

Diese Punkte sind fachlich vorbereitet, aber noch nicht bis zur letzten Komfortstufe ausgebaut:

- explizite Command-/API-Eingangspunkte `selectBy...` im Manager statt nur Store-Methoden
- UI-seitige Aktivierung einer Mehrstimmen-Selection ueber `editorVoiceScope`
- Einbindung weiterer Identitaetsraeume jenseits von `textRange` und `confKey`
- getrennte Public-APIs fuer `resolveSelectionProjection(...)` und `resolvePlaybackProjection(...)` bereitstellen
- pane-nahe Hilfslogik aus den Views in den Manager oder in klar benannte Adapter verschieben
- Mehrstimmen-Selection im Editor als bewusstes Feature modellieren, nicht als Nebeneffekt
- die aktuelle transiente `SelectionStore`-Logik gegen spaetere Persistenz- oder Rebind-Anforderungen abgrenzen
