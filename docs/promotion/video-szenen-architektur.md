# Architektur für wiederverwendbare Video-Szenen

## Ziel

Promotion-Videos, Schulungsvideos, Website-Touren und Präsentationen sollen
nicht unabhängig voneinander produziert werden. Eine gemeinsame
Szenenbibliothek enthält kurze, fachlich abgegrenzte Bausteine. Aus diesen
Bausteinen werden unterschiedliche Produktionen zusammengesetzt.

Die gemeinsame inhaltliche Quelle bleibt
[`kommunikationsgrundlage-zupfnoter-ts.md`](kommunikationsgrundlage-zupfnoter-ts.md).
Sie legt Botschaften und Ton fest. Diese Architektur beschreibt, wie daraus
aufnehmbare und wiederverwendbare Medienbausteine entstehen.

## Grundmodell

```text
Kommunikationsmodul
        ↓
     Szene ─────→ Website-Tour-Schritt
      │  │
      │  └──────→ Präsentationsbaustein
      ↓
Szenenvariante
      ↓
Produktion (Promotion, Schulung, Kurzfilm)
      ↓
fertiges Video
```

Eine **Szene** erklärt genau einen fachlichen Gedanken oder zeigt genau einen
Arbeitsablauf. Eine **Produktion** bestimmt Auswahl, Reihenfolge, Übergänge und
Gesamtdramaturgie.

## Bausteine

### 1. Kommunikationsmodul

Ein Modul wie `M03 – Cloud-Speicherung und Speicherorte` enthält die fachliche
Botschaft. Es ist unabhängig von einem konkreten Film.

### 2. Szene

Eine Szene ist der kleinste wiederverwendbare Medienbaustein. Sie besitzt eine
stabile Kennung, zum Beispiel:

- `S-M02-01-bestand-vergleichen`
- `S-M03-01-speicherorte-oeffnen`
- `S-M04-02-auswahlumfang-umschalten`
- `S-M06-01-wiedergabe-verfolgen`

Jede Szene beschreibt:

- Lern- oder Kommunikationsziel,
- Voraussetzungen und Ausgangszustand,
- verwendetes Demo-Stück,
- sichtbare Arbeitsschritte,
- erwarteten Endzustand,
- Sprechertextvarianten,
- Texteinblendungen,
- ungefähre Dauer,
- betroffene Funktionen und Oberflächen,
- Aufnahmestatus und letzte fachliche Prüfung.

Eine Szene enthält keinen Welcome-Screen und normalerweise keinen
Kapitelübergang. Dadurch kann sie an verschiedenen Stellen eingesetzt werden.

### 3. Szenenvariante

Dasselbe Bildschirmmaterial kann je nach Zweck unterschiedlich erläutert
werden:

- `promo`: kurz, nutzenorientiert und emotional,
- `schulung`: langsamer, vollständig und schrittweise,
- `tour`: sehr kurz und direkt am Bedienelement,
- `praesentation`: Standbild oder kurze Animation mit Überschrift.

Die Varianten teilen sich möglichst die Aufnahmebeschreibung. Sprechertext,
Tempo, Ausschnitt und Einblendungen dürfen abweichen. Eine Schulungsszene wird
nicht künstlich auf Promotion-Tempo beschleunigt.

### 4. Übergang

Übergänge gehören zur jeweiligen Produktion, nicht zur Szene. Dazu zählen:

- Welcome-Screen am Anfang,
- Kapitelkarten,
- kurze Erklärdiagramme,
- Zusammenfassungen,
- Schlussbild und Handlungsaufforderung.

So kann dieselbe Szene in einem Promotion-Video mit einer kurzen Kapitelkarte
und in einem Schulungsvideo mit einer Lernziel-Einblendung verwendet werden.

### 5. Produktion

Eine Produktion ist eine geordnete Liste aus Szenen, Varianten und
Übergängen. Beispiele:

- `P-promotion-legacy-4min`
- `P-schulung-erste-schritte`
- `P-schulung-speicherorte`
- `P-kurzfilm-bestand-bleibt`

Die Produktion legt außerdem Musik, Lautstärke, Seitenverhältnis, Untertitel
und Zielplattform fest.

## Kontinuität zwischen Szenen

Kontinuität entsteht nicht dadurch, dass alle Szenen in einer einzigen langen
Sitzung aufgenommen werden. Sie entsteht durch verbindliche Aufnahmeprofile
und definierte Übergabepunkte.

Für jede Szene werden Ein- und Ausgangszustand festgelegt, zum Beispiel:

```text
Eingang: Demo-Stück geöffnet, Stimme 1 aktiv, keine Auswahl
Aktion: Passage markieren und Auswahlumfang umschalten
Ausgang: dieselbe Passage für alle Stimmen ausgewählt
```

Verbindlich gleich bleiben:

- Fenstergröße und Seitenverhältnis,
- Zoomstufe und Schriftgröße,
- Sprache und Farbschema,
- Demo-Stück und Ausgangsdaten,
- Anordnung der Bereiche,
- Mausdarstellung und Bewegungstempo,
- Einblendungsstil,
- Sprecherstimme und Du-Ansprache.

Klicks werden während der Screencasts doppelt kenntlich gemacht: Ein kurzer
farbiger Ring erscheint am Mauszeiger und gleichzeitig erklingt ein dezenter
Klickton. Beide Effekte gehören zum Aufnahmeprofil und werden nicht in die
Produktoberfläche eingebaut. Tastatureingaben erhalten nur dann einen Ton oder
eine Einblendung, wenn sie für das Verständnis der Szene wichtig sind.

Jede Aufnahme enthält am Anfang und Ende ein bis zwei Sekunden ruhiges Bild.
Diese „Griffe“ ermöglichen saubere Schnitte und Überblendungen.

Wenn zwei Szenen direkt aufeinander aufbauen, müssen Ausgangszustand der ersten
und Eingangszustand der zweiten Szene übereinstimmen. Andernfalls wird ein
sichtbarer Übergang eingesetzt, statt eine falsche Kontinuität vorzutäuschen.

## Verzeichnisstruktur

```text
docs/promotion/
  README.md
  kommunikationsgrundlage-zupfnoter-ts.md
  video-szenen-architektur.md
  video-promotion-legacy-anwender.md

media/
  catalog/
    scenes/
      S-M02-01-bestand-vergleichen.yaml
      S-M03-01-speicherorte-oeffnen.yaml
    productions/
      P-promotion-legacy-4min.yaml
      P-schulung-erste-schritte.yaml
  narration/de/
  overlays/
  diagrams/
  capture/
    profiles/
    scripts/

apps/web/public/media/videos/
  manifest.json
  promotion/
  training/
```

Unter `docs/promotion/` liegen Konzept, Botschaften, Drehbücher und
Aufnahmehinweise. Unter `media/` liegen die versionierbaren Produktionsquellen:
Manifeste, Sprechertexte, Diagrammquellen, Einblendungen und Aufnahmeskripte.

Die freigegebenen, weboptimierten Filme sind Produktbestandteile und werden
unter `apps/web/public/media/videos/` abgelegt. Vite übernimmt sie unverändert
in die Web-Auslieferung. `manifest.json` hält pro Film Kennung, Titel, Version,
Sprache, Laufzeit, Dateipfad und die verwendeten Szenen fest.

Rohaufnahmen, Schnittprojekte, Zwischenstände und verlustarme Masterdateien
gehören nicht nach `apps/web/public`. Sie werden außerhalb des normalen
Repositories oder in einer dafür vorgesehenen großen Medienablage verwaltet.
Nur tatsächlich freigegebene Endfassungen gelangen in das Produkt. Falls die
Endfassungen für normales Git zu groß werden, werden sie über Git LFS oder eine
versionierte Produktablage bereitgestellt; das Manifest bleibt in jedem Fall
im Repository.

## Beispiel für ein Szenenmanifest

```yaml
id: S-M04-02-auswahlumfang-umschalten
module: M04
title: Auswahlumfang umschalten
goal: Zeigen, dass eine Auswahl für Stimme, Auszug oder alle Stimmen gilt.
fixture: krippen-demo
entryState:
  documentOpen: true
  activeVoice: 1
  selection: none
actions:
  - Passage in Stimme 1 auswählen
  - Auswahl auf aktuellen Auszug umschalten
  - Auswahl auf alle Stimmen umschalten
exitState:
  selectionScope: allVoices
variants:
  promo:
    durationSeconds: 18
  training:
    durationSeconds: 45
  tour:
    durationSeconds: 12
featureTags:
  - selection
  - extracts
  - voices
status: planned
```

Die erste Produktionsstufe verwendet YAML als menschenlesbares
Austauschformat. Sobald die automatische Verarbeitung beginnt, werden die
Manifeste beim Einlesen gegen ein typisiertes Schema geprüft. Die fachlichen
Kennungen bleiben dabei unabhängig vom späteren internen Datenformat stabil.

## Sprechertext und Bildschirmaufnahme

Sprechertext und Bildschirmaufnahme werden getrennt gepflegt. Damit kann:

- dieselbe Aufnahme mit kurzem Promotion- oder ausführlichem Schulungstext
  verwendet werden,
- ein Sprechertext korrigiert werden, ohne die Oberfläche neu aufzunehmen,
- eine geänderte Oberfläche neu aufgenommen werden, ohne die Botschaft neu zu
  erfinden,
- später eine weitere Sprache ergänzt werden.

Der Sprechertext verweist auf die Szenenkennung und die Variante. Er enthält
keine Klickanweisungen, die im Bild nicht tatsächlich zu sehen sind.

## Ton und Hintergrundmusik

„Ich steh an deiner Krippen hier“ wird mit dem Zupfnoter-Player abgespielt und
als eigene Tonspur aufgenommen. Die Musik wird anschließend leise unter den
Sprechertext gemischt. Dadurch bleibt sie auch bei Schnitten kontinuierlich,
und die Lautstärke kann unabhängig von Klicks und Sprache geregelt werden.

Die Player-Aufnahme darf nicht live an eine einzelne Screencast-Szene gebunden
sein. Sprechertext, Musik, Klicktöne und Bildschirmaufnahme bleiben getrennte
Spuren und werden erst in der Produktion zusammengeführt.

## Offene Anforderungen an Start-URLs

Die Startsequenz ist noch nicht endgültig festgelegt. Das Legacy-System kann
ein Stück per URL öffnen. Diese Möglichkeit muss gemeinsam mit dem neuen
Welcome-Screen und der Wiederherstellung eines zuletzt bearbeiteten Dokuments
betrachtet werden.

Vor einer Umsetzung sind mindestens diese Fälle zu klären:

- Aufruf ohne Stück und ohne gespeicherten Zustand,
- Aufruf ohne Stück mit gespeichertem Zustand,
- explizites Öffnen eines Stücks per URL,
- expliziter Start des Demo-Stücks oder einer Tour,
- ungültige oder nicht mehr erreichbare Stück-URL,
- Vorrangregeln zwischen URL, gespeichertem Dokument und Welcome-Screen,
- Sicherheits- und Freigaberegeln für öffentlich oder privat erreichbare
  Stücke.

Bis diese Anforderungen geklärt sind, erhält die Videoaufnahme keine eigene
Start-URL-Sonderlogik. Die konkrete Startsequenz wird für die Aufnahme lokal
vorbereitet, ohne daraus bereits ein dauerhaftes Produktverhalten abzuleiten.

## Aktualisierung bei Weiterentwicklung

Jede Szene trägt Funktionskennzeichen wie `storage`, `selection`, `config` oder
`playback`. Ändert sich Zupfnoter-ts, werden zuerst die betroffenen Szenen über
diese Kennzeichen ermittelt.

Der Aktualisierungsablauf lautet:

1. geänderte Funktion benennen,
2. betroffene Szenen und Produktionen ermitteln,
3. fachliche Aussage in der Kommunikationsgrundlage prüfen,
4. nur betroffene Aufnahmebeschreibungen und Texte ändern,
5. Szenen mit identischem Aufnahmeprofil neu aufnehmen,
6. abhängige Produktionen neu zusammensetzen,
7. Ergebnis gegen die vorherige Fassung prüfen.

Ein geeigneter Prompt lautet:

> Die Funktion [Name] hat sich wie folgt geändert: [Beschreibung]. Ermittle
> anhand der Funktionskennzeichen alle betroffenen Szenen und Produktionen.
> Ändere nur diese Bausteine. Bewahre Kennungen, Zielgruppe, Du-Stil,
> Aufnahmeprofil und nicht betroffene Inhalte. Zeige zuerst die Auswirkung und
> die geplanten Änderungen. Erzeuge anschließend die aktualisierten
> Szenenmanifeste und Sprechertexte.

## Qualitätsregeln

Eine Szene gilt erst als freigegeben, wenn:

- die gezeigte Funktion im aktuellen Build funktioniert,
- Ausgangs- und Endzustand reproduzierbar sind,
- keine privaten Dateien, Konten oder Zugangsdaten sichtbar sind,
- Sprechertext und sichtbarer Ablauf übereinstimmen,
- Fachbegriffe für die Zielgruppe verständlich sind,
- die Aufnahme im vorgesehenen Seitenverhältnis lesbar ist,
- die Szene in mindestens einer Testproduktion sauber anschließt.

Für jede freigegebene Aufnahme werden die verwendete Anwendungsversion, das
Aufnahmeprofil und das Aufnahmedatum festgehalten. So lässt sich später
erkennen, welche Szenen nach einer Oberflächenänderung veraltet sein könnten.

## Erste Umsetzungsetappe

Für das vierminütige Legacy-Promotion-Video werden zunächst nur die tatsächlich
benötigten Szenenmanifeste angelegt. Diese bilden den ersten Katalog. Die
Architektur wird anschließend bei den ersten Schulungsvideos weiterverwendet,
ohne vorab einen vollständigen Schulungsplan festlegen zu müssen.
