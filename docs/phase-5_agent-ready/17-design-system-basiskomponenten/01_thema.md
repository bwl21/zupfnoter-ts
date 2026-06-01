# Design-System und Basiskomponenten

## Status

☑ Architektur ausgearbeitet  
☑ Implementiert

## Diskussion


Dieses Thema ist als erster praktischer Einstieg sinnvoll. Es ist allgemein genug, um schnell sichtbaren Fortschritt zu erzeugen, ohne sofort Worker, Selection, Storage oder Config Editor vollständig lösen zu müssen.

Ziel ist eine sichtbare Workbench-Shell mit einfachen Komponenten. Die Details von Editor, Console und Config Editor werden später erarbeitet. Für den Anfang reichen Shells/Platzhalter, die später fachlich gefüllt werden.

Der Einstieg über Design-System vermeidet, dass die Portierung wochenlang nur Architektur produziert. Stattdessen entsteht schnell ein MVP mit Panels, Footer, Tabs, Toolbars und klarer Oberfläche.


## Entscheidungen


- Phase 5 bekommt ein kleines eigenes `Zn*`-Design-System.
- Design-System enthält keine Fachlogik.
- Basiskomponenten: `ZnPanel`, `ZnTabs`, `ZnToolbar`, `ZnButton`, `ZnSplitPane`, `ZnStatusBar`, Dialog/Badge/ProblemMarker/ZoomControl.
- Workbench-Shell wird zuerst gebaut.
- Editor, Console, Config Editor zunächst nur als Shells.
- Fachkomponenten bauen später auf Basiskomponenten auf.


## Implementierungsaufträge


- `tokens.css` mit CSS Custom Properties anlegen.
- `Zn*`-Basiskomponenten priorisiert implementieren.
- `ZupfnoterWorkbench` und `WorkbenchLayout` anlegen.
- Panels als Shells anlegen: ABC, Lyrics, Config, Score, Harp, PDF, Console.
- Footer mit Extract, StoragePath, Dirty, Speed/Saveformat vorbereiten.
- Smoke Tests oder Demo prüfen.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

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
