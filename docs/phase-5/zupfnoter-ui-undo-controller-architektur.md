# Zupfnoter – UI-, Undo- und Controller-Architektur

## Überblick

Im aktuellen Zupfnoter-System existieren mehrere Ebenen von Anwendungen und Zuständigkeiten. Die Architektur ist historisch gewachsen und unterscheidet zwischen verschiedenen Laufzeitumgebungen.

Gleichzeitig existieren mehrere voneinander getrennte Undo/Redo-Stacks, was direkte Auswirkungen auf die UI-Konzeption hat.

---

# Undo-/Redo-Konzept

## Aktuelle Situation

Es existieren derzeit drei voneinander getrennte Undo-Stacks:

1. Editor-Undo
2. Konfigurationseditor-Undo
3. Globales Undo

Diese Undo-Systeme haben unterschiedliche Verantwortlichkeiten.

---

## 1. Editor-Undo

Der normale Editor besitzt ein lokales Undo/Redo-System.

Typische Anwendungsfälle:

- Änderungen am ABC-Text
- Textbearbeitung
- Direkte Inhalteingaben

Dieses Undo verhält sich ähnlich wie in klassischen Texteditoren.

---

## 2. Konfigurationseditor-Undo

Der Konfigurationseditor besitzt einen separaten Undo-Stack.

Typische Änderungen:

- Layoutparameter
- Zupfnoter-Konfiguration
- Rendering-Optionen
- Druckparameter

Der Stack ist vom normalen Texteditor getrennt.

---

## 3. Globales Undo

Zusätzlich existiert ein globales Undo-System.

Dieses wird weniger für einzelne Bearbeitungsschritte benötigt, sondern eher für:

- versehentliches Laden anderer Dateien
- Rückkehr zu einem vorherigen Gesamtsystemzustand
- Wiederherstellung nicht gespeicherter Arbeitsstände

Dadurch entsteht ein semantisch anderer Undo-Begriff:

- lokale Undos = Bearbeitungsschritte
- globales Undo = Dokument-/Anwendungszustände

---

# UI-Auswirkungen

## Problem der Sichtbarkeit

Im aktuellen UI existiert kein sichtbares Element für das globale Redo.

Das globale Undo/Redo wird teilweise nur über das Konsolenfenster bzw. technische Funktionen erreichbar.

Dadurch entsteht:

- geringe Entdeckbarkeit
- unklare Zuständigkeit
- Verwechslungsgefahr zwischen lokalen und globalen Undo-Ebenen

---

# Controller-Architektur

## Mehrere Controller

Das Legacy-System besitzt mehrere Controller-Einstiegspunkte.

Genannte Dateien:

- controller.rb
- controller-cli.rb
- controller-nw.rb
- controller_command_definitions.rb

---

# Anwendungen / Laufzeitumgebungen

Im Grunde existieren drei Hauptanwendungen:

## 1. Web-Anwendung

Datei:

- application.rb

## 2. CLI-Anwendung

Datei:

- application-cli.rb

## 3. Worker-Anwendung

Datei:

- znworker.rb

---

# Fazit

Die bestehende Architektur zeigt:

- mehrere Anwendungstypen
- mehrere Undo-Ebenen
- historisch gewachsene Controller-Strukturen
- starke Trennung zwischen lokalen Bearbeitungen und globalen Dokumentzuständen
