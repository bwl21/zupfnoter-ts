# UI-Anbindung / Workbench

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Die UI soll keine Neuauflage eines unstrukturierten Legacy-Widget-Baums werden, sondern eine Vue-Workbench mit klaren Grenzen zwischen UI, Stores, Commands, Worker und Core.

Die wichtigste Diskussionslinie war: Fachlogik bleibt im Core beziehungsweise in Core-nahen Services. Die UI visualisiert Zustände und löst Aktionen aus. Sie darf nicht anfangen, fachliche Dinge selbst aus DOM-Zuständen oder Preview-Strukturen abzuleiten.

Die Workbench ist keine Multi-Dokument-IDE. Sie arbeitet mit genau einem aktiven Dokument. Panels sind fest, Perspektiven ändern nur Layout und Sichtbarkeit. Die Fachmodelle – ABC, Config/Confstack, Song, Sheet, PlayerModel – liegen nicht in einzelnen Panels.

Die UI muss später mehrere Sichten koordinieren: ABC-Editor, Config-Editor, Lyrics, Klaviernoten, Harfennoten, PDF, Console, Footer. Gerade deshalb braucht sie ein einfaches gemeinsames Layout und eine zentrale Zustandsführung.


## Entscheidungen


- Die Phase-5-UI ist eine Single-Document-Workbench.
- Vue-Komponenten sind Views und Interaktionspunkte, nicht Träger der Fachlogik.
- Zentrale fachliche/transiente Zustände liegen in Stores oder Core-/Worker-Resultaten.
- Panels sind feste Vue-Komponenten.
- Perspektiven steuern Layout und Sichtbarkeit.
- Menüs, Toolbar, Shortcuts, ContextActions und Console lösen Commands aus.
- UI-Komponenten sollen über definierte Adapter mit Editor/SVG/Worker/Commands sprechen.


## Implementierungsaufträge


- Workbench-Shell strukturieren.
- Zentrale Bereiche anlegen: linker Arbeitsbereich, Score Preview, Harp/PDF Preview, Console, Footer.
- Panel-Komponenten als Shells anlegen.
- UI-State von Dokument-/Fachzustand trennen.
- Keine fachliche Berechnung in Panel-Komponenten einbauen.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- `apps/web/src/`
- `apps/web/src/components/`
- `apps/web/src/stores/`
- `apps/web/src/App.vue`
- `apps/web/src/main.ts`
