# Architektur: Storage

## 1. Überblick

Zupfnoter braucht eine providerneutrale Storage-Schicht, damit Öffnen und Speichern nicht
an Dropbox-Details hängen. Die Architektur trennt deshalb zwischen:

- dem aktiven Storage-Kontext
- dem Zielverzeichnis des Benutzers
- dem konkreten `StorageProvider`

Dropbox ist nur die erste Implementierung. Nextcloud ist als weiterer Provider vorgesehen.

```
┌──────────────────────┐     ┌──────────────────────┐     ┌─────────────────────────┐
│ apps/web             │     │ Workbench State      │     │ StorageProvider          │
│                      │     │                      │     │                         │
│ Footer / FilePicker ─┼────►│ activeStoragePath    │────►│ DropboxProvider         │
│ Console / Commands ──┼────►│ activeStorageSystem  │────►│ NextcloudProvider       │
│                      │     │ filenameFromF       │     │                         │
└──────────────────────┘     └──────────────────────┘     └─────────────────────────┘
```

Die Storage-Schicht ist keine Dateimanager-API. Sie bildet nur die Operationen ab, die
Zupfnoter für den Web-Workflow benötigt.

## 2. Begriffe

### 2.1 StoragePath

`StoragePath` beschreibt ein Zielverzeichnis, nicht eine Datei.

```ts
interface StoragePath {
  system: string
  path: string
}
```

Format:

```text
{system}//{path}
```

Beispiele:

- `dropbox//MeineNoten`
- `nextcloud//Privat/Zupfnoter`

### 2.2 aktiver Storage-Kontext

Der aktive Storage-Kontext besteht aus:

- dem gewählten `system`
- dem aktuellen `StoragePath`
- der Authentifizierungssitzung des Providers

Dieser Zustand muss:

- in der Fußzeile anzeigbar sein
- im `localStorage` persistierbar sein
- für Recovery und Reconnect wiederherstellbar sein

### 2.3 Save Target

Gespeichert wird nicht direkt auf den `StoragePath`, sondern auf:

```text
activeStoragePath + filenameFromF
```

Der Dateiname kommt aus `F:`. Der Storage-Kontext steuert nur das Zielverzeichnis.

## 3. Provider-Schnittstelle

Der Kern der Architektur ist ein einfacher Provider-Vertrag:

```ts
interface StorageProvider {
  system: string
  login(): Promise<void>
  logout(): Promise<void>
  search(path: StoragePath, query: string): Promise<StorageSearchResult[]>
  open(path: StoragePath, filename: string): Promise<StorageFile>
  save(path: StoragePath, filename: string, content: string): Promise<void>
  cleanup(): Promise<void>
}

interface StorageSearchResult {
  path: string
  name: string
  isFolder: boolean
  modifiedAt?: string
}

interface StorageFile {
  path: string
  name: string
  content: string
  modifiedAt?: string
}
```

### 3.1 Semantik

`login()`
: Stellt eine Sitzung beim Provider her oder erneuert sie.

`logout()`
: Trennt die Sitzung und entfernt Authentifizierungsdaten.

`search(path, query)`
: Sucht innerhalb eines Storage-Kontexts nach Dateien oder Ordnern.

`open(path, filename)`
: Lädt eine Datei aus dem Storage-Kontext.

`save(path, filename, content)`
: Schreibt eine Datei in den Storage-Kontext.

`cleanup()`
: Räumt temporäre Ressourcen auf.

### 3.2 OAuth und Tokens

Die Provider kapseln ihre Authentifizierung selbst:

- Access-Token
- Refresh-Token
- Reconnect
- kontrolliertes Logout

Die UI kennt nur den aktiven Provider und den aktiven Storage-Kontext. Provider-spezifische
Tokenlogik gehört nicht in die Workbench.

## 4. Erste Implementierung: Dropbox

Dropbox ist die erste konkrete Provider-Implementierung.

### 4.1 Aufgaben von DropboxProvider

- OAuth-Login
- Tokenverwaltung
- Dateisuche
- Öffnen von Dateien
- Speichern von Dateien
- Logout und Cleanup

### 4.2 UI-Anbindung

Die UI spricht nicht direkt mit Dropbox, sondern mit:

- Commands
- Workbench-Storage-State
- providerneutralen Pickern und Anzeigen

Die Benutzeroberfläche soll nur den aktuellen Storage-Kontext anzeigen und ändern können.
Provider-spezifische Details bleiben im Adapter.

## 5. Command-Syntax

In der ersten Ausbaustufe wird Storage über den Command-Prozessor bedient.
Die Commands sind providerneutral und arbeiten auf dem aktiven Storage-Kontext.

### 5.1 Grundform

```text
sstorage <system> [<path>]
sstatus
ssearch <query>
schoose <path>
sopen <filename>
ssave [<filename>]
slogout
sreconnect
scleanup
```

### 5.2 Semantik

`sstorage <system> [<path>]`
: Wählt den aktiven Storage-Provider und optional den Storage-Kontext.

`sstatus`
: Zeigt aktiven Provider, aktiven Storage-Kontext und Login-Zustand.

`ssearch <query>`
: Sucht im aktiven Storage-Kontext.

`schoose <path>`
: Setzt den aktiven Storage-Kontext.

`sopen <filename>`
: Öffnet eine Datei innerhalb des aktiven Storage-Kontexts.

`ssave [<filename>]`
: Speichert im aktiven Storage-Kontext.

`slogout`
: Meldet den aktiven Provider ab.

`sreconnect`
: Stellt die letzte Storage-Sitzung wieder her.

`scleanup`
: Räumt temporäre Storage-Zustände auf.

### 5.3 Ziel der Command-Bedienung

Die Command-Bedienung ist ein Zwischenschritt, kein Sonderweg. Sie soll später von UI-Buttons,
FilePicker und Fußzeile ergänzt werden, nicht ersetzt.

## 6. Weitere Provider

Nextcloud ist die naheliegende zweite Implementierung. Sie muss denselben Vertrag erfüllen:

- gleicher `StoragePath`
- gleiche UI-Anzeige
- gleiche Command-Syntax
- gleiche Session- und Tokenregeln auf Architektur-Ebene

Weitere Provider können später ergänzt werden, wenn sie denselben Vertrag erfüllen.

## 7. Architekturprinzipien

- Storage ist providerneutral
- `StoragePath` beschreibt ein Verzeichnis, keine Datei
- der Dateiname kommt aus `F:`
- die UI kennt nur den aktiven Storage-Kontext
- provider-spezifische Logik bleibt im Adapter
- kein Dateimanager als Kernfunktion

## 8. Abgrenzung

Nicht Teil dieser Schicht sind:

- ABC-Parsing
- Song- und Sheet-Transformation
- SVG-Rendering
- PDF-Rendering
- Konfigurationsauflösung

## 9. Ergebnis

Die neue Storage-Architektur ersetzt die Dropbox-zentrierte Sicht durch eine providerneutrale
Schicht mit `StoragePath`, `StorageProvider`, aktivem Storage-Kontext und klarer UI-Anbindung.
