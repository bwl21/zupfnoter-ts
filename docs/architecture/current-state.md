# Architektur und aktueller Projektstand

Stand: 2026-09-05. Dieser Ist-Bericht ergänzt die Fachspezifikationen.
Befunde, Abnahmekriterien und Prüfergebnisse der Architekturklärung stehen im
[Review mit Checkliste](../review/architecture-clarity-2026-09-05.md).

## Quelle der Wahrheit und Paketgrenzen

ABC bleibt die fachliche Quelle. Die Apps verbinden gemeinsame Bausteine;
sie besitzen keine eigenen Song-Parser oder alternative Layout-Pipelines.

```text
ABC → core: DocumentPipeline → Song → Sheet → SVG/PDF
                                  ↘ Playback-Timeline
                                     ├→ playback-audio → Web / Review
                                     └→ playback: Linkformat → Practice
                                                              ↘ playback-audio/session
```

| Paket | Verantwortung und Grenze |
|---|---|
| `types` | Gemeinsame Datenmodelle, einschließlich Playback-Link- und Storage-Verträgen; nur Typen, keine Laufzeitlogik. |
| `core` | ABC-Parser, Song/Layout, SVG/PDF, Confstack/Schema und gemeinsame fachliche Playback-Berechnungen. Kein App-Import. |
| `playback` | Versioniertes Linkformat, Kompressionsschnittstelle und Metronommathematik; keine zweite aus Exportdaten rekonstruierte Timeline. |
| `playback-audio` | Browser-Audio-Sitzung, Instrumentladen und Scheduling; Timeline-Adapter für Web/Review. Der Unterpfad `./session` importiert Core nicht und wird von Practice verwendet. |
| `storage` | Verbindungen, Anbieterregistrierung, Dropbox/OAuth-Protokoll. Kein Core-Import für Zustandstypen; keine Vue-Dialoge. |
| `design-system` | Gemeinsame Vue-Komponenten und Design-Tokens, einschließlich Wiedergabepille/-Controls. Privates Quellpaket; Build bedeutet Vue-Typecheck. |
| `practice-ui` | Imperative produktive Practice-Oberfläche, Steuerungs-API und Styles. Keine Audio-Engine. |

Alle Apps sind eigenständige Einstiegspunkte. Produktionscode importiert
weder Storybook noch eine andere App. Storybook darf Produktionskomponenten
für deren Darstellung importieren.

## Apps

- **Web:** vollständige Workbench mit Editor, Commands, Konfiguration,
  Auswahl, Vorschauen, Storage, Export und Playback.
- **Review:** schreibgeschützte ABC-Ansicht mit Auszügen, Storage-Öffnen,
  Playback und Highlights; für mobile Geräte, Tablets und Desktop-Browser.
  Ohne Notenauswahl wird der aktuelle Auszug gespielt.
- **Practice:** eigenständige mobile Link-Wiedergabe und QR-Scanner;
  benötigt weder ABC noch den Core-Parser zur Wiedergabe.
- **CLI:** Node-Einstieg mit Commands und Batch-SVG-/PDF-Export samt
  optionalem Practice-Link/QR. Datei-I/O und Kompression sind Node-Adapter.
- **Zupfmanager-QR-Generator:** Projekt-/Datenbank-I/O und QR-Blatt-Zusammenstellung.
- **ViewSvg:** eigenständige Vergleichs-/SVG-/PDF-Ansichten.
- **Demo:** kleiner direkter Verbraucher der zentralen Dokument-Pipeline.
- **Storybook:** isolierte Darstellungen produktiver Komponenten und
  Practice-Renderfunktion, keine Ersatz-Mockups.

## Gemeinsame Dokument- und Konfigurationsverarbeitung

`DocumentPipeline` bietet zentrale Einstiege für Konfiguration,
ABC→Song, Layout mit einheitlichen Textmetriken und Playback-Link-Optionen.
Web, Review, CLI, Demo und QR-Generator verwenden diese Verarbeitung.
Ressourcen-I/O und Browser-/Node-Kompression werden vom Aufrufer bereitgestellt.

`Confstack` bleibt generisch. Der Fachaufbau der Konfiguration liegt im
Core. Für den Editor vereinigt `ConfigEditorContext` Built-in-Werte,
globale Dokumentwerte, Auszug 0 und aktiven Auszug. Konkrete Formularpfade
verwenden das Schema; Herkunftsinformationen kommen aus Confstack.
Schema-Metadaten beschreiben Default-Verweise, nicht UI-Regex.
Die dokumentierte Legacy-Formset-Kompatibilität ist keine Feldquelle für
konkrete Formulare. Details und Grenzen:
[Konfigurationsparität](../user-manual/UD_Zupfnoter-Handbuch/config-parity.md).

## Playback und Lifecycle

Web und Review verwenden dieselbe Timeline-Audio-Implementierung und dieselbe
fachliche Highlight-Zeitbasis. Die Startposition berücksichtigt Takt **und**
Durchlauf. Gemeinsame fachliche Typen liegen in `types`; bisherige
Typ-Importpfade werden teilweise kompatibel weitergereicht.

Practice und der Timeline-Adapter teilen AudioContext-Erzeugung,
gestenzeitiges Resume, Laden/Timeout/Abbruch und Scheduling-Fenster über
`playback-audio/session`. Die Adapter behalten absichtlich ihre
Ausgabeeinstellungen: Web-Stereo und vollständig vorgeplante Ereignisse;
Practice-Sampleauswahl, Kompressor und mobile Nachfüllfenster. Gleiche
Audio-Infrastruktur bedeutet daher nicht automatisch identischen Klang.

Review besitzt einen Speichercontroller mit explizitem ABC-Übernahme-Callback.
Verbindungswechsel und Unmount entwerten ausstehende Ergebnisse.
Die Workbench besitzt einen separaten Rendercontroller für Worker, Request-IDs,
Debounce und Cleanup; ihre Stores verbleiben bei der Workbench.

## Worker und Storybook

Die Web-Renderpipeline läuft bereits in einem Modul-Worker
(`apps/web/src/workbench/rendering/renderWorker.ts`). Ist Worker-Erzeugung
nicht verfügbar, verwendet der Controller dieselbe Renderfunktion synchron.
Veraltete Ergebnisse werden verworfen. Review verwendet derzeit den
synchronen Core-Einstieg; eine Worker-Migration von Review ist nicht behauptet.

Storybook hat eigene Vite-/TypeScript-Konfiguration und lädt global nur
die Design-System-Basis. Die vorhandenen Workbench-Stories benötigen keine
globale Pinia-Installation oder Web-Shell-Styles. App-spezifische Story-Umgebung
gehört bei künftigem Bedarf an die jeweilige Story.

## Validierung und verbleibende Grenzen

- Die Architekturklärung enthält pro Befund einen Implementierungscommit
  und dokumentierte Tests; siehe verlinkte Checkliste.
- Unit-Tests und Typechecks belegen ausschließlich das geprüfte Verhalten.
  Vollständige Legacy-, Druck-, Klang- und Geräteparität sind keine daraus
  ableitbaren Zusagen.
- Reale iOS-/Android-Tests für Audio und QR-Erkennung bleiben notwendig.
  Die integrierte Browserprüfung war in der Architekturklärung nicht erreichbar.
- Große UI-Einstiege bestehen weiterhin als App-Komposition. Die Abgrenzung
  einzelner Verantwortlichkeiten ist kein Anspruch auf einen vollständigen
  Neuaufbau aller Commands und Stores.
- Export-/Anbieterfehler und Netzunterbrechungen benötigen weiterhin
  Integrationstests mit echten, ausdrücklich freigegebenen Verbindungen.
- Deploy-Skripte für Web, Practice und Review sind vorhanden. Dieser
  Architektur-Branch wurde nicht deployed oder gepusht.
