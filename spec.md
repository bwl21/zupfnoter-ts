# Spezifikationen (Index)

Diese Datei ist der Doku-Index des Repositories. Sie verlinkt Specs, Konzepte und
nah verwandte Architektur- und Referenzdokumente.

Terminologie- und Übersetzungsregeln stehen in
[docs/glossary.md](docs/glossary.md).

Begriffsverwendung:

- `Phase` bezeichnet eine Migrations- oder Implementierungsphase
- `Stufe` bezeichnet eine fachliche Transformationsstufe der Pipeline

Spezifikationen liegen bevorzugt als `docs/<phase>/spec.md` vor. Bei größeren Themen
können im jeweiligen Phase-Ordner auch ergänzende Dateien wie `spec-<thema>.md` liegen.

| Datei | Inhalt |
|-------|--------|
| [docs/phase-0/spec.md](docs/phase-0/spec.md) | Phase 0 – Monorepo-Setup |
| [docs/phase-1/spec.md](docs/phase-1/spec.md) | Phase 1 – `@zupfnoter/types` |
| [docs/fixtures/spec.md](docs/fixtures/spec.md) | Legacy-Vergleichstests (fixtures/) |
| [docs/fixtures/spec-sheet-bootstrap.md](docs/fixtures/spec-sheet-bootstrap.md) | Sheet-Fixtures: Bootstrap + Tests aktivieren |
| [docs/phase-2/konzept_json_serialisierung.md](docs/phase-2/konzept_json_serialisierung.md) | Phase 2 – JSON-Serialisierung und Referenz für ABC → Song |
| [docs/phase-3/konzept_json_serialisierung.md](docs/phase-3/konzept_json_serialisierung.md) | Phase 3 – JSON-Serialisierung und Referenz für Song → Sheet |
| [docs/phase-3/spec-beatpacker.md](docs/phase-3/spec-beatpacker.md) | Phase 3.2 – BeatPacker |
| [docs/phase-3/spec-layout.md](docs/phase-3/spec-layout.md) | Phase 3.3 – HarpnotesLayout |
| [docs/phase-3/spec-apps-demo.md](docs/phase-3/spec-apps-demo.md) | Phase 3 – `apps/demo`: Pipeline-Demo-App |
| [docs/phase-4/spec-svg.md](docs/phase-4/spec-svg.md) | Phase 4.1 – SvgEngine |
| [docs/adr/vector-umsetzung.md](docs/adr/vector-umsetzung.md) | ADR: Ruby `Vector` → TypeScript |
| [docs/phase-5/demo-view-bugfixes.md](docs/phase-5/demo-view-bugfixes.md) | Demo-View: Browser-Kompatibilität, BeatPacker-Bugs, Y_SCALE |
| [docs/architecture/repo-analysis.md](docs/architecture/repo-analysis.md) | Repo-Analyse und Architekturüberblick |

Neue Specs werden im jeweiligen Phase-Ordner abgelegt.
Die aktuelle Arbeits-Spec wird von Ona direkt in dieser Datei verwaltet und nach Abschluss
in den passenden Phase-Ordner überführt oder von dort verlinkt.
