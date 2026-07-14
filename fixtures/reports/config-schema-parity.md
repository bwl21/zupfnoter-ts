# Config Schema Parity Report

Stand: 2026-07-14

- Referenz: [legacy-config-schema.json](/Users/beweiche/beweiche_noTimeMachine/zupfnoter-ts/fixtures/legacy-config-schema.json)
- TS-Quelle: `packages/core/src/configSchema.ts`
- Anzahl Abweichungen: 0

## Freigegebene TS-Erweiterungen gegenüber Legacy

- `$.properties.layout.properties.FONT_STYLE_DEF.patternProperties..*.properties.description`: Dynamische Schriftstile können eine Markdown-Beschreibung für die Auswahl anbieten.
- `$.properties.layout.properties.FONT_STYLE_DEF.patternProperties..*.properties.label`: Dynamische Schriftstile können eine fachliche Beschriftung für die Auswahl anbieten.

Abgesehen von den oben freigegebenen Erweiterungen sind die kanonisierten Schemaobjekte identisch.
