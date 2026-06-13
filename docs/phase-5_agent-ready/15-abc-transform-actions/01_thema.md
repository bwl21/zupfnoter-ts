# ABC Transform Actions

## Status

☑ Architektur besprochen  
☐ Implementiert

## Diskussion


Ausgangspunkt waren Editor-Menüpunkte wie Mehrklang zu erster Note, Mehrklang durch zweite/letzte Note ersetzen, Mehrklänge umkehren, Noten in Mehrklang tauschen.

Bernhard stellte klar, dass diese Aktionen auf zentraler Selection arbeiten. Die Selection kann auch aus Klaviernoten oder Harfennoten stammen und wird in den Editor gespiegelt. Daher sind es nicht bloß Editor-Aktionen, sondern fachliche ABC-Transformationen.

Weitere Vision: `L:` einer Stimme ändern und ABC entsprechend umschreiben; dargestellte Note bearbeiten und anhand von Transposition die richtige ABC-Note erzeugen.


## Entscheidungen


- AbcTransformActions liegen im Core.
- Sie arbeiten auf ABC + zentraler Selection + Kontext.
- Output ist `TextEdit[]`.
- CodeMirror führt TextEdits aus, berechnet sie aber nicht.
- Transformationen berücksichtigen Voice-Kontext, `L:`, Transposition und ABC-Kontext.
- Quelle der Selection ist egal.


## Implementierungsaufträge


- `TextEdit`-Typ prüfen/definieren.
- `AbcTransformAction`-Interface definieren.
- Erste Actions als pure functions vorbereiten.
- Mehrklang-Aktionen portieren oder als Skeleton anlegen.
- Tests mit ABC-Input/Selection/TextEdit-Output schreiben.


## Offene Punkte

- Prüfen, welche bestehenden Dateien/Komponenten im Repository bereits in diese Richtung gehen.
- Umsetzung in kleinen, testbaren Schritten.
- Nach jedem Agentenlauf den Status dieses Dokuments aktualisieren.


## Hinweise zu möglichen Dateien

Mögliche Suchorte:
- ABC parser/model
- existing editor context actions
- packages/core
- apps/web editor commands
