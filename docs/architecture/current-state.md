# Aktueller Projektstand

Stand: 2026-07-20

Dieses Dokument beschreibt den tatsächlich vorhandenen Stand des Monorepos. Es
ist ein Ist-Bericht und ersetzt keine Fachspezifikation.

## Kurzfassung

`zupfnoter-ts` ist ein PNPM-Monorepo mit einer weitgehend implementierten
Transformationskette:

```text
ABC → Song → Sheet → SVG/PDF
             ↘ Playback-Timeline → Playback-Link → apps/practice
```

Die Vue-Workbench ist die aktive Produktanwendung. Die eigenständige Practice-App,
das gemeinsame Design-System und Storybook sind vorhanden und werden separat
gebaut bzw. deployed.

## Repository-Struktur

- `packages/types`: gemeinsame Datenmodelle ohne Laufzeitlogik
- `packages/core`: ABC-Parser, Song-/Layout-Pipeline, SVG/PDF und Konfiguration
- `packages/playback`: versioniertes Binärformat für Playback-Links
- `packages/practice-ui`: gemeinsame imperative Practice-Oberfläche und Styles
- `packages/design-system`: wiederverwendbare `Zn*`-Vue-Komponenten
- `apps/web`: Workbench mit Editor, Vorschauen, Commands, Storage und Playback
- `apps/practice`: mobile Playback-Link-Anwendung
- `apps/viewsvg`: eigenständige SVG-/Vergleichsansicht
- `apps/demo`: kleinere Pipeline-Demo
- `apps/cli`: CLI-Grundlage; der geplante Endausbau ist noch offen
- `apps/storybook`: Storybook für Design-System, Web- und Practice-Stories

## Implementierter Kern

`packages/core` implementiert:

1. `AbcParser` über die vendorte `abc2svg`-Bibliothek
2. `AbcToSong` für ABC → Song
3. `Confstack` und hierarchische Konfigurationsauflösung
4. `BeatPacker` und vertikale Layoutberechnung
5. `HarpnotesLayout` für Song → Sheet
6. `SvgEngine` und `PdfEngine` für SVG-, A3- und segmentierte A4-Ausgabe

Die Kernpipeline wird durch Unit-, Snapshot-, Fixture-, SVG- und PDF-
Vergleichstests geprüft. Fixtures mit Copyright-Schutz bleiben außerhalb des
öffentlichen Git-Repositories.

## Web-Workbench

In `apps/web` sind vorhanden:

- Workbench-Layout mit ABC-Editor, Score- und Harfennoten-Vorschau
- zentrale Selection mit Scope für Einzelstimme, Auszug und alle Stimmen
- Zoom, Pan, Lupe, Mirror-/Mehrfensteransichten und Highlighting
- CodeMirror-Editor mit Diagnose- und Shortcut-Anbindung
- CommandStack, Konsole, Undo/Redo-Grundlage und zentraler Logger
- Datei-Menü mit Öffnen, Speichern, Storage-Verbindungsdialog und Dropbox-
  Verbindungen
- dauerhafte Storage-Profile mit Wurzelpfad und Schreibschutz
- Playback-Timeline mit Repeat-/Volta-Flow, Takt-/Durchlauf-Positionsspur,
  Metronom, Stereo-Panning und Soundfont-/Oszillator-Ausgabe
- Playback-Link-Export einschließlich optionalem, temporär erzeugtem
  Übungs-QR-Code als JPG in SVG/PDF
- About-Dialog mit Build-Metadaten

Noch nicht vollständig konsolidiert sind insbesondere die Trennung der
Selection-Projektionen, der weitere Ausbau des Konfigurationseditors und die
vollständige lokale Datei-Integration.

## Playback und Practice

`packages/playback` kodiert die bereits erzeugte Timeline in ein versioniertes,
komprimiertes URL-Fragment. Der Payload enthält Audioereignisse und eine
separate zeitbasierte Positionsspur für Takt, Durchlauf und Metrum.

`apps/practice` decodiert diese Links ohne ABC- oder Serverzugriff. Die produktive
Practice-UI kommt aus `packages/practice-ui`; Storybook verwendet dieselbe UI-
Renderfunktion und dasselbe CSS. Die Positionsübernahme funktioniert auch
während der Wiedergabe und nach einer Pause. Practice ist öffentlich über
FLink deploybar.

Die Workbench verwendet für Teilen und PDF-QR-Erzeugung dieselbe Web-
Playback-Timeline. Der QR-Code wird beim Export erzeugt und nicht als
Ressource persistiert.

Offen bleiben vor allem die weitere Audio-/Mobile-Politur und ein vollständiger
CLI-Exportweg für Playback-Links.

## Storybook und Design-System

`apps/storybook` ist eine eigene Workspace-App. Stories liegen unter
`apps/storybook/stories/` und verwenden die produktiven Komponenten bzw. die
gemeinsame Practice-UI. Storybook dient als isolierte Darstellung, Accessibility-
Prüfung und Grundlage für visuelle Regressionstests; es enthält keine zweite
Produktionsdarstellung.

## Phasenstand

- Phase 0: Monorepo-Setup umgesetzt
- Phase 1: gemeinsame Typen umgesetzt
- Phase 2: ABC → Song umgesetzt und getestet
- Phase 3: Song → Sheet, Konfiguration und Layout weitgehend umgesetzt
- Phase 4: SVG- und PDF-Ausgabe umgesetzt; Paritätsausbau läuft weiter
- Phase 5: aktive Produktphase; Workbench und Storage sind weit fortgeschritten
- Phase 5/Storybook: Design-System- und Practice-Stories eingerichtet
- Phase 6: Playback-Link, Practice und FLink-Deployment umgesetzt; CLI-Ausbau offen
- Phase 7: Worker-Architektur weiterhin offen

## Verbindliche offene Themen

- Selection-Projektionen und Mehrfachauswahl weiter konsolidieren
- lokale Datei-Integration abschließen
- Konfigurationseditor und globale Stores weiter entkoppeln
- CLI-Export und gemeinsame Browser-/CLI-Pipeline vervollständigen
- Audio-/Mobile-Playback weiter gegen reale Geräte prüfen
- Worker-Architektur nur bei nachgewiesenem UI-Thread-Bedarf einführen
