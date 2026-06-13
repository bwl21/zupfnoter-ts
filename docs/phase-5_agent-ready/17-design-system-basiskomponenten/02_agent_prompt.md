# Agent Prompt: Design-System und Basiskomponenten

## Kontext

Du arbeitest am Zupfnoter TypeScript/Vue-Projekt. Ziel ist die Phase-5-Workbench: eine Vue-3-basierte Single-Document-App für ABC-Text, eingebettete Zupfnoter-Konfiguration, Klaviernoten-/Harfennoten-Vorschau, PDF, Console, Player, Storage und Recovery.

Dieses Arbeitspaket betrifft: **Design-System und Basiskomponenten**.

## Architekturstand


- Phase 5 bekommt ein kleines eigenes `Zn*`-Design-System.
- Design-System enthält keine Fachlogik.
- Basiskomponenten: `ZnPanel`, `ZnTabs`, `ZnToolbar`, `ZnButton`, `ZnSplitPane`, `ZnStatusBar`, Dialog/Badge/ProblemMarker/ZoomControl.
- Workbench-Shell wird zuerst gebaut.
- Editor, Console, Config Editor zunächst nur als Shells.
- Fachkomponenten bauen später auf Basiskomponenten auf.


## Aufgabe


- `tokens.css` mit CSS Custom Properties anlegen.
- `Zn*`-Basiskomponenten priorisiert implementieren.
- `ZupfnoterWorkbench` und `WorkbenchLayout` anlegen.
- Panels als Shells anlegen: ABC, Lyrics, Config, Score, Harp, PDF, Console.
- Footer mit Extract, StoragePath, Dirty, Speed/Saveformat vorbereiten.
- Smoke Tests oder Demo prüfen.


## Arbeitsweise

1. Analysiere zuerst die vorhandene Projektstruktur.
2. Verwende bestehende Konventionen, statt neue Parallelstrukturen zu erfinden.
3. Implementiere in kleinen Schritten.
4. Vermeide große Refactorings außerhalb des Arbeitspakets.
5. Ergänze Tests oder dokumentiere, warum noch keine Tests sinnvoll möglich sind.
6. Aktualisiere am Ende `01_thema.md` mit dem Bearbeitungsstatus.

## Akzeptanzkriterien

- Die Umsetzung verletzt keine Architekturentscheidung dieses Arbeitspakets.
- Es entstehen keine versteckten UI-Sonderlogiken, die später Core/Worker/Stores ersetzen.
- Fachlogik bleibt dort, wo sie laut Architektur hingehört.
- Typecheck/Lint/Test laufen oder Abweichungen sind dokumentiert.

## Nicht-Ziele

- Keine vollständige Legacy-Parität in einem Schritt.
- Keine großen Umbauten außerhalb der direkt notwendigen Dateien.
- Keine Einführung einer schwergewichtigen Architektur, wenn ein kleiner Adapter reicht.


## Konkrete Priorität

1. `ZnPanel`, `ZnPanelHeader`, `ZnPanelBody`
2. `ZnTabs`
3. `ZnToolbar`
4. `ZnButton`, `ZnIconButton`
5. `ZnSplitPane`
6. `ZnStatusBar`
7. `ZupfnoterWorkbench`
8. Panel-Shells
9. FooterBar

Editor, Config Editor und Console nur als sichtbare Platzhalter.


## Abschlussbericht

Erzeuge am Ende einen kurzen Bericht mit:

```markdown
# Umsetzung Design-System und Basiskomponenten

## Angelegte/geänderte Dateien

...

## Entscheidungen

...

## Tests / Checks

...

## Nicht umgesetzt

...

## Nächste Schritte

...
```

## Mögliche Dateien / Suchorte

Mögliche Zielstruktur:

```text
apps/web/src/design-system/
  tokens.css
  components/
    ZnButton.vue
    ZnIconButton.vue
    ZnToolbar.vue
    ZnPanel.vue
    ZnPanelHeader.vue
    ZnPanelBody.vue
    ZnTabs.vue
    ZnSplitPane.vue
    ZnStatusBar.vue
    ZnDialog.vue
    ZnBadge.vue
    ZnProblemMarker.vue
    ZnZoomControl.vue
  index.ts

apps/web/src/workbench/
  ZupfnoterWorkbench.vue
  WorkbenchLayout.vue
  FooterBar.vue
  panels/
    AbcEditorPanel.vue
    LyricsPanel.vue
    ConfigEditorPanel.vue
    ScorePreviewPanel.vue
    HarpPreviewPanel.vue
    PdfPreviewPanel.vue
    ConsolePanel.vue
```
