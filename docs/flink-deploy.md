# Flink-Deploy für `apps/web`

## Ziel

`csweichel.dev` wird hier als Flink-Instanz genutzt, um `apps/web` als statische Web-App zu veröffentlichen. Der Deploy soll mit einem kurzen Prompt auslösbar sein, ohne dass man die Infrastruktur jedes Mal neu zusammensuchen muss.

## Was die Installation aktuell ist

Die Zielseite `https://csweichel.dev` ist kein normaler statischer Host, sondern eine Flink-Installation. Die Instanz leitet auf `/_flink/login` weiter und bietet nach dem Login eine Verwaltungsoberfläche für Sites, Uploads und veröffentlichte Dateien.

Der entscheidende Punkt für den Deploy ist:

- Server: `https://csweichel.dev`
- Tenant: aus `apps/web/.env`
- Passwort: aus `apps/web/.env`

Für diesen Stand war die lokale Datei [apps/web/.env](/Users/beweiche/beweiche_noTimeMachine/zupfnoter-ts/apps/web/.env) die einzige Quelle für die Zugangsdaten.

## Tatsächlicher Deploy-Ablauf

Der funktionierende Ablauf war:

1. `apps/web` bauen.
1. Das Flink-CLI passend zur eigenen Plattform laden.
1. Mit dem Tenant-Zugang auf `csweichel.dev` publishen.
1. Die veröffentlichte Site im Browser öffnen.

Konkret:

```bash
pnpm --filter @zupfnoter/web build
curl -L -o flink.tar.gz https://github.com/csweichel/flink/releases/download/v0.8/flink_darwin_arm64.tar.gz
tar -xzf flink.tar.gz
./flink publish ./dist --site zupfnoter-ts --server https://csweichel.dev --tenant bwl21 --password <password>
```

Das veröffentlichte Ziel war anschließend:

```text
https://bwl21--zupfnoter-ts.csweichel.dev/
```

## Konkrete Schritte in dieser Session

Das waren die einzelnen Schritte, die in dieser Sitzung tatsächlich nötig waren, um den Deploy durchzuführen:

1. Im Repository nach einem vorhandenen Deploy-Weg suchen.
1. Prüfen, ob `csweichel.dev` im Repo oder in der lokalen Umgebung dokumentiert ist.
1. Die Zielseite im Browser öffnen und erkennen, dass sie auf Flink basiert.
1. Die Flink-Doku des Servers auslesen, um den Publish-Mechanismus zu verstehen.
1. Die Zugangsdaten aus [apps/web/.env](/Users/beweiche/beweiche_noTimeMachine/zupfnoter-ts/apps/web/.env) holen.
1. Den Web-Client bauen mit `pnpm --filter @zupfnoter/web build`.
1. Das Flink-CLI für macOS ARM64 aus dem GitHub-Release laden.
1. Das korrekte CLI-Binary verifizieren.
1. Die existierenden Sites im Tenant abfragen, um sicherzugehen, dass noch keine Site angelegt ist.
1. `apps/web/dist` mit dem Site-Namen `zupfnoter-ts` auf Flink veröffentlichen.
1. Die Live-URL aufrufen und den HTTP-Status prüfen.

## Kosten / Aufwand

Exakte Token- und Credit-Werte sind in dieser Laufumgebung nicht direkt sichtbar, deshalb kann ich hier keine harte Zahl mit Gewähr eintragen.

Was sich sicher sagen lässt:

- Der Deploy brauchte mehrere Recherche- und Verifikationsschritte, nicht nur einen Build.
- Ein erheblicher Teil der Arbeit bestand aus Kontextsuche: Flink-Instanz erkennen, Doku finden, Zugangsdaten lokalisieren, CLI passend zur Plattform beschaffen.
- Zusätzlich gab es mehrere Tool-Aufrufe für Browser, Shell und Repository-Inspektion.

Praktische Einordnung:

- Das war deutlich teurer als ein gewöhnlicher statischer Deploy mit festem CI-Job.
- Die eigentliche Publikation selbst war kurz, der Aufwand lag fast vollständig in der Vorbereitung und der Infrastruktur-Erkundung.
- Für einen sauber automatisierten Weg sollte dieser Zusatzaufwand künftig im Repo oder im Flink-Workflow verborgen werden.

## Was dabei schiefgehen kann

Der Weg ist aktuell noch nicht „ein Prompt, ein Deploy“, weil mehrere Dinge manuell zusammengesucht werden müssen:

- Die Flink-Instanz ist nicht aus dem Projekt selbst ableitbar.
- Der passende CLI-Download hängt von der Plattform ab.
- Das richtige Binary ist nicht automatisch im Repo vorhanden.
- Der Site-Name wurde für diesen Deploy manuell gewählt.
- Die Site war nach dem ersten Publish auf `owner`-Schutz gesetzt, also nicht öffentlich frei zugänglich.

## Playback-Player

Der eigenständige Player wird aus `apps/player/dist` als eigene owner-only Site
veröffentlicht:

```bash
pnpm --filter @zupfnoter/player build
flink publish apps/player/dist \
  --site zupfnoter-player \
  --server https://csweichel.dev \
  --tenant bwl21 \
  --owner
```

Die aktuelle Site ist:

```text
https://zupfnoter-player.csweichel.dev/
```

## Was Flink verbessern muss

Damit ein einfacher Prompt genügt, sollte Flink selbst mehr Abstraktion anbieten.

### 1. Ein echter „publish this project“-Weg

Im Moment muss man wissen:

- welche Dateien gebaut werden sollen
- welcher Ordner publiziert wird
- welcher Site-Name verwendet werden soll
- welche Tenant-Credentials gelten

Ein guter Zielzustand wäre ein einzelner Befehl wie:

```text
flink publish current-project
```

oder noch besser:

```text
flink publish
```

wenn das Projekt in einem bekannten Flink-/Workspace-Kontext liegt.

### 2. Plattform-Erkennung für das CLI

Der Deploy brauchte erst das richtige `darwin_arm64`-Binary. Das ist unnötige Reibung.

Flink sollte:

- die passende Plattform automatisch erkennen
- einen einheitlichen Installationsbefehl anbieten
- oder ein kleines natives Wrapper-Tool mitliefern, das das richtige Binary selbst nachlädt

### 3. Projekt-Metadaten im Repo

Flink müsste wissen, wie dieses Projekt veröffentlicht werden soll, ohne dass man es per Hand erklärt.

Sinnvoll wäre z. B. eine kleine Konfigurationsdatei im Repo, etwa:

```yaml
flink:
  server: https://csweichel.dev
  tenant: bwl21
  site: zupfnoter-ts
  publish: apps/web/dist
```

Dann könnte ein Agent oder Mensch ohne Rückfrage veröffentlichen.

### 4. Stabile Site-Zuordnung

Der Deploy war erfolgreich, aber die Site-Zuordnung entstand ad hoc.

Flink sollte Projekte eindeutig einer Site zuordnen können, z. B. über:

- Repository-Name
- Branch-Name
- definierte Site-ID

Dann würde der nächste Deploy nicht versehentlich eine neue Site anlegen.

### 5. Bessere Ausgabe für den Agenten

Der CLI-Output ist für Menschen brauchbar, aber für den Agenten wäre besser:

- maschinenlesbares JSON als Default oder klare Option
- explizite Live-URL
- expliziter Hinweis, ob die Site neu angelegt oder nur aktualisiert wurde
- sichtbare Angabe von `auth` und Veröffentlichungsstatus

### 6. Standardisierte Auth- und Sichtbarkeitsprofile

Die Site wurde mit `owner` geschützt. Das ist für private Projekte korrekt, aber für das typische „einfacher Prompt“-Szenario sollte Flink Profile anbieten wie:

- `private`
- `team`
- `public`

Dann müsste der Nutzer nicht nach dem Publish noch über Zugriffsmodi nachdenken.

### 7. Kein manuelles Login für den normalen Deploy-Weg

Die Weboberfläche ist nützlich für Administration, aber nicht für den eigentlichen Standard-Deploy.

Für den Alltag sollte reichen:

- Repo bauen
- Publish anstoßen
- URL zurückbekommen

Die Weboberfläche bleibt dann für Ausnahmen und Inspektion.

## Was im Projekt selbst noch ergänzt werden sollte

Damit `apps/web` wirklich prompt-fähig wird, sollte das Repo selbst Flink-Deploy-Metadaten enthalten.

Empfehlung:

- eine kleine Deploy-Spezifikation im Repo
- ein Skript oder Make-Ziel für den Build + Publish
- klare Dokumentation, welcher Build-Ordner auf Flink geht
- keine manuelle Suche in `.env` für Standardfälle

## Fazit

Der aktuelle Deploy funktioniert, aber er ist noch zu sehr ein zusammengesetzter Handgriff aus:

- Repo bauen
- Flink-CLI passend zur Plattform finden
- Tenant-Zugang aus `.env` ziehen
- Site-Name manuell setzen
- Publish ausführen

Für einen wirklich einfachen Prompt muss Flink die Projekt- und Zielkonfiguration stärker selbst tragen. Dann könnte der Auftrag schlicht lauten:

```text
deploy apps/web to csweichel.dev
```

und alles Weitere würde aus dem Workspace und der Flink-Konfiguration folgen.
