# Sicherheit des lokalen Dateizugriffs

Der lokale Zupfnoter-Speicher verwendet die File System Access API. Ein vom
Browser erteilter `FileSystemDirectoryHandle` ist dabei nur eine Capability,
aber noch kein vertrauenswürdiges Zupfnoter-Projekt.

```text
Browser-Capability
        ↓
Projektmarker (.zupfnoter-project)
        ↓
ProjectFileSystem
        ↓
relative Projektpfad-Validierung
        ↓
Schreib- und Lösch-Policy
        ↓
konkrete Datei
```

## Sicherheitsgrenzen

`localFsProvider.ts` ist die einzige Stelle, die den Directory-Handle aus dem
Browser, den Picker und die IndexedDB-Persistierung kennt. Der normale
Anwendungscode erhält keinen rohen Handle, sondern ein `ProjectFileSystem`.
Git verwendet dieselbe Abstraktion.

Ein Ordner wird erst als Projekt akzeptiert, wenn die Datei
`.zupfnoter-project` vorhanden ist und exakt den Typ
`zupfnoter-project` sowie die unterstützte Version `1` trägt. Ein Ordner ohne
Marker wird nicht automatisch verwendet. Für einen bewusst angelegten neuen
Projektmarker gibt es `createLocalProject`.

Alle Projektpfade sind relativ und slash-separiert. Absolute Pfade,
Windows-Laufwerksnamen, leere Segmente, `.` und `..` werden zentral abgelehnt.
Damit können weder der Local Provider noch Git über den Projektordner hinaus
zugreifen.

Lesen und Verzeichnisauflistung sind auf das validierte Projekt begrenzt.
Schreibende Operationen erlauben nur Zupfnoter-Dateien (`.abc`, Projekt-
Konfigurationen und bekannte Ausgabeformate), den Projektmarker und Git-
Metadaten unter `.git`. Unbekannte Dateien werden nicht überschrieben oder
gelöscht. Das Anlegen und Entfernen von Verzeichnissen ist auf `.git`
beschränkt; Git-Operationen bleiben dadurch innerhalb derselben Grenze.

## Berechtigungen und Persistierung

Beim Öffnen wird zunächst nur Leseberechtigung verwendet. Die
Schreibberechtigung wird erst bei der ersten schreibenden Operation zentral
angefordert. Persistierte Handles werden bei der Wiederverwendung erneut auf
Leseberechtigung geprüft. `removeConnection` löscht den gespeicherten Handle
und den temporären Cache; Browser-Site-Permissions können unabhängig davon
weiterbestehen.

Verzeichnisse werden nicht automatisch rekursiv eingelesen. Rekursion erfolgt
nur bei einer ausdrücklich angeforderten Such-/Listoperation.

## Restrisiken und CSP

Die Browser-API kann den tatsächlichen absoluten Pfad eines Handles nicht
zuverlässig liefern. Deshalb ist eine Ablehnung von Ordnern wie `/Users` oder
`C:\\Windows` keine belastbare Sicherheitsgrenze; entscheidend sind Marker,
relative Pfade und die Policy.

Die Web-App lädt keine zusätzlichen JavaScript-CDNs oder Tag Manager. Dropbox
verwendet für die ausdrücklich aktivierte Cloud-Funktion externe OAuth-/API-
Origins. Die gebündelte ABC-Software enthält historisch `eval`/`Function`; das
ist bestehender Third-Party-/Legacy-Code und wurde in diesem Schritt nicht
migriert. Für einen späteren kontrollierten Origin sollte eine CSP mindestens
`default-src 'self'`, passende `connect-src`-Einträge für Dropbox und
`worker-src 'self' blob:` sowie `object-src 'none'` vorsehen. Eine vollständige
CSP-Einführung bleibt ein separater Schritt.

## Git

Die isomorphic-git-Schicht erhält weiterhin nur ein `WorkspaceFileSystem`, das
jetzt vom Local Provider als `ProjectFileSystem` übergeben wird. Die
Pfadvalidierung und Schreib-Policy liegen darunter. Remote-Git, Reset/Clean
und andere destruktive Komfortoperationen bleiben unabhängig davon separat zu
klassifizieren und benötigen zusätzliche Bestätigungspolitik.
