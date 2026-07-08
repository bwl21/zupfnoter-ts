# Phase 5 – Spezifikation Konfigurationseditor

## Zweck

Dieses Dokument beschreibt das fachliche und grafische Zielbild des
Konfigurationseditors in `apps/web`.

Es schließt die Lücke zwischen:

- der bestehenden textbasierten Bearbeitung im Konfigurations-Panel
- der Command-/Undo-Architektur
- der noch fehlenden formularbasierten Bearbeitung häufiger Einstellungen

Die Spezifikation ist bewusst UI-orientiert. Sie ergänzt die bestehenden
Architekturtexte, ersetzt aber weder `Confstack` noch die Konfigurationslogik
im Core.

## Ausgangslage

Aktuell gibt es in Phase 5:

- ein Konfigurations-Panel als technischer Platzhalter
- eingebettete Song-Konfiguration im ABC über `%%%%zupfnoter.config`
- Commands wie `editconf`, `cconf`, `delconfig` und `cpconfig`
- ein separates Konfigurations-Undo als Architekturidee

Was fehlt, ist ein klarer visueller und interaktiver Aufbau für die tägliche
Bearbeitung.

## Nicht-Ziele

Diese Spezifikation definiert nicht:

- Voice Styles
- vollständige Laufzeitvalidierung aller Config-Felder
- eine neue lokale Config-Merge-Logik
- direkte Bearbeitung der effektiven `Confstack`-Werte als eigene Datenquelle

Die einzige editierbare Quelle bleibt die eingebettete Song-Konfiguration im
Dokument.

## Leitprinzipien

1. Der Editor arbeitet auf der Dokument-Konfiguration, nicht auf einer lokal
   zusammenkopierten Effektiv-Konfiguration.
2. Häufige Aufgaben werden formularbasiert angeboten, seltene oder komplexe
   Fälle bleiben im JSON sichtbar.
3. Formular und JSON sind zwei Sichten auf dieselbe Quelle.
4. Änderungen sollen klein, reversibel und im Preview direkt überprüfbar sein.
5. Der Editor muss den fachlichen Aufbau von Zupfnoter abbilden:
   globale Werte, Extract-Werte, Layout, Druck, Stimmenauswahl, Textelemente.
6. Strukturierte Eingabe ist der Standard, kompakte Syntax bleibt für geübte
   Benutzer als schneller Expertenmodus erhalten.

## Benutzerziele

Der Konfigurationseditor muss vor allem diese Aufgaben gut unterstützen:

- Titel, Instrument und Seitenformat schnell ändern
- aktive Stimmen eines Extracts anpassen
- häufige Layout-Werte wie Abstände und Skalierung ändern
- Extract-spezifische Beschriftungen und Basisoptionen bearbeiten
- Änderungen im Harfen-/Noten-Preview direkt prüfen
- bei Bedarf in die JSON-Sicht wechseln, ohne Kontext zu verlieren

## Zielbild im UI

Der Konfigurationseditor ist ein eigenes Panel in der Workbench.

Sein Primärmodus ist kein klassischer Formular-Wizard, sondern ein
hierarchischer Baumeditor für Konfigurationsparameter.

Der Screenshot aus dem Legacy-System dient dafür als Funktionsreferenz, nicht als
Gestaltungsvorgabe.

Der Editor besteht im Zielbild aus zwei Ebenen:

1. globale Aktionsleiste
2. hierarchische Parameterliste

### 1. Globale Aktionsleiste

Die Leiste am oberen Rand enthält die wichtigsten Editorfunktionen:

- Anzeige des aktuell bearbeiteten Extracts
- Undo
- Redo
- Suche
- Schnelleinstellungen
- `Neuer Eintrag` für Array-Kontexte
- Konfigurations-Hauptmenü

Die Leiste muss immer sichtbar bleiben, auch wenn die Parameterliste gescrollt
wird.

### 2. Hierarchische Parameterliste

Die Hauptfläche zeigt die Konfiguration als auf- und zuklappbaren Baum.

Jede Zeile repräsentiert genau einen Knoten:

- Objekt
- Array
- Blattwert

Der Baum stellt die Hierarchie direkt dar, statt sie nur über Form-Bereiche
abzuleiten.

Wichtige Eigenschaften:

- Teilbäume sind ein- und ausklappbar
- die Einrückung zeigt die Tiefe der Hierarchie
- Arrays und Objekte können eigene Aktionen tragen
- Blattwerte sind direkt editierbar

Ein sekundärer JSON-Modus darf zusätzlich existieren, ist aber nicht die
Primärinteraktion des Editors.

## Informationsarchitektur

Die Parameterliste zeigt nicht eine lokal gemergte Effektiv-Konfiguration,
sondern die editierbare Dokument-Konfiguration mit Bezug auf ihre wirksamen
Werte.

Die Grundstruktur orientiert sich an realen Konfigurationsästen wie:

- `extract`
- `layout`
- `printer`
- `notes`
- `legend`
- weitere vorhandene Teilbäume der Song-Konfiguration

Der Editor darf zusätzlich Schnellzugriffe für häufige Themen anbieten, aber die
fachliche Primärstruktur bleibt der Baum der Konfigurationspfade.

## Zeilenmodell

Jede Parameterzeile zeigt mindestens diese Spalten oder Funktionsbereiche:

- Hierarchie und Auf-/Zu-Kontrolle
- Parametername
- editierbarer Parameterwert
- Select-Aktion
- Parametermenü
- Tippy-/Hilfesymbol
- wirksamer Wert

### Hierarchie

Die Hierarchie muss explizit sichtbar sein:

- aufklappbar für Objekte und Arrays
- zuklappbar für größere Teilbäume
- mit klarer visueller Einrückung

### Parametername

Der Name zeigt die fachlich lesbare Bezeichnung des Knotens.

Zusätzlich soll der technische Pfad verfügbar sein, mindestens:

- per Tooltip
- im Parametermenü
- oder in einer Detailansicht

### Parameterwert

Der Wert ist die direkt editierbare lokale Belegung im aktuellen Dokumentkontext.

Unterstützte Fälle:

- Text
- Zahl
- Boolean
- Enum-Auswahl
- Array-/Objekt-Einstieg

Für bestimmte fachliche Spezialwerte soll der Editor zwei Eingabeformen
unterstützen können:

- strukturierte Eingabe als Standard
- kompakte Rohsyntax als Expertenmodus

Das betrifft insbesondere:

- Stimmenlisten
- Synchronisationslinien
- andere lokal kodierte Mehrfachangaben

Beide Modi müssen denselben fachlichen Wert bearbeiten.

### Parametermenü

Jede Zeile besitzt ein Kontextmenü oder Aktionsmenü.

Mindestens erforderlich:

- Parameter löschen
- Teilbaum löschen
- im Baum lokalisieren oder fokussieren
- JSON/Pfad anzeigen
- Wert aus wirksamem Kontext übernehmen, wenn sinnvoll

### Select-Aktion

Für alle Konfigurationsknoten mit fachlichem Objektbezug soll eine explizite
`Select`-Aktion vorhanden sein.

Ziel:

- die Aktion setzt die fachliche Selection im Selection Manager
- selektiert wird das von der Konfiguration betroffene Objekt
- dadurch kann der Benutzer vom Konfigurationseditor direkt zur betroffenen
  Note, Annotation, Flowline oder anderen fachlichen Entität springen

Die Aktion ist besonders wichtig für:

- `notebound`-Einträge
- extract-spezifische Annotationen
- parameterisierte Einträge mit konkretem Objektbezug

Wenn ein Konfigurationspfad keinen eindeutigen Objektbezug hat, darf die
Aktion deaktiviert oder ausgeblendet sein.

### Tippy-/Hilfesymbol

Jede fachlich relevante Zeile kann ein Hilfesymbol tragen.

Das Hilfesymbol ist für:

- Kurzbeschreibung des Parameters
- Hinweis auf Datentyp
- Erklärung der Herkunft des wirksamen Werts
- Warnung bei Spezialverhalten

### Wirksamer Wert

Neben dem lokalen editierbaren Wert zeigt der Editor den aktuell wirksamen Wert.

Dabei muss sichtbar sein, aus welcher Ebene dieser wirksame Wert stammt, etwa:

- Builtin
- Extract `0`
- aktueller Extract
- lokaler Dokumentwert

Damit bleibt nachvollziehbar, warum ein leerer lokaler Wert trotzdem eine
sichtbare Wirkung im Rendering hat.

## Interaktionsmodell

### Extract-Wechsel

Der aktive Extract ist im Konfigurationseditor explizit sichtbar und steuerbar.

Regel:

- Bearbeitung und wirksamer Wert beziehen sich immer auf den sichtbar gewählten
  Extract-Kontext
- dabei muss klar erkennbar sein, ob ein lokaler Eintrag in diesem Extract, in
  `extract.0` oder nur als Builtin wirksam ist

### Auf- und Zuklappen

Der Benutzer kann einzelne Knoten und ganze Teilbäume auf- und zuklappen.

Das muss auch bei langen Konfigurationen flüssig nutzbar bleiben.

### Löschen

Der Editor muss sowohl einzelne Parameter als auch ganze Teilbäume löschen
können.

Regel:

- Blattknoten: Löschen des einzelnen Parameters
- Objekt-/Array-Knoten: Löschen des kompletten Teilbaums

### Auffüllen

Der Editor muss fehlende einzelne Parameter gezielt auffüllen können.

Gemeint ist:

- ein fehlender lokaler Parameter wird als expliziter Eintrag angelegt
- der Startwert orientiert sich am aktuell wirksamen Wert oder an einem
  geeigneten Default

Das ist besonders wichtig für Parameter, die nur implizit über Builtin oder
`extract.0` wirken.

### Neuer Eintrag

Für Arrays oder sammlungsartige Knoten braucht der Editor eine explizite Aktion
`Neuer Eintrag`.

Diese Aktion hängt vom aktuell markierten Knoten ab und ist nur dort aktiv, wo
sie fachlich sinnvoll ist.

### Suche

Die Suche muss mindestens diese Fälle unterstützen:

- Name des Parameters
- technischer Pfad
- optional sichtbarer Wert

Suchtreffer sollen den Baum automatisch öffnen oder zum Treffer springen.

## Grafische Bedienmuster

Die Oberfläche soll nicht wie ein roher JSON-Editor wirken, aber auch nicht wie
ein starres Formular ohne Struktur.

Stattdessen:

- Baumzeilen mit fester horizontaler Ordnung
- klare Spalten für Name, Wert und wirksamen Wert
- kompakte Ikon-Aktionen pro Zeile
- monospace für technische oder wertnahe Inhalte, nicht für alle Labels
- sichtbare Hierarchie statt versteckter Bereichsnavigation

Die alte Optik muss nicht reproduziert werden. Entscheidend ist die gleiche oder
bessere Arbeitsfähigkeit.

## Spezialsyntax und Expertenmodus

Im Legacy-System mussten Benutzer bei einigen Parametern kompakte lokale Syntax
beherrschen, etwa für:

- Stimmenlisten
- Synchronisationslinien
- ähnliche Mehrfach- oder Bereichsangaben

Der neue Editor soll diese Syntax nicht zur Pflicht machen, aber bewusst weiter
unterstützen.

### Zielbild

- Standardbenutzer arbeiten mit strukturierten Controls
- geübte Benutzer können auf schnelle kompakte Eingabe umschalten
- beide Darstellungen bleiben semantisch identisch

### Anforderungen

- Rohsyntax bleibt pro geeignetem Feld erreichbar
- Live-Validierung in der Rohsyntax
- klare Fehlermeldungen bei ungültiger Eingabe
- verlustfreier Wechsel zwischen strukturierter Darstellung und Rohsyntax

### Beispiele

- Stimmenlisten: Mehrfachauswahl plus kompakte Listensyntax
- Synchronisationslinien: strukturierter Listeneditor plus kompakte Kurzsyntax

## Beziehung zu Commands

Die bestehende Command-Welt bleibt relevant, wird aber UI-seitig anders
sichtbar gemacht.

Zuordnung:

- Feldänderungen entsprechen fachlich `cconf <key> <value>`
- Löschen eines Werts entspricht `delconfig <key>`
- Kopieren zwischen Extracts entspricht `cpconfig <key> <targetid>`

Zusätzlich relevant:

- Auffüllen eines Parameters ist fachlich ein gezieltes Anlegen eines lokalen
  Config-Eintrags
- `Neuer Eintrag` erzeugt einen neuen Array-Eintrag im selektierten Knoten
- Schnelleinstellungen und Hauptmenü lösen bestehende oder neue
  Konfigurationskommandos aus

## Kontextmenüs und Entkopplung

Kontextmenüs sind eine wichtige Integrationsstelle zwischen Preview,
Konfigurationseditor und weiteren UI-Bereichen.

Die Entkopplung soll dabei nicht über direkte Komponentenaufrufe erfolgen.
Ebenso soll kein freier, unstrukturierter Event-Bus das fachliche Primärmodell
werden.

Stattdessen gilt:

- Kontextmenüs lösen fachliche Commands oder klar benannte Intents aus
- diese Commands/Intents adressieren Konfigurationspfade und Extract-Kontexte
- der Konfigurationseditor reagiert darauf, statt direkt von anderen
  Komponenten aufgerufen zu werden

Das entspricht dem Legacy-Grundprinzip:

- UI-Aktion erzeugt ein Kommando
- das Kommando wird zentral verarbeitet
- daraus folgt Öffnen, Fokussieren oder Mutieren im Konfigurationseditor

### Ziel der Entkopplung

Preview, Baumeditor, Toolbar und spätere Zusatzsichten sollen nicht
komponentenspezifisch miteinander verdrahtet sein.

Stattdessen teilen sie eine gemeinsame fachliche Sprache:

- Pfad
- Extract
- Aktion

### Geeignete Aktionen

Typische fachliche Aktionen sind:

- `config.focusPath`
- `config.openMenuAtPath`
- `config.editPath`
- `config.deletePath`
- `config.fillPath`
- `config.addChildAtPath`
- `config.selectAffectedObject`

Ob diese intern als Command-String, typed Command-Objekt oder Intent-Event
transportiert werden, ist eine Implementierungsfrage. Fachlich müssen sie aber
als zentrale, nachvollziehbare Aktionen behandelbar bleiben.

### Anforderungen an die Payload

Die Payload solcher Aktionen soll fachlich sein, nicht DOM-zentriert.

Mindestens sinnvoll sind:

- `path`
- `extractId`
- optional ein Selection-Ziel oder eine auflösbare Objekt-Referenz
- optional eine Menü-Position oder ein Anchor-Rechteck für die Darstellung

Nicht die Primärschnittstelle sein sollen:

- direkte Komponenteninstanzen
- direkte DOM-Elemente
- implizite Abhängigkeiten auf konkrete Panel-Strukturen

Die UI darf diese Commands kapseln, aber nicht parallel eine zweite,
widersprüchliche Mutationslogik einführen.

## Undo/Redo

Der Konfigurationseditor besitzt eine eigene, sichtbare Undo-/Redo-Bedienung.

Anforderungen:

- Änderungen in Formular und JSON landen im selben Config-Undo
- die UI zeigt klar, dass es sich nicht um Editor-Undo handelt
- Undo/Redo ist im Panel selbst bedienbar, nicht nur per Console oder Shortcut

## Fehler- und Validierungsverhalten

Die erste Ausbaustufe braucht keine vollständige Schema-UI, aber sie braucht
klare Rückmeldungen.

Mindestens nötig:

- ungültige JSON-Syntax klar markieren
- nicht interpretierbare Formularwerte nicht still übernehmen
- Fehlzustände im Panel sichtbar machen
- betroffene Keys benennen

Die Fehlermeldung soll nach Möglichkeit am konkreten Feld oder JSON-Pfad hängen,
nicht nur in einer globalen Meldungsfläche.

## Minimaler erster Ausbau

Ein sinnvoller erster Umfang ist:

- globale Aktionsleiste mit Extract-Anzeige, Undo/Redo und Suche
- hierarchische Baumdarstellung
- Auf-/Zuklappen von Teilbäumen
- Bearbeitung einfacher Blattwerte
- Select-Aktion für Knoten mit eindeutigem Objektbezug
- Anzeige des wirksamen Werts inklusive Herkunft
- Löschen einzelner Parameter
- Löschen ganzer Teilbäume
- Auffüllen einzelner Parameter
- `Neuer Eintrag` für erste Array-Kontexte
- Parametermenü und Hilfesymbol

Noch nicht erforderlich für diesen ersten Ausbau:

- vollständige Abdeckung aller Sonderdatentypen
- Voice Styles
- vollständige Schema-gesteuerte Formulargenerierung
- tief spezialisierte Editoren für jeden Spezialknoten

## Bezug auf bestehende Artefakte

Diese Spezifikation baut besonders auf:

- `docs/phase-5/status.md`
- `docs/phase-5/roadmap.md`
- `docs/phase-5/architektur_command_ui.md`
- `docs/phase-5/phase-5-ui-architektur.md`
- `docs/phase-5/anwenderdoku_commands.md`
- `apps/web/src/workbench/panels/ConfigEditorPanel.vue`

## Ergebnis dieser Spezifikation

Nach dieser Spezifikation ist der Konfigurationseditor nicht mehr nur als
technisches Panel oder als Command-Anschluss gedacht, sondern als eigene
arbeitsfähige UI mit:

- klarer Bereichsstruktur
- sichtbarer Trennung zwischen Formular und JSON
- explizitem Extract-Kontext
- konsistenter Command- und Undo-Anbindung
  - bewusst kleinem ersten Umsetzungsumfang
