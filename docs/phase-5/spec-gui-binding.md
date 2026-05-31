# Spezifikation: Anbindung des grafischen UI

## Zweck

Dieses Dokument ist eine Arbeitsgrundlage für die Konzeption der grafischen Benutzeroberfläche von Zupfnoter.
Es soll an ChatGPT gegeben werden können, damit daraus eine saubere UI-Architektur mit klaren Schnittstellen,
Zuständen und Interaktionsregeln abgeleitet wird.

Ziel ist nicht die fertige Implementierung, sondern ein belastbares Konzept für die Anbindung des GUI an die
bestehende Zupfnoter-Logik.

## Kontext

Zupfnoter besteht fachlich aus einer festen Transformationskette:

`ABC-Text → Song → Sheet → SVG / PDF`

Die neue UI soll diese Pipeline sichtbar machen und steuern, ohne die Fachlogik in die Oberfläche zu verlagern.
Die UI darf nur über definierte Schnittstellen mit `@zupfnoter/core` kommunizieren.

Wichtige vorhandene Artefakte:

- `packages/core` für ABC-, Song-, Sheet- und Ausgabe-Logik
- `packages/types` für gemeinsame Datentypen
- `apps/web` als zukünftige produktive Vue-Anwendung
- `apps/viewsvg` als lokaler visueller Vergleichs- und Debug-Viewer

## Zielbild

Die UI soll später mindestens diese Funktionen abdecken:

- ABC-Text eingeben und bearbeiten
- Konfiguration pro Extract verwalten
- Song und Sheet erzeugen
- SVG- und PDF-Ausgabe anzeigen oder exportieren
- Elemente im SVG auswählen und ihre fachlichen Metadaten sehen
- Abweichungen zwischen Legacy und TS visuell untersuchen

## Leitprinzipien

1. Die Fachlogik bleibt im Core.
2. Die UI spricht nur über definierte API-Funktionen, Datenmodelle und Commands mit dem Core.
3. UI-Zustand und Fachzustand werden getrennt gehalten.
4. Selektion, Hover und Editor-Aktionen müssen auf dieselben fachlichen Identitäten zeigen.
5. Sichtbarkeit und Interaktion dürfen nicht durch implizite DOM-Annahmen entstehen.

## Benötigte Schnittstellen

Die spätere UI braucht klare, stabile Schnittstellen für:

- ABC parsen
- Song erzeugen
- Sheet erzeugen
- SVG erzeugen
- PDF erzeugen
- Ausgewähltes Element identifizieren
- Element-Metadaten lesen
- Konfiguration lesen und ändern
- Command-Ausführung mit Undo/Redo

## Daten, die im UI sichtbar sein müssen

Mindestens diese Kategorien müssen im UI verfügbar sein:

- Roh-ABC
- Song-Daten
- Sheet-Daten
- SVG-Ausgabe
- Extract-Auswahl
- Konfiguration pro Extract
- `confKey`-basierte Identität
- Zusatzmetadaten wie `more_conf_keys` und `draginfo`, soweit sie für Interaktion relevant sind

## Interaktionsanforderungen

Die UI soll folgende Interaktionen unterstützen:

- Klick auf SVG-Elemente
- Hover über SVG-Elemente
- Anzeige von Metadaten zum Element
- Editor-Selektion aus dem SVG ableiten
- Änderung von Konfigurationswerten
- Auslösen von Commands
- Undo/Redo
- Vergleich von Legacy und TS

## Architekturfragen, die ChatGPT beantworten soll

Bitte entwerfe auf Basis dieses Dokuments:

1. Welche Komponenten sollte die UI haben?
2. Welche Daten gehören in globale Stores und welche nur in lokale Komponenten?
3. Welche Events braucht die UI zum Core?
4. Wie wird die Identität eines SVG-Elements zuverlässig an den Editor zurückgegeben?
5. Wie wird ein ausgewähltes Element in UI und Core konsistent gehalten?
6. Wie sollte der Vergleichsmodus zwischen Legacy und TS strukturiert sein?
7. Wie sieht ein klarer Datenfluss für Parse → Layout → Render → Interaktion aus?
8. Welche Teile sollten als Commands modelliert werden?

## Nicht-Ziele

Dieses Dokument fordert nicht:

- die konkrete Implementierung
- die Wahl eines spezifischen UI-Frameworks
- eine neue Fachlogik im Core
- lokale Sonderfälle nur für einzelne Fixtures

## Erwartetes Ergebnis von ChatGPT

Die Antwort von ChatGPT soll am Ende liefern:

- einen Vorschlag für die UI-Struktur
- einen Vorschlag für die Zustandsaufteilung
- einen Vorschlag für die Core-UI-Schnittstellen
- einen Vorschlag für die Event-/Command-Architektur
- Hinweise auf Risiken oder unklare Stellen

## Arbeitsauftrag für ChatGPT

Bitte konzipiere die grafische UI-Anbindung von Zupfnoter so, dass:

- die Fachlogik im Core bleibt
- die UI nur über klar definierte Schnittstellen arbeitet
- SVG-Selektion und Editor-Selektion denselben fachlichen Bezug haben
- Vergleiche zwischen Legacy und TS reproduzierbar sind
- spätere Erweiterungen nicht an impliziten DOM-Tricks hängen

Antworte strukturiert und konkret. Vermeide allgemeine UI-Ratschläge ohne Bezug zur Zupfnoter-Pipeline.
