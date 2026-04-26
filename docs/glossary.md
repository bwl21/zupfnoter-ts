# Glossar

Dieses Dokument definiert den bevorzugten Wortschatz für die Projektdokumentation.
Es dient zwei Zielen:

- konsistente deutsche Fachdokumentation
- spätere systematische Übersetzung ins Englische

## Regeln

- Eine Sprache pro Dokument: Deutsch oder Englisch, nicht gemischt
- Code-Begriffe, Typnamen, Paketnamen und Dateinamen bleiben unverändert
- Normative Begriffe sollen möglichst stabil und eindeutig verwendet werden
- Wenn ein englischer Fachbegriff Teil der API ist, bleibt er auch in deutscher Doku unverändert

## Nicht übersetzen

Diese Begriffe sind Teil der technischen Modellierung oder API und bleiben in allen
Dokumenten unverändert:

- `AbcModel`
- `AbcParser`
- `AbcToSong`
- `BeatCompressionMap`
- `BeatPacker`
- `Confstack`
- `Drawable`
- `DrawableElement`
- `ExtractConfig`
- `FlowLine`
- `Glyph`
- `HarpnotesLayout`
- `LayoutConfig`
- `Note`
- `Pause`
- `Playable`
- `Sheet`
- `Song`
- `SvgEngine`
- `Voice`
- `Voice Style`
- `ZupfnoterConfig`

## Bevorzugte deutsche Begriffe

| Deutsch | Verwendung |
|---------|------------|
| Transformationsstufe | Fachlicher Schritt in der Pipeline |
| Implementierungsphase | Schritt im Migrations- oder Umsetzungsplan |
| Konfigurationsauflösung | Auflösen effektiver Werte aus `Confstack` |
| Konfigurationsschicht | Ein Layer innerhalb des `Confstack` |
| Basiswerte | Nicht-Override-Werte eines `extract` |
| Überschreibung | Override eines Werts durch höhere Priorität |
| Vererbung | Übernahme von Werten aus `extract.0` |
| Musikmodell | Das Modell `Song` und seine Teiltypen |
| Drawing-Modell | Das Modell `Sheet` und seine Drawables |
| Ausgabe-Engine | Renderer wie `SvgEngine` oder später `PdfEngine` |
| Laufzeitvalidierung | Validierung externer JSON-Konfiguration zur Laufzeit |
| Vergleichstest | Test gegen Legacy-Fixtures oder Referenzausgabe |
| Snapshot-Test | Test gegen gespeicherte Ausgabe-Snapshots |

## Bevorzugte englische Begriffe

Diese Begriffe sollten für englische Fassungen verwendet werden:

| Englisch | Bedeutung |
|----------|-----------|
| transformation stage | fachliche Stufe der Pipeline |
| implementation phase | Migrations- oder Umsetzungsphase |
| configuration resolution | Auflösung effektiver Config-Werte |
| configuration layer | einzelne `Confstack`-Schicht |
| base values | nicht-Override-Werte eines `extract` |
| override | Überschreibung mit höherer Priorität |
| inheritance | Übernahme aus `extract.0` |
| music model | `Song`-Modell |
| drawing model | `Sheet`-Modell |
| output engine | Renderer wie `SvgEngine` |
| runtime validation | Laufzeitvalidierung externer Config |
| comparison test | Test gegen Legacy-Referenz |
| snapshot test | Test gegen gespeicherte Snapshots |

## Aktuelle Kernformulierungen

Diese Formulierungen sollten in der Doku möglichst einheitlich bleiben:

- Zupfnoter wandelt ABC-Notation in Harfennoten-Blätter um.
- Die Kernpipeline ist: `ABC-Text -> AbcModel -> Song -> Sheet -> SVG/PDF`.
- `Stufe` bezeichnet eine fachliche Transformationsstufe.
- `Phase` bezeichnet eine Implementierungs- oder Migrationsphase.
- `Confstack` ist der zentrale Mechanismus für Konfigurationsauflösung.
