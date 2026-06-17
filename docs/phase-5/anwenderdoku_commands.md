# Anwenderdoku: Commands in der Web-App

Diese Doku beschreibt die Befehle, die in der aktuellen Web-App über die Konsole
und über Toolbar-Aktionen verfügbar sind. Sie erweitert das Legacy-Verhalten um
die Web-spezifischen Bedienpunkte und ist die Referenz für Anwender, die mit der
Command-Konsole arbeiten.

## 1. Grundprinzip

Die Web-App verwendet ein textbasiertes Command-System. Befehle können in der
Konsole eingegeben oder über UI-Buttons ausgelöst werden.

Beispiele:

```text
help
view 0
p auto
sls -r abend
```

### Syntax

- Der erste Token ist der Befehl.
- Weitere Tokens sind Parameter.
- Zeichenketten mit Leerzeichen können in Anführungszeichen stehen.
- JSON-ähnliche Werte können als ein Argument übergeben werden.

Beispiele:

```text
c 4711 "Mein Titel"
pasteDatauri {"key":"a b","value":[1,2]}
```

## 2. Hilfe und Orientierung

### `help [filter]`

Zeigt die verfügbaren Befehle an.

Beispiele:

```text
help
help dlogin
help panel
```

Hinweis:

- `help panel` ergänzt die Hilfe um die Panel-Varianten für `harp` und `notes`.
- Private interne Befehle werden nicht in der Standardhilfe angezeigt.

## 3. Wiedergabe und Ansicht

### `view <extract>`

Wählt einen Extrakt und rendert die Vorschau neu.

Beispiel:

```text
view 0
```

### `render`

Aktualisiert die Vorschau ohne den Extrakt zu ändern.

### `p <range>`

Startet die Wiedergabe.

Werte für `range`:

- `auto`
- `sel`
- `ff`
- `all`

Beispiele:

```text
p auto
p all
```

### `speed <value>`

Ändert die Wiedergabegeschwindigkeit.

Beispiele:

```text
speed 0.5
speed 1
speed 1.25
```

### `stop`

Stoppt die Wiedergabe.

## 4. Audio und Darstellung

### `sound [name]`

Setzt oder zeigt das aktuelle Wiedergabe-Instrument.

Unterstützte Werte:

- `harp`
- `piano`
- `western-guitar`
- `oscillator`

Beispiele:

```text
sound
sound piano
```

### `panel duplicate <harp|notes>`

Öffnet eine zweite Fensteransicht für das angegebene Panel.

Beispiele:

```text
panel duplicate harp
panel duplicate notes
```

## 5. Datei- und Konfigurationsbearbeitung

### `c <id> <title>`

Erzeugt oder benennt ein Stück um.

Beispiel:

```text
c 1 "Untitled"
```

### `editconf <form>`

Öffnet den Konfigurationseditor für ein bestimmtes Formular.

Beispiel:

```text
editconf basic_settings
```

### `cconf <key> <value>`

Setzt einen Konfigurationswert im aktuellen Dokument.

Beispiel:

```text
cconf extract.0.title "Neuer Titel"
```

### `delconfig <key>`

Löscht einen Konfigurationswert.

### `cpconfig <key> <targetid>`

Kopiert einen Konfigurationswert in einen anderen Extrakt.

### `setstdnotes`

Speichert den aktuellen Zustand als Standard-Noten-Konfiguration.

### `stdnotes`

Lädt die Standard-Noten-Konfiguration zurück.

### `setstdextract`

Speichert den aktuellen Extrakt als Standard-Extrakt.

### `stdextract`

Lädt den Standard-Extrakt zurück.

### `maketemplate`

Erzeugt eine Vorlage aus dem aktuellen Stück.

### `settemplate`

Speichert den aktuellen Inhalt als Vorlage.

### `loadtemplate`

Lädt die Vorlage in den Editor.

### `totemplate`

Wandelt den aktuellen Inhalt in eine Vorlage um.

## 6. Speichern und lokale Ablage

### `lsave`

Speichert das aktuelle Stück im lokalen Speicher.

### `llist`

Listet die lokal gespeicherten Stücke.

### `lopen <id>`

Lädt ein Stück aus dem lokalen Speicher.

### `download_abc`

Lädt den aktuellen ABC-Text herunter.

## 7. Storage-Kommandos

Die Storage-Kommandos arbeiten auf dem aktuell ausgewählten Speicher-Backend.

### `sprovider <system>`

Wählt den aktiven Storage-Provider.

### `sstatus`

Zeigt Status, Pfad und Login-Zustand an.

### `scd <path>`

Wechselt den aktiven Storage-Pfad.

### `spwd`

Zeigt den aktuellen Storage-Pfad an.

### `slogin`

Meldet sich beim Storage-Provider an.

### `slogout`

Meldet sich ab.

### `sreconnect`

Stellt die Verbindung erneut her.

### `scleanup`

Räumt temporäre Storage-Zustände auf.

### `ssearch <query>`

Sucht im aktiven Storage-Pfad.

### `sls [flag] [query]`

Listet ABC-Dateien im aktiven Storage-Pfad.

Besondere Regeln:

- Der erste Parameter kann `-r` sein.
- Wenn der erste Parameter nicht `-r` ist, wird er als Suchbegriff interpretiert.
- `-r` aktiviert die rekursive Suche.

Beispiele:

```text
sls
sls abend
sls -r abend
```

### `sopen [flag] [filename]`

Öffnet eine Datei aus dem aktiven Storage-Pfad.

Besondere Regeln:

- Der erste Parameter kann `-r` sein.
- Wenn der erste Parameter nicht `-r` ist, wird er als Suchbegriff oder Dateiname interpretiert.
- Bei mehreren Treffern wird eine Kandidatenliste angezeigt.
- Danach kann mit `sopen <nummer>` ein Eintrag aus der Liste geöffnet werden.

Beispiele:

```text
sopen abend
sopen -r abend
sopen 2
```

### `ssave <filename>`

Speichert die aktuelle Datei im aktiven Storage-Pfad.

## 8. Dropbox-Kommandos

Die Dropbox-Kommandos sind in der aktuellen Web-App vorhanden, aber ihre
Bedienung hängt vom verbundenen Storage-Backend ab.

Typische Befehle:

- `dlogin`
- `dchoose`
- `dsave`
- `dopen`

Diese Befehle sind für den normalen Arbeitsablauf vorgesehen, wenn Dropbox als
Storage-Provider aktiv ist.

## 9. Verlauf, Undo und Redo

### `history`

Zeigt die Kommando-Historie.

### `undo`

Macht den letzten undo-fähigen Befehl rückgängig.

### `redo`

Stellt den zuletzt rückgängig gemachten Befehl wieder her.

### `showundo`

Zeigt die Undo-Liste.

### `showredo`

Zeigt die Redo-Liste.

## 10. Status und Laufzeit

### `loglevel <level>`

Setzt den Log-Level.

### `autorefresh <mode>`

Setzt das Auto-Refresh-Verhalten.

Werte:

- `on`
- `off`
- `remote`

### `setsetting <key> <value>`

Setzt eine Laufzeit-Einstellung.

### `toggle <key>`

Schaltet eine Laufzeit-Einstellung um.

### `getsetting <key>`

Liest eine Laufzeit-Einstellung.

### `settings`

Listet alle Laufzeit-Einstellungen.

## 11. Unterschiede zum Legacy-System

Die Web-App erweitert das frühere Command-System an einigen Stellen:

- Die Konsole ist direkt in die Web-UI integriert.
- Die Command-Hilfe ist im UI verfügbar.
- Storage-Kommandos unterstützen das rekursive `-r`-Verhalten in `sls` und `sopen`.
- Die Suche im Storage kann rekursiv über das Backend laufen.
- Hilfetexte und Kandidatenlisten sind für die Web-Oberfläche lesbarer gemacht.

Nicht alle historischen Legacy-Kommandos sind in der Web-App vollständig
portiert. Wenn ein Befehl nicht verfügbar ist, meldet die Konsole einen
entsprechenden Fehler oder Hinweis.

## 12. Praktische Arbeitsabläufe

### Ein Stück öffnen

```text
sprovider dropbox
sls -r abend
sopen 1
```

### Wiedergabe starten

```text
view 0
p auto
```

### Stück speichern

```text
lsave
```

### Konfiguration ändern

```text
editconf basic_settings
cconf extract.0.title "Neuer Titel"
render
```

## 13. Merksätze

- Der erste Parameter von `sls` und `sopen` ist speziell: `-r` schaltet rekursiv.
- `help` ist der schnellste Einstieg.
- `render` aktualisiert nur die Ansicht.
- `p auto` startet die Wiedergabe.
- `undo` und `redo` gelten nur für undo-fähige Befehle.

