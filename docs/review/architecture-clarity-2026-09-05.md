# Architekturklärung vom 5. September 2026

Ausgangspunkt: `a1f79aa`, Branch `feat/mobile-review-app`.
Arbeitsbranch: `feat/architecture-clarity`.

Der Review unterscheidet nachgewiesene Defekte von strukturellen Risiken.
Keine neue Parallelarchitektur: vorhandene Fachlogik wird zentralisiert und
bestehende öffentliche Einstiege bleiben nach Möglichkeit kompatibel.
Jeder Befund erhält einen eigenen Implementierungscommit einschließlich
Aktualisierung dieser Checkliste. Die Reihenfolge darf Abhängigkeiten folgen.

## Checkliste

- [ ] B1 – Lockdatei reparieren und reproduzierbare Workspace-Auflösung prüfen.
- [ ] B2 – Musikalische Startposition zentral auflösen; Durchlauf berücksichtigen.
- [ ] B3 – Konfigurationsfelder und wirksame Werte generisch aus Schema/Confstack beziehen.
- [ ] B4 – Gemeinsame Dokument-/Exportvorbereitung; identische Playback-Link-Metadaten.
- [ ] B5 – Gemeinsamer Audio-Lebenszyklus und Scheduling für Practice sowie Web/Review.
- [ ] B6 – Gemeinsame fachliche Typen eindeutig in `packages/types` besitzen.
- [ ] B7 – Design-System-Paketvertrag und Build/Typecheck konsistent machen.
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
