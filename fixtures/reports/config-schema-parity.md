# Config Schema Parity Report

Stand: 2026-08-01

- Referenz: [legacy-config-schema.json](/Users/beweiche/beweiche_noTimeMachine/zupfnoter-ts/fixtures/legacy-config-schema.json)
- TS-Quelle: `packages/core/src/configSchema.ts`
- Anzahl Abweichungen: 0

## Explizit eingeordnete Abweichungen

- **legacy-runtime-contradiction** `$.definitions.minc_entry.properties.minc_f.type`: Die TS-Konfigurationsoberfläche verwendet null als explizit inaktiven minc-Override; die Runtime behandelt diesen Legacy-Fall entsprechend als deaktiviert.
- **legacy-runtime-contradiction** `$.properties.extract.patternProperties.d*.properties.instrument_shape.type`: Instrument-Presets verwenden null ausdrücklich für Instrumente ohne eigene Umrissform.
- **legacy-runtime-contradiction** `$.properties.extract.patternProperties.d*.properties.lyrics.patternProperties..*.properties`: Der TS-Editor verarbeitet die Legacy-Liedtextfelder verses, pos und style vollständig; die exportierte Legacy-Schema-Referenz enthält diese Eigenschaften an dieser Stelle nicht.
- **ts-editor-extension** `$.properties.layout.properties.FONT_STYLE_DEF.patternProperties..*.properties.description`: Dynamische Schriftstile können eine Markdown-Beschreibung für die Auswahl anbieten.
- **ts-editor-extension** `$.properties.layout.properties.FONT_STYLE_DEF.patternProperties..*.properties.label`: Dynamische Schriftstile können eine fachliche Beschriftung für die Auswahl anbieten.

Abgesehen von den oben eingeordneten Abweichungen sind die kanonisierten Schemaobjekte identisch.
