# Architekturklärung vom 5. September 2026

Ausgangspunkt: `a1f79aa`, Branch `feat/mobile-review-app`.
Arbeitsbranch: `feat/architecture-clarity`.

Der Review unterscheidet nachgewiesene Defekte von strukturellen Risiken.
Keine neue Parallelarchitektur: vorhandene Fachlogik wird zentralisiert und
bestehende öffentliche Einstiege bleiben nach Möglichkeit kompatibel.
Jeder Befund erhält einen eigenen Implementierungscommit einschließlich
Aktualisierung dieser Checkliste. Die Reihenfolge darf Abhängigkeiten folgen.

## Checkliste

- [x] B1 – Lockdatei reparieren und reproduzierbare Workspace-Auflösung prüfen.
- [x] B2 – Musikalische Startposition zentral auflösen; Durchlauf berücksichtigen.
- [x] B3 – Konfigurationsfelder und wirksame Werte generisch aus Schema/Confstack beziehen.
- [x] B4 – Gemeinsame Dokument-/Exportvorbereitung; identische Playback-Link-Metadaten.
- [x] B5 – Gemeinsamer Audio-Lebenszyklus und Scheduling für Practice sowie Web/Review.
- [x] B6 – Gemeinsame fachliche Typen eindeutig in `packages/types` besitzen.
- [x] B7 – Design-System-Paketvertrag und Build/Typecheck konsistent machen.
- [ ] B8 – UI-Abläufe durch verantwortliche Controller entkoppeln.
- [ ] B9 – Storybook isolieren und Architekturdokumentation aktualisieren.

## Befunde und Abnahmekriterien

### B1 – Fehlerhafte Lockdatei (hoch)

`pnpm-lock.yaml` enthält unter Storybook zweimal `@zupfnoter/types`, davon
einmal mit `link:../types`. Im Design-System fehlt die deklarierte Abhängigkeit.
Ein YAML-Parser meldet doppelte Schlüssel. Bestehende `node_modules` verdecken
den Fehler bei lokalen Typechecks.

Abnahme: eindeutiges YAML, Manifest-/Lockfile-Konsistenz und Installation mit
Frozen-Lockfile ohne Veränderung der Lockdatei.

### B2 – Falscher Review-Startdurchlauf (hoch)

`apps/review/src/App.vue:preparePlaybackSteps` wählt bei der Folge
`15/1 → 16/1 → 15/2` für die gewünschte Position `15/2` den Schritt `16/1`.
Der vorhandene Funktionskörper reproduziert diesen Fehler.

Abnahme: eine zentrale Positionsauflösung mit Regressionstest für Wiederholungen,
fehlende Positionen und Zeitverschiebung; Review verwendet diese Funktion.

### B3 – Zweite Konfigurationslogik (hoch)

`packages/core/src/configEditorForms.ts:getConfigEditorDynamicFields` enthält
Regex-Tabellen mit festen Feldern. `ConfigEditorPanel.vue` ergänzt eigene
Default-Vererbung und Sonderformulare. Das widerspricht der generischen
Schema-/Confstack-Regel. Legacy-Parität ist durch den Review nicht belegt.

Abnahme: konkrete Pfade beziehen ihre Felder aus dem Schema; wirksame Werte und
Quellen kommen zentral aus Confstack. Schema, dynamische Einträge, Defaults,
Ebene 0 und aktive Ebene werden gemeinsam berücksichtigt. Tests bleiben erhalten;
bewusste Legacy-Abweichungen werden dokumentiert.

### B4 – Unterschiedliche Pipeline-Zusammensetzung (mittel)

Web, Review, CLI und QR-Generator setzen die Kernbausteine separat zusammen.
Der CLI-Batch-Link lässt BPM, Tempoeinheit und Metronom weg, während Web und
QR-Generator sie übertragen.

Abnahme: gemeinsame fachliche Dokument-/Exportvorbereitung, gemeinsame
Playback-Link-Optionen und Konsistenztests; Plattform-I/O bleibt beim Aufrufer.

### B5 – Getrennte Audio-Scheduler (mittel)

Practice besitzt in `apps/practice/src/main.ts` einen eigenen AudioContext-,
Soundfont-, Scheduling- und Pause-Lebenszyklus. Web/Review verwenden
`packages/playback-audio`. Gemeinsame Metronommathematik allein teilt keine
Audio-Lebenszyklen.

Abnahme: zentraler Audio-Lebenszyklus/Scheduler mit Adaptern für Timeline und
Link-Ereignisse; keine Rekonstruktion einer zweiten fachlichen Timeline aus
dem Link. AudioContext-Gesten, Pausen, Wiederaufnahme und Metronom werden geprüft.
Reale iOS-/Android-Klangparität kann ein Unit-Test nicht beweisen.

### B6 – Uneindeutige Typzuständigkeit (mittel)

`PlaybackPosition`, `PlaybackEvent` und `PlaybackLinkOptions` stehen parallel
in `types` und `playback`; die Optionsdefinitionen sind bereits verschieden.
Storage bezieht seinen Zustandstyp aus Core.

Abnahme: kanonische Definitionen in `packages/types`, kompatible Typ-Reexports
und keine reine Typabhängigkeit von Storage auf die Core-Implementierung.

### B7 – Unzutreffender Design-System-Buildvertrag (mittel)

Das Manifest exportiert `dist/index.js`; `build: tsc` läuft jedoch mit
`noEmit: true`. Die Apps funktionieren durch ihre besondere `source`-Auflösung.

Abnahme: expliziter, dokumentierter Quellpaket- oder Buildvertrag; alle
Verbraucher lösen ihn konsistent auf; Vue-Komponenten werden wirklich typgeprüft.

### B8 – Überladene UI-Koordination (mittel)

Workbench, Review und Practice koordinieren zahlreiche unabhängige Abläufe
direkt in großen UI-Einstiegen. Zeilenzahl allein ist kein Defekt; gemeinsam
veränderter Zustand verschiedener Abläufe erhöht das Nebenwirkungsrisiko.

Abnahme: fachlich abgegrenzte Controller für betroffene Abläufe, explizite
Schnittstellen und Lifecycle-Cleanup; keine kosmetische Zerlegung nach Zeilenzahl.

### B9 – Storybook-Isolation und veralteter Ist-Bericht (mittel)

Storybook übernimmt global Web-CSS, Pinia und Web-Vite-Konfiguration.
`docs/architecture/current-state.md` nennt Worker offen und führt die neuen
Pakete/Review nicht auf.

Abnahme: globale Storybook-Basis nur Design-Tokens und tatsächlich allgemeine
Abhängigkeiten; Web-spezifische Umgebung lokal an den benötigten Stories.
Ist-Dokumentation zeigt tatsächliche Pakete, Grenzen, Worker und Prüfgrenzen.

## Validierung und Grenzen

Pro Implementierungscommit werden ausgeführte Prüfungen und offene Grenzen
hier ergänzt. Ein grüner Typecheck belegt weder reproduzierbare Installation
noch Klang-/Layout-Parität. Browser-/Geräteprüfungen werden getrennt ausgewiesen.

### Ausgangsreview

- Deklarierter Workspace-Produktionsgraph ohne Zyklen.
- Keine produktiven gegenseitigen Imports zwischen Web und Review gefunden.
- Zentrale Parser-/Song-/Sheet-/SVG-/PDF-Bausteine vorhanden.
- YAML-Fehler und Review-Startpositionsfehler gezielt reproduziert.
- Keine vollständige Legacy-, Browser- oder Geräteprüfung im Ausgangsreview.

### B1 – Ergebnis

Der falsche Storybook-Eintrag wurde entfernt und unter Design-System korrekt
eingetragen. `pnpm install --lockfile-only --frozen-lockfile --offline
--ignore-scripts` prüft alle 17 Workspace-Projekte erfolgreich. Eine vollständige
Neuinstallation wurde nicht durchgeführt: pnpm wollte die vorhandenen
Modulverzeichnisse ersetzen und brach ohne TTY ab. Die laufenden lokalen
Entwicklungsserver behalten deshalb ihre vorhandene Installation.

### B2 – Ergebnis

`playbackTimelineFromPosition` in Core sucht die exakte Position und verschiebt
die verbleibenden Schritte relativ zum neuen Start. Review nutzt diese Funktion.
Fehlende Positionen liefern eine leere Timeline. Regressionstests prüfen den
zweiten Durchlauf, fehlende Positionen und unveränderte Eingangsdaten.
Core-Regressionstests (2), Review-Tests (2) und beide Typechecks erfolgreich.
Keine akustische Änderung am Scheduler; keine Geräteprüfung durchgeführt.

### B6 – Ergebnis

Position, Ereignis, Metrum, Positionsmarker, Linkoptionen, Metronomkonfiguration
und Linkergebnis samt Größenanalyse haben eine kanonische Definition in `types`.
Playback und Core reichen die bisherigen Typ-Imports kompatibel weiter.
`StorageCommandState` liegt ebenfalls in `types`; Storage benötigt Core nicht mehr.
Rein formatinterne und plattformspezifische Adaptertypen bleiben beim Besitzer.
Alle Workspace-Typechecks, 31 Playback- und 2 Storage-Tests erfolgreich.
Workspace-Installation mit `--frozen-lockfile --offline --ignore-scripts`
anschließend vollständig erfolgreich; keine Paketdownloads erforderlich.

### B7 – Ergebnis

Design-System ist explizit ein privates Vue-/TypeScript-Quellpaket. Manifest
und README beschreiben denselben Vertrag; `build` validiert mit `vue-tsc`,
einschließlich der Vue-Templates, statt ein nicht erzeugtes `dist` anzubieten.
Frozen-Workspace-Installation, Design-System-Build, Storybook-Typecheck,
4 Web-Komponententests und Review-Build inklusive Typecheck erfolgreich.
Bekannte Vendor-eval-/Chunkgrößenwarnungen bleiben; keine visuelle Änderung.

### B4 – Ergebnis

`DocumentPipeline` bündelt Konfigurationsaufbau, Song-Transformation,
Layout-Textmetriken und Playback-Link-Optionen. Web, Review, CLI, QR-Generator
und Demo nutzen diese Einstiege; Ressourcenauflösung und Kompression bleiben
bei den Plattformadaptern. CLI-Links enthalten jetzt ebenfalls BPM,
Tempoeinheit und die über Confstack geerbten Metronomvorgaben.
4 Core-, 22 Web- und 2 Review-Tests sowie alle Workspace-Typechecks erfolgreich.
Die Konsistenztests vergleichen Song- und Timeline-Export und prüfen
Tempoeinheit und Metronomvererbung. Keine vollständige Druck-/Legacy-Parität
oder Geräteprüfung behauptet.

### B3 – Ergebnis

Konkrete Editorpfade verwenden generische Schema-Bäume. Die UI-eigenen
dynamischen Formularbauer und Default-Regex entfallen. `ConfigEditorContext`
vereinigt die Konfigurationsebenen zentral; Confstack kann die beitragende
Schicht ausweisen. Notengebundene Default-Verweise stehen als Metadaten im
Schema. Die alte Formset-API bleibt als dokumentierte Legacy-Kompatibilität
mit unveränderten Tests erhalten, ohne konkrete UI-Felder zu bestimmen.
95 Core-Tests und 50 Panel-Tests sowie Web-Typecheck erfolgreich.
Legacy-Belege und bewusste Erweiterung stehen in `config-parity.md`.
Eine visuelle Browserprüfung ist in dieser Sitzung bisher nicht verfügbar.

### B5 – Ergebnis

`playback-audio/session` besitzt AudioContext, gestenzeitiges Resume,
Sample-Cache/-Timeout/-Abbruch und audiozeitbasierte Scheduling-Fenster.
Practice verwendet diesen Core-freien Einstieg mit Link-Ereignissen;
Web/Review behalten ihren Timeline-Adapter. Gestoppte Sample-Ladevorgänge
können keinen neuen Kontext mehr eröffnen. Die Ausgabestrategien bleiben
bewusst erhalten: Web plant vorbereitete Stereo-Ereignisse vollständig,
Practice füllt begrenzte mobile Fenster mit überlappenden Resume-Noten nach.
Gain, Kompressor, Instrumentwahl und Metronommathematik bleiben unverändert.
20 gemeinsame Audio-/Web-Tests, 12 Practice-Tests, Web-/Practice-Typechecks,
Audio-Paketbuild und Practice-Produktionsbuild erfolgreich. Das sind keine
akustischen iOS-/Android-Paritätsnachweise; Geräteprüfung bleibt erforderlich.
