# Metronom-Teststück: Taktwechsel und Wiederholungen

Die Datei `input.abc` dient zur gemeinsamen manuellen Prüfung in Workbench und
Player. In der Workbench die Datei öffnen, Auszug 1 wählen und die Wiedergabe
mit Metronom starten. Anschließend einen Playback-Link erzeugen und denselben
Ablauf im Player prüfen.

## Erwarteter Ablauf

Bei `Q:1/4=100` dauert ein Viertelschlag 600 ms.

1. Abschnitt A beginnt im 4/4-Metrum mit dem Auftakt `z2 G2`. Die Pause `z2`
   ist der Anfang dieses Auftakts und gehört zum Stück. Das Einzählen endet vor
   der Pause; anschließend liegen die Pause auf Schlag 3 und `G` auf Schlag 4.
   Danach folgen zwei vollständige 4/4-Takte in einer Wiederholung. Auch im
   zweiten Takt und nach dem Sprung bleibt der Puls konstant.
2. Abschnitt B wechselt auf 3/4. Die Anzeige und das Metronom zählen pro Takt
   `1, 2, 3`. Der wiederholte Bereich besitzt ein erstes und ein zweites
   Variantenende. Im ersten Durchlauf erklingt `[1 B c d`, im zweiten
   Durchlauf `[2 d c B`. Direkt danach muss der Wechsel auf 2/4 wirksam werden:
   `1, 2`.
3. Abschnitt C wechselt auf 6/8. Da `playback.division` absichtlich nicht
   gesetzt ist, gilt der Zähler aus `M:`: sechs gleichmäßige Schläge. Auch diese
   Passage besitzt eine Wiederholung.
4. Abschnitt D wechselt auf 12/8 und zählt zwölf gleichmäßige Schläge. Der
   Abschlusstakt wechselt zurück auf 4/4.

## Prüfpunkte

- Workbench und Player zeigen denselben Abschnitt, Takt und Durchlauf.
- Das Einzählen endet vor der notierten Anfangspause. Bei Metronom „immer“
  klickt das Wiedergabemetronom anschließend während dieser Pause weiter.
- Die Abschnittsanzeige bleibt innerhalb eines Abschnitts stehen und wechselt
  erst am nächsten nicht leeren `P:`-Namen.
- Erstes und zweites Variantenende werden in der korrekten Reihenfolge gespielt.
- Das optische Metronom stimmt in beiden Anwendungen mit den hörbaren Klicks
  überein.
- Kein Klickabstand wird an einer Wiederholungsgrenze kürzer oder länger.
- Nach jedem `M:`-Wechsel erscheint sofort die neue Schlagzahl.
- Beim Export bleibt die Blattvorgabe `Metronom: immer` erhalten.
- Optional `Schläge/Takt` lokal überschreiben und danach auf die Blattvorgabe
  zurücksetzen.
