# Agent-Regeln für zupfnoter-ts

Diese Datei enthält nur Regeln, die bei jeder Änderung gelten. Historische
Phasenpläne und ausführliche Fachspezifikationen liegen unter `docs/`.

## Priorität und Arbeitsweise

1. Die aktuelle Benutzeranweisung
2. Diese Datei
3. Die einschlägige Fachspezifikation unter `docs/`
4. Bestehender Code und Tests

Arbeite in kleinen, nachvollziehbaren Schritten. Ändere nur den betroffenen
Bereich und respektiere bestehende Architektur und Benennungen. Bei einer
Portierung ist die Legacy-Implementierung unter
`../200_zupfnoter/30_sources/SRC_Zupfnoter/` die maßgebliche Referenz; das
Projektmaterial unter `../200_Zupfnotenprojekte/` ist keine Implementierungs-
Referenz.

Vor einem Fix muss die Ursache im relevanten Artefakt belegt sein. Ein grüner
Test beweist nur das getestete Verhalten, nicht automatisch Legacy-Parität.
Wenn ein fachlicher Legacy-Beleg fehlt, muss das Ergebnis als unsicher
bezeichnet und weiter geprüft werden.

## TypeScript und Dateien

- Kein `any`, sofern nicht unvermeidbar und begründet.
- Keine Non-Null-Assertions (`!`). Fehlende Werte explizit prüfen.
- Neue fachliche Typen gehören zuerst nach `packages/types`.
- `packages/types` enthält nur Typen und Interfaces, keine Laufzeitlogik.
- Semantische Interface-Properties erhalten JSDoc mit Einheit und Bedeutung.
- Inline-Kommentare nur für kurze technische Hinweise.
- Lokale Dateien mit `apply_patch` ändern; keine Schreibtricks über `cat` oder
  Python.
- Keine stillen Architekturänderungen und keine unnötigen Refactorings.

## Architektur

```text
ABC → @zupfnoter/core Song → Sheet → SVG/PDF
                         ↘ Playback-Timeline
```

- `packages/core`: ABC-Parser, Song-/Layout-Pipeline, SVG/PDF und gemeinsame
  fachliche Logik.
- `packages/types`: gemeinsame Datenmodelle.
- `packages/playback`: versioniertes, player-only Playback-Link-Format.
- `packages/design-system`: wiederverwendbare Vue-Komponenten (`Zn*`).
- `apps/web`: Vue-Workbench, Commands, Editor, Vorschauen und Storage-UI.
- `apps/player`: eigenständiger, mobiler Playback-Link-Player.
- `apps/viewsvg`: eigenständige SVG-/Vergleichsansicht.
- `apps/cli`: Node-CLI ohne Browser-Abhängigkeiten.
- `apps/storybook`: isolierte Stories und visuelle Komponentenfälle.

Die fachliche Quelle der Wahrheit bleibt ABC. Playback verwendet die bereits
berechnete Timeline; es wird keine zweite Timeline aus dem Export erzeugt.
Konfigurationswerte werden über `Confstack` aufgelöst, nicht durch lokale
Merges in Layout- oder UI-Code.

Jeder konkrete Konfigurationspfad, der über Suche oder `editconf` geöffnet
wird, muss generisch über `Confstack` und das Built-in-Schema aufgelöst werden.
Das Formular wird aus dem ermittelten Schemaobjekt und dessen Eigenschaften
erzeugt. Bereichsspezifische Regex-Tabellen, feste Feldlisten, Expander oder
Sonderlogik im Editor sind unzulässig. Ausnahmen benötigen einen
dokumentierten Legacy-Beleg und einen Paritätstest.

Jedes SVG-Drawable, das aus einem konfigurierbaren Layoutparameter entsteht,
muss beim Erzeugen seinen fachlichen `confKey` erhalten. Der SVG-Renderer
reicht diesen Schlüssel nur als Objektmetadatum weiter; er darf den
Konfigurationspfad nicht nachträglich aus Geometrie oder Darstellung erraten.
Für dynamische Objekte bezeichnet ein `.*`-Schlüssel den editierbaren
Gesamteintrag, während Dragging weiterhin konkrete Unterfelder verwenden darf.

### Bestehende Fachlogik wiederverwenden

Bevor neue fachliche Verarbeitung implementiert wird, muss geprüft werden, ob
die benötigte Pipeline bereits existiert. Web, CLI, Export, Vorschau und Tests
müssen dieselbe zentrale Implementierung verwenden. Für dieselbe Semantik
dürfen keine parallelen Berechnungen, Parser, Konverter oder Exportpfade
entstehen.

Wenn eine bestehende Funktion nicht direkt wiederverwendbar ist, wird zuerst
die gemeinsame Funktion erweitert oder in das zuständige gemeinsame Paket
verschoben. Eine abweichende Implementierung muss vorher begründet und durch
Paritäts- oder Konsistenztests abgesichert werden.

Das Konfigurationssystem muss bei jeder Auflösung alle betroffenen Ebenen
berücksichtigen: Built-in-Schema, dynamische Parameter, Built-in-Defaults,
Ebene 0 und aktive Ebene. Jeder dynamische Config-Tree muss daraus dieselbe
Vereinigungsmenge bilden. „Nur das Notwendige“ bedeutet nicht nur, die
sichtbare Symptomeigenschaft zu reparieren, sondern diese auch unsichtbare
Konsistenzregel zentral umzusetzen. Bereichsspezifische Sonderlogik ist zu
vermeiden, wenn mehrere Bereiche dieselbe fachliche Regel teilen.

Die UI darf diese Ebenen nicht als eigene Merge-Logik nachbauen. Der
Confstack liefert den wirksamen Wert und muss bei Bedarf auch die Quell-Ebene
(global, Ebene 0 oder aktive Ebene) für einen konkreten Eintrag bestimmen.

Externe Stimmennummern sind 1-basiert, interne Array-Indizes 0-basiert.
`Sheet.activeVoices` und `extract.*.voices` verwenden die externe 1-basierte
Konvention.

## Web, Player und Design-System

- Produktive Komponenten bleiben unabhängig von Storybook.
- Storybook bildet die produktive Komponente oder Renderfunktion ab und darf
  kein abweichendes Mockup als Ersatz einführen.
- Stories liegen unter `apps/storybook/stories/`, nicht unter Produktions-
  `src/`-Verzeichnissen.
- Globale Plugins und Styles werden in Storybook nur registriert, wenn die
  dargestellte Komponente sie tatsächlich benötigt.
- Web-UI-Änderungen mit Browser MCP oder lokalem Playwright prüfen, wenn der
  Workflow ausführbar ist.
- Beim Player mobile Nutzung, AudioContext-Gesten, Ladezustände und öffentliche
  FLink-Deployments berücksichtigen.
- Änderungen an gemeinsam genutzten Komponenten in Web, Player und ViewSvg
  auf alle Verbraucher prüfen.

## Tests und Validierung

Nach Änderungen möglichst ausführen:

```text
pnpm test
pnpm type-check
```

Bei Änderungen an einem Teilpaket mindestens dessen Tests und Typecheck
ausführen. Für UI-Änderungen zusätzlich den betroffenen Browser-Workflow
prüfen. Ergebnisse und nicht ausgeführte Prüfungen im Abschluss nennen.

Bestehende Tests nicht löschen oder abschwächen. Snapshots und Fixtures nur
bewusst aktualisieren; copyright-geschützte Fixtures bleiben außerhalb des
öffentlichen Git-Repositories.

## Dokumentation

- Projektdokumentation wird standardmäßig auf Deutsch geschrieben.
- Code-, Paket- und Dateinamen bleiben unverändert.
- User-Dokumentation liegt unter `docs/user-manual/`.
- Konfigurationshilfe wird dort gepflegt und mit
  `pnpm generate:config-docs` erzeugt; generierte Dateien nicht manuell
  bearbeiten.
- Neue Architekturentscheidungen als ADR oder Fachspezifikation unter
  `docs/` dokumentieren.

## Git

- Für Features einen passenden Branch `feat/<name>` verwenden; Experimente
  gehören nach `wip/<name>`.
- Vor einem Feature-Wechsel den alten Branch lokal committen, sofern der User
  nichts anderes verlangt.
- Push, PR und Merge nur auf ausdrückliche Anweisung.
- Commits enthalten eine fachlich verständliche Meldung.
- Vor dem Commit Status, Diff und `git diff --check` prüfen.

## Abschlussbericht

Kurz nennen:

- Was geändert wurde und warum
- Betroffene Dateien
- Ausgeführte Tests und Typechecks
- Browser- oder Deploy-Validierung
- Fachlich belegte Punkte und verbleibende Unsicherheiten
