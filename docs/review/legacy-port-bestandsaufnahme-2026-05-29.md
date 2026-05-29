## Confstack / buildConfstack Paritätsbericht

### Kurzfazit

Die aktuelle TS-Implementierung ist bei `Confstack` und `buildConfstack` nur teilweise legacy-paritätisch.
Der wichtigste übersehene Punkt im früheren Review war die API-Signatur von `Confstack#get`:
Ruby unterstützt `get(key=nil, options={:resolve => true})`, TS derzeit nur `get(path: string)`.
Zusätzlich ist die `buildConfstack`-Topologie noch nicht identisch zum Legacy-Pfad in `_layout_prepare_options`.

### Vergleich `confstack2.rb` vs. `Confstack.ts`

#### Sicher belegt

- Ruby `initialize(name = 'default')` baut bei einem Namen automatisch die Environment-Schicht auf (`confstack.env` / `push_from_env`).
  TS hat keinen entsprechenden `name`-Parameter und keinen Env-Bootstrap.
  Das ist eine klare API- und Verhaltensabweichung.
- Ruby `get(key=nil, options={:resolve => true})` akzeptiert keinen Schlüssel und kann die Auflösung über `options[:resolve]` abschalten.
  TS kennt weder den optionalen Schlüssel noch `options.resolve`.
  Das ist eine klare Signaturabweichung und damit keine vollständige Parität.
- Ruby `get(nil, ...)` liefert die aktuell effektive Gesamt-Konfiguration.
  TS bietet dafür nur `getAll()`, aber nicht über dieselbe API.
- Ruby `pop` arbeitet auf dem zugrundeliegenden Array ohne Unterlauf-Guard.
  Ein zu häufiges `pop` gibt in Ruby `nil` zurück, TS wirft bei leerem Stack.
  Das ist eine reale Verhaltensabweichung.
- Ruby `delete(key)` mutiert die oberste Schicht direkt.
  TS hat zwar `DeleteMe` und `delete(path)`, aber die Oberflächensemantik ist nicht vollständig gleich dokumentiert bzw. abgesichert.

#### Eher nah, aber nicht vollständig belegt

- `push` ist in beiden Implementierungen snapshot-basiert und tief gemergt.
  Für die üblichen Plain-Object-Configs ist das nah am Legacy-Verhalten.
  Die exakte Gleichheit ist aber nicht vollständig belegt, weil Ruby `deep_dup` / `deep_merge` auf dem Ruby-Objektmodell basiert.
- Late Binding ist in beiden Varianten vorhanden und cached.
  Die konkrete Cache-Granularität ist ähnlich, aber die API bleibt wegen der fehlenden `resolve`-Option nicht vollständig gleich.

### Vergleich `_layout_prepare_options` vs. `buildConfstack.ts`

#### Sicher belegt

- Ruby baut in `get_print_options` zunächst einen separaten `print_options_raw`-Stack aus `extract.0` und dem Ziel-Extract.
  TS baut dagegen direkt einen gemeinsamen `Confstack` mit globalen `layout`/`printer`-Werten plus Extract-Schichten.
  Das ist eine andere Topologie.
- Ruby schaltet bei `layout.beams` explizit auf `DURATION_TO_BEAMS` um, indem `DURATION_TO_STYLE` überschrieben wird.
  TS enthält `DURATION_TO_BEAMS` zwar in `initConf`, setzt diesen Switch aber in `buildConfstack` nicht um.
- Ruby ruft nach dem Konfigurationsaufbau `initialize` und `set_instrument_handlers` erneut auf.
  TS hat keinen entsprechenden Reinitialisierungsschritt im `buildConfstack`-/Layout-Aufbaupfad.

#### Wahrscheinliche Folgewirkung

- Die Reihenfolge der Schichten ist in TS zwar nachvollziehbar, aber nicht deckungsgleich mit dem Legacy-Zwei-Phasen-Modell.
  Das kann spätere Verbraucher beeinflussen, vor allem dort, wo Layout- und Printer-Werte als Defaults oder Overrides gelesen werden.

### Produktive Callsites

- `buildConfstack()` wird produktiv in `packages/core/src/HarpnotesLayout.ts` verwendet.
- Keine produktive externe Callsite für `conf.set()` gefunden.
- Keine produktive externe Callsite für `push()` oder `pop()` auf `Confstack` gefunden.
- `new Confstack()` wird in `apps/demo/src/DemoView.vue` verwendet, aber nur als allgemeiner Konfigurations-Container, nicht als eigener produktiver Stack-Manipulationspfad.

### Welche Abweichungen sind sicher belegt?

- Fehlende `get(key=nil, options={:resolve => true})`-Parität.
- Fehlender `resolve`-Schalter in TS.
- Fehlender `Confstack`-Konstruktor-Bootstrap mit `name` / `push_from_env`.
- Unterschiedliches `pop`-Unterlaufverhalten.
- Fehlende `layout.beams` -> `DURATION_TO_BEAMS`-Umschaltung im TS-Buildpfad.
- Fehlende Reinitialisierung nach Konfigurationsaufbau.

### Welche Abweichungen sind nur Vermutung?

- Ob die exakten Ruby-`deep_dup`- und `deep_merge`-Details außerhalb der heutigen Plain-Object-Configs jemals sichtbar werden.
- Ob der fehlende Reinitialisierungsschritt aktuell schon in sichtbaren Render-Abweichungen endet oder erst in Randfällen.
- Ob `delete` im TS in allen Edge-Cases exakt wie Ruby behandelt.

### Tests / Fixtures, die die Abweichungen sichtbar machen

- `get()`-API:
  - Test für `get()` ohne Schlüssel, der die effektive Konfiguration zurückgibt.
  - Test für `get(path, { resolve: false })`, der Late Binding nicht auswertet.
- `pop`:
  - Test, der auf einem frisch konstruierten Stack mehrfach `pop()` aufruft und den Ruby-Fehler-/Nil-Fall sichtbar macht.
- `buildConfstack`:
  - Fixture mit `extract.0` plus Ziel-Extract, das die Schichtreihenfolge prüft.
  - Fixture mit `layout.beams = true`, bei dem `DURATION_TO_BEAMS` tatsächlich wirksam werden muss.
  - Fixture mit instrumentenspezifischen Layout-Folgen, die die Reinitialisierung nach dem Konfigurationsaufbau benötigt.

### Kleinster sicherer Fix

- `Confstack#get` auf Ruby-Signatur erweitern:
  - optionaler Schlüssel
  - `options.resolve`
  - `get()` ohne Schlüssel liefert die effektive Konfiguration
- `buildConfstack` / Layout-Aufbau so anpassen, dass die Legacy-Reihenfolge und die Beam-Umschaltung reproduziert werden.
- Reinitialisierung nach dem Konfigurationsaufbau im Layout-Pfad ergänzen, nicht im generischen `Confstack`.

### Schlussbewertung

Der frühere Review war an einer entscheidenden Stelle unvollständig, weil die Signatur von `get()` nicht als Paritätskriterium behandelt wurde.
Mit der korrigierten Prüflogik ist klar:
`Confstack` ist als Mechanismus schon nahe am Legacy,
aber die API-Oberfläche und der `buildConfstack`-/Layout-Aufbau sind noch nicht vollständig gleich.
