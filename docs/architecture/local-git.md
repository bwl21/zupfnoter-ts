# Lokale Git-Integration

Die lokale Git-Integration arbeitet direkt im über den lokalen Speicheranbieter
ausgewählten Workspace. Zupfnoter speichert Dateien weiterhin über die File
System Access API; Git legt seinen normalen `.git`-Ordner im selben Workspace an.
Es gibt keine zweite Repository-Kopie in IndexedDB oder LightningFS.

## Architektur

```text
LocalFsProvider / GitService
          │
          ▼
ProjectFileSystem
          │
          ▼
File System Access API
```

`apps/web/src/workbench/storage/workspaceFileSystem.ts` ist der technische
Adapter für einen einzelnen Browser-Handle. Darüber liegt
`projectFileSystem.ts` als Sicherheitsgrenze: Projektmarker, relative
Pfadvalidierung und Schreib-Policy werden dort zentral geprüft.
`localFsProvider.ts` verwendet diese Grenze für das normale Öffnen und
Speichern und stellt dem GitService nur das validierte Projekt bereit.

`apps/web/src/workbench/git/isomorphicGitFs.ts` bildet diese Abstraktion auf die
Promise-FS-Schnittstelle von `isomorphic-git` ab. `gitService.ts` bleibt von Vue
und Pinia unabhängig und kapselt Repository-Initialisierung, Status, Staging,
Commit, Historie und lokale Branches.

Die Vue-/Pinia-Schicht liegt in `apps/web/src/stores/git.ts` und wird von
`GitDialog.vue` verwendet. Ein normales Speichern des Stücks ruft keine
Git-Funktion auf. Mehrere Dateien können daher zunächst normal gespeichert und
später gemeinsam als ein Versionsstand festgeschrieben werden. Der normale
Dialog zeigt dabei nur die Historie des aktuell geladenen Stücks, die Dateien
des ausgewählten Versionsstands und eine kompakte Liste der Arbeitsänderungen.
Branch- und Staging-Funktionen bleiben intern verfügbar, werden aber nicht als
Git-Fork-Oberfläche präsentiert.

## Browser-Unterstützung

Der lokale Workspace benötigt `window.showDirectoryPicker`, also die File
System Access API. In der Praxis wird dafür ein aktueller Chromium-basierter
Browser auf einer sicheren Origin (`https` oder `localhost`) benötigt. Firefox
und Safari werden für diesen lokalen Workspace derzeit nicht durch einen
Polyfill versteckt; dort zeigt die Anwendung eine klare Nichtverfügbar-Meldung.

Der Browser kann eine gespeicherte Directory-Handle-Berechtigung verlieren oder
erneut anfordern. In diesem Fall muss der lokale Ordner über die
Speicherverbindungen erneut verbunden beziehungsweise die Berechtigung erteilt
werden.

## Unterstützte lokale Git-Funktionen

- Repository im Workspace initialisieren
- Änderungen und neue Dateien anzeigen
- mehrere Dateien gemeinsam als einen Versionsstand festschreiben
- Stück-Historie mit Kurz-SHA, Nachricht, Datum und Autor
- geänderte Dateien eines ausgewählten Versionsstands anzeigen
- aktuellen Branch anzeigen, Branch anlegen und Branch wechseln
- Dateiinhalt aus einer Commit-Revision lesen
- ein Stück aus einer Revision gegen den Workspace vergleichen
- die alte Revision und den Arbeitsstand über die bestehende Rendering-Pipeline
  als SVG nebeneinander, überlagert oder als Pixel-Differenz ansehen
- zeilenorientierte ABC-/Konfigurationsänderungen anzeigen

Der Vergleich liest die alte Datei aus dem Git-Objekt und den rechten Stand aus
dem Workspace. Für das aktuell geöffnete Stück wird dabei auch der noch nicht
gespeicherte Editorinhalt berücksichtigt. Die Pixelansicht benötigt Canvas und
SVG-Unterstützung des Browsers. Die bisherige Node-basierte Legacy-Parity-
Analyse unter `packages/core/src/testing/` bleibt Testinfrastruktur; sie wird
nicht als zweite Rendering-Engine in die Anwendung kopiert.

Remote-Git (`fetch`, `pull`, `push`) ist absichtlich noch nicht aktiviert. Dafür
müssen Authentifizierung und CORS beziehungsweise ein Proxy separat festgelegt
werden. Branchwechsel mit ungespeicherten Änderungen wird zum Schutz vor
Datenverlust blockiert. Ein Repertoire-Batchvergleich ist architektonisch noch
nicht als eigene Oberfläche umgesetzt; der Vergleichskern arbeitet bereits auf
einzelnen Dateien und kann später dafür wiederverwendet werden.
