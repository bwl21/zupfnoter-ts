## Promotionvideo für Legacy-Anwender – Arbeitsstand und Wiederaufnahme

### Ziel

Es wird ein ca. 4-minütiges Promotionvideo für **bestehende Zupfnoter-/Legacy-Anwender** erstellt.

Das Video soll insbesondere Anwender aus Tischharfengruppen ansprechen und zeigen, welchen praktischen Vorteil `zupfnoter-ts` gegenüber dem bisherigen Zupfnoter bietet.

### Aktueller Stand

Der bisherige Arbeitsstand wurde gesichert:

* Commit: `84baf3b`
* Commit-Message: `docs(promotion): Filmkonzept und Produktionspipeline sichern`
* Branch zum Zeitpunkt der Sicherung: `feat/startscreen`
* Drehbuch und verbindliche inhaltliche Vorgabe:
`docs/promotion/video-promotion-legacy-anwender.md`
* Filmfassungen und temporäre Produktionsdateien befinden sich lokal unter:
`media-work/`

Im Repository befinden sich außerdem die bisher erstellten Szenen-, Aufnahme- und Schnittskripte sowie Diagramme und Sprechertexte.

### Bisheriger Produktionsprozess

Das Video wird weitgehend automatisiert aus dem Repository heraus erzeugt.

Die Produktion umfasst unter anderem:

1. statische Diagramm-/Erklärungsszenen,
2. aufgezeichnete bzw. automatisierte Demos von `zupfnoter-ts`,
3. Mausbewegungen und sichtbare Klicks,
4. Sprechertext,
5. Hintergrundmusik,
6. echte Zupfnoter-Wiedergabe in den Playback-Szenen,
7. Zusammenbau der Szenen zum fertigen Film.

Das bisherige Zielformat ist:

* 1600 × 900
* 25 fps
* ca. 4:00 Minuten

### Bereits umgesetzte Regieentscheidungen

Folgende Entscheidungen sollen bei neuen Fassungen grundsätzlich erhalten bleiben:

* Diagramme kommen **vor** den zugehörigen Demos.
* Statische Diagramme dürfen nicht zoomen oder wackeln.
* Im Text wird **„Gruppe“** bzw. **„Tischharfengruppe“** verwendet, nicht „Verein“.
* Demoabläufe sollen langsam genug sein, damit ein Anwender die Aktion nachvollziehen kann.
* Mauszeiger und Klicks müssen deutlich sichtbar sein.
* Das vollständige Zupfnoter-Fenster darf nicht durch Video-Titel oder Overlays verdeckt werden.
* Bei der Harfenvorschau soll nach Möglichkeit das **vollständige Blatt eingepasst** sichtbar sein.
* Bei Änderungen im ABC-Editor soll deren Wirkung in der Harfenvorschau unmittelbar erkennbar sein.
* Selektionen sollen aussagekräftige Bereiche umfassen und nicht nur eine einzelne Note.
* Der Weg von einem Parameter zum davon betroffenen Objekt in der Harfenvorschau muss visuell nachvollziehbar sein.
* Die Geschwindigkeitsdemo soll ABC-Editor und vollständige Harfenvorschau gleichzeitig zeigen, sodass die unmittelbare Aktualisierung sichtbar wird.
* Playback/Wiedergabe gehört ausdrücklich in das Promotionvideo.
* Während einer Zupfnoter-Wiedergabeszene wird die Hintergrundmusik ausgeblendet. Zu hören ist stattdessen die tatsächliche Wiedergabe von Zupfnoter.
* Zwischen Szenen keine unnötig langen Pausen.

### Stimme

Die lokale Stimme „Flo“ war für Deutsch ungeeignet bzw. klang fehlerhaft.

„Anna“ spricht korrektes Deutsch, klingt jedoch deutlich monotoner als die natürliche ChatGPT-Sprachausgabe.

Die Sprecherstimme ist daher **noch nicht endgültig gelöst**. Bei einer späteren Überarbeitung sollte geprüft werden, ob eine natürlichere deutsche TTS-Stimme verfügbar ist, ohne dafür den bestehenden Produktionsablauf unnötig umzubauen.

### Noch offene Qualitätsprobleme

Die aktuelle Fassung ist ein brauchbarer Prototyp, aber noch **nicht die endgültige Promotionfassung**.

Insbesondere die Anwendungsszenen sollten weiter verbessert werden:

* Demos müssen den jeweiligen Vorteil deutlicher zeigen.
* Harfenvorschau möglichst vollständig und sinnvoll eingepasst darstellen.
* Übergänge zwischen Bedienaktionen natürlicher gestalten.
* Klicks und deren Auswirkungen eindeutig sichtbar machen.
* Genügend Zeit lassen, damit der Zuschauer das Ergebnis einer Aktion wahrnimmt.
* Prüfen, ob jede Demo tatsächlich die dazugehörige Aussage des Sprechertexts beweist.

### Manuelle Überarbeitung

Die Datei

`docs/promotion/video-promotion-legacy-anwender.md`

ist die **verbindliche Vorgabe für die nächste Fassung**.

Änderungen an Inhalt, Szenen, Sprechertext, Reihenfolge und Dauer möglichst direkt dort eintragen.

Bei Änderungen idealerweise festhalten:

* Szene bzw. Zeitstelle,
* was aktuell falsch oder unklar ist,
* was stattdessen gezeigt werden soll,
* was gesprochen werden soll,
* gewünschte Reihenfolge,
* ungefähre Dauer.

Die fertigen Filmdateien selbst müssen nicht manuell geschnitten werden. Änderungen sollen möglichst über Drehbuch und Produktionspipeline reproduzierbar umgesetzt werden.

---

## Wiederaufnahme der Arbeit

Beim nächsten Arbeitsbeginn zuerst:

1. aktuellen Git-Status und Branch prüfen,
2. Commit `84baf3b` als gesicherten Ausgangspunkt berücksichtigen,
3. dieses README lesen,
4. `docs/promotion/video-promotion-legacy-anwender.md` vollständig lesen,
5. vorhandene Produktionsskripte untersuchen,
6. vorhandene Filmfassung ansehen, sofern sie unter `media-work/` noch verfügbar ist,
7. meine seitdem manuell eingetragenen Änderungen im Drehbuch identifizieren.

**Nicht sofort eine neue Filmfassung erzeugen.**

Zuerst die gefundenen Änderungen und die daraus geplanten Produktionsänderungen kurz zusammenfassen. Erst danach die nächste Fassung produzieren.

### Empfohlener Auftrag an Codex

Beim Wiederaufnehmen kann folgender Auftrag verwendet werden:

> Wir setzen die Arbeit am Promotionvideo für Zupfnoter-Legacy-Anwender fort.
>
> Lies zuerst den Abschnitt zum Promotionvideo im README und anschließend vollständig `docs/promotion/video-promotion-legacy-anwender.md`.
>
> Prüfe den vorhandenen Produktionsstand und die zugehörigen Skripte. Commit `84baf3b` ist der gesicherte Zwischenstand der bisherigen Arbeit.
>
> Behandle `docs/promotion/video-promotion-legacy-anwender.md` als verbindliche inhaltliche Vorgabe. Berücksichtige insbesondere meine dort nach dem letzten Stand manuell eingetragenen Korrekturen.
>
> Erzeuge noch keine neue Filmfassung. Berichte mir zuerst kurz:
>
> 1. welchen Produktionsstand du vorgefunden hast,
> 2. welche manuellen Änderungen du im Drehbuch gefunden hast,
> 3. welche Szenen dadurch geändert werden müssen,
> 4. wie du diese Änderungen technisch umsetzen willst.
>
> Warte danach auf meine Freigabe für die Produktion.

### Wichtig für Codex

Das Ziel ist die **Produktion des Promotionvideos**, nicht die Weiterentwicklung von `zupfnoter-ts`.

Produktionsskripte, Drehbuch, Video-Assets und Dateien unter den dafür vorgesehenen Promotion-/Arbeitsverzeichnissen dürfen angepasst werden.

**Produktiver Anwendungscode von `zupfnoter-ts` darf nicht nur deshalb verändert werden, um eine Szene für das Video einfacher oder schöner darstellen zu können.**

Falls für eine gewünschte Szene tatsächlich eine Änderung der Anwendung erforderlich erscheint, zuerst darauf hinweisen und die Änderung mit mir abstimmen.

### Arbeitsprinzip

**ChatGPT:** Konzept, Dramaturgie, Kritik, Sprechertext und inhaltliche Entscheidungen.

**Codex:** Repository analysieren, Produktionsskripte ändern, Demos erzeugen, Audio/Video zusammensetzen, technische Qualitätskontrolle und gesicherte Änderungen im Repository.

So soll vermieden werden, dass konzeptionelle Diskussionen unnötig als umfangreiche agentische Repository-Arbeit ausgeführt werden.
