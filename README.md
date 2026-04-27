# zupfnoter-ts

TypeScript-Rewrite von Zupfnoter als PNPM-Monorepo.

Zupfnoter wandelt ABC-Notation in Harfennoten-Blätter um. Die Kernpipeline ist:

```text
ABC-Text -> AbcModel -> Song -> Sheet -> SVG/PDF
```

Begriffsverwendung in diesem Repository:

- `Stufe` bezeichnet eine fachliche Transformationsstufe der Pipeline
- `Phase` bezeichnet eine Migrations- oder Implementierungsphase des Rewrites

## Repository-Struktur

```text
packages/
  core/   Transformationspipeline und Rendering
  types/  Gemeinsame Typen für Musik-, Drawing- und Config-Modelle

apps/
  demo/   Laufende Demo-App für ABC-Editor + SVG-Vorschau
  web/    Geplante Vue-Web-App (Phase 5)
  cli/    Geplante CLI für SVG/PDF-Export
```

## Architektur

- `@zupfnoter/types` definiert die gemeinsamen Datenmodelle
- `@zupfnoter/core` implementiert die fachlichen Stufen der Pipeline: Parsing, Transformation, Layout und SVG-Rendering
- `apps/*` konsumieren die `core`-API und halten möglichst wenig Domänenlogik

Eine Repo-Analyse liegt in [docs/architecture/repo-analysis.md](docs/architecture/repo-analysis.md).

## Wichtige Dokumentation

- [AGENTS.md](AGENTS.md) – Implementierungsplan und Projektregeln
- [spec.md](spec.md) – Doku-Index für Specs, Konzepte und ADR-nahe Referenzen
- [docs/glossary.md](docs/glossary.md) – Terminologie- und Übersetzungsregeln
- [docs/phase-0/architektur_zupfnoter.md](docs/phase-0/architektur_zupfnoter.md) – Legacy-Architektur und Pipeline
- [docs/phase-0/architecture-vision.md](docs/phase-0/architecture-vision.md) – Zielbild des Rewrites

## Entwicklung

Voraussetzungen:

- Node.js `^20.19.0 || >=22.12.0`
- PNPM Workspaces

Nützliche Kommandos:

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm test:unit
pnpm test:gaps
pnpm type-check
pnpm lint
```

`pnpm dev` startet aktuell `@zupfnoter/demo`.

Für Fixture- und Legacy-Vergleichsarbeit:

```sh
npm run test:loadsample -- "<abc-glob>"
npm run test:gaps
```

Die ausführliche Dokumentation dazu steht in [fixtures/README.md](fixtures/README.md).

## Status

Bereits weitgehend umgesetzt:

- Stufe 1: `ABC -> Song`
- Stufe 2: `Song -> Sheet`
- Stufe 3: `Sheet -> SVG`
- Snapshot- und Vergleichstests für `core`

Noch offen oder unvollständig:

- PDF-Engine
- produktive Web-App in `apps/web`
- CLI-Renderpfad
- Editor/SVG-Interaktivität
- Worker-Architektur
