# SVG- und Konfigurationsparität

Stand: 2026-05-24

Dieses Dokument ist die fortschreibbare Paritäts-Tabelle für `zupfnoter-ts`.
Es bündelt zwei Fragen:

1. Welche Konfigurationsparameter sind im Legacy-Schema fest vorgegeben?
2. Welche dieser Parameter sind in TS bereits paritätisch, teilweise oder noch nicht abgebildet?

Wichtig:

- `extract` kann im Legacy beliebig viele numerische Keys haben.
- Die Tabelle unterscheidet deshalb zwischen `schema required`, `schema open`, `legacy default values` und `TS status`.
- TS-only-Erweiterungen wie `data-*`-Metadaten oder zusätzliche Diagnoseanker werden hier separat markiert.

## Legende

| Status | Bedeutung |
|--------|-----------|
| `vollständig` | Legacy-Verhalten und -Struktur sind in TS im relevanten Pfad abgebildet |
| `teilweise` | Kern ist da, aber nicht alle Legacy-Unterfelder / Presets / Sonderfälle |
| `offen` | Legacy-Element ist noch nicht sinnvoll portiert oder nur als Platzhalter vorhanden |
| `TS-only` | Kein Legacy-Gegenstück, bewusst zusätzliche TS-Erweiterung |

## Top-Level-Schema

Diese Keys sind im Legacy-Schema fest vorgegeben (`opal-ajv.rb`):

| Bereich | Legacy-Schema | TS-Status | Bemerkung |
|---------|---------------|-----------|-----------|
| `produce` | required | teilweise | In TS vorhanden, aber nicht als vollständige Legacy-Policy behandelt |
| `abc_parser` | required | offen | Noch kein vollwertiger Legacy-Default-Block |
| `restposition` | required | vollständig | Portiert |
| `wrap` | required | offen | Legacy-Rootwert noch nicht als eigener TS-Default-Block modelliert |
| `defaults` | required | vollständig | `defaults.notebound` ist in TS vorhanden |
| `templates` | required | offen | Legacy-Template-Block noch nicht 1:1 als eigener Konfigurationsblock portiert |
| `annotations` | required | teilweise | Kern ist da, aber nicht alle Legacy-Felder sind als eigener Block abgebildet |
| `extract` | required, open keys | vollständig | `extract.<nr>` ist als offene numerische Struktur modelliert |
| `layout` | required | vollständig | Kern-Layoutparameter portiert |
| `neatjson` | required | offen | Noch nicht als vollständiger TS-Block abgebildet |

## `extract.<nr>`-Schema

Legacy erlaubt beliebig viele Extrakte mit numerischen Schlüsseln. Diese Keys sind pro Extrakt fest:

| Bereich | Legacy-Schema | TS-Status | Bemerkung |
|---------|---------------|-----------|-----------|
| `title` | required | vollständig | Portiert |
| `filenamepart` | required | teilweise | In TS vorhanden, aber nicht überall gleich streng genutzt |
| `startpos` | required | vollständig | Portiert |
| `voices` | required | vollständig | Portiert |
| `flowlines` | required | vollständig | Portiert |
| `subflowlines` | required | vollständig | Portiert |
| `synchlines` | required | vollständig | Portiert |
| `jumplines` | required | vollständig | Portiert |
| `repeatsigns` | required | teilweise | Kern vorhanden, Details weiter abzugleichen |
| `layoutlines` | required | vollständig | Portiert |
| `legend` | required | vollständig | Portiert, inklusive Align-Semantik |
| `lyrics` | required | teilweise | Struktur vorhanden, einzelne Legacy-Optionen noch offen |
| `layout` | required | vollständig | Extrakt-Overrides werden aufgelöst |
| `nonflowrest` | required | vollständig | Portiert |
| `notes` | required | teilweise | Präsenz vorhanden, einzelne Legacy-Subkeys noch offen |
| `barnumbers` | required | vollständig | Portiert |
| `countnotes` | required | teilweise | Kern vorhanden, aber Legacy-Sonderfälle weiter zu prüfen |
| `chords` | required | offen | In TS noch nicht vollständig als eigener Konfigurationsblock modelliert |
| `stringnames` | required | vollständig | Portiert |
| `printer` | required | vollständig | Portiert |
| `notebound` | schema-Teil | teilweise | Fachliche Unterstruktur vorhanden, aber noch nicht vollständig ausgeschrieben |

## `extract.<nr>.notebound`

Legacy kennt folgende Unterblöcke:

| Bereich | Legacy-Schema | TS-Status | Bemerkung |
|---------|---------------|-----------|-----------|
| `annotation` | fest | vollständig | Portiert |
| `chord` | fest | vollständig | Portiert |
| `barnumber` | fest | teilweise | Kern da, Align-/Sonderlogik weiter abzugleichen |
| `c_jumplines` | fest | offen | Noch nicht vollständig als eigener TS-Block modelliert |
| `countnote` | fest | teilweise | Kern vorhanden |
| `decoration` | fest | teilweise | Kern vorhanden, per-Decoration-Overrides weiter abzugleichen |
| `flowline` | fest | teilweise | Kern vorhanden, Bezier-/Override-Fallarbeit offen |
| `minc` | fest | vollständig | Portiert |
| `nconf` | fest | offen | Noch nicht vollständig ausgearbeitet |
| `partname` | fest | vollständig | Portiert |
| `repeat_begin` | fest | offen | Noch nicht vollständig modelliert |
| `repeat_end` | fest | offen | Noch nicht vollständig modelliert |
| `tuplet` | fest | teilweise | Kern vorhanden, Details weiter abzugleichen |
| `variantend` | fest | vollständig | Portiert |

## `layout`

Kernparameter im Legacy-Default-Layout, die in TS bereits abgebildet sind:

- `grid`
- `limit_a3`
- `SHOW_SLUR`
- `LINE_THIN`
- `LINE_MEDIUM`
- `LINE_THICK`
- `ELLIPSE_SIZE`
- `REST_SIZE`
- `X_SPACING`
- `X_OFFSET`
- `Y_SCALE`
- `DRAWING_AREA_SIZE`
- `BEAT_RESOLUTION`
- `SHORTEST_NOTE`
- `BEAT_PER_DURATION`
- `PITCH_OFFSET`
- `FONT_STYLE_DEF`
- `MM_PER_POINT`
- `DURATION_TO_STYLE`
- `REST_TO_GLYPH`

Weitere Layout-Werte, die in TS bereits geführt werden:

- `instrument`
- `packer`
- `bottomup`
- `jumpline_anchor`
- `jumpline_vcut`
- `DECORATIIONS_AS_ANNOTATIONS`

## Presets und Erweiterungen

Diese Legacy-Bereiche sind in TS nur teilweise oder noch nicht vollständig als Default-Dokumentation abgebildet:

| Bereich | Legacy-Status | TS-Status | Bemerkung |
|---------|---------------|-----------|-----------|
| `presets.layout` | vorhanden | teilweise | Teilmenge portiert |
| `presets.instrument` | vorhanden | teilweise | Instrument-Presets noch nicht komplett |
| `presets.notes` | vorhanden | offen | Nicht vollständig als TS-Default-Bestandteil modelliert |
| `presets.printer` | vorhanden | offen | Noch nicht als eigener Default-Block ausformuliert |
| `templates` | vorhanden | offen | Noch kein 1:1-Port |
| `annotations` | vorhanden | teilweise | Fachliche Kernfälle vorhanden |
| `neatjson` | vorhanden | offen | Doku-relevant, aber kein Laufzeitkern |

## TS-only Metadaten

Diese Felder existieren absichtlich nur in TS und werden nicht als Legacy-Fehler behandelt:

- `data-conf-key`
- `data-zn-id`
- weitere `data-*`-Attribute zur Struktur- und Interaktionsdiagnose

## Pflegehinweis

Diese Datei ist die zentrale Arbeitsreferenz für Paritätsfragen.
Wenn sich an `init_conf`, `opal-ajv` oder den TS-Typen etwas ändert, wird diese Tabelle zuerst aktualisiert.

Praktische Regel:

- neue Legacy-Funde zuerst hier eintragen
- Schema-Quellenfragen zuerst in `docs/phase-3/spec-config-schema-source.md`
  klaeren
- danach die betroffenen TS-Typen / Transformer / Renderer anpassen
- anschließend den Fixture-/SVG-Report neu erzeugen
