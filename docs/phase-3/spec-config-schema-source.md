# Spec: Zentrale Schema-Quelle fuer ZupfnoterConfig

## Problem

Im Legacy-System ist `src/opal-ajv.rb` mit `Ajv::JsonValidator#_schema` die
zentrale fachliche Schema-Quelle fuer die eingebettete
`%%%%zupfnoter.config`.

Dort liegen an einer Stelle:

- die fachlich gueltigen Parameternamen
- `required`- und `patternProperties`-Regeln
- die offene `extract.<nr>`-Struktur
- viele der heute im UI benoetigten Teilbaum- und Unterfeldnamen

Im aktuellen TS-Stand ist diese Rolle aufgespalten:

- Typen liegen in `packages/types/src/config.ts`
- Defaults liegen in `packages/core/src/initConf.ts`
- Editor-Perspektiven liegen in `packages/core/src/configEditorForms.ts`
- der Baum des Konfigurationseditors liegt in
  `apps/web/src/workbench/panels/ConfigEditorPanel.vue`
- Laufzeitvalidierung fuer die eingebettete Song-Konfiguration fehlt

Das fuehrt dazu, dass Legacy-Parameterpfade an mehreren Stellen nachgebaut
werden muessen und dabei auseinanderlaufen koennen.

## Ziel

`zupfnoter-ts` bekommt wieder eine klar benannte zentrale Schema-Quelle fuer
die Dokument-Konfiguration.

Diese Quelle ist fachlich zustaendig fuer:

- Legacy-kompatible Parameternamen
- Struktur des Konfigurationsbaums
- erlaubte offene numerische Schluessel wie `extract.<nr>`
- benoetigte `required`-Felder
- die Schema-URI (`$schema`)

Nicht Ziel dieser Quelle ist:

- die Ableitung aller TypeScript-Typen
- die Confstack-Aufloesung
- ein lokales Merge-Modell im UI
- das Ersetzen aller Legacy-offenen Sonderfaelle in einem Schritt

## Entscheidung

Die zentrale Schema-Quelle liegt in `packages/core`.

Begruendung:

- `@zupfnoter/types` darf nur Typen enthalten, keine Laufzeitlogik
- das Schema ist Laufzeitwissen und wird von Core, Web, Tests und spaeter CLI
  benoetigt
- die eingebettete Song-Konfiguration wird schon heute in `@zupfnoter/core`
  geparst

## Zielstruktur

Die Zielstruktur wird in kleinen Schritten aufgebaut:

```text
packages/core/src/
  configSchema/
    zupfnoterConfigSchema.ts
    validateZupfnoterConfig.ts
```

### `zupfnoterConfigSchema.ts`

Enthaelt die zentrale, exportierte Schema-Definition fuer die
Dokument-Konfiguration.

Anforderungen:

- Legacy-Pfadnamen bleiben unveraendert
- offene `extract.<nr>`-Keys bleiben offen modelliert
- das Schema beschreibt die Dokument-Konfiguration, nicht den effektiv
  aufgeloesten Confstack
- die Quelle ist hand-editierbar und fuer Portierungsvergleiche lesbar

### `validateZupfnoterConfig.ts`

Kapselt spaeter die Laufzeitvalidierung der eingebetteten Song-Konfiguration.

Die Validierung soll:

- auf der zentralen Schemaquelle basieren
- Fehlerpfade in Legacy-naher Form liefern
- beim Einlesen der Dokument-Konfiguration und in UI-Diagnosen nutzbar sein

## Abgrenzung zu bestehenden Artefakten

### `packages/types/src/config.ts`

Bleibt die TypeScript-Typreferenz, aber nicht die alleinige fachliche
Schemaquelle.

Die Typen sagen:

- wie TS mit Daten arbeitet

Das Schema sagt:

- welche Legacy-Pfade fachlich gueltig sind
- welche offenen Unterstrukturen erlaubt sind
- welche Felder im Dokument erwartet werden

### `packages/core/src/initConf.ts`

Bleibt die Quelle fuer Defaults, nicht fuer Gueltigkeit oder Vollstaendigkeit
der Parameternamen.

### `packages/core/src/configEditorForms.ts`

Bleibt eine UI-nahe Perspektivenliste. Diese Datei darf Sichtmengen definieren,
aber nicht frei neue Legacy-Pfadnamen erfinden.

### `apps/web/src/workbench/panels/ConfigEditorPanel.vue`

Der Baumeditor darf Labels, Reihenfolge und Sichtlogik definieren, aber seine
fachlichen Pfade muessen zur zentralen Schemaquelle passen.

## Migrationsstrategie

### Schritt 1: Quelle sichtbar machen

- die Legacy-Rolle von `opal-ajv.rb` ist dokumentiert
- neue Arbeiten orientieren sich daran
- neue Pfade werden nicht mehr nur aus Typen oder UI heraus eingefuehrt

### Schritt 2: kleine zentrale TS-Quelle anlegen

Als Sofort-Fix wird zuerst nicht das komplette Legacy-Schema portiert, sondern
ein belastbarer TS-Einstieg mit:

- Schema-URI
- Legacy-Top-Level-Bereichen
- kritischen Schluesseln fuer `extract`, `layout`, `printer`

Damit lassen sich kuenftige Key-Aenderungen an einer Stelle verankern.

### Schritt 3: Laufzeitvalidierung anschliessen

Danach wird das Einlesen von `%%%%zupfnoter.config` um Schema-Validierung
erweitert.

### Schritt 4: UI und Formsets anbinden

Perspektiven, Kontextmenues und Baumdarstellung bleiben fachlich eigenstaendig,
werden aber gegen die zentrale Quelle geprueft.

## Verbindliche Regeln fuer den Port

- Legacy-Parameternamen werden nicht in neue Namensstile umbenannt
- die zentrale Schemaquelle liegt nicht im Web-UI
- `@zupfnoter/types` bleibt frei von Laufzeit-Schemaobjekten
- Defaults und Schema werden getrennt gehalten
- neue Konfigurationspfade werden zuerst an der Schemaquelle festgemacht

## Offene Punkte

- Ob die TS-Schemaquelle direkt als JSON Schema oder als TS-Objekt mit
  JSON-Schema-kompatibler Struktur gepflegt wird
- Ob die Laufzeitvalidierung mit `ajv` oder einem spaeteren kompatiblen
  Validator angeschlossen wird
- Wie weit der erste Port des Legacy-Schemas gehen muss, bevor der
  Konfigurationseditor daraus gezielt profitieren soll
