# Spezifikation: CodeMirror-Integration für den ABC-Editor

## Zweck

Diese Spezifikation beschreibt die minimal notwendige Integration von CodeMirror in `apps/web`
für den ABC-Editor. Sie deckt nur die aktuell relevanten Anforderungen ab:

1. Syntax-Highlighting wie im Legacy-System
2. Fehler am Rand anzeigen

Weitere Editor-Funktionen wie Selektion-Synchronisierung, Commands, Shortcuts oder
Konfigurationsbearbeitung werden in separaten Spezifikationen behandelt.

## Kontext

Der ABC-Editor ist die zentrale Texteingabe der Web-Anwendung. Er bearbeitet den
ABC-Quelltext, aus dem die Pipeline `ABC-Text → Song → Sheet → SVG / PDF` erzeugt wird.

Die Editor-Implementierung gehört in `apps/web`. Die fachliche Analyse und die
Fehlerermittlung bleiben im Core beziehungsweise in den zugehörigen Render-/Parse-Stufen.
CodeMirror ist nur die UI-Ebene für Darstellung, Eingabe und Markierung.

## Ziel

Der ABC-Editor soll sich für Nutzer fachlich wie das Legacy-System anfühlen:

- ABC-Konstrukte werden farblich und strukturell lesbar hervorgehoben
- Fehler werden am Rand der jeweiligen Zeile sichtbar gemacht
- die Markierungen folgen dem Quelltext und nicht einem losgelösten DOM-Zustand

## Nicht-Ziele

Diese Spezifikation fordert nicht:

- bidirektionale Selektion zwischen Editor und SVG
- Playback-Highlighting
- globale Shortcut-Architektur
- Undo/Redo-Architektur über den Editor hinaus
- Konfigurationseditor oder JSON-Editor

## Fachliche Anforderungen

### 1. Syntax-Highlighting wie im Legacy-System

Das Syntax-Highlighting muss die gleichen fachlichen Kategorien sichtbar machen wie das
Legacy-System, soweit sie im ABC-Editor relevant sind.

Mindestens sichtbar zu unterscheiden sind:

- ABC-Header und Metadaten
- Stimmen und Systemmarker
- Noten, Pausen und Dauerangaben
- Dekorationen, Kommentare und Direktiven
- eingebettete Zupfnoter-Konfigurationsblöcke
- Fehler- oder Warnhinweisstellen, soweit sie im Text kontextuell erkennbar sind

Die visuelle Umsetzung darf technisch neu sein, muss aber die Lesbarkeit und die
fachliche Differenzierung des Legacy-Editors reproduzieren.

### 2. Fehler am Rand anzeigen

Der Editor muss diagnostische Meldungen am Zeilenrand anzeigen.

Anforderungen:

- jede Meldung ist an eine konkrete Zeile gebunden
- mehrere Meldungen pro Zeile müssen möglich sein
- Warnungen und Fehler müssen visuell unterscheidbar sein
- die Randmarkierung darf den Textfluss nicht verändern
- die Meldung soll auf den Quelltext zurückführbar sein, z. B. über Tooltip oder Detailanzeige

Die Randanzeige ist eine Darstellungsschicht. Die fachliche Diagnosequelle liegt außerhalb
von CodeMirror, typischerweise im Parse-/Transformationskontext.

## Datenmodell für Diagnosen

Für die Darstellung im Editor muss jede Diagnose mindestens diese Informationen tragen:

- `severity` - `warning` oder `error`
- `message` - lesbarer Diagnose-Text
- `line` - 1-basierte Zeilennummer
- `column` - optionale 1-basierte Spalte
- `length` - optionale Spannenlänge
- `source` - optionale Herkunft, z. B. Parser oder Layout

Die Editor-Darstellung darf daraus nur UI-Marker erzeugen. Sie darf die Diagnose nicht
neu interpretieren oder fachlich verändern.

## UI-Verhalten

### Syntax-Highlighting

- die Hervorhebung wird beim Laden und bei jeder Textänderung aktualisiert
- Highlighting ist rein editor-lokal
- die Darstellung muss auch bei großen Textblöcken stabil bleiben

### Randfehler

- Fehler- und Warnmarker stehen im Rand der zugehörigen Zeile
- die Marker müssen auch bei Scrollen sichtbar konsistent bleiben
- bei mehreren Meldungen pro Zeile darf der Editor die Marker stapeln oder bündeln
- auf Wunsch der Bedienoberfläche kann eine Marker-Interaktion die zugehörige Meldung öffnen

## Architekturvorgaben

### Zuständigkeit

- `apps/web` baut und konfiguriert CodeMirror
- `@zupfnoter/core` oder angrenzende Analysepfade liefern Diagnosen
- CodeMirror verwaltet nur Darstellung und editornahe Interaktion

### Trennung von Fach- und UI-Logik

- die Heuristik für Diagnoseerzeugung gehört nicht in die Editor-Komponente
- die Editor-Komponente übersetzt Diagnosen nur in Decorations, Gutter-Elemente und Tooltips
- Syntax-Regeln werden als CodeMirror-Extensions formuliert, nicht als DOM-Manipulation

## Akzeptanzkriterien

Die Umsetzung gilt als ausreichend, wenn:

1. ABC-Text im Editor sichtbar strukturiert hervorgehoben wird
2. Warnungen und Fehler an der jeweiligen Zeile am Rand markiert werden
3. der Editor-Textfluss durch Fehlermarkierungen nicht verschoben wird
4. Diagnosen aus dem Parse-/Analysepfad im Editor angezeigt werden können
5. die Darstellung auch bei längerem ABC-Text stabil bleibt

## Offene Punkte

- Welche konkrete Farb- und Kategorienzuordnung exakt dem Legacy-Editor entspricht, muss
  beim Implementieren gegen das Legacy-System verifiziert werden.
- Ob Tooltips, klickbare Marker oder eine zusätzliche Diagnoseleiste gewünscht sind, ist
  für diese Minimal-Spec noch offen.
