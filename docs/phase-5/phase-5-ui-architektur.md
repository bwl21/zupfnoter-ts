# Phase 5 – UI- und Applikationsarchitektur

## Überblick

Im aktuellen Stand des Projekts existieren mehrere Anwendungstypen, die auf denselben Kernfunktionen aufbauen, jedoch unterschiedliche Laufzeit- und Bedienkonzepte besitzen.

Die Architektur trennt dabei:

- Core-Logik
- UI-Controller
- CLI-Steuerung
- Worker-/Batch-Verarbeitung

Dadurch kann dieselbe Transformations- und Rendering-Logik in verschiedenen Umgebungen verwendet werden.

---

# Anwendungen

## 1. Web-Anwendung

Die Web-Anwendung ist die interaktive Hauptoberfläche.

Merkmale:

- Editor für ABC-Text
- SVG-Vorschau
- Konfigurationseditor
- Interaktive Bedienung
- Undo/Redo innerhalb einzelner UI-Komponenten

Relevante Komponenten:

- `application.rb`
- Web-Controller
- Vue-/Frontend-Komponenten in `apps/web`

---

## 2. CLI-Anwendung

Die CLI-Anwendung dient der automatisierten Verarbeitung.

Typische Aufgaben:

- SVG/PDF-Export
- Fixture-Erzeugung
- Batch-Verarbeitung
- Testläufe

Relevante Komponenten:

- `application-cli.rb`
- `controller-cli.rb`

Eigenschaften:

- keine interaktive UI
- deterministische Verarbeitung
- gut für CI/CD geeignet

---

## 3. Worker-Anwendung

Die Worker-Anwendung verarbeitet Hintergrundaufgaben.

Relevante Dateien:

- `znworker.rb`

Mögliche Aufgaben:

- Rendering
- Queue-Verarbeitung
- Langlaufende Jobs
- Serverbetrieb

---

# Controller-Struktur

Aktuell existieren mehrere spezialisierte Controller.

## Relevante Dateien

- `controller.rb`
- `controller-cli.rb`
- `controller-nw.rb`
- `controller_command_definitions.rb`

---

## Architekturidee

Die Controller kapseln:

- UI-Kommandos
- Dateizugriffe
- Undo/Redo
- Rendering-Aufrufe
- Export-Funktionen
- Zustandsverwaltung

Dabei teilen sich die Controller große Teile der Kernlogik, besitzen aber unterschiedliche Bedienoberflächen.

---

# Undo-/Redo-Konzept

Aktuell existieren drei Undo-Stacks.

## 1. Editor-Undo

Zuständig für Änderungen am ABC-Text.

Typische Aktionen:

- Texteingabe
- Löschen
- Einfügen
- Formatierungen

---

## 2. Konfigurationseditor-Undo

Zuständig für Änderungen an:

- Layout-Konfiguration
- Rendering-Optionen
- Zupfnoter-spezifischen Einstellungen

---

## 3. Globales Undo

Das globale Undo dient hauptsächlich dazu:

- versehentlich geladene Dokumente zurückzunehmen
- größere Zustandswechsel rückgängig zu machen

Beispiel:

- anderes Lied geladen
- Datei geöffnet
- Projektzustand gewechselt

---

# Problemstellung beim globalen Undo

Im aktuellen UI ist das globale Redo/Undo kaum sichtbar.

Teilweise wird es nur über:

- Konsolenfenster
- Tastaturkommandos
- Debug-Funktionen

bedient.

Dadurch entsteht:

- geringe Sichtbarkeit
- unklare Zuständigkeit
- Verwechslungsgefahr mit lokalem Undo

---

# Mögliche Architekturverbesserungen

## Klare Trennung der Undo-Ebenen

UI-seitig könnte deutlicher getrennt werden zwischen:

| Ebene | Bedeutung |
|---|---|
| Editor | Textänderungen |
| Konfiguration | Layout-/Config-Änderungen |
| Global | Dokument-/Projektzustand |

---

## Sichtbarkeit im UI

Mögliche Maßnahmen:

- eigene Toolbar-Bereiche
- Verlauf-/History-Ansicht
- getrennte Icons
- Scope-Anzeige („Editor“, „Projekt“, „Konfiguration“)

---

## Event-/Command-Architektur

Langfristig könnte eine vereinheitlichte Command-Architektur sinnvoll sein.

Ziele:

- reproduzierbare Aktionen
- persistente History
- Makros/Scripting
- synchronisierte Worker-Verarbeitung

---

# Verhältnis von Web, CLI und Worker

## Gemeinsame Basis

Alle Anwendungen verwenden denselben Kern:

- Parser
- Song-Modell
- Sheet-Modell
- Rendering
- Layouting

---

## Unterschiedliche Laufzeitmodelle

| Anwendung | Interaktiv | Batch | Hintergrund |
|---|---|---|---|
| Web | Ja | Teilweise | Nein |
| CLI | Nein | Ja | Nein |
| Worker | Nein | Ja | Ja |

---

# Langfristige Zielarchitektur

Eine mögliche Zielarchitektur wäre:

## Core

Enthält:

- Parser
- Modelle
- Layouting
- Rendering
- Konfigurationssystem

---

## Application Layer

Enthält:

- Commands
- Undo/Redo
- State Management
- Projektverwaltung

---

## Frontends

Getrennte Frontends für:

- Web
- CLI
- Worker
- eventuell Desktop-App

---

# Offene Fragen

## Globales Undo

- Wie sichtbar soll es sein?
- Soll es persistiert werden?
- Soll es projektübergreifend sein?

---

## Command-System

- zentrale Command-Registry?
- serialisierbare Commands?
- Replay-/Macro-Funktion?

---

## Worker-Integration

- asynchrones Rendering
- Rendering-Queues
- Serverbetrieb

---

# Zusammenfassung

Die bestehende Architektur besitzt bereits eine klare funktionale Trennung zwischen:

- Core
- UI
- CLI
- Worker

Die größte offene Herausforderung liegt aktuell in:

- Zustandsverwaltung
- globalem Undo/Redo
- sichtbarer UI-Integration
- Vereinheitlichung der Command-Struktur
