# Current State

Stand: 2026-04-26

Dieses Dokument beschreibt den aktuellen Zustand von `zupfnoter-ts` als technisches
Arbeits- und Architektur-Snapshot.

## Kurzfassung

`zupfnoter-ts` ist bereits ein funktionsfähiges PNPM-Monorepo mit klarer Trennung
zwischen Typen, Kernlogik und App-Shells. Die zentrale Transformationskette ist
weitgehend umgesetzt:

`ABC -> Song -> Sheet -> SVG`

Der Kern ist testbar und durch Unit-, Snapshot- und Fixture-Tests abgesichert. Die
Weboberfläche ist noch ein Scaffold, während `apps/demo` die aktuelle funktionale
Oberfläche für die Pipeline darstellt. Eine PDF-Ausgabe und die geplante Produkt-UI
sind noch nicht fertig.

## Repository-Struktur

Das Repository ist als Monorepo aufgebaut:

- `packages/types` enthält die gemeinsamen TypeScript-Typen für Musik, Drawing und
  Konfiguration.
- `packages/core` enthält Parser, Transformation, Layout, Beat-Packing und SVG-Export.
- `apps/demo` ist die derzeit nutzbare Demo-Oberfläche.
- `apps/web` ist die spätere Produkt-App, derzeit noch Scaffold.
- `apps/cli` ist die geplante CLI, derzeit nur ein Platzhalter.
- `fixtures/` enthält versionsierte Testfälle für die fixture-driven Tests.
- `docs/` enthält Phasen-Dokumentation, Architektur-Notizen und Testkonzepte.

Root-Skripte orchestrieren die Arbeitsabläufe über PNPM:

- `pnpm dev` startet die Demo-App.
- `pnpm build` baut alle Workspaces.
- `pnpm test:unit` führt die Workspace-Tests aus.
- `pnpm type-check` und `pnpm lint` laufen workspace-weit.

## Implementierter Kern

### `packages/types`

Dieses Paket definiert die zentralen Verträge ohne Logik. Es enthält die Modelle für:

- Musikmodell
- Drawing-Modell
- Zupfnoter-Konfiguration

Die Typen bilden die Grundlage für alle weiteren Stufen und halten die Pipeline
entkoppelt von UI- und Laufzeitdetails.

### `packages/core`

Der Kern ist der wichtigste technische Teil des Repos und implementiert die
fachliche Pipeline:

1. `AbcParser` bindet die vendorte `abc2svg`-Bibliothek ein.
2. `AbcToSong` transformiert ABC in das interne Musikmodell `Song`.
3. `Confstack` und `buildConfstack` lösen Konfigurationen hierarchisch auf.
4. `BeatPacker` berechnet die vertikale Kompression.
5. `HarpnotesLayout` erzeugt das Layout-Modell `Sheet`.
6. `SvgEngine` rendert das `Sheet` als SVG.

Die Testabdeckung ist bereits beachtlich:

- Parser- und Transformer-Tests
- Confstack-Tests
- BeatPacker-Tests
- Snapshot-Tests für Layout und SVG
- fixture-basierte Vergleichstests für Song und Sheet

### `fixtures/`

Fixtures sind pro Testfall organisiert:

- `fixtures/cases/<name>/input.abc`
- `fixtures/cases/<name>/song.json`
- `fixtures/cases/<name>/sheet.json`

Die Tests scannen diese Verzeichnisse automatisch. Ein Testfall wird für Song-Tests
aktiv, sobald `song.json` existiert, und für Sheet-Tests, sobald `sheet.json`
vorhanden ist. Zusätzlich kann die TS-Pipeline Vergleichsausgaben unter
`_ts_output/` erzeugen.

Ein Legacy-Exportmodus im alten Repository kann die Fixtures jetzt direkt in diese
Verzeichnisstruktur schreiben.

## Apps

### `apps/demo`

Die Demo-App ist aktuell die produktiv nutzbare Oberfläche im Repository. Sie dient
zum Testen und zur Visualisierung der Pipeline, nicht als vollständige Endanwender-UI.

### `apps/web`

Die Web-App ist technisch vorbereitet, aber inhaltlich noch nicht ausgebaut. Sie
enthält noch die Vue-Starterstruktur und wartet auf die eigentliche Editor-, Preview-
und Konfigurationsoberfläche.

### `apps/cli`

Die CLI ist im TS-Monorepo angelegt, aber noch nicht als echte Render-CLI fertig
implementiert. Sie markiert den Zielort für SVG- und PDF-Export ohne Browser.

## Dokumentationsstand

Die Architektur- und Migrationsdokumentation ist bereits breit angelegt:

- Phasen-Dokumente liegen unter `docs/phase-*`
- Architektur- und Analyse-Notizen liegen unter `docs/architecture`
- Fixture-Strategien sind unter `docs/fixtures` und `docs/testing` beschrieben
- Voice-Styles sind dokumentiert, aber noch nicht implementiert

`AGENTS.md` beschreibt zusätzlich den geplanten Ausbaupfad für das Monorepo.

## Offene Punkte

Folgende Bereiche sind noch offen oder unvollständig:

- PDF-Export fehlt
- die echte `apps/web`-Produktoberfläche fehlt
- CLI-Funktionalität ist noch nicht vollständig ausgebaut
- Worker-Architektur ist noch nicht vorhanden
- Voice Styles sind dokumentiert, aber noch nicht als Feature umgesetzt
- weitere technische Integrationen wie File Handling, Command-System und MIDI sind
  noch nicht fertig

## Praktische Einordnung

Der aktuelle Zustand ist damit nicht mehr ein reiner Scaffold, sondern ein
fachlich brauchbares Transformationssystem mit:

- sauber getrennten Typen und Kernmodulen
- implementierter ABC-zu-SVG-Pipeline
- versionsierten Fixtures
- stabiler Testbasis

Was noch fehlt, ist vor allem die produktive Hülle um diesen Kern herum.
