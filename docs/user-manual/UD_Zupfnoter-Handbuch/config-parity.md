# Konfigurations-Parität Legacy ↔ TypeScript

Dieses Dokument ist die fachliche Arbeitsquelle für die Konfigurations-
Parität zwischen dem Legacy-Zupfnoter und `zupfnoter-ts`.

Es ist bewusst **nicht generiert**. Änderungen an der Konfiguration sollen
hier so beschrieben werden, dass daraus später Benutzerhinweise für das
User-Manual und die In-App-Hilfe abgeleitet werden können.

## Quellen

| Bereich | Quelle |
|---|---|
| Legacy-Builtin-Defaults | `../200_zupfnoter/30_sources/SRC_Zupfnoter/src/init_conf.rb` |
| Legacy-Konfigurationsschema | `../200_zupfnoter/30_sources/SRC_Zupfnoter/src/opal-ajv.rb` |
| Legacy-Rendering und effektive Semantik | `../200_zupfnoter/30_sources/SRC_Zupfnoter/src/harpnotes.rb` |
| Legacy-Config-Editor | `../200_zupfnoter/30_sources/SRC_Zupfnoter/src/config-form.rb` und `controller_command_definitions.rb` |
| Legacy-Standardvorlage | `../200_zupfnoter/30_sources/SRC_Zupfnoter/public/demos/9999_Zupfnoter_standard-template.abc` |
| TS-Schema | `packages/core/src/configSchema.ts` |
| TS-Builtin-Defaults | `packages/core/src/initConf.ts` |
| TS-Config-Editor | `packages/core/src/configEditorTree.ts`, `packages/core/src/configEditorForms.ts` und `apps/web/src/workbench/panels/ConfigEditorPanel.vue` |
| User-Manual-Quelle | `docs/user-manual/UD_Zupfnoter-Handbuch/help_de-de.md` und `090_UD-Zupfnoter-Konfiguration.source.md` |

Die User-Manual-Quellen sind damit bereits in das TS-Repository übernommen.
`tools/generate-config-docs.mjs` erzeugt daraus die In-App-Hilfe und die
generierte Kapiteldatei. Dieses Paritätsdokument wird von diesem Generator
nicht überschrieben.

## Statusübersicht

| Konfigurationsbereich | Legacy-Befund | TS-Status | Benutzerwirkung |
|---|---|---|---|
| `extract.*.tuplets.text` | Builtin ist `{{tuplet}}`; die Standardvorlage kann `- {{tuplet}} -` setzen. | Unterstützt; Builtin und Vorlagenwert werden getrennt behandelt. | Hilfe muss den Unterschied zwischen Builtin und Vorlage erklären. |
| `extract.*.tuplets.style` | Runtime und Standardvorlage verwenden `style: small`; die exportierte Legacy-Schemaquelle weist das Feld nicht aus. | Im Schema, Editor und Rendering unterstützt. Als Legacy-Schema-/Runtime-Widerspruch dokumentiert. | Stil ist im Config-Editor auswählbar. |
| `extract.*.notebound.*.show` | Runtime behandelt fehlendes `show` bei sichtbaren notengebundenen Objekten als `true`; der Legacy-Editor zeigt den impliziten Wert leer an. | Editor zeigt den wirksamen Wert `Ja`, ohne einen lokalen Wert zu schreiben. | Verhindert die irreführende Anzeige eines unbekannten oder ausgeschalteten Zustands. |
| „Alle Parameter“ | Legacy-Suche basiert auf den verfügbaren Config-Schlüsseln und kann schema-definierte, noch nicht gespeicherte Felder übersehen. | Baum wird schema-getrieben aufgebaut; dynamische Einträge kommen aus aktueller und wirksamer Konfiguration. | Suche findet auch `n-Tolen`, wenn im ABC noch kein Tuplet-Override gespeichert ist. |
| Standardvorlage | Eingebaute Vorlage enthält einen eingebetteten `%%%%zupfnoter.config`-Block, unter anderem für Tuplets. | Vollständige Legacy-Standardvorlage ist noch nicht als TS-Vorlagenquelle portiert. | Vorlagenparität bleibt ein eigener offener Arbeitsbereich. |
| Partfolge und Part-ID-Zuordnung | Legacy verarbeitet `[P:...]` als sichtbare `notebound.partname`-Marker über `part_table`; eine gleichwertige konfigurationsbasierte Zuordnung zu Header-IDs ist dort nicht vorhanden. | TS liest und expandiert die Headerfolge im Parser, ordnet sichtbare Parttexte aber ausschließlich über `extract.<nr>.playback.parts` zu. Playback führt die Parts stimmenübergreifend und erhöht `passIndex` bei erneutem Part-Auftreten. | Bewusste TS-Erweiterung; die sichtbare Darstellung der `[P:...]`-Marker bleibt erhalten. |

## Detail: implizites `show`

Im Legacy-Rendering wird ein fehlender Wert sinngemäß so behandelt:

```ruby
show = show_from_config.nil? ? true : show_from_config
```

Der TS-Config-Editor bildet diese fachliche Bedeutung ab. Das ist eine
bewusste UI-Korrektur gegenüber dem Legacy-Config-Editor; die Rendering-
Semantik bleibt zwischen beiden Systemen gleich.

## Detail: Tuplet-Defaults

Es müssen drei Quellen unterschieden werden:

1. Builtin-Default aus `init_conf.rb`: `{{tuplet}}`
2. Wert aus der Legacy-Standardvorlage: `- {{tuplet}} -`
3. Expliziter Wert im eingebetteten ABC-Config-Block

Diese Werte dürfen nicht zu einem einzigen globalen Default zusammengeführt
werden.

## Detail: Partfolge und Part-ID-Zuordnung

Der Legacy-Beleg liegt in
`../200_zupfnoter/30_sources/SRC_Zupfnoter/src/abc2svg_to_harpnotes.rb`:
`[P:...]`-Marker werden in einer `part_table` gesammelt und als
`notebound.partname`-Annotationen in die Harpennoten übernommen. Eine
konfigurationsbasierte Zuordnung von sichtbarem Parttext zu einer Header-ID
für eine Playback-Partfolge ist dort nicht belegt.

Zupfnoter-TS weicht an dieser Stelle bewusst ab:

1. `AbcParser` expandiert nur die Headerfolge und vergibt keine IDs für
   sichtbare Markertexte.
2. `extract.<nr>.playback.parts` ist die Quelle der Zuordnung von Header-ID zu
   sichtbarem Parttext.
3. Der generische Config-Editor bietet die sichtbaren Markerwerte zur
   Zuordnung an.
4. Playback, Seitenbeschriftung und Player verwenden dieselbe Zuordnung.
5. Wird ein Part in der konfigurierten Folge erneut abgespielt, wird sein
   `passIndex` erhöht; der vorhandene Zähler aus normalen ABC-Wiederholungen
   bleibt dabei erhalten.

Die Abweichung ist durch die gemeinsame TS-Partfolge für Konfiguration,
Notenbild und Playback begründet. Die sichtbaren `[P:...]`-Marker selbst
bleiben zur Legacy-Kompatibilität erhalten.

## Pflegekonvention

Für jeden neuen Paritätsfall werden ergänzt:

- der konkrete Legacy-Beleg mit Datei und relevanter Stelle,
- das TS-Gegenstück,
- die fachliche Bewertung (`identisch`, `TS-Korrektur`, `offen` oder
  `Legacy-Widerspruch`),
- die sichtbare Benutzerwirkung,
- ein Test oder eine Fixture, sofern das Verhalten ausführbar ist.

Erst wenn die fachliche Auswirkung feststeht, wird die User-Manual-Quelle
angepasst. Generierte Dateien wie `090_UD-Zupfnoter-Konfiguration.md`,
`apps/web/public/locale/conf-help_de-de.json` und
`packages/core/src/generated/configEditorDocumentation.ts` werden nicht
manuell bearbeitet.
