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
| `abc_parser` | required | vollständig | Default und Schema-Quelle sind in TS vorhanden |
| `restposition` | required | vollständig | Portiert |
| `wrap` | required | vollständig | Default und Validierung sind portiert |
| `defaults` | required | vollständig | `defaults.notebound` ist in TS vorhanden |
| `templates` | required | vollständig | Legacy-Template-Block ist als TS-Default und Schema-Port vorhanden |
| `annotations` | required | vollständig | Builtins und Required-Keys sind portiert |
| `extract` | required, open keys | vollständig | `extract.<nr>` ist als offene numerische Struktur modelliert |
| `layout` | required | vollständig | Kern-Layoutparameter portiert |
| `neatjson` | required | vollständig | Default-Block und Required-Validierung sind portiert |

## `extract.<nr>`-Schema

Legacy erlaubt beliebig viele Extrakte mit numerischen Schlüsseln. Diese Keys sind pro Extrakt fest:

| Bereich | Legacy-Schema | TS-Status | Bemerkung |
|---------|---------------|-----------|-----------|
| `title` | required | vollständig | Portiert |
| `filenamepart` | required | vollständig | Legacy-laxer Typ ist bewusst beibehalten |
| `startpos` | required | vollständig | Portiert |
| `voices` | required | vollständig | Portiert |
| `flowlines` | required | vollständig | Portiert |
| `subflowlines` | required | vollständig | Portiert |
| `synchlines` | required | vollständig | Portiert |
| `jumplines` | required | vollständig | Portiert |
| `repeatsigns` | required | vollständig | Struktur und zentrale Required-Keys sind portiert |
| `layoutlines` | required | vollständig | Portiert |
| `legend` | required | vollständig | Portiert, inklusive Align-Semantik |
| `lyrics` | required | vollständig | Legacy-Struktur ist in Schema und Defaults abgebildet |
| `layout` | required | vollständig | Extrakt-Overrides werden aufgelöst |
| `nonflowrest` | required | vollständig | Portiert |
| `notes` | required | vollständig | Notes-Einträge sind als strenger Block modelliert |
| `barnumbers` | required | vollständig | Portiert |
| `countnotes` | required | vollständig | Legacy-Kern inkl. Text-Overrides ist portiert |
| `chords` | required | vollständig | Legacy-Annotation-Block ist als eigener TS-Schemateil modelliert |
| `stringnames` | required | vollständig | Portiert |
| `printer` | required | vollständig | Portiert |
| `notebound` | schema-Teil | vollständig | Unterstruktur ist als eigener TS-Schemablock ausgeschrieben |

## `extract.<nr>.notebound`

Legacy kennt folgende Unterblöcke:

| Bereich | Legacy-Schema | TS-Status | Bemerkung |
|---------|---------------|-----------|-----------|
| `annotation` | fest | vollständig | Portiert |
| `chord` | fest | vollständig | Portiert |
| `barnumber` | fest | vollständig | Portiert |
| `c_jumplines` | fest | vollständig | Als eigener TS-Block modelliert |
| `countnote` | fest | vollständig | Portiert |
| `decoration` | fest | vollständig | Portiert |
| `flowline` | fest | vollständig | Bezier-Struktur ist portiert |
| `minc` | fest | vollständig | Portiert |
| `nconf` | fest | vollständig | Portiert |
| `partname` | fest | vollständig | Portiert |
| `repeat_begin` | fest | vollständig | Portiert |
| `repeat_end` | fest | vollständig | Portiert |
| `tuplet` | fest | vollständig | Bezier-Struktur ist portiert |
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
| `presets.layout` | vorhanden | vollständig | Legacy-Werte und Separatoren sind portiert |
| `presets.instrument` | vorhanden | vollständig | Instrument-Presets aus `init_conf.rb` sind portiert |
| `presets.notes` | vorhanden | vollständig | Noten-Presets sind portiert |
| `presets.printer` | vorhanden | vollständig | Drucker-Presets sind portiert |
| `templates` | vorhanden | vollständig | Portiert |
| `annotations` | vorhanden | vollständig | Portiert |
| `neatjson` | vorhanden | vollständig | Portiert |

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
