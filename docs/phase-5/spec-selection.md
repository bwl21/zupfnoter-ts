# Spezifikation: Selection in Phase 5

## Zweck

Diese Spezifikation beschreibt die fachlichen Regeln fuer Selection in `apps/web`
innerhalb von Phase 5.

Sie baut auf dem bereits vorhandenen zentralen `SelectionStore`, dem
`SheetObjectIndex` und den bestehenden Projektionen auf. Ziel ist nicht, eine neue
Selection-Architektur zu erfinden, sondern die Bedien- und Fachregeln fuer
Selektionsarten, Stimmumfang und praktische Anwendungsfaelle klar festzulegen.

## Kontext

In `apps/web` existieren bereits:

- eine zentrale Selection als fachlicher Zustand
- Projektionen in Editor, Score und Harfenvorschau
- ein `SelectionManager` fuer die Uebersetzung zwischen Identitaetsraeumen
- eine Trennung zwischen Benutzer-Selection und Playback-Highlight

Der offene Punkt ist die fachliche Spezifikation dafuer, welche Arten von Selection
der Benutzer ausdruecken kann und wie diese auf Stimmen, Zeitbereiche und Views
bezogen werden.

## Ziel

Selection soll fachlich ausdruecken koennen:

- welcher musikalische Abschnitt gemeint ist
- auf welche Stimmen sich die Auswahl bezieht
- ob nur eine Stimme oder ein mehrstimmiger Block gemeint ist

Die Bedienung darf dabei aus verschiedenen Views starten, muss aber in dieselbe
zentrale Selection muenden.

## Nicht-Ziele

Diese Spezifikation fordert nicht:

- freie disjunkte Mehrfachselektion als ersten Ausbauschritt
- beliebige Kombinationen aus Einzelnoten, Blöcken und Toggles
- panel-spezifische Sondermodelle fuer Selection
- neue DOM-basierte Wahrheiten ausserhalb des zentralen Selection-Modells

## Fachliche Grundsaetze

### 1. Selection ist zentral

Editor, Score und Harfenvorschau arbeiten auf derselben zentralen Selection.

Das bedeutet:

- die Quelle der Eingabe ist fuer die fachliche Bedeutung zweitrangig
- jede View speist dieselbe Selection
- jede View zeigt Projektionen derselben Selection

### 2. Selection beschreibt notiertes Material

Selection bezieht sich auf das notierte Material und nicht auf panel-spezifische
Darstellungen.

Das bedeutet:

- die Auswahl wird auf notierte Entities oder notierte Bereiche bezogen
- Projektionen in Editor, Score und Harfe bleiben abgeleitet
- spaetere Funktionen wie Playback oder Commands lesen dieselbe fachliche Selection

### 3. Stimmenbezug ist explizit

Selection darf nicht stillschweigend unklar lassen, ob eine Auswahl nur fuer eine
Stimme, fuer die Stimmen des aktiven Auszugs oder fuer alle Stimmen gilt.

Der Stimmumfang ist daher fachlicher Teil der Selection.

## Selektionsdimensionen

Selection wird fachlich ueber drei Dimensionen beschrieben:

1. Selektionsform
2. Stimmumfang
3. Aenderungsmodus

### 1. Selektionsform

Es gibt in der ersten Ausbaustufe genau drei Selektionsformen:

- `point`
  - eine einzelne notierte Entity
- `range`
  - ein zusammenhaengender Bereich innerhalb einer Stimme
- `block`
  - ein zusammenhaengender Zeitbereich ueber mehrere Stimmen

### 2. Stimmumfang

Es gibt in der ersten Ausbaustufe genau drei fachliche Scopes:

- `single-voice`
  - nur die betroffene Stimme
- `extract-voices`
  - die im aktuellen Auszug aktiven Stimmen
- `all-voices`
  - alle Stimmen des aktuellen Stuecks

### 3. Aenderungsmodus

In der ersten Ausbaustufe werden nur diese beiden Modi fachlich garantiert:

- `replace`
  - die bisherige Selection wird ersetzt
- `extend`
  - die Selection wird vom Anker aus zu einem groesseren Bereich erweitert

Freies Toggle-Verhalten mit disjunkten Teilmengen gehoert nicht in diesen ersten
Schritt.

## Erlaubte Selektionsarten in Version 1

Fuer die erste belastbare Phase-5-Variante werden genau diese Kombinationen
unterstuetzt:

### 1. Punktselektion in einer Stimme

- Form: `point`
- Scope: `single-voice`

Beispiel:

- eine einzelne Note im Editor
- eine einzelne Note in der Harfenvorschau
- eine einzelne Note im Score

### 2. Bereichsselektion in einer Stimme

- Form: `range`
- Scope: `single-voice`

Beispiel:

- ein Abschnitt in der Sopranstimme
- ein Textbereich im Editor, der auf einen zusammenhaengenden Bereich in einer
  Stimme aufgeloest wird

### 3. Blockselektion ueber die Stimmen des aktuellen Auszugs

- Form: `block`
- Scope: `extract-voices`

Beispiel:

- ein Ausschnitt aus der Partitur soll in allen aktiven Stimmen des aktuellen
  Auszugs selektiert werden

### 4. Blockselektion ueber alle Stimmen

- Form: `block`
- Scope: `all-voices`

Beispiel:

- ein Ausschnitt aus der Partitur soll in allen Stimmen selektiert werden

## Praktische Anwendungsfaelle

### 1. Ausschnitt in einer Stimme selektieren

Der Benutzer waehlt einen Abschnitt in genau einer Stimme.

Erwartung:

- nur diese Stimme wird Teil der Selection
- andere Stimmen werden nicht implizit mitselektiert

### 2. Ausschnitt in allen Stimmen selektieren

Der Benutzer waehlt einen musikalischen Abschnitt, der fuer das ganze Stueck ueber
alle Stimmen gelten soll.

Erwartung:

- die Selection wird als Block ueber alle Stimmen interpretiert
- Editor, Score und Harfe spiegeln denselben Zeitbereich fuer alle Stimmen

### 3. Ausschnitt in den Stimmen des aktuellen Auszugs selektieren

Der Benutzer waehlt einen Abschnitt, der nur fuer die im aktiven Auszug relevanten
Stimmen gelten soll.

Erwartung:

- die Selection wird als Block ueber die aktuellen Extract-Stimmen interpretiert
- nicht aktive Stimmen des Stuecks gehoeren nicht zur Selection

## Bedienlogik fuer Version 1

Die genaue Tastenbelegung kann spaeter noch feiner ausgearbeitet werden. Fuer die
erste fachliche Spezifikation gelten diese Regeln:

### 1. Klick

- waehlt eine einzelne Entity
- Modus: `replace`
- Scope: `single-voice`
- Form: `point`

### 2. Shift plus Klick

- erweitert vom Anker zu einem zusammenhaengenden Bereich
- Modus: `extend`
- Standardfall: `range` in einer Stimme

Wenn die aktive Bedienlogik bereits auf einen Mehrstimmen-Scope gestellt ist, darf
dieselbe Geste auch zu einer `block`-Selection fuehren.

### 3. Modifizierte Bereichsselektion fuer Mehrstimmen-Scope

Es braucht eine explizite Bedienmoeglichkeit, einen Bereich nicht nur in einer
Stimme, sondern:

- in den Stimmen des aktiven Auszugs
- oder in allen Stimmen

Die konkrete Tastenbelegung wird als UI-Detail spaeter festgelegt. Fachlich wichtig
ist nur:

- Mehrstimmen-Selection geschieht explizit
- sie ist nicht stiller Nebeneffekt einer normalen Einzelstimmen-Selektion

## Architekturvorgaben

### Zuständigkeit

- der `SelectionStore` bleibt der zentrale Zustandstraeger
- der `SelectionManager` bleibt fuer Aufloesung und Projektionen zustaendig
- Views liefern Eingaben und konsumieren Projektionen
- Views definieren nicht selbst die fachliche Bedeutung der Selection
- der `SelectionStore` darf zwischen Ursprungsauswahl und scope-erweiterter
  Projektion unterscheiden

### Trennung

- Selection bleibt getrennt von Playback-Highlight
- Selection bleibt getrennt von Audio- oder Command-Sonderlogik
- der Stimmumfang wird zentral aufgeloest und nicht lokal je Panel geraten

### Aktuelle Praezisierung des Ist-Stands

Im aktuellen Stand wird die fachliche Ursprungsauswahl gesondert gehalten und
anschliessend auf den gewaehlten Scope projiziert.

Das bedeutet:

- `single-voice`
  - nutzt die Ursprungsauswahl direkt
- `extract-voices`
  - erweitert dieselbe Ursprungsauswahl auf die aktiven Extract-Stimmen
- `all-voices`
  - erweitert dieselbe Ursprungsauswahl auf alle Stimmen

Damit bleibt die Rueckkehr von Mehrstimmen-Scope auf Einzelstimme stabil.

## Akzeptanzkriterien

Die Umsetzung gilt fuer diese Spezifikation als ausreichend, wenn:

1. eine Punktselektion in einer einzelnen Stimme moeglich ist
2. eine Bereichsselektion in einer einzelnen Stimme moeglich ist
3. ein Block ueber die aktiven Extract-Stimmen selektiert werden kann
4. ein Block ueber alle Stimmen selektiert werden kann
5. dieselbe fachliche Selection in Editor, Score und Harfe gespiegelt wird
6. die Views keine voneinander abweichenden eigenen Wahrheiten ueber die Selection
   aufbauen

## Offene Punkte

- die konkrete Tastenbelegung fuer `Ctrl`, `Cmd`, `Alt` oder weitere Modifikatoren
  ist noch zu definieren
- ob spaeter freie disjunkte Mehrfachselektion zugelassen wird, bleibt offen
- ob der Benutzer den Stimmumfang ueber Gesten, Toolbar oder Commands umschaltet,
  bleibt ein separates UI-Thema
