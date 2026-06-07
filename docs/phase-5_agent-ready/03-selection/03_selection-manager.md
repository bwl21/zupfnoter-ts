# Selection-Manager und Identitaetsprojektion

## Ziel

Dieses Dokument beschreibt die Zielarchitektur fuer Selection in Phase 5, wenn mehrere Identitaetsraeume gleichzeitig bedient werden muessen.

Die Kernidee ist:

- Selection ist zentraler fachlicher Zustand.
- Unterschiedliche Sichten arbeiten mit unterschiedlichen Identitaeten.
- Eine eigene Mapping- und Orchestrierungsschicht projiziert dieselbe Selection in alle Sichten.

Damit wird vermieden, dass Editor, Klaviernoten, Harfennoten und Playback jeweils eigene Sonderlogik fuer Selection und Highlighting aufbauen.

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

## Architekturentscheidung

Die Uebersetzung zwischen diesen Identitaeten gehoert in eine eigene Selection-Schicht.

Arbeitsname:

- `SelectionManager`

Der `SelectionManager` ist kein UI-Controller und manipuliert kein DOM direkt. Er ist eine fachliche Orchestrierungsschicht, die:

- Selection-Anfragen aus verschiedenen Sichten annimmt
- sie in eine kanonische Selection ueberfuehrt
- abgeleitete Projektionen fuer andere Sichten bereitstellt
- Playback-Highlight getrennt von Selection orchestriert

## Grundregel

Selection und PlaybackHighlight bleiben getrennte Zustaende.

- `Selection`
  - beschreibt, was der Benutzer aktuell ausgewaehlt hat
- `PlaybackHighlight`
  - beschreibt, was waehrend der Wiedergabe aktiv ist

Beide duerfen denselben Mapping-Index benutzen, aber nicht dasselbe State-Objekt sein.

## Zielbild

Die Selection-Schicht besteht aus vier Teilen:

1. `SelectionIndex`
2. `SelectionStore`
3. `PlaybackStore`
4. `SelectionManager`

## 1. SelectionIndex

`SelectionIndex` ist eine reine Mapping-Struktur.

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

Die Selection ist dabei nicht view-spezifisch, sondern kanonisch.

Beispiel:

```ts
interface CanonicalSelection {
  kind: 'none' | 'point' | 'range'
  znIds: string[]
  charRange?: {
    start: number
    end: number
  }
  lineColumnRange?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  confKeys?: string[]
}
```

Wichtig:

- nicht jede Selection muss alle Felder gesetzt haben
- der Manager projiziert nur die Felder, die aus der Quelle sicher ableitbar sind

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
- Harfennoten-Projektion als `znIds`

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

## Nutzen

Die Schicht loest mehrere Probleme gleichzeitig:

- Klaviernoten brauchen keine `znId`
- Harfennoten und Editor bleiben trotzdem synchron
- PlaybackHighlight kann dieselben Mappings nutzen
- Identitaetslogik bleibt testbar und nicht in Panels verteilt
- spaetere Erweiterungen wie `time`, `flowIndex` oder `passIndex` bekommen einen sauberen Andockpunkt

## Konsequenz fuer die Umsetzung

Die aktuelle `SelectionStore`-Implementierung ist ein sinnvoller Startpunkt, reicht aber fuer die dauerhafte Zielarchitektur noch nicht aus.

Der naechste Ausbauschritt sollte sein:

1. `SelectionIndex` explizit modellieren
2. `SelectionManager` als Mapping-Schicht einfuehren
3. Editor, Klaviernoten und Harfennoten auf dessen Projektionen umstellen
4. PlaybackHighlight ueber dieselbe Index-Schicht projizieren

## Offene Punkte

- Exaktes Datenmodell fuer `SelectionIndex`
- Umgang mit mehrdeutigen `charRange -> znId`-Treffern
- Umgang mit nicht-notenhaften ABC-Objekten in den Klaviernoten
- Ob `SelectionManager` ein eigener Store-Adapter oder ein Service-Modul wird
